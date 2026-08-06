import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Commitment } from "@/lib/types";

/** How many days before an offer ends the reminder appears. */
export const PROMO_WARNING_DAYS = 3;

export function isSubscription(c: Commitment): boolean {
  return !!c.is_subscription;
}

export function cadenceLabel(cadence: string | null | undefined): string {
  return cadence === "annual" ? "Annual" : "Monthly";
}

/** True while a discounted offer is still running. */
export function hasActivePromo(c: Commitment, today = new Date()): boolean {
  if (!c.promo_ends_on) return false;
  return differenceInCalendarDays(parseISO(c.promo_ends_on), today) >= 0;
}

/** Days until the offer ends (negative once it has passed). */
export function daysUntilPromoEnd(c: Commitment, today = new Date()): number | null {
  if (!c.promo_ends_on) return null;
  return differenceInCalendarDays(parseISO(c.promo_ends_on), today);
}

/**
 * Subscriptions whose offer ends soon (or just ended) and whose reminder
 * hasn't been snoozed past now.
 */
export function promoAlerts(items: Commitment[], today = new Date()): Commitment[] {
  const nowISO = today.toISOString();
  return items
    .filter((c) => {
      if (!c.is_subscription || !c.promo_ends_on) return false;
      if (c.promo_alert_snoozed_until && c.promo_alert_snoozed_until > nowISO) return false;
      const days = differenceInCalendarDays(parseISO(c.promo_ends_on), today);
      return days <= PROMO_WARNING_DAYS && days >= -1;
    })
    .sort((a, b) => (a.promo_ends_on ?? "").localeCompare(b.promo_ends_on ?? ""));
}

/**
 * Snooze until the next sign-in: we use a far-future-safe marker that the
 * app clears on sign-in. Stored as an ISO timestamp 30 days out; the
 * sign-in handler wipes snoozes so the reminder returns next session.
 */
export function snoozeUntilNextLogin(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

/** Patch applied when the user accepts the full price going forward. */
export function acceptFullPricePatch(c: Commitment): Partial<Commitment> {
  return {
    promo_alert_snoozed_until: null,
    // Keep promo_ends_on so rollover flips the price on the end date.
    // If the offer already ended, apply the standard price immediately.
    ...(c.promo_ends_on && c.promo_ends_on <= new Date().toISOString().slice(0, 10)
      ? {
          amount: typeof c.standard_price === "number" ? c.standard_price : c.amount,
          promo_price: null,
          promo_ends_on: null,
          standard_price: null,
        }
      : {}),
  };
}
