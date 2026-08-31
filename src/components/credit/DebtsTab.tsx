import { useEffect, useMemo, useState } from "react";
import { ListSkeleton } from "@/components/ListSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

import { format } from "date-fns";
import { toast } from "sonner";
import { colorForKey } from "@/lib/colors";
import {
  Plus,
  Trash2,
  HandCoins,
  CreditCard as CreditIcon,
  Wallet,
  ChevronRight,
  ArrowUpRight,
  History,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  useCommitments,
  useDebts,
  useDebtItems,
  useIncomes,
  useLoans,
  useSavings,
  useTransactions,
} from "@/lib/store";
import type { Debt, LedgerPayment, Loan } from "@/lib/types";
import { fmt } from "@/lib/format";
import { addMonths } from "date-fns";
import { syncCommitmentAfterDebtPayment } from "@/lib/bnplSync";
import {
  todayISO,
  loanPaid,
  loanRemaining,
  debtPaid,
  debtRemaining,
  sourceLabel,
  encodeSource,
  type SourceChoice,
} from "@/lib/credit";
import { usePockets, useLedgerSync } from "@/lib/creditHooks";
import { FundingSourceDialog, HistoryList, PaymentDialog } from "@/components/credit/shared";

function DebtItemsSection({ debtId }: { debtId: string }) {
  const { items, add, remove } = useDebtItems();
  const rows = items.filter((it) => it.debt_id === debtId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const subtotal = rows.reduce((s, r) => s + r.price * r.quantity, 0);

  async function submit() {
    if (!name.trim()) return;
    try {
      await add(debtId, {
        item_name: name.trim(),
        price: parseFloat(price) || 0,
        quantity: parseInt(qty, 10) || 1,
      });
      setName("");
      setPrice("");
      setQty("1");
      setAdding(false);
    } catch (e) {
      console.error(e);
      toast.error("Could not add item");
    }
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="items" className="border-none">
        <AccordionTrigger className="text-xs py-1.5 hover:no-underline">
          <span className="flex items-center gap-1.5">
            Items ({rows.length})
            {rows.length > 0 && (
              <span className="text-muted-foreground tabular-nums">· {fmt(subtotal)}</span>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No items recorded.</p>
          ) : (
            <ul className="divide-y divide-border/60 text-xs">
              {rows.map((it) => (
                <li key={it.id} className="flex items-center justify-between py-1.5 gap-2">
                  <span className="truncate">{it.item_name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-muted-foreground tabular-nums">
                      {it.quantity} × {fmt(it.price)} = {fmt(it.quantity * it.price)}
                    </span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove(it.id)}
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {adding ? (
            <div className="mt-2 grid grid-cols-12 gap-1.5 items-center">
              <Input
                className="col-span-5 h-8 text-xs"
                placeholder="Item"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                className="col-span-3 h-8 text-xs"
                inputMode="decimal"
                placeholder="Price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <Input
                className="col-span-2 h-8 text-xs"
                inputMode="numeric"
                placeholder="Qty"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <Button size="sm" className="col-span-2 h-8 text-xs px-2" onClick={submit}>
                Add
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-7 text-xs"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3 w-3" /> Add item
            </Button>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function DebtsTab() {
  const { items, isLoading, update, remove } = useDebts();
  const { items: commitments, add: addCommitment, remove: removeCommitment } = useCommitments();
  const { addMany: addDebtItems } = useDebtItems();
  const qc = useQueryClient();
  const ledger = useLedgerSync();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [pending, setPending] = useState<{
    debt: Debt;
    amount: number;
    date: string;
    notes?: string;
  } | null>(null);

  // Kill-switch: when a BNPL/debt is fully repaid, drop any linked
  // recurring commitment so it stops appearing in future bills.
  async function maybeKillCommitment(debtId: string, settled: boolean) {
    if (!settled) return;
    const linked = commitments.filter((c) => c.debt_id === debtId);
    for (const c of linked) await removeCommitment(c.id);
  }

  const standard = items.filter((d) => d.kind === "standard");
  const bnpl = items.filter((d) => d.kind === "bnpl");

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New debt
        </Button>
      </div>

      {/* Standard debts */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Standard debts</h2>
          <span className="text-xs text-muted-foreground">
            Open-ended balances (rent arrears, IOUs, etc.)
          </span>
        </div>
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <ListSkeleton rows={2} />
            </CardContent>
          </Card>
        ) : standard.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No standard debts. Add one to track its running balance.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {standard.map((d) => {
              const paid = debtPaid(d);
              const remaining = debtRemaining(d);
              const settled = remaining <= 0.001;
              return (
                <Card key={d.id} className={settled ? "border-primary/30 bg-primary/5" : ""}>
                  <CardContent className="p-4 md:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Total: <span className="tabular-nums">{fmt(d.total_amount)}</span> · Paid:{" "}
                          <span className="tabular-nums">{fmt(paid)}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(d);
                          setOpen(true);
                        }}
                        className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="rounded-lg bg-secondary/40 p-3">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Running balance
                      </p>
                      <p className="text-2xl font-semibold tabular-nums">{fmt(remaining)}</p>
                    </div>

                    <DebtPaymentLauncher
                      disabled={settled}
                      label={`Add payment — ${d.name}`}
                      max={remaining}
                      onSubmit={(v) => setPending({ debt: d, ...v })}
                    />

                    <DebtItemsSection debtId={d.id} />

                    <Accordion type="single" collapsible>
                      <AccordionItem value="hist" className="border-none">
                        <AccordionTrigger className="text-xs py-1.5 hover:no-underline">
                          <span className="flex items-center gap-1.5">
                            <History className="h-3.5 w-3.5" /> View history (
                            {(d.payments ?? []).length})
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <HistoryList payments={d.payments ?? []} />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete debt "${d.name}"?`)) {
                            remove(d.id);
                            toast.success("Removed");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* BNPL */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">BNPL plans</h2>
          <span className="text-xs text-muted-foreground">Clearpay, PayPal Pay in 4, Klarna…</span>
        </div>
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <ListSkeleton rows={2} />
            </CardContent>
          </Card>
        ) : bnpl.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No installment plans. Add one to track each scheduled payment.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {bnpl.map((d) => {
              const totalInstallments = Math.max(1, d.installments_total ?? 4);
              const defaultAmount = d.total_amount / totalInstallments;
              const paidCount = Math.min(totalInstallments, (d.payments ?? []).length);
              const remaining = debtRemaining(d);
              const pct = (paidCount / totalInstallments) * 100;
              const settled = paidCount >= totalInstallments;
              const dates = d.installment_dates ?? [];
              const nextDate = dates[paidCount] ?? todayISO();
              return (
                <Card key={d.id} className={settled ? "border-primary/30 bg-primary/5" : ""}>
                  <CardContent className="p-4 md:p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                          {fmt(defaultAmount)} × {totalInstallments}
                          {dates[paidCount] && (
                            <> · next {format(new Date(dates[paidCount]), "d MMM")}</>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(d);
                          setOpen(true);
                        }}
                        className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Edit
                      </button>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">
                          {paidCount} of {totalInstallments} Paid
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {fmt(remaining)} left
                        </span>
                      </div>
                      <Progress value={pct} />
                    </div>

                    <DebtPaymentLauncher
                      disabled={settled}
                      label={`Pay installment — ${d.name}`}
                      defaultAmount={defaultAmount}
                      scheduledDate={nextDate}
                      max={remaining}
                      buttonIcon={<ChevronRight className="h-4 w-4" />}
                      buttonLabel="Pay Next Installment"
                      onSubmit={(v) => setPending({ debt: d, ...v })}
                    />

                    <DebtItemsSection debtId={d.id} />

                    <Accordion type="single" collapsible>
                      <AccordionItem value="hist" className="border-none">
                        <AccordionTrigger className="text-xs py-1.5 hover:no-underline">
                          <span className="flex items-center gap-1.5">
                            <History className="h-3.5 w-3.5" /> View history (
                            {(d.payments ?? []).length})
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <HistoryList payments={d.payments ?? []} />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete plan "${d.name}"?`)) {
                            remove(d.id);
                            toast.success("Removed");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <DebtDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSave={async (data, extras) => {
          if (editing) {
            await update(editing.id, data);
            toast.success("Updated");
            setOpen(false);
            return;
          }

          // ===== New debt =====
          const { data: u } = await supabase.auth.getUser();
          if (!u.user) {
            toast.error("Not signed in");
            return;
          }

          const n = Math.max(1, data.installments_total ?? 1);
          const per = data.kind === "bnpl" && n > 0 ? data.total_amount / n : 0;
          const today = todayISO();

          const initialPayments: LedgerPayment[] = [];
          if (extras.payFirstNow && extras.firstPaymentSource && data.kind === "bnpl") {
            initialPayments.push({
              id: crypto.randomUUID(),
              date: today,
              amount: per,
              type: "payment",
              source: encodeSource(extras.firstPaymentSource),
              notes: "1st installment",
            });
          }

          // Insert returning id so we can link a commitment to it.
          const { data: created, error } = await supabase
            .from("debts")
            .insert({
              user_id: u.user.id,
              name: data.name,
              kind: data.kind,
              total_amount: data.total_amount,
              installments_total: data.installments_total ?? null,
              installment_dates: (data.installment_dates ?? []) as never,
              start_date: data.start_date ?? null,
              notes: data.notes,
              payments: initialPayments as never,
            } as never)
            .select("id")
            .single();
          if (error || !created) {
            console.error(error);
            toast.error("Could not save debt");
            return;
          }
          const debtId = (created as { id: string }).id;

          // Side-effect: debit ledger when "Pay 1st now" was chosen.
          if (extras.payFirstNow && extras.firstPaymentSource && data.kind === "bnpl") {
            await ledger.debit(extras.firstPaymentSource, {
              amount: per,
              date: today,
              label: `BNPL · ${data.name} (1/${n})`,
              category: "Debt",
              notes: "1st installment",
            });
          }

          // Auto-create a linked commitment for EVERY new BNPL plan (not only
          // the pay-first-now path). Due date is the next unpaid installment.
          if (data.kind === "bnpl" && n > 0) {
            const dates = data.installment_dates ?? [];
            const paidFirst = !!(extras.payFirstNow && extras.firstPaymentSource);
            const remainingCount = paidFirst ? n - 1 : n;
            if (remainingCount > 0) {
              const nextDue =
                dates[paidFirst ? 1 : 0] ??
                dates[0] ??
                format(addMonths(new Date(today), 1), "yyyy-MM-dd");
              await addCommitment({
                item_name: `${data.name} Installment`,
                store: data.name,
                payment_method: "BNPL",
                amount: per,
                category: "Debt",
                next_due_date: nextDue,
                last_paid_date: paidFirst ? today : null,
                prev_due_date: null,
                notes: `Auto-linked to BNPL plan (${remainingCount} of ${n} remaining).`,
                paid: false,
                debt_id: debtId,
              } as never);
            }
          }

          // Insert any line items captured in the modal.
          if (extras.items && extras.items.length > 0) {
            try {
              await addDebtItems(debtId, extras.items);
            } catch (e) {
              console.error(e);
              toast.warning("Debt saved, but items could not be added");
            }
          }

          await qc.invalidateQueries({ queryKey: ["debts"] });
          toast.success(extras.payFirstNow ? "Debt added · 1st installment paid" : "Added");
          setOpen(false);
        }}
      />

      <FundingSourceDialog
        open={!!pending}
        onOpenChange={(v) => {
          if (!v) setPending(null);
        }}
        title={pending ? `Payment funded from` : ""}
        direction="out"
        onConfirm={async (choice) => {
          if (!pending) return;
          try {
            const next: LedgerPayment[] = [
              ...(pending.debt.payments ?? []),
              {
                id: crypto.randomUUID(),
                date: pending.date,
                amount: pending.amount,
                notes: pending.notes,
                type: "payment",
                source: encodeSource(choice),
              },
            ];
            await update(pending.debt.id, { payments: next });
            await ledger.debit(choice, {
              amount: pending.amount,
              date: pending.date,
              label:
                pending.debt.kind === "bnpl"
                  ? `BNPL · ${pending.debt.name}`
                  : `Debt · ${pending.debt.name}`,
              category: "Debt",
              notes: pending.notes,
            });

            // Sync linked commitment: mark paid + advance to next installment.
            const updatedDebt: Debt = { ...pending.debt, payments: next };
            if (pending.debt.kind === "bnpl") {
              try {
                await syncCommitmentAfterDebtPayment(updatedDebt, pending.date);
                qc.invalidateQueries({ queryKey: ["commitments"] });
              } catch (err) {
                console.error("Commitment sync failed", err);
              }
            }

            // Kill-switch: drop the linked recurring commitment when settled.
            const remainingAfter = debtRemaining(updatedDebt);
            const installmentsDone =
              pending.debt.kind === "bnpl" &&
              pending.debt.installments_total != null &&
              next.filter((p) => p.type !== "topup").length >= pending.debt.installments_total;
            await maybeKillCommitment(pending.debt.id, remainingAfter <= 0.001 || installmentsDone);

            toast.success("Payment logged");
          } catch (e) {
            console.error(e);
            toast.error("Something went wrong");
          } finally {
            setPending(null);
          }
        }}
      />
    </div>
  );
}

function DebtPaymentLauncher({
  disabled,
  label,
  defaultAmount,
  defaultDate,
  scheduledDate,
  max,
  onSubmit,
  buttonIcon,
  buttonLabel,
}: {
  disabled?: boolean;
  label: string;
  defaultAmount?: number;
  defaultDate?: string;
  scheduledDate?: string | null;
  max: number;
  onSubmit: (v: { amount: number; date: string; notes?: string }) => void;
  buttonIcon?: React.ReactNode;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
        {buttonIcon ?? <Plus className="h-4 w-4" />} {buttonLabel ?? "Add Payment"}
      </Button>
      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        defaultAmount={defaultAmount}
        defaultDate={defaultDate}
        scheduledDate={scheduledDate}
        max={max}
        onSave={(v) => {
          setOpen(false);
          onSubmit(v);
        }}
      />
    </>
  );
}

function DebtDialog({
  open,
  onOpenChange,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Debt | null;
  onSave: (
    data: Omit<Debt, "id" | "created_at" | "payments">,
    extras: {
      payFirstNow: boolean;
      firstPaymentSource: SourceChoice | null;
      items: Array<{ item_name: string; price: number; quantity: number }>;
    },
  ) => void | Promise<void>;
}) {
  const pockets = usePockets();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"standard" | "bnpl">("standard");
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("4");
  const [startDate, setStartDate] = useState(todayISO());
  const [dates, setDates] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [payFirstNow, setPayFirstNow] = useState(false);
  const [sourceValue, setSourceValue] = useState<string>("main");
  const [itemRows, setItemRows] = useState<
    Array<{ item_name: string; price: string; quantity: string }>
  >([]);
  const [totalDirty, setTotalDirty] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setKind(editing?.kind ?? "standard");
      setAmount(editing ? String(editing.total_amount) : "");
      setInstallments(editing?.installments_total ? String(editing.installments_total) : "4");
      setStartDate(editing?.start_date ?? todayISO());
      setDates(editing?.installment_dates ?? []);
      setNotes(editing?.notes ?? "");
      setPayFirstNow(false);
      setSourceValue("main");
      setItemRows([]);
      setTotalDirty(!!editing);
    }
  }, [open, editing]);

  // Compute items total
  const itemsTotal = useMemo(() => {
    return itemRows.reduce((s, r) => {
      const p = parseFloat(r.price) || 0;
      const q = parseInt(r.quantity, 10) || 0;
      return s + p * q;
    }, 0);
  }, [itemRows]);

  // Auto-mirror total from items when user hasn't manually edited it.
  useEffect(() => {
    if (editing) return;
    if (totalDirty) return;
    if (itemRows.length === 0) return;
    setAmount(itemsTotal > 0 ? itemsTotal.toFixed(2) : "");
  }, [itemsTotal, totalDirty, editing, itemRows.length]);

  // Keep date array length aligned with installments count.
  const n = parseInt(installments, 10) || 4;
  useEffect(() => {
    if (kind !== "bnpl") return;
    setDates((prev) => {
      const out = [...prev];
      while (out.length < n) {
        const base = new Date(startDate || todayISO());
        base.setMonth(base.getMonth() + out.length);
        out.push(format(base, "yyyy-MM-dd"));
      }
      return out.slice(0, n);
    });
  }, [kind, n, startDate]);

  const showPayFirst = !editing && kind === "bnpl";
  const amtNum = parseFloat(amount);
  const perInstallment = showPayFirst && amtNum > 0 ? amtNum / n : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit debt" : "New debt"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rent arrears, Clearpay – Nike"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as "standard" | "bnpl")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard debt</SelectItem>
                  <SelectItem value="bnpl">BNPL plan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Total (£)
              </Label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setTotalDirty(true);
                }}
                placeholder="0.00"
              />
              {!editing &&
                itemRows.length > 0 &&
                totalDirty &&
                itemsTotal > 0 &&
                Math.abs((parseFloat(amount) || 0) - itemsTotal) > 0.005 && (
                  <p className="text-[11px] text-amber-600">
                    Items total {fmt(itemsTotal)} doesn't match.{" "}
                    <button
                      type="button"
                      className="underline hover:no-underline"
                      onClick={() => {
                        setAmount(itemsTotal.toFixed(2));
                        setTotalDirty(false);
                      }}
                    >
                      Use items total
                    </button>
                  </p>
                )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Start date
            </Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          {kind === "bnpl" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Installments
                </Label>
                <Select value={installments} onValueChange={setInstallments}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 6, 8, 12].map((nn) => (
                      <SelectItem key={nn} value={String(nn)}>
                        {nn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Scheduled due dates
                </Label>
                <div className="space-y-2">
                  {dates.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-12">#{i + 1}</span>
                      <Input
                        type="date"
                        value={d}
                        onChange={(e) => {
                          const next = [...dates];
                          next[i] = e.target.value;
                          setDates(next);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {showPayFirst && (
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 space-y-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 accent-primary"
                  checked={payFirstNow}
                  onChange={(e) => setPayFirstNow(e.target.checked)}
                />
                <span className="text-sm">
                  <span className="font-medium">Pay 1st installment now</span>
                  {perInstallment > 0 && (
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {fmt(perInstallment)} taken today · remaining {n - 1} added to Commitments
                    </span>
                  )}
                </span>
              </label>
              {payFirstNow && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Source pocket
                  </Label>
                  <Select value={sourceValue} onValueChange={setSourceValue}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">Main balance</SelectItem>
                      {pockets.map((p) => (
                        <SelectItem key={p} value={`pocket:${p}`}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-sm"
                              style={{ backgroundColor: colorForKey(p) }}
                            />
                            Pocket · {p}
                          </span>
                        </SelectItem>
                      ))}
                      <SelectItem value="other">Other / Do not deduct</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {!editing && (
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Items (optional)
                </Label>
                {itemRows.length > 0 && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    Sum {fmt(itemsTotal)}
                  </span>
                )}
              </div>
              {itemRows.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Add line items to itemize this debt. Total auto-fills from the sum.
                </p>
              )}
              <div className="space-y-2">
                {itemRows.map((r, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      className="col-span-6"
                      placeholder="Item name"
                      value={r.item_name}
                      onChange={(e) => {
                        const next = [...itemRows];
                        next[i] = { ...next[i], item_name: e.target.value };
                        setItemRows(next);
                      }}
                    />
                    <Input
                      className="col-span-3"
                      inputMode="decimal"
                      placeholder="Price"
                      value={r.price}
                      onChange={(e) => {
                        const next = [...itemRows];
                        next[i] = { ...next[i], price: e.target.value };
                        setItemRows(next);
                      }}
                    />
                    <Input
                      className="col-span-2"
                      inputMode="numeric"
                      placeholder="Qty"
                      value={r.quantity}
                      onChange={(e) => {
                        const next = [...itemRows];
                        next[i] = { ...next[i], quantity: e.target.value };
                        setItemRows(next);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="col-span-1 h-9 w-9"
                      onClick={() => setItemRows(itemRows.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  setItemRows([...itemRows, { item_name: "", price: "", quantity: "1" }])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const amt = parseFloat(amount);
              if (!name.trim() || !(amt >= 0)) {
                toast.error("Name and a valid amount are required.");
                return;
              }
              const firstPaymentSource: SourceChoice | null =
                showPayFirst && payFirstNow
                  ? sourceValue === "main"
                    ? { kind: "main" }
                    : sourceValue === "other"
                      ? { kind: "other" }
                      : { kind: "pocket", name: sourceValue.slice(7) }
                  : null;
              onSave(
                {
                  name: name.trim(),
                  kind,
                  total_amount: amt,
                  installments_total: kind === "bnpl" ? n : null,
                  installment_dates: kind === "bnpl" ? dates.slice(0, n) : [],
                  start_date: startDate || null,
                  notes: notes.trim() || undefined,
                },
                {
                  payFirstNow: showPayFirst && payFirstNow,
                  firstPaymentSource,
                  items: editing
                    ? []
                    : itemRows
                        .map((r) => ({
                          item_name: r.item_name.trim(),
                          price: parseFloat(r.price) || 0,
                          quantity: parseInt(r.quantity, 10) || 1,
                        }))
                        .filter((r) => r.item_name.length > 0),
                },
              );
            }}
          >
            {editing ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
