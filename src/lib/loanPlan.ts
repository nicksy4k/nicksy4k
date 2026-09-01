import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";

import type { LedgerPayment, Loan, LoanRepaymentAdjustment } from "./types";
import { loanPaid, loanRemaining, todayISO } from "./credit";

export type LoanCadence = "weekly" | "fortnightly" | "four_weekly" | "monthly";

export const CADENCE_LABELS: Record<LoanCadence, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  four_weekly: "Every 4 weeks",
  monthly: "Monthly",
};

export function hasPlan(l: Loan): boolean {
  return !!l.plan_amount && l.plan_amount > 0 && !!l.plan_cadence;
}

/** Step a yyyy-MM-dd date forward by `n` periods of the given cadence. */
export function stepDate(iso: string, cadence: LoanCadence, n = 1): string {
  const d = parseISO(iso);
  const next =
    cadence === "weekly"
      ? addDays(d, 7 * n)
      : cadence === "fortnightly"
        ? addDays(d, 14 * n)
        : cadence === "four_weekly"
          ? addDays(d, 28 * n)
          : addMonths(d, n);
  return format(next, "yyyy-MM-dd");
}

export type ScheduleEntry = {
  /** 1-based instalment number. */
  index: number;
  dueDate: string;
  amount: number;
  status: "paid" | "part" | "due" | "upcoming";
  /** How much of this instalment has been covered by recorded payments. */
  covered: number;
  /** "regular" follows the cadence; "extra" is a one-off scheduled payment. */
  kind: "regular" | "extra";
  /** Set on one-off entries so they can be edited/removed. */
  extraId?: string;
  note?: string;
};

export type LoanPlanSummary = {
  schedule: ScheduleEntry[];
  paid: number;
  remaining: number;
  /** Next unpaid instalment, or null when the loan is settled. */
  nextDue: ScheduleEntry | null;
  paidCount: number;
  /** Paid entries that follow the cadence (excludes one-off extras). */
  paidRegularCount: number;
  totalCount: number;
  remainingCount: number;
  projectedClearDate: string | null;
  /** Days overdue for the next instalment (0 when not overdue). */
  overdueBy: number;
};

const EPS = 0.005;

/**
 * Whether a recorded repayment should be counted against the plan's
 * instalments rather than treated as pre-plan history.
 *
 * A payment counts when it was explicitly linked to an instalment, when it
 * falls on/after the plan's first due date, or when it was recorded on/after
 * the plan was set up (covers paying a day or two early).
 */
export function countsTowardPlan(
  p: LedgerPayment,
  planStart: string,
  planCreatedAt?: string | null,
): boolean {
  if (p.type === "topup") return false;
  if (p.instalment_due_date) return true;
  if (p.date >= planStart) return true;
  if (planCreatedAt && p.date >= planCreatedAt.slice(0, 10)) return true;
  return false;
}

/**
 * Build the instalment schedule for a loan from its plan fields plus the
 * payments already recorded. Nothing is stored per instalment — progress is
 * always derived, so deleting a payment rewinds the schedule automatically.
 */
export function buildLoanPlan(loan: Loan, today: string = todayISO()): LoanPlanSummary | null {
  if (!hasPlan(loan)) return null;

  const cadence = loan.plan_cadence as LoanCadence;
  const perPayment = Number(loan.plan_amount);
  const paid = loanPaid(loan);
  const remaining = loanRemaining(loan);

  const firstDue = loan.plan_next_due ?? loan.plan_start_date ?? loan.start_date ?? today;
  const planStart = loan.plan_start_date ?? loan.start_date ?? firstDue;

  const priorPaid = (loan.payments ?? [])
    .filter((p) => p.type !== "topup" && !countsTowardPlan(p, planStart, loan.plan_created_at))
    .reduce((s, p) => s + p.amount, 0);
  const planPaid = Math.max(0, paid - priorPaid);
  const baseline = Math.max(0, loan.total_amount - priorPaid);
  const count = Math.max(1, Math.ceil((baseline - EPS) / perPayment));
  const adjustments = (loan.repayment_adjustments ?? []).filter(
    (a): a is LoanRepaymentAdjustment => a.amount > EPS && !!a.due_date,
  );
  const increases = new Map<string, number>();
  for (const adjustment of adjustments) {
    if (adjustment.type === "increase") {
      increases.set(adjustment.due_date, (increases.get(adjustment.due_date) ?? 0) + adjustment.amount);
    }
  }

  // Start with the regular cadence, then allocate top-up instructions within
  // that same balance. This keeps the schedule total equal to the loan total:
  // an earlier extra/increase makes the final regular instalment smaller.
  const regularAmounts: number[] = [];
  const regularDates: string[] = [];
  let date = firstDue;
  for (let i = 0; i < count; i++) {
    regularDates.push(date);
    regularAmounts.push(i === count - 1 ? Math.max(0, baseline - perPayment * (count - 1)) : perPayment);
    regularAmounts[i] = Math.max(0, regularAmounts[i] + (increases.get(date) ?? 0));
    date = stepDate(date, cadence);
  }

  const extraAdjustments = adjustments.filter((a) => a.type === "extra");
  const allocatedAdjustmentTotal = extraAdjustments.reduce((sum, a) => sum + a.amount, 0) +
    [...increases.values()].reduce((sum, amount) => sum + amount, 0);
  let toReallocate = Math.min(baseline, allocatedAdjustmentTotal);
  for (let i = regularAmounts.length - 1; i >= 0 && toReallocate > EPS; i--) {
    const reduction = Math.min(regularAmounts[i]!, toReallocate);
    regularAmounts[i] = Math.max(0, regularAmounts[i]! - reduction);
    toReallocate -= reduction;
  }

  const entries: Array<ScheduleEntry & { order: number }> = regularDates.map((dueDate, i) => ({
    index: i + 1,
    dueDate,
    amount: regularAmounts[i]!,
    status: "upcoming",
    covered: 0,
    kind: "regular",
    order: i,
  }));
  for (const adjustment of extraAdjustments) {
    entries.push({
      index: 0,
      dueDate: adjustment.due_date,
      amount: Math.min(adjustment.amount, baseline),
      status: "upcoming",
      covered: 0,
      kind: "extra",
      extraId: adjustment.id,
      note: adjustment.note,
      order: entries.length,
    });
  }
  entries.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.order - b.order);

  let coveredPool = planPaid;
  let schedule: ScheduleEntry[] = entries.map(({ order: _order, ...entry }) => {
    const covered = Math.min(entry.amount, Math.max(0, coveredPool));
    coveredPool -= covered;
    const status: ScheduleEntry["status"] =
      covered >= entry.amount - EPS
        ? "paid"
        : covered > EPS
          ? "part"
          : entry.dueDate <= today
            ? "due"
            : "upcoming";
    return { ...entry, covered, status };
  });

  // Fully-paid cadence instalments drop off the front, so the outstanding ones
  // re-date from the stored next-due. One-off entries keep their own dates.
  const regulars = schedule.filter((s) => s.kind === "regular");
  const firstUnpaidRegular = regulars.findIndex((s) => s.status !== "paid");
  if (firstUnpaidRegular > 0) {
    let d = firstDue;
    for (let i = firstUnpaidRegular; i < regulars.length; i++) {
      const entry = regulars[i]!;
      entry.dueDate = d;
      entry.status = entry.covered > EPS ? "part" : d <= today ? "due" : "upcoming";
      d = stepDate(d, cadence);
    }
    schedule = [...schedule].sort(
      (a, b) => a.dueDate.localeCompare(b.dueDate) || (a.kind === b.kind ? 0 : a.kind === "extra" ? -1 : 1),
    );
  }
  schedule = schedule.map((s, i) => ({ ...s, index: i + 1 }));

  const unpaid = schedule.filter((s) => s.status !== "paid");
  const nextDue = unpaid[0] ?? null;
  const paidCount = schedule.length - unpaid.length;
  const paidRegularCount = schedule.filter((s) => s.kind === "regular" && s.status === "paid").length;
  const last = schedule[schedule.length - 1];
  const projectedClearDate = remaining <= EPS ? null : (last?.dueDate ?? null);
  const overdueBy =
    nextDue && nextDue.dueDate < today
      ? differenceInCalendarDays(parseISO(today), parseISO(nextDue.dueDate))
      : 0;

  return {
    schedule,
    paid,
    remaining,
    nextDue,
    paidCount,
    paidRegularCount,
    totalCount: schedule.length,
    remainingCount: unpaid.length,
    projectedClearDate,
    overdueBy,
  };
}

/**
 * What an additional payment of `amount` does to the plan: how many
 * instalments it removes and how much sooner the loan clears.
 */
export function applyExtraPayment(
  loan: Loan,
  amount: number,
  today: string = todayISO(),
): { paymentsSaved: number; newClearDate: string | null; oldClearDate: string | null } | null {
  const before = buildLoanPlan(loan, today);
  if (!before) return null;

  const simulated: Loan = {
    ...loan,
    payments: [
      ...(loan.payments ?? []),
      { id: "sim", date: today, amount, type: "payment" } as LedgerPayment,
    ],
  };
  const after = buildLoanPlan(simulated, today);
  if (!after) return null;

  return {
    paymentsSaved: Math.max(0, before.remainingCount - after.remainingCount),
    newClearDate: after.projectedClearDate,
    oldClearDate: before.projectedClearDate,
  };
}

/** Instalment amount needed to clear `total` in `n` payments. */
export function amountForCount(total: number, n: number): number {
  if (!(n > 0)) return 0;
  return Math.round((total / n) * 100) / 100;
}
