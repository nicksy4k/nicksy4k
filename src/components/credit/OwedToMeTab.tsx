import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListSkeleton } from "@/components/ListSkeleton";
import { supabase } from "@/integrations/supabase/client";

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
  FileText,
  Link2,
  Copy,
  Share2,
  Trash2 as TrashIcon,
} from "lucide-react";

import { differenceInCalendarDays } from "date-fns";
import {
  CADENCE_LABELS,
  buildLoanPlan,
  countsTowardPlan,
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
import type { Debt, LedgerPayment, Loan, LoanRepaymentAdjustment } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
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
import { loanStatementText, printLoanStatement } from "@/lib/loanStatement";
import { createLoanShare, listLoanShares, revokeLoanShare } from "@/lib/api/loanShare.functions";
import { expiryFromDays, expiryLabel, isShareUsable, shareUrl, SHARE_EXPIRY_OPTIONS, type LoanShareRecord } from "@/lib/loanShare";


export function OwedToMeTab() {
  const { items, isLoading, add, update, remove } = useLoans();
  const ledger = useLedgerSync();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);

  // Pending action awaiting a funding-source choice.
  const [planFor, setPlanFor] = useState<Loan | null>(null);

  // Instalment awaiting an existing payment to be linked to it.
  const [linkFor, setLinkFor] = useState<{ loan: Loan; dueDate: string } | null>(null);

  // Loan whose shareable statement is being previewed.
  const [statementFor, setStatementFor] = useState<Loan | null>(null);

  // Loan gaining a one-off, off-schedule repayment.
  const [extraFor, setExtraFor] = useState<Loan | null>(null);



  const [pending, setPending] = useState<
    | { kind: "create"; draft: Omit<Loan, "id" | "created_at" | "payments"> }
    | {
        kind: "topup";
        loan: Loan;
        amount: number;
        date: string;
        notes?: string;
        adjustments: LoanRepaymentAdjustment[];
      }
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

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <ListSkeleton rows={3} />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
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
                      className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
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
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setPlanFor(l)}
                          className="text-[11px] underline text-muted-foreground hover:text-foreground"
                        >
                          Adjust plan
                        </button>
                        {!settled && (
                          <button
                            type="button"
                            onClick={() => setExtraFor(l)}
                            className="text-[11px] underline text-muted-foreground hover:text-foreground"
                          >
                            Add one-off payment
                          </button>
                        )}
                      </div>

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
                    loan={l}
                    label={`Top up ${l.person_name}'s loan`}
                    onSubmit={({ amount, date, notes, adjustments }) =>
                      setPending({ kind: "topup", loan: l, amount, date, notes, adjustments })
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
                                  {s.kind === "extra" && (
                                    <span className="ml-1.5 text-amber-700 dark:text-amber-300">
                                      · Extra
                                    </span>
                                  )}
                                </span>
                                <span className="flex items-center gap-2">
                                  <span className="tabular-nums">{fmt(s.amount)}</span>
                                  {s.status !== "paid" && (
                                    <button
                                      type="button"
                                      className="underline text-muted-foreground hover:text-foreground"
                                      onClick={() => setLinkFor({ loan: l, dueDate: s.dueDate })}
                                    >
                                      Mark paid
                                    </button>
                                  )}
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


                  <div className="flex items-center justify-between gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStatementFor(l)}>
                      <FileText className="h-4 w-4" /> Statement
                    </Button>
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

      <MarkInstalmentPaidDialog
        target={linkFor}
        onOpenChange={(v) => {
          if (!v) setLinkFor(null);
        }}
        onLink={async (paymentId) => {
          if (!linkFor) return;
          const loan = linkFor.loan;
          const next = (loan.payments ?? []).map((p) =>
            p.id === paymentId ? { ...p, instalment_due_date: linkFor.dueDate } : p,
          );
          const before = buildLoanPlan(loan);
          const after = buildLoanPlan({ ...loan, payments: next });
          const patch: Partial<Loan> = { payments: next };
          const moved = nextDueAfterPayment(before, after, loan.plan_cadence as LoanCadence);
          if (moved !== undefined) patch.plan_next_due = moved;

          await update(loan.id, patch);
          setLinkFor(null);
          toast.success("Instalment marked as paid");
        }}
      />

      <StatementDialog
        loan={statementFor}
        onOpenChange={(v) => {
          if (!v) setStatementFor(null);
        }}
      />

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

      <ExtraRepaymentDialog
        loan={extraFor}
        onOpenChange={(v) => {
          if (!v) setExtraFor(null);
        }}
        onSave={async (adjustment) => {
          if (!extraFor) return;
          await update(extraFor.id, {
            repayment_adjustments: [...(extraFor.repayment_adjustments ?? []), adjustment],
          });
          setExtraFor(null);
          toast.success("One-off repayment added to the plan");
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
                repayment_adjustments: [
                  ...(pending.loan.repayment_adjustments ?? []),
                  ...pending.adjustments,
                ],
              });
              await ledger.debit(choice, {
                amount: pending.amount,
                date: pending.date,
                label: `Top-up loan · ${pending.loan.person_name}`,
                category: "Loans",
                notes: pending.notes,
              });
              toast.success(
                pending.adjustments.length > 0
                  ? "Top-up logged and repayment scheduled"
                  : "Top-up logged",
              );
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
                onSave({
                  plan_amount: null,
                  plan_cadence: null,
                  plan_start_date: null,
                  plan_next_due: null,
                  plan_created_at: null,
                  repayment_adjustments: [],
                })
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
                plan_created_at: loan?.plan_created_at ?? new Date().toISOString(),
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


function ExtraRepaymentDialog({
  loan,
  onOpenChange,
  onSave,
}: {
  loan: Loan | null;
  onOpenChange: (open: boolean) => void;
  onSave: (adjustment: LoanRepaymentAdjustment) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!loan) return;
    setAmount("");
    setDueDate(todayISO());
    setNote("");
  }, [loan]);

  const value = Number.parseFloat(amount);
  return (
    <Dialog open={!!loan} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add one-off repayment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add an extra payment to {loan?.person_name ?? "this loan"} without changing the regular repayment cadence.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (£)</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Michelle's extra payment" />
          </div>
          {loan && value > 0 && (
            <p className="text-xs text-muted-foreground">
              The outstanding balance will reduce by {fmt(Math.min(value, loanRemaining(loan)))} when this repayment is recorded.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => {
            if (!(value > 0) || !dueDate) {
              toast.error("Enter an amount and due date.");
              return;
            }
            if (loan && value > loanRemaining(loan) + 0.005) {
              toast.error("The repayment cannot exceed the outstanding balance.");
              return;
            }
            onSave({ id: crypto.randomUUID(), due_date: dueDate, amount: value, type: "extra", note: note || undefined });
          }}>Add repayment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TopUpLauncher({
  loan,
  label,
  onSubmit,
}: {
  loan: Loan;
  label: string;
  onSubmit: (v: {
    amount: number;
    date: string;
    notes?: string;
    adjustments: LoanRepaymentAdjustment[];
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ amount: number; date: string; notes?: string } | null>(null);

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
          // Only ask about repayment scheduling when there's a plan to adjust.
          if (hasPlan(loan)) setDraft(v);
          else onSubmit({ ...v, adjustments: [] });
        }}
      />
      <TopUpRepaymentDialog
        loan={loan}
        draft={draft}
        onOpenChange={(v) => {
          if (!v) setDraft(null);
        }}
        onConfirm={(adjustments) => {
          if (!draft) return;
          onSubmit({ ...draft, adjustments });
          setDraft(null);
        }}
      />
    </>
  );
}

/**
 * Asks how a top-up should be repaid: leave it to the existing plan, collect it
 * as a one-off payment before the next due date, and/or bump the next payment.
 */
function TopUpRepaymentDialog({
  loan,
  draft,
  onOpenChange,
  onConfirm,
}: {
  loan: Loan;
  draft: { amount: number; date: string; notes?: string } | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: (adjustments: LoanRepaymentAdjustment[]) => void;
}) {
  const topUpAmount = draft?.amount ?? 0;
  const nextDue = loan.plan_next_due ?? loan.plan_start_date ?? todayISO();

  const [extraOn, setExtraOn] = useState(false);
  const [extraAmount, setExtraAmount] = useState("");
  const [extraDate, setExtraDate] = useState(todayISO());
  const [increaseOn, setIncreaseOn] = useState(false);
  const [increaseAmount, setIncreaseAmount] = useState("");

  useEffect(() => {
    if (!draft) return;
    setExtraOn(false);
    setIncreaseOn(false);
    setExtraAmount(draft.amount.toFixed(2));
    setIncreaseAmount(draft.amount.toFixed(2));
    setExtraDate(todayISO());
  }, [draft]);

  const extra = parseFloat(extraAmount);
  const increase = parseFloat(increaseAmount);
  const scheduled =
    (extraOn && extra > 0 ? extra : 0) + (increaseOn && increase > 0 ? increase : 0);

  return (
    <Dialog open={!!draft} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>How should this top-up be repaid?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {fmt(topUpAmount)} is being added to {loan.person_name}'s balance. By default it's
            absorbed into the existing plan — the last payment grows. You can also collect it
            sooner.
          </p>

          <div className="rounded-lg border border-border/60 p-3 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={extraOn}
                onCheckedChange={(v) => setExtraOn(v === true)}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">Add a one-off extra payment</span>
                <span className="block text-[11px] text-muted-foreground">
                  A separate payment scheduled before the next planned one.
                </span>
              </span>
            </label>
            {extraOn && (
              <div className="grid grid-cols-2 gap-3 pl-7">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Amount (£)
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={extraAmount}
                    onChange={(e) => setExtraAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Due date
                  </Label>
                  <Input
                    type="date"
                    value={extraDate}
                    onChange={(e) => setExtraDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border/60 p-3 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={increaseOn}
                onCheckedChange={(v) => setIncreaseOn(v === true)}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">
                  Increase the next planned payment
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Due {format(new Date(nextDue), "d MMM yyyy")} · normally{" "}
                  {fmt(Number(loan.plan_amount ?? 0))}
                </span>
              </span>
            </label>
            {increaseOn && (
              <div className="pl-7 space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Add to that payment (£)
                </Label>
                <Input
                  inputMode="decimal"
                  value={increaseAmount}
                  onChange={(e) => setIncreaseAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}
          </div>

          {scheduled > topUpAmount + 0.005 && (
            <p className="text-[11px] text-destructive">
              You're scheduling {fmt(scheduled)} but only topping up {fmt(topUpAmount)} — the extra
              will come out of the rest of the plan.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onConfirm([])}>
            Just add to the balance
          </Button>
          <Button
            onClick={() => {
              const adjustments: LoanRepaymentAdjustment[] = [];
              if (extraOn) {
                if (!(extra > 0) || !extraDate) {
                  toast.error("Enter an amount and date for the extra payment.");
                  return;
                }
                adjustments.push({
                  id: crypto.randomUUID(),
                  due_date: extraDate,
                  amount: extra,
                  type: "extra",
                  note: draft?.notes,
                });
              }
              if (increaseOn) {
                if (!(increase > 0)) {
                  toast.error("Enter how much to add to the next payment.");
                  return;
                }
                adjustments.push({
                  id: crypto.randomUUID(),
                  due_date: nextDue,
                  amount: increase,
                  type: "increase",
                  note: draft?.notes,
                });
              }
              onConfirm(adjustments);
            }}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

/**
 * Attribute a repayment that's already recorded on the loan to a scheduled
 * instalment — e.g. money that arrived a day before the plan's first due date.
 */
function MarkInstalmentPaidDialog({
  target,
  onOpenChange,
  onLink,
}: {
  target: { loan: Loan; dueDate: string } | null;
  onOpenChange: (v: boolean) => void;
  onLink: (paymentId: string) => void | Promise<void>;
}) {
  const loan = target?.loan ?? null;
  const planStart = loan?.plan_next_due ?? loan?.plan_start_date ?? loan?.start_date ?? todayISO();

  const candidates = (loan?.payments ?? []).filter(
    (p) => p.type !== "topup" && !countsTowardPlan(p, planStart, loan?.plan_created_at),
  );

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Mark instalment paid
            {target && <> · {format(new Date(target.dueDate), "d MMM yyyy")}</>}
          </DialogTitle>
        </DialogHeader>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No unattributed repayments to link. Close this and use{" "}
            <span className="font-medium text-foreground">Log Repayment</span> to record the payment
            — it counts against this instalment automatically.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Pick a repayment already recorded on this loan to count against this instalment.
            </p>
            <ul className="divide-y divide-border/60">
              {candidates.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="text-sm font-medium tabular-nums">{fmt(p.amount)}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {format(new Date(p.date), "d MMM yyyy")}
                      {p.notes ? ` · ${p.notes}` : ""}
                    </span>
                  </span>
                  <Button size="sm" variant="outline" onClick={() => onLink(p.id)}>
                    Use this
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareLinkSection({ loan, note }: { loan: Loan; note: string }) {
  const create = useServerFn(createLoanShare);
  const list = useServerFn(listLoanShares);
  const revoke = useServerFn(revokeLoanShare);
  const [expiryDays, setExpiryDays] = useState("0");
  const [share, setShare] = useState<LoanShareRecord & { id: string; note: string | null } | null>(null);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);

  const shares = useQuery({
    queryKey: ["loan-shares", loan.id],
    queryFn: () => list({ data: { loanId: loan.id } }),
  });

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const active = shares.data?.find((item) => isShareUsable(item));
    if (active) setShare(active);
  }, [shares.data]);

  const url = share && origin ? shareUrl(origin, share.token) : "";

  async function copyLink(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Statement link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  async function createLink() {
    setBusy(true);
    try {
      const created = await create({
        data: {
          loanId: loan.id,
          note: note.trim() || undefined,
          expiresAt: expiryFromDays(Number(expiryDays)),
        },
      });
      setShare(created);
      await copyLink(shareUrl(window.location.origin, created.token));
      await shares.refetch();
    } catch {
      toast.error("Couldn't create the statement link");
    } finally {
      setBusy(false);
    }
  }

  async function revokeLink() {
    if (!share) return;
    setBusy(true);
    try {
      await revoke({ data: { id: share.id } });
      setShare(null);
      await shares.refetch();
      toast.success("Statement link revoked");
    } catch {
      toast.error("Couldn't revoke the link");
    } finally {
      setBusy(false);
    }
  }

  async function shareLink() {
    if (!url) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `Loan statement for ${loan.person_name}`, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyLink(url);
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Share a live statement</p>
          <p className="text-xs text-muted-foreground">Anyone with the link can view it without an account.</p>
        </div>
        <Link2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>

      {url ? (
        <>
          <div className="flex gap-2">
            <Input value={url} readOnly aria-label="Shareable statement link" className="text-xs" />
            <Button type="button" variant="outline" size="icon" aria-label="Copy statement link" onClick={() => copyLink(url)}>
              <Copy />
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{share ? expiryLabel(share) : ""}</p>
            <div className="flex gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={shareLink}>
                <Share2 /> Share
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={revokeLink} disabled={busy}>
                <TrashIcon /> Revoke
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Select value={expiryDays} onValueChange={setExpiryDays}>
            <SelectTrigger className="flex-1" aria-label="Statement link expiry">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHARE_EXPIRY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={createLink} disabled={busy}>
            <Share2 /> {busy ? "Creating…" : "Create link"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Preview + share a printable statement for a single loan. */
function StatementDialog({
  loan,
  onOpenChange,
}: {
  loan: Loan | null;
  onOpenChange: (v: boolean) => void;
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    setNote("");
  }, [loan?.id]);

  if (!loan) return null;

  const paid = loanPaid(loan);
  const remaining = Math.max(0, loanRemaining(loan));
  const plan = buildLoanPlan(loan);

  return (
    <Dialog open={!!loan} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Statement for {loan.person_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total lent</span>
              <span className="tabular-nums">{fmt(loan.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Repaid</span>
              <span className="tabular-nums">{fmt(paid)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Outstanding</span>
              <span className="tabular-nums">{fmt(remaining)}</span>
            </div>
            {plan?.nextDue && (
              <p className="text-xs text-muted-foreground pt-1">
                Next payment {fmt(plan.nextDue.amount - plan.nextDue.covered)} on{" "}
                {format(new Date(plan.nextDue.dueDate), "d MMM yyyy")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="statement-note">Message on the statement (optional)</Label>
            <Textarea
              id="statement-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Thanks — next payment by bank transfer please."
            />
          </div>

          <ShareLinkSection loan={loan} note={note} />

          <p className="text-xs text-muted-foreground">
            The statement lists every loan, top-up and repayment with a running balance, plus any
            remaining scheduled payments. Choose “Save as PDF” in the print dialog to share it.
          </p>
        </div>


        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(loanStatementText(loan));
                toast.success("Summary copied");
              } catch {
                toast.error("Couldn't copy — try the PDF instead");
              }
            }}
          >
            Copy summary
          </Button>
          <Button onClick={() => printLoanStatement(loan, { note: note.trim() || undefined })}>
            <FileText className="h-4 w-4" /> Save as PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
