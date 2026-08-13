import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { useEffect, useMemo, useState } from "react";
import { useCategories, useCommitments, useSavings, useTransactions } from "@/lib/store";
import type { Commitment } from "@/lib/types";
import { fmt } from "@/lib/format";
import { sortLabels } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BellRing, Pencil, Plus, Repeat, Trash2, Tag, Undo2 } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { toast } from "sonner";
import { useActiveCycle, advanceForCommitment, advanceDueDate } from "@/lib/cycle";
import {
  PROMO_WARNING_DAYS,
  cadenceLabel,
  daysUntilPromoEnd,
  hasActivePromo,
  promoAlerts,
  snoozeUntilNextLogin,
  acceptFullPricePatch,
} from "@/lib/subscriptions";
import { perCycleTotal } from "@/lib/outgoings";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions — Ledgerly" },
      {
        name: "description",
        content:
          "Track recurring subscriptions, renewal dates, categories and discounted offer prices.",
      },
      { property: "og:title", content: "Subscriptions — Ledgerly" },
      {
        property: "og:description",
        content:
          "Track recurring subscriptions, renewal dates, categories and discounted offer prices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubscriptionsPage,
  errorComponent: RouteError,
});

const BILL_POCKET = "Bill Money";

function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

function SubscriptionsPage() {
  const { items: allCommitments, add, update, remove } = useCommitments();
  const { add: addSaving } = useSavings();
  const { add: addTransaction, remove: removeTransaction, items: transactions } = useTransactions();
  const { list: categories } = useCategories();

  const cycle = useActiveCycle();
  const resetDate = format(addDays(cycle.end, 1), "yyyy-MM-dd");

  const items = useMemo(() => allCommitments.filter((c) => c.is_subscription), [allCommitments]);

  const monthlyTotal = useMemo(
    () => items.reduce((s, c) => s + (c.cadence === "annual" ? c.amount / 12 : c.amount), 0),
    [items],
  );

  const dueThisCycle = useMemo(
    () =>
      items
        .filter((c) => c.next_due_date && c.next_due_date < resetDate)
        .reduce((s, c) => s + c.amount, 0),
    [items, resetDate],
  );

  const billsDueThisCycle = useMemo(
    () =>
      allCommitments
        .filter((c) => !c.is_subscription && c.next_due_date && c.next_due_date < resetDate)
        .reduce((s, c) => s + c.amount, 0),
    [allCommitments, resetDate],
  );

  const totalOutgoings = dueThisCycle + billsDueThisCycle;

  const everyCycle = useMemo(() => perCycleTotal(allCommitments), [allCommitments]);


  const alerts = useMemo(() => promoAlerts(items), [items]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Commitment | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsItem = useMemo(
    () => items.find((i) => i.id === detailsId) ?? null,
    [items, detailsId],
  );
  const [offerFor, setOfferFor] = useState<Commitment | null>(null);
  const [payMode, setPayMode] = useState<"details" | "confirm">("details");
  const [pickerDate, setPickerDate] = useState("");

  useEffect(() => {
    if (detailsItem) {
      setPayMode("details");
      setPickerDate(detailsItem.next_due_date ?? todayISO());
    }
    // Only re-seed when a different subscription is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsId]);

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
        notes: `Auto-logged from subscription: ${c.item_name}`,
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
      toast.success("Paid · logged & deducted from Bill Money");
    } catch (err) {
      console.error("Failed to auto-log paid subscription", err);
      toast.error("Marked paid, but auto-logging failed.");
    }
    setDetailsId(null);
    setPayMode("details");
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
      toast.success("Reversed · transaction removed & Bill Money refunded");
    } catch (err) {
      console.error("Failed to undo paid subscription", err);
      toast.error("Could not fully undo. Check transactions & pocket.");
    }
    setDetailsId(null);
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
            Recurring charges
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Paid from the same <span className="font-medium">Bill Money</span> pocket as your{" "}
            <Link to="/commitments" className="underline underline-offset-2">
              commitments
            </Link>
            .
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add subscription
        </Button>
      </header>

      {alerts.length > 0 && (
        <div className="space-y-3 mb-6">
          {alerts.map((c) => {
            const days = daysUntilPromoEnd(c) ?? 0;
            return (
              <Card key={c.id} className="border-warning/40 bg-warning/5">
                <CardContent className="p-5 flex flex-wrap items-start gap-3">
                  <BellRing className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-[220px] text-sm">
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
                        await update(c.id, {
                          promo_alert_snoozed_until: snoozeUntilNextLogin(),
                        });
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-6">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Active subscriptions
            </p>
            <p className="text-2xl font-semibold tabular-nums">{items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Cost per month
            </p>
            <p className="text-2xl font-semibold tabular-nums">{fmt(monthlyTotal)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Annual plans spread over 12.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Due this cycle
            </p>
            <p className="text-2xl font-semibold tabular-nums">{fmt(dueThisCycle)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Included in your commitments shortfall.
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Total outgoings this cycle
            </p>
            <p className="text-2xl font-semibold tabular-nums">{fmt(totalOutgoings)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              bills {fmt(billsDueThisCycle)} + subs {fmt(dueThisCycle)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Every cycle (all tracked)
            </p>
            <p className="text-2xl font-semibold tabular-nums">{fmt(everyCycle.total)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {everyCycle.count} bills + subs · annual plans spread over 12
            </p>
          </CardContent>
        </Card>
      </div>


      <Card>
        <CardHeader>
          <CardTitle>All subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No subscriptions yet — add Netflix, Spotify, your gym…
            </p>
          ) : (
            <ul className="space-y-2">
              {items
                .slice()
                .sort((a, b) =>
                  (a.next_due_date ?? "9999").localeCompare(b.next_due_date ?? "9999"),
                )
                .map((c) => {
                  const promo = hasActivePromo(c);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setDetailsId(c.id)}
                        className="w-full text-left rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors px-4 py-3 flex items-center gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{c.item_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider">
                              {c.category || "—"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Repeat className="h-3 w-3" />
                              {cadenceLabel(c.cadence)}
                            </span>
                            <span>
                              {c.next_due_date
                                ? `Renews ${format(parseISO(c.next_due_date), "d MMM yyyy")}`
                                : "No renewal date"}
                            </span>
                            {promo && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning px-2 py-0.5 text-[10px]">
                                <Tag className="h-3 w-3" />
                                Offer ends {format(parseISO(c.promo_ends_on!), "d MMM")}
                                {typeof c.standard_price === "number"
                                  ? ` — then ${fmt(c.standard_price)}`
                                  : ""}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold tabular-nums">
                            {fmt(c.amount)}
                          </span>
                          <span
                            aria-label={c.paid ? "Paid this cycle" : "Unpaid"}
                            className={`inline-flex h-2.5 w-2.5 rounded-full ${
                              c.paid ? "bg-primary" : "bg-yellow-400"
                            }`}
                          />
                        </div>
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </CardContent>
      </Card>

      <SubscriptionDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        categories={categories}
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

      <NewOfferDialog
        item={offerFor}
        onClose={() => setOfferFor(null)}
        onSave={async (item, patch) => {
          await update(item.id, patch);
          setOfferFor(null);
          toast.success("New offer saved");
        }}
      />

      <Dialog
        open={!!detailsItem}
        onOpenChange={(v) => {
          if (!v) {
            setDetailsId(null);
            setPayMode("details");
          }
        }}
      >
        <DialogContent className="max-w-md">
          {detailsItem && payMode === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle className="break-words">Confirm payment reset?</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground break-words">
                  Marking{" "}
                  <span className="font-medium text-foreground">{detailsItem.item_name}</span> as
                  paid will advance its next renewal date. Choose how to roll it forward:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="flex-col h-auto py-2"
                    onClick={() => {
                      const base = detailsItem.next_due_date ?? todayISO();
                      void markPaid(detailsItem, advanceDueDate(base, "monthly"));
                    }}
                  >
                    <span className="text-sm">+1 month</span>
                    <span className="text-xs text-muted-foreground">
                      {format(
                        parseISO(advanceDueDate(detailsItem.next_due_date ?? todayISO(), "monthly")),
                        "d MMM yyyy",
                      )}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-col h-auto py-2"
                    onClick={() => {
                      const base = detailsItem.next_due_date ?? todayISO();
                      void markPaid(detailsItem, advanceDueDate(base, "four-weekly"));
                    }}
                  >
                    <span className="text-sm">+4 weeks</span>
                    <span className="text-xs text-muted-foreground">
                      {format(
                        parseISO(
                          advanceDueDate(detailsItem.next_due_date ?? todayISO(), "four-weekly"),
                        ),
                        "d MMM yyyy",
                      )}
                    </span>
                  </Button>
                </div>
                {detailsItem.cadence === "annual" && (
                  <Button
                    variant="outline"
                    className="w-full flex-col h-auto py-2"
                    onClick={() => {
                      const base = detailsItem.next_due_date ?? todayISO();
                      void markPaid(detailsItem, advanceForCommitment(base, "annual", cycle));
                    }}
                  >
                    <span className="text-sm">+1 year (annual plan)</span>
                    <span className="text-xs text-muted-foreground">
                      {format(
                        parseISO(
                          advanceForCommitment(
                            detailsItem.next_due_date ?? todayISO(),
                            "annual",
                            cycle,
                          ),
                        ),
                        "d MMM yyyy",
                      )}
                    </span>
                  </Button>
                )}
                <div className="rounded-md border border-border p-3 space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Or pick a date
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={pickerDate}
                      onChange={(e) => setPickerDate(e.target.value)}
                    />
                    <Button
                      onClick={() => pickerDate && void markPaid(detailsItem, pickerDate)}
                    >
                      Set
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setPayMode("details")}>
                  Cancel
                </Button>
              </DialogFooter>
            </>
          )}
          {detailsItem && payMode === "details" && (
            <>
              <DialogHeader>
                <DialogTitle className="break-words pr-6">{detailsItem.item_name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <Row
                  label="Price"
                  value={
                    <span className="font-semibold tabular-nums">{fmt(detailsItem.amount)}</span>
                  }
                />
                <Row label="Billing" value={cadenceLabel(detailsItem.cadence)} />
                <Row label="Category" value={detailsItem.category || "—"} />
                <Row label="Provider" value={detailsItem.store || "—"} />
                <Row label="Payment method" value={detailsItem.payment_method || "—"} />
                <Row
                  label="Next renewal"
                  value={
                    detailsItem.next_due_date
                      ? format(parseISO(detailsItem.next_due_date), "d MMM yyyy")
                      : "—"
                  }
                />
                {detailsItem.promo_ends_on && (
                  <Row
                    label="Offer"
                    value={
                      <span>
                        Ends {format(parseISO(detailsItem.promo_ends_on), "d MMM yyyy")}
                        {typeof detailsItem.standard_price === "number"
                          ? ` → ${fmt(detailsItem.standard_price)}`
                          : ""}
                      </span>
                    }
                  />
                )}
                {detailsItem.notes && (
                  <Row
                    label="Notes"
                    value={
                      <span className="italic text-muted-foreground">{detailsItem.notes}</span>
                    }
                  />
                )}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <Label htmlFor="sub-paid-toggle">Paid this cycle</Label>
                  <Switch
                    id="sub-paid-toggle"
                    checked={detailsItem.paid}
                    onCheckedChange={(v) => {
                      if (v) {
                        setPickerDate(detailsItem.next_due_date ?? todayISO());
                        setPayMode("confirm");
                      } else {
                        void unmarkPaid(detailsItem);
                      }
                    }}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await remove(detailsItem.id);
                    setDetailsId(null);
                    toast.success("Removed");
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const id = detailsItem.id;
                    setDetailsId(null);
                    await update(id, { is_subscription: false });
                    toast.success("Moved back to Commitments", {
                      action: {
                        label: "Undo",
                        onClick: () => void update(id, { is_subscription: true }),
                      },
                    });
                  }}
                >
                  <Undo2 className="h-4 w-4" /> Move to Commitments
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDetailsId(null);
                    setEditing(detailsItem);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button size="sm" onClick={() => setDetailsId(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground shrink-0">
        {label}
      </span>
      <span className="text-sm text-right break-words min-w-0">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SubscriptionDialog({
  open,
  onOpenChange,
  editing,
  categories,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Commitment | null;
  categories: string[];
  onSave: (data: Omit<Commitment, "id" | "created_at">) => void | Promise<void>;
}) {
  const [itemName, setItemName] = useState("");
  const [store, setStore] = useState("");
  const [payment, setPayment] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Subscriptions");
  const [cadence, setCadence] = useState("monthly");
  const [nextDue, setNextDue] = useState("");
  const [notes, setNotes] = useState("");
  const [onOffer, setOnOffer] = useState(false);
  const [promoEnds, setPromoEnds] = useState("");
  const [standardPrice, setStandardPrice] = useState("");

  useEffect(() => {
    if (!open) return;
    setItemName(editing?.item_name ?? "");
    setStore(editing?.store ?? "");
    setPayment(editing?.payment_method ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setCategory(
      editing?.category ??
        (categories.includes("Subscriptions")
          ? "Subscriptions"
          : (categories[0] ?? "Subscriptions")),
    );
    setCadence(editing?.cadence === "annual" ? "annual" : "monthly");
    setNextDue(editing?.next_due_date ?? "");
    setNotes(editing?.notes ?? "");
    setOnOffer(!!editing?.promo_ends_on);
    setPromoEnds(editing?.promo_ends_on ?? "");
    setStandardPrice(
      typeof editing?.standard_price === "number" ? String(editing.standard_price) : "",
    );
  }, [open, editing, categories]);

  async function submit() {
    const amt = parseFloat(amount);
    if (!itemName.trim() || !(amt >= 0)) {
      toast.error("Name and a valid price are required.");
      return;
    }
    if (onOffer && !promoEnds) {
      toast.error("Add the date the offer ends.");
      return;
    }
    const std = parseFloat(standardPrice);
    await onSave({
      item_name: itemName.trim(),
      store: store.trim(),
      payment_method: payment.trim(),
      amount: amt,
      category: category || "Subscriptions",
      last_paid_date: editing?.last_paid_date ?? null,
      next_due_date: nextDue || null,
      notes: notes.trim() || undefined,
      paid: editing?.paid ?? false,
      is_subscription: true,
      cadence,
      promo_price: onOffer ? amt : null,
      promo_ends_on: onOffer ? promoEnds : null,
      standard_price: onOffer && std > 0 ? std : null,
      promo_alert_snoozed_until: null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit subscription" : "Add subscription"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name">
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Netflix"
              />
            </Field>
            <Field label="Provider">
              <Input
                value={store}
                onChange={(e) => setStore(e.target.value)}
                placeholder="Netflix Inc."
              />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No categories yet — add one in Settings.
                    </div>
                  ) : (
                    sortLabels(categories).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Billing cycle">
              <Select value={cadence} onValueChange={setCadence}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Price you pay now">
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Next renewal date">
              <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
            </Field>
          </div>
          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="on-offer" className="text-sm">
                On a discounted offer
              </Label>
              <Switch id="on-offer" checked={onOffer} onCheckedChange={setOnOffer} />
            </div>
            {onOffer && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Offer ends on">
                    <Input
                      type="date"
                      value={promoEnds}
                      onChange={(e) => setPromoEnds(e.target.value)}
                    />
                  </Field>
                  <Field label="Price after offer">
                    <Input
                      inputMode="decimal"
                      value={standardPrice}
                      onChange={(e) => setStandardPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  You'll be reminded {PROMO_WARNING_DAYS} days before the offer ends. If you do
                  nothing, the price switches to the full price on that date.
                </p>
              </>
            )}
          </div>
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewOfferDialog({
  item,
  onClose,
  onSave,
}: {
  item: Commitment | null;
  onClose: () => void;
  onSave: (item: Commitment, patch: Partial<Commitment>) => void | Promise<void>;
}) {
  const [price, setPrice] = useState("");
  const [ends, setEnds] = useState("");
  const [standard, setStandard] = useState("");

  useEffect(() => {
    if (!item) return;
    setPrice(String(item.amount));
    setEnds("");
    setStandard(typeof item.standard_price === "number" ? String(item.standard_price) : "");
  }, [item]);

  return (
    <Dialog
      open={!!item}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle>New offer — {item.item_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="New offer price">
                  <Input
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </Field>
                <Field label="Offer ends on">
                  <Input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
                </Field>
              </div>
              <Field label="Price after this offer">
                <Input
                  inputMode="decimal"
                  value={standard}
                  onChange={(e) => setStandard(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const amt = parseFloat(price);
                  const std = parseFloat(standard);
                  if (!(amt >= 0) || !ends) {
                    toast.error("Enter the new price and the date it ends.");
                    return;
                  }
                  void onSave(item, {
                    amount: amt,
                    promo_price: amt,
                    promo_ends_on: ends,
                    standard_price: std > 0 ? std : null,
                    promo_alert_snoozed_until: null,
                  });
                }}
              >
                Save offer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
