import type { CycleType } from "@/lib/cycle";
import type { Commitment } from "@/lib/types";

export interface PerCycleTotals {
  bills: number;
  subs: number;
  total: number;
  count: number;
}

/** How many cycles of each type fall in a year. */
export const CYCLES_PER_YEAR: Record<CycleType, number> = {
  monthly: 12,
  "four-weekly": 13,
};

/** How many times a cadence is charged in a year. */
const CHARGES_PER_YEAR: Record<string, number> = {
  weekly: 52,
  fortnightly: 26,
  "four-weekly": 13,
  monthly: 12,
  annual: 1,
};

/**
 * The cost of one outgoing spread across a single cycle of `cycleType`.
 * Everything is normalised through an annual figure first, so a monthly bill
 * on a 4-weekly cycle costs slightly less per cycle (12 charges over 13
 * cycles) and an annual renewal is spread over the real number of cycles.
 * An unknown/missing cadence is assumed to be charged once per cycle.
 */
export function perCycleAmount(
  amount: number,
  cadence: string | null | undefined,
  cycleType: CycleType,
): number {
  const cyclesPerYear = CYCLES_PER_YEAR[cycleType];
  const chargesPerYear = cadence ? CHARGES_PER_YEAR[cadence] : undefined;
  if (!chargesPerYear) return amount;
  return (amount * chargesPerYear) / cyclesPerYear;
}

/**
 * Typical outgoings for a single cycle across EVERY tracked row, regardless of
 * whether it happens to fall due inside the current cycle window and regardless
 * of paid state. Uses the current `amount`, so promo pricing is reflected
 * exactly like the funding waterfall does.
 */
export function perCycleTotal(
  items: Commitment[],
  cycleType: CycleType = "monthly",
): PerCycleTotals {
  let bills = 0;
  let subs = 0;
  for (const c of items) {
    const value = perCycleAmount(c.amount, c.cadence, cycleType);
    if (c.is_subscription) subs += value;
    else bills += value;
  }
  return { bills, subs, total: bills + subs, count: items.length };
}
