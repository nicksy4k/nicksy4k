import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";

import type { LedgerPayment, Loan } from "./types";
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
};

export type LoanPlanSummary = {
  schedule: ScheduleEntry[];
  paid: number;
  remaining: number;
  /** Next unpaid instalment, or null when the loan is settled. */
  nextDue: ScheduleEntry | null;
  paidCount: number;
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

  // Payments made before the plan began are already reflected in the opening
  // balance — only payments that count toward the plan reduce instalments.
  const priorPaid = (loan.payments ?? [])
    .filter((p) => p.type !== "topup" && !countsTowardPlan(p, planStart, loan.plan_created_at))
    .reduce((s, p) => s + p.amount, 0);
  const planPaid = Math.max(0, paid - priorPaid);
  const baseline = Math.max(0, loan.total_amount - priorPaid);

  // Instalments needed to cover the balance outstanding when the plan started.
  const count = Math.max(1, Math.ceil((baseline - EPS) / perPayment));

  const schedule: ScheduleEntry[] = [];
  let coveredPool = planPaid;
  let date = firstDue;

  for (let i = 0; i < count; i++) {
    const amount = i === count - 1 ? Math.max(0, baseline - perPayment * (count - 1)) : perPayment;

    const covered = Math.min(amount, Math.max(0, coveredPool));
    coveredPool -= covered;

    const status: ScheduleEntry["status"] =
      covered >= amount - EPS
        ? "paid"
        : covered > EPS
          ? "part"
          : date <= today
            ? "due"
            : "upcoming";

    schedule.push({ index: i + 1, dueDate: date, amount, status, covered });
    date = stepDate(date, cadence);
  }

  // Fully-paid instalments are pushed off the front of the remaining schedule,
  // so re-date the unpaid ones from the first outstanding due date.
  const firstUnpaidIdx = schedule.findIndex((s) => s.status !== "paid");
  if (firstUnpaidIdx > 0) {
    let d = firstDue;
    for (let i = firstUnpaidIdx; i < schedule.length; i++) {
      schedule[i]!.dueDate = d;
      schedule[i]!.status =
        schedule[i]!.covered > EPS ? "part" : d <= today ? "due" : "upcoming";
      d = stepDate(d, cadence);
    }
  }

  const unpaid = schedule.filter((s) => s.status !== "paid");
  const nextDue = unpaid[0] ?? null;
  const paidCount = schedule.length - unpaid.length;

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
