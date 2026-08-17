import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { useMemo, useState } from "react";
import { useCategories, useCommitments, useSavings, useTransactions } from "@/lib/store";
import { syncDebtAfterCommitmentPayment, undoDebtPaymentForCommitment } from "@/lib/bnplSync";
import { useQueryClient } from "@tanstack/react-query";
import type { Commitment } from "@/lib/types";
import { fmt } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BellRing, Plus } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { toast } from "sonner";
import { useActiveCycle } from "@/lib/cycle";
import { MoveToSubscriptionsCard } from "@/components/MoveToSubscriptionsCard";
import { perCycleTotal } from "@/lib/outgoings";
import {
  acceptFullPricePatch,
  daysUntilPromoEnd,
  promoAlerts,
  snoozeUntilNextLogin,
} from "@/lib/subscriptions";
import { OutgoingsSummary } from "@/components/outgoings/OutgoingsSummary";
import { OutgoingsList, OutgoingsLegend } from "@/components/outgoings/OutgoingsList";
import { OutgoingDialog } from "@/components/outgoings/OutgoingDialog";
import { OutgoingDetailsDialog } from "@/components/outgoings/OutgoingDetailsDialog";
import { PromoOfferDialog } from "@/components/outgoings/PromoOfferDialog";
import { BILL_POCKET, todayISO } from "@/components/outgoings/shared";

type View = "all" | "subs" | "bills";

export const Route = createFileRoute("/commitments")({
  validateSearch: (search: Record<string, unknown>): { view?: View } => {
    const v = search.view;
    return v === "subs" || v === "bills" || v === "all" ? { view: v } : {};
  },
  head: () => ({
    meta: [
      { title: "Outgoings — Ledgerly" },
      {
        name: "description",
        content: "One place for recurring bills and subscriptions, due dates and payment status.",
      },
      { property: "og:title", content: "Outgoings — Ledgerly" },
      {
        property: "og:description",
        content: "One place for recurring bills and subscriptions, due dates and payment status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OutgoingsPage,
  errorComponent: RouteError,
});

function OutgoingsPage() {
  const { view = "all" } = Route.useSearch();
  const navigate = useNavigate({ from: "/commitments" });

  const { items: allItems, add, update, remove } = useCommitments();
  const { items: savings, add: addSaving } = useSavings();
  const { items: transactions, add: addTransaction, remove: removeTransaction } = useTransactions();
  const { list: categories } = useCategories();
  const qc = useQueryClient();

  const bills = useMemo(() => allItems.filter((c) => !c.is_subscription), [allItems]);
  const subscriptions = useMemo(() => allItems.filter((c) => c.is_subscription), [allItems]);

  const cycle = useActiveCycle();
  const resetDate = format(addDays(cycle.end, 1), "yyyy-MM-dd");

  const billPocketBalance = useMemo(
    () =>
      savings
        .filter((s) => s.account.trim().toLowerCase() === BILL_POCKET.toLowerCase())
        .reduce((sum, s) => sum + (s.kind === "deposit" ? s.amount : -s.amount), 0),
    [savings],
  );

  // Paying a row rolls next_due_date forward, so paid rows fall back to
  // prev_due_date — the date they were actually due in THIS cycle.
  const cycleDate = (i: Commitment) =>
    (i.paid ? (i.prev_due_date ?? i.next_due_date) : i.next_due_date) ?? null;
  const inCycle = (i: Commitment) => {
    const d = cycleDate(i);
    return !!d && d < resetDate;
  };

  const billsDue = useMemo(
    () => bills.filter(inCycle).reduce((s, i) => s + i.amount, 0),
    [bills, resetDate],
  );
  const subsDue = useMemo(
    () => subscriptions.filter(inCycle).reduce((s, i) => s + i.amount, 0),
    [subscriptions, resetDate],
  );
  const paidThisCycle = useMemo(
    () => allItems.filter((i) => i.paid && inCycle(i)).reduce((s, i) => s + i.amount, 0),
    [allItems, resetDate],
  );
  const everyCycle = useMemo(() => perCycleTotal(allItems, cycle.type), [allItems, cycle.type]);

  const leftToPay = useMemo(
    () =>
      allItems
        .filter((i) => !i.paid && i.next_due_date && i.next_due_date < resetDate)
        .reduce((s, i) => s + i.amount, 0),
    [allItems, resetDate],
  );

  // Waterfall: allocate Bill Money down the unpaid, due-this-cycle rows by date.
  const fundedMap = useMemo(() => {
    const unpaidSorted = allItems
      .filter((i) => !i.paid && i.next_due_date && i.next_due_date < resetDate)
      .slice()
      .sort((a, b) => (a.next_due_date ?? "9999").localeCompare(b.next_due_date ?? "9999"));
    let remaining = billPocketBalance;
    const map: Record<string, boolean> = {};
    for (const c of unpaidSorted) {
      if (remaining >= c.amount) {
        map[c.id] = true;
        remaining -= c.amount;
      } else {
        map[c.id] = false;
      }
    }
    return map;
  }, [allItems, billPocketBalance, resetDate]);

  const alerts = useMemo(() => promoAlerts(subscriptions), [subscriptions]);

  const visible = view === "subs" ? subscriptions : view === "bills" ? bills : allItems;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Commitment | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [offerFor, setOfferFor] = useState<Commitment | null>(null);
  const detailsItem = useMemo(
    () => allItems.find((i) => i.id === detailsId) ?? null,
    [allItems, detailsId],
  );

  async function markPaid(c: Commitment, newDue: string) {
    const paidDate = todayISO();
    await update(c.id, {
      paid: true,
      last_paid_date: paidDate,
      prev_due_date: c.next_due_date ?? null,
      next_due_date: newDue,
    });
    try {
      await addTransaction({
        date: paidDate,
        retailer: c.item_name,
        total_amount: c.amount,
        receipt_attached: false,
        receipt_type: "None",
        receipt_location: "",
        notes: `Auto-logged from ${c.is_subscription ? "subscription" : "commitment"}: ${c.item_name}`,
        commitment_id: c.id,
        items: [
          {
            id: crypto.randomUUID(),
            item_name: c.item_name,
            price: c.amount,
            category: c.category || "Subscriptions",
          },
        ],
      });
      await addSaving({
        date: paidDate,
        kind: "withdrawal",
        amount: c.amount,
        account: BILL_POCKET,
        notes: `Auto-deducted for ${c.item_name}`,
      });
    } catch (err) {
      console.error("Failed to auto-log paid outgoing", err);
      toast.error("Marked paid, but auto-logging failed.");
    }
    if (c.debt_id) {
      try {
        await syncDebtAfterCommitmentPayment(c, paidDate, `pocket:${BILL_POCKET}`);
        qc.invalidateQueries({ queryKey: ["debts"] });
      } catch (err) {
        console.error("Debt sync failed", err);
      }
    }
    toast.success("Paid · logged & deducted from Bill Money");
    setDetailsId(null);
  }

  async function unmarkPaid(c: Commitment) {
    try {
      const linked = transactions.filter((t) => t.commitment_id === c.id);
      for (const t of linked) await removeTransaction(t.id);
      const refundAmount = linked.reduce((s, t) => s + t.total_amount, 0) || c.amount;
      await addSaving({
        date: todayISO(),
        kind: "deposit",
        amount: refundAmount,
        account: BILL_POCKET,
        notes: `Refund — unmarked ${c.item_name}`,
      });
      await update(c.id, {
        paid: false,
        last_paid_date: null,
        next_due_date: c.prev_due_date ?? c.next_due_date ?? null,
        prev_due_date: null,
      });
      if (c.debt_id) {
        try {
          await undoDebtPaymentForCommitment(c);
          qc.invalidateQueries({ queryKey: ["debts"] });
        } catch (err) {
          console.error("Debt undo failed", err);
        }
      }
      toast.success("Reversed · transaction removed & Bill Money refunded");
    } catch (err) {
      console.error("Failed to undo paid outgoing", err);
      toast.error("Could not fully undo. Check transactions & pocket.");
    }
    setDetailsId(null);
  }

  const filters: { key: View; label: string; count: number }[] = [
    { key: "all", label: "All outgoings", count: allItems.length },
    { key: "subs", label: "Subscriptions", count: subscriptions.length },
    { key: "bills", label: "Bills", count: bills.length },
  ];

  return (
    <div className="p-0 md:p-4 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
            Recurring money out
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold">Outgoings</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Bills and subscriptions, all paid from your{" "}
            <span className="font-medium">Bill Money</span> pocket.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add {view === "subs" ? "subscription" : "outgoing"}
        </Button>
      </header>

      <OutgoingsSummary
        cycleStart={cycle.start}
        cycleEnd={cycle.end}
        cycleOverridden={cycle.isOverridden}
        bills={billsDue}
        subs={subsDue}
        billsCount={bills.length}
        subsCount={subscriptions.length}
        paid={paidThisCycle}
        leftToPay={leftToPay}
        everyCycleTotal={everyCycle.total}
        everyCycleCount={everyCycle.count}
        billPocketBalance={billPocketBalance}
      />

      {alerts.length > 0 && view !== "bills" && (
        <div className="space-y-3 mb-6">
          {alerts.map((c) => {
            const days = daysUntilPromoEnd(c) ?? 0;
            return (
              <Card key={c.id} className="border-warning/40 bg-warning/5">
                <CardContent className="p-5 flex flex-wrap items-start gap-3">
                  <BellRing className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-[220px] text-sm break-words">
                    <p className="font-semibold">
                      {c.item_name} —{" "}
                      {days > 0
                        ? `offer ends in ${days} day${days === 1 ? "" : "s"}`
                        : "offer ends today"}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      {fmt(c.amount)} now
                      {typeof c.standard_price === "number"
                        ? ` · rises to ${fmt(c.standard_price)} on ${format(parseISO(c.promo_ends_on!), "d MMM")}`
                        : ""}
                      . Shop around, log a new offer, or let it renew.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setOfferFor(c)}>
                      Log new offer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await update(c.id, { promo_alert_snoozed_until: snoozeUntilNextLogin() });
                        toast.success("Snoozed until your next visit");
                      }}
                    >
                      Snooze
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await update(c.id, acceptFullPricePatch(c));
                        toast.success("Will continue at the full price");
                      }}
                    >
                      Let it renew
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => navigate({ search: f.key === "all" ? {} : { view: f.key } })}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              view === f.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-xs opacity-70 tabular-nums">{f.count}</span>
          </button>
        ))}
      </div>

      <OutgoingsLegend />

      {view !== "subs" && <MoveToSubscriptionsCard items={bills} update={update} />}

      <Card>
        <CardHeader>
          <CardTitle>
            {view === "subs" ? "Subscriptions" : view === "bills" ? "Bills" : "All outgoings"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OutgoingsList
            items={visible}
            resetDate={resetDate}
            fundedMap={fundedMap}
            onSelect={setDetailsId}
            emptyLabel={
              view === "subs"
                ? "No subscriptions yet — add Netflix, Spotify, your gym…"
                : view === "bills"
                  ? "No bills yet."
                  : "Nothing tracked yet."
            }
          />
        </CardContent>
      </Card>

      <OutgoingDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        categories={categories}
        defaultSubscription={view === "subs"}
        onSave={async (data) => {
          if (editing) {
            await update(editing.id, data);
            toast.success("Updated");
          } else {
            await add(data);
            toast.success("Added");
          }
          setFormOpen(false);
        }}
      />

      <PromoOfferDialog
        item={offerFor}
        onClose={() => setOfferFor(null)}
        onSave={async (item, patch) => {
          await update(item.id, patch);
          setOfferFor(null);
          toast.success("New offer saved");
        }}
      />

      <OutgoingDetailsDialog
        item={detailsItem}
        cycle={cycle}
        onClose={() => setDetailsId(null)}
        onEdit={(c) => {
          setDetailsId(null);
          setEditing(c);
          setFormOpen(true);
        }}
        onDelete={async (id) => {
          await remove(id);
          setDetailsId(null);
          toast.success("Removed");
        }}
        onConfirmReset={markPaid}
        onUnmarkPaid={unmarkPaid}
        onLogOffer={(c) => {
          setDetailsId(null);
          setOfferFor(c);
        }}
        onToggleType={async (c) => {
          setDetailsId(null);
          const next = !c.is_subscription;
          await update(c.id, {
            is_subscription: next,
            ...(next ? { cadence: c.cadence === "annual" ? "annual" : "monthly" } : {}),
          });
          toast.success(next ? "Now a subscription" : "Moved back to bills", {
            action: {
              label: "Undo",
              onClick: () => void update(c.id, { is_subscription: !next }),
            },
          });
        }}
      />
    </div>
  );
}
