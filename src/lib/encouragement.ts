// Small, honest encouragements for the dashboard. Every line must be TRUE of
// the current data — we never invent a compliment, and we never scold. If
// nothing genuinely positive is true, we return null and render nothing.

import { differenceInCalendarDays } from "date-fns";

export interface EncouragementInput {
  leftToSpend: number;
  totalIncome: number;
  totalExpenses: number;
  savingsBalance: number;
  itemCount: number;
  receiptsAttached: number;
  transactionCount: number;
  cycleEnd: Date;
}

export function encouragementFor(i: EncouragementInput): string | null {
  const daysLeft = differenceInCalendarDays(i.cycleEnd, new Date());

  if (i.transactionCount === 0) {
    return "Clean slate this cycle. Log whenever you're ready — no rush.";
  }
  if (i.leftToSpend > 0 && daysLeft >= 0) {
    const days = daysLeft === 0 ? "today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} to go`;
    return `You're inside your plan with ${days}. Nice pacing.`;
  }
  if (i.savingsBalance > 0) {
    return "Money set aside this cycle — future you says thanks.";
  }
  if (i.receiptsAttached > 0 && i.receiptsAttached >= i.transactionCount / 2) {
    return "Most of this cycle's spends have receipts attached. Properly organised.";
  }
  if (i.itemCount > 0) {
    return `${i.itemCount} item${i.itemCount === 1 ? "" : "s"} itemised this cycle — that's real clarity.`;
  }
  return null;
}
