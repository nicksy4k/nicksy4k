import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import type { ActiveCycle } from "@/lib/cycle";
import type { Commitment, IncomeEntry, SavingsEntry, Transaction } from "@/lib/types";
import { mainExpensePortion } from "@/lib/format";

export interface ForecastInputs {
  cycle: ActiveCycle;
  incomes: IncomeEntry[];
  transactions: Transaction[];
  savings: SavingsEntry[];
  commitments: Commitment[];
}

export interface SafeToSpendResult {
  /** Money available after accounting for upcoming unpaid outgoings. */
  safeToSpend: number;
  /** The dashboard's existing "Left to spend" figure for the cycle. */
  mainBalance: number;
  /** Unpaid outgoings due on or before the cycle ends. */
  unpaidOutgoings: number;
  /** Number of outgoings included in the unpaid total. */
  unpaidCount: number;
  /** Days remaining in the cycle (0 on the last day). */
  daysRemaining: number;
  /** Safe-to-spend divided by days remaining. */
  perDay: number;
}

/**
 * Compute the user's "safe to spend" figure for the active cycle.
 *
 * main balance = income in cycle − main-expense portion of transactions in cycle − net savings in cycle
 * safe to spend = main balance − unpaid outgoings due before the cycle ends
 *
 * Pending transactions are excluded from expenses because they are estimates that
 * would double-count once settled. BNPL splits are excluded via `mainExpensePortion`.
 */
export function computeSafeToSpend(inputs: ForecastInputs): SafeToSpendResult {
  const { cycle, incomes, transactions, savings, commitments } = inputs;

  const totalIncome = incomes
    .filter((i) => isInWindow(i.date, cycle))
    .reduce((s, i) => s + i.amount, 0);

  const totalExpenses = transactions
    .filter((t) => isInWindow(t.date, cycle) && !t.is_pending)
    .reduce((s, t) => s + mainExpensePortion(t), 0);

  const netSavings = savings
    .filter((s) => isInWindow(s.date, cycle))
    .reduce((s, e) => s + (e.kind === "deposit" ? e.amount : -e.amount), 0);

  const mainBalance = +(totalIncome - totalExpenses - netSavings).toFixed(2);

  const resetDate = format(addDays(cycle.end, 1), "yyyy-MM-dd");
  const unpaidInCycle = commitments.filter(
    (c) => !c.paid && c.next_due_date && c.next_due_date < resetDate,
  );
  const unpaidOutgoings = +unpaidInCycle.reduce((s, c) => s + c.amount, 0).toFixed(2);
  const safeToSpend = +(mainBalance - unpaidOutgoings).toFixed(2);

  const today = startOfDay(new Date());
  const end = startOfDay(cycle.end);
  const daysRemaining = Math.max(0, differenceInCalendarDays(end, today));
  const perDay = daysRemaining > 0 ? +(safeToSpend / daysRemaining).toFixed(2) : safeToSpend;

  return {
    safeToSpend,
    mainBalance,
    unpaidOutgoings,
    unpaidCount: unpaidInCycle.length,
    daysRemaining,
    perDay,
  };
}

function isInWindow(dateISO: string, cycle: ActiveCycle): boolean {
  return dateISO >= cycle.startISO && dateISO <= cycle.endISO;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/**
 * Format a safe-to-spend figure for display, including the per-day breakdown.
 */
export function safeToSpendCaption(result: SafeToSpendResult): string {
  const { daysRemaining, perDay } = result;
  if (daysRemaining === 0) return "Last day of cycle";
  return `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left · ${perDay}/day`;
}
