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
 * Snooze until the next session: hides the reminder for the rest of today,
 * so it reappears the next time the user opens the app on another day.
 */
export function snoozeUntilNextLogin(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
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

/** Store/provider names that are almost certainly subscriptions. */
export const SUBSCRIPTION_PROVIDERS = [
  "netflix",
  "spotify",
  "disney",
  "nowtv",
  "now tv",
  "amazon prime",
  "prime video",
  "paramount",
  "apple",
  "itunes",
  "google",
  "youtube",
  "xbox",
  "playstation",
  "nintendo",
  "audible",
  "sky",
  "hulu",
  "hbo",
  "max",
  "deezer",
  "tidal",
  "dropbox",
  "adobe",
  "microsoft",
  "office 365",
  "canva",
  "patreon",
  "twitch",
  "britbox",
  "discovery",
  "crunchyroll",
  "peloton",
  "strava",
  "duolingo",
];

/**
 * Heuristic for legacy rows created before the Subscriptions page existed:
 * anything filed under the "Subscriptions" category, or from a well-known
 * subscription provider. BNPL-linked rows are never suggested.
 */
export function looksLikeSubscription(c: Commitment): boolean {
  if (c.is_subscription) return false;
  if (c.debt_id) return false;
  if ((c.category ?? "").trim().toLowerCase() === "subscriptions") return true;
  const haystack = `${c.store ?? ""} ${c.item_name ?? ""}`.toLowerCase();
  return SUBSCRIPTION_PROVIDERS.some((p) => haystack.includes(p));
}

/** Commitments that should probably live on the Subscriptions page. */
export function unmigratedSubscriptions(items: Commitment[]): Commitment[] {
  return items.filter(looksLikeSubscription);
}
