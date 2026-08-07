import type { Commitment } from "@/lib/types";

export interface PerCycleTotals {
  bills: number;
  subs: number;
  total: number;
  count: number;
}

/**
 * Typical outgoings for a single cycle across EVERY tracked row, regardless of
 * whether it happens to fall due inside the current cycle window and regardless
 * of paid state. Annual subscriptions are spread over 12 so one big renewal
 * doesn't distort the figure. Uses the current `amount`, so promo pricing is
 * reflected exactly like the funding waterfall does.
 */
export function perCycleTotal(items: Commitment[]): PerCycleTotals {
  let bills = 0;
  let subs = 0;
  for (const c of items) {
    const value = c.cadence === "annual" ? c.amount / 12 : c.amount;
    if (c.is_subscription) subs += value;
    else bills += value;
  }
  return { bills, subs, total: bills + subs, count: items.length };
}
