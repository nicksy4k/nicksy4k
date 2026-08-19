import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import type { CycleType } from "@/lib/cycle";
import type { Commitment, SavingsEntry } from "@/lib/types";

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

export type FundedLevel = "full" | "partial" | "none";

export interface DueSoonOutgoing {
  commitment: Commitment;
  /** Days until due — negative when overdue. */
  daysUntil: number;
  overdue: boolean;
  funded: FundedLevel;
}

function billPocketBalance(savings: SavingsEntry[], pocket: string): number {
  return savings
    .filter((s) => s.account.trim().toLowerCase() === pocket.trim().toLowerCase())
    .reduce((sum, s) => sum + (s.kind === "deposit" ? s.amount : -s.amount), 0);
}

/**
 * Unpaid outgoings due within the next `withinDays` days (overdue rows included
 * and sorted first), tagged with whether the Bill Money pocket still covers them
 * once everything due earlier has been paid — the same waterfall the Outgoings
 * page uses to colour its rows.
 */
export function dueSoonOutgoings(
  commitments: Commitment[],
  savings: SavingsEntry[],
  now: Date = new Date(),
  withinDays = 7,
  pocket = "Bill Money",
): { rows: DueSoonOutgoing[]; pocketBalance: number; totalDue: number } {
  const today = startOfDay(now);
  const todayISO = format(today, "yyyy-MM-dd");
  const cutoff = format(addDays(today, withinDays), "yyyy-MM-dd");

  // Waterfall over EVERY unpaid dated row in date order, so rows already past
  // due consume the pocket before the ones coming up.
  const unpaidSorted = commitments
    .filter((c) => !c.paid && !!c.next_due_date)
    .slice()
    .sort((a, b) => (a.next_due_date ?? "9999").localeCompare(b.next_due_date ?? "9999"));

  let remaining = billPocketBalance(savings, pocket);
  const pocketBalance = remaining;
  const funding = new Map<string, FundedLevel>();
  for (const c of unpaidSorted) {
    if (remaining >= c.amount) {
      funding.set(c.id, "full");
      remaining -= c.amount;
    } else if (remaining > 0) {
      funding.set(c.id, "partial");
      remaining = 0;
    } else {
      funding.set(c.id, "none");
    }
  }

  const rows = unpaidSorted
    .filter((c) => (c.next_due_date as string) <= cutoff)
    .map((c) => {
      const due = c.next_due_date as string;
      const daysUntil = differenceInCalendarDays(parseISO(due), today);
      return {
        commitment: c,
        daysUntil,
        overdue: due < todayISO,
        funded: funding.get(c.id) ?? "none",
      };
    });

  return {
    rows,
    pocketBalance,
    totalDue: rows.reduce((s, r) => s + r.commitment.amount, 0),
  };
}
