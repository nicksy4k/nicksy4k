import { useEffect, useMemo, useState } from "react";
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
  CalendarClock,
  History,
} from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import {
  CADENCE_LABELS,
  buildLoanPlan,
  hasPlan,
  stepDate,
  type LoanCadence,
} from "@/lib/loanPlan";

/** Whole days until a yyyy-MM-dd date (negative once overdue). */
function dueInDays(iso: string): number {
  return differenceInCalendarDays(new Date(iso), new Date(todayISO()));
}

function dueLabel(iso: string): string {
  const d = dueInDays(iso);
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `In ${d} days`;
}


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

export function OwedToMeTab() {
  const { items, add, update, remove } = useLoans();
  const ledger = useLedgerSync();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);

  // Pending action awaiting a funding-source choice.
  const [planFor, setPlanFor] = useState<Loan | null>(null);

  const [pending, setPending] = useState<
    | { kind: "create"; draft: Omit<Loan, "id" | "created_at" | "payments"> }
    | { kind: "topup"; loan: Loan; amount: number; date: string; notes?: string }
    | { kind: "repay"; loan: Loan; amount: number; date: string; notes?: string }
    | null
  >(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New loan
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No loans tracked yet. Log money you've lent out to keep tabs on repayments.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((l) => {
            const remaining = loanRemaining(l);
            const paid = loanPaid(l);
            const pct = l.total_amount > 0 ? Math.min(100, (paid / l.total_amount) * 100) : 0;
            const settled = remaining <= 0.001;
            const plan = buildLoanPlan(l);
            return (
              <Card key={l.id} className={settled ? "border-primary/30 bg-primary/5" : ""}>
                <CardContent className="p-4 md:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{l.person_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Loan: <span className="tabular-nums">{fmt(l.total_amount)}</span>
                        {l.start_date && <> · {format(new Date(l.start_date), "d MMM yyyy")}</>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(l);
                        setOpen(true);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        Remaining
                      </span>
                      <span className="text-xl font-semibold tabular-nums">{fmt(remaining)}</span>
                    </div>
                    <Progress value={pct} className="mt-2" />
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {fmt(paid)} of {fmt(l.total_amount)} repaid
                    </p>
                  </div>

                  {plan ? (
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                      {plan.nextDue ? (
                        <>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs uppercase tracking-wider text-muted-foreground">
                              Next payment
                            </span>
                            <span className="font-semibold tabular-nums">
                              {fmt(plan.nextDue.amount - plan.nextDue.covered)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="text-muted-foreground">
                              {format(new Date(plan.nextDue.dueDate), "d MMM yyyy")}
                            </span>
                            <span
                              className={
                                plan.overdueBy > 0
                                  ? "rounded px-1.5 py-0.5 bg-destructive/15 text-destructive"
                                  : dueInDays(plan.nextDue.dueDate) <= 3
                                    ? "rounded px-1.5 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                    : "rounded px-1.5 py-0.5 bg-muted text-muted-foreground"
                              }
                            >
                              {dueLabel(plan.nextDue.dueDate)}
                            </span>
                            <span className="text-muted-foreground">
                              {plan.paidCount} of {plan.totalCount} paid ·{" "}
                              {CADENCE_LABELS[l.plan_cadence as LoanCadence]}
                            </span>
                          </div>
                          {plan.projectedClearDate && (
                            <p className="text-[11px] text-muted-foreground">
                              On track to be repaid by{" "}
                              <span className="font-medium text-foreground">
                                {format(new Date(plan.projectedClearDate), "d MMM yyyy")}
                              </span>
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Plan complete — nothing left to pay.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setPlanFor(l)}
                        className="text-[11px] underline text-muted-foreground hover:text-foreground"
                      >
                        Adjust plan
                      </button>
                    </div>
                  ) : (
                    !settled && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => setPlanFor(l)}
                      >
                        <CalendarClock className="h-4 w-4" /> Add payment plan
                      </Button>
                    )
                  )}

                  <RepaymentLauncher
                    disabled={settled}
                    label={`Log repayment from ${l.person_name}`}
                    max={remaining}
                    defaultAmount={
                      plan?.nextDue
                        ? Math.min(remaining, plan.nextDue.amount - plan.nextDue.covered)
                        : undefined
                    }
                    scheduledDate={plan?.nextDue?.dueDate ?? null}
                    onSubmit={({ amount, date, notes }) =>
                      setPending({ kind: "repay", loan: l, amount, date, notes })
                    }
                  />

                  <TopUpLauncher
                    label={`Top up ${l.person_name}'s loan`}
                    onSubmit={({ amount, date, notes }) =>
                      setPending({ kind: "topup", loan: l, amount, date, notes })
                    }
                  />

                  <Accordion type="single" collapsible>
                    {plan && (
                      <AccordionItem value="plan" className="border-none">
                        <AccordionTrigger className="text-xs py-1.5 hover:no-underline">
                          <span className="flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5" /> Payment schedule (
                            {plan.totalCount})
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="divide-y divide-border/60">
                            {plan.schedule.map((s) => (
                              <li
                                key={s.index}
                                className="flex items-center justify-between gap-3 py-1.5 text-xs"
                              >
                                <span className="text-muted-foreground">
                                  #{s.index} · {format(new Date(s.dueDate), "d MMM yyyy")}
                                </span>
                                <span className="flex items-center gap-2">
                                  <span className="tabular-nums">{fmt(s.amount)}</span>
                                  <span
                                    className={
                                      s.status === "paid"
                                        ? "rounded px-1.5 py-0.5 bg-primary/15 text-primary"
                                        : s.status === "part"
                                          ? "rounded px-1.5 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                          : s.status === "due"
                                            ? "rounded px-1.5 py-0.5 bg-destructive/15 text-destructive"
                                            : "rounded px-1.5 py-0.5 bg-muted text-muted-foreground"
                                    }
                                  >
                                    {s.status === "part"
                                      ? `Part · ${fmt(s.covered)}`
                                      : s.status === "paid"
                                        ? "Paid"
                                        : s.status === "due"
                                          ? "Due"
                                          : "Upcoming"}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                    <AccordionItem value="hist" className="border-none">
                      <AccordionTrigger className="text-xs py-1.5 hover:no-underline">
                        <span className="flex items-center gap-1.5">
                          <History className="h-3.5 w-3.5" /> View history (
                          {(l.payments ?? []).length})
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <HistoryList payments={l.payments ?? []} />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>


                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete loan to ${l.person_name}?`)) {
                          remove(l.id);
                          toast.success("Loan removed");
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

      <PlanDialog
        loan={planFor}
        onOpenChange={(v) => {
          if (!v) setPlanFor(null);
        }}
        onSave={async (patch) => {
          if (!planFor) return;
          await update(planFor.id, patch);
          setPlanFor(null);
          toast.success(patch.plan_amount ? "Payment plan saved" : "Payment plan removed");
        }}
      />

      <LoanDialog

        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSave={async (draft) => {
          if (editing) {
            await update(editing.id, draft);
            toast.success("Loan updated");
            setOpen(false);
          } else {
            // New loan = money going OUT — ask for funding source.
            setOpen(false);
            setPending({ kind: "create", draft });
          }
        }}
      />

      <FundingSourceDialog
        open={!!pending}
        onOpenChange={(v) => {
          if (!v) setPending(null);
        }}
        title={
          pending?.kind === "create"
            ? "Loan funded from"
            : pending?.kind === "topup"
              ? "Top-up funded from"
              : pending?.kind === "repay"
                ? "Repayment goes to"
                : ""
        }
        direction={pending?.kind === "repay" ? "in" : "out"}
        onConfirm={async (choice) => {
          if (!pending) return;
          try {
            if (pending.kind === "create") {
              const date = pending.draft.start_date ?? todayISO();
              await add({ ...pending.draft, payments: [] });
              await ledger.debit(choice, {
                amount: pending.draft.total_amount,
                date,
                label: `Loan to ${pending.draft.person_name}`,
                category: "Loans",
              });
              toast.success("Loan added");
            } else if (pending.kind === "topup") {
              const next: LedgerPayment[] = [
                ...(pending.loan.payments ?? []),
                {
                  id: crypto.randomUUID(),
                  date: pending.date,
                  amount: pending.amount,
                  notes: pending.notes,
                  type: "topup",
                  source: encodeSource(choice),
                },
              ];
              await update(pending.loan.id, {
                total_amount: pending.loan.total_amount + pending.amount,
                payments: next,
              });
              await ledger.debit(choice, {
                amount: pending.amount,
                date: pending.date,
                label: `Top-up loan · ${pending.loan.person_name}`,
                category: "Loans",
                notes: pending.notes,
              });
              toast.success("Top-up logged");
            } else if (pending.kind === "repay") {
              const next: LedgerPayment[] = [
                ...(pending.loan.payments ?? []),
                {
                  id: crypto.randomUUID(),
                  date: pending.date,
                  amount: pending.amount,
                  notes: pending.notes,
                  type: "payment",
                  source: encodeSource(choice),
                },
              ];
              // Advance the plan's next due date by however many instalments
              // this payment completed, so early/extra payments pull it forward.
              const before = buildLoanPlan(pending.loan);
              const after = buildLoanPlan({ ...pending.loan, payments: next });
              const patch: Partial<Loan> = { payments: next };
              if (before?.nextDue && after) {
                const advanced = after.paidCount - before.paidCount;
                if (advanced > 0) {
                  patch.plan_next_due = after.nextDue
                    ? stepDate(
                        before.nextDue.dueDate,
                        pending.loan.plan_cadence as LoanCadence,
                        advanced,
                      )
                    : null;
                }
              }
              await update(pending.loan.id, patch);

              await ledger.credit(choice, {
                amount: pending.amount,
                date: pending.date,
                label: `Repayment · ${pending.loan.person_name}`,
                category: "Loan repayment",
                notes: pending.notes,
              });
              toast.success("Repayment logged");
            }
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

function RepaymentLauncher({
  disabled,
  label,
  max,
  defaultAmount,
  scheduledDate,
  onSubmit,
}: {
  disabled: boolean;
  label: string;
  max: number;
  defaultAmount?: number;
  scheduledDate?: string | null;
  onSubmit: (v: { amount: number; date: string; notes?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
        <Wallet className="h-4 w-4" /> Log Repayment
      </Button>
      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        max={max}
        defaultAmount={defaultAmount}
        scheduledDate={scheduledDate}
        onSave={(v) => {
          setOpen(false);
          onSubmit(v);
        }}
      />
    </>
  );
}

/** Create or adjust a repayment plan for a loan. */
function PlanDialog({
  loan,
  onOpenChange,
  onSave,
}: {
  loan: Loan | null;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: Partial<Loan>) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<LoanCadence>("monthly");
  const [firstDue, setFirstDue] = useState(todayISO());

  useEffect(() => {
    if (!loan) return;
    setAmount(loan.plan_amount ? String(loan.plan_amount) : "");
    setCadence((loan.plan_cadence as LoanCadence) ?? "monthly");
    setFirstDue(loan.plan_next_due ?? loan.plan_start_date ?? todayISO());
  }, [loan]);

  const remaining = loan ? loanRemaining(loan) : 0;
  const per = parseFloat(amount);
  const count = per > 0 ? Math.max(1, Math.ceil((remaining - 0.005) / per)) : 0;
  const clearDate = count > 0 ? stepDate(firstDue, cadence, count - 1) : null;

  return (
    <Dialog open={!!loan} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {loan && hasPlan(loan) ? "Adjust payment plan" : "Set up payment plan"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Payment amount (£)
              </Label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                How often
              </Label>
              <Select value={cadence} onValueChange={(v) => setCadence(v as LoanCadence)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CADENCE_LABELS) as LoanCadence[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CADENCE_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              First payment due
            </Label>
            <Input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            {count > 0 && clearDate ? (
              <>
                {count} payment{count === 1 ? "" : "s"} of {fmt(per)} clears the{" "}
                {fmt(remaining)} outstanding by{" "}
                <span className="font-medium text-foreground">
                  {format(new Date(clearDate), "d MMM yyyy")}
                </span>
                .
              </>
            ) : (
              "Enter a payment amount to see how long repayment will take."
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {loan && hasPlan(loan) && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={() =>
                onSave({ plan_amount: null, plan_cadence: null, plan_start_date: null, plan_next_due: null })
              }
            >
              Remove plan
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!(per > 0)) {
                toast.error("Enter a payment amount.");
                return;
              }
              onSave({
                plan_amount: per,
                plan_cadence: cadence,
                plan_start_date: firstDue,
                plan_next_due: firstDue,
              });
            }}
          >
            Save plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function TopUpLauncher({
  label,
  onSubmit,
}: {
  label: string;
  onSubmit: (v: { amount: number; date: string; notes?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <ArrowUpRight className="h-4 w-4" /> Top Up Loan
      </Button>
      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        max={Number.POSITIVE_INFINITY}
        hideRemaining
        onSave={(v) => {
          setOpen(false);
          onSubmit(v);
        }}
      />
    </>
  );
}

function LoanDialog({
  open,
  onOpenChange,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Loan | null;
  onSave: (data: Omit<Loan, "id" | "created_at" | "payments">) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setName(editing?.person_name ?? "");
      setAmount(editing ? String(editing.total_amount) : "");
      setStartDate(editing?.start_date ?? todayISO());
      setNotes(editing?.notes ?? "");
    }
  }, [open, editing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit loan" : "New loan"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Person</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {editing ? "Total (£)" : "Starting amount (£)"}
              </Label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Loan date
              </Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
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
              onSave({
                person_name: name.trim(),
                total_amount: amt,
                start_date: startDate || null,
                notes: notes.trim() || undefined,
              });
            }}
          >
            {editing ? "Save" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ DEBTS & BNPL ============
