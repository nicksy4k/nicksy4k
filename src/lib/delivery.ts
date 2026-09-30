import { differenceInCalendarDays, parseISO } from "date-fns";

import type { Transaction } from "./types";

export type DeliveryStatus =
  | "awaiting_dispatch"
  | "in_transit"
  | "out_for_delivery"
  | "delayed_claim"
  | "delivered";

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  "awaiting_dispatch",
  "in_transit",
  "out_for_delivery",
  "delayed_claim",
  "delivered",
];

export interface DeliveryMeta {
  label: string;
  emoji: string;
  /** Tailwind classes for a small pill badge. */
  className: string;
}

const META: Record<DeliveryStatus, DeliveryMeta> = {
  awaiting_dispatch: {
    label: "Awaiting Dispatch",
    emoji: "📦",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  in_transit: {
    label: "In Transit",
    emoji: "🚚",
    className: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    emoji: "🛵",
    className: "border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  delayed_claim: {
    label: "Delayed / Possibly Lost",
    emoji: "⚠️",
    className: "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  delivered: {
    label: "Received",
    emoji: "✓",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
};

export function deliveryMeta(status: string | null | undefined): DeliveryMeta | null {
  if (!status) return null;
  return META[status as DeliveryStatus] ?? null;
}

/** True while an order is still on its way (not yet received). */
export function isAwaitingDelivery(t: Pick<Transaction, "delivery_status">): boolean {
  return (
    t.delivery_status === "awaiting_dispatch" ||
    t.delivery_status === "in_transit" ||
    t.delivery_status === "out_for_delivery" ||
    t.delivery_status === "delayed_claim"
  );
}

export function countAwaitingDelivery(items: Pick<Transaction, "delivery_status">[]): number {
  return items.filter(isAwaitingDelivery).length;
}

/** Sensible forward steps offered as one-tap buttons for the current status. */
export function nextDeliverySteps(status: string | null | undefined): DeliveryStatus[] {
  switch (status) {
    case "awaiting_dispatch":
      return ["in_transit", "out_for_delivery", "delivered"];
    case "in_transit":
      return ["out_for_delivery", "delivered"];
    case "out_for_delivery":
      return ["delivered"];
    case "delayed_claim":
      return ["delivered"];
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ */
/* Delayed parcels & claim windows                                     */
/* ------------------------------------------------------------------ */

export type ClaimPhase = "upcoming" | "open" | "expired";

export interface ClaimWindow {
  phase: ClaimPhase;
  /** Days until the claim window opens (0 when it opens today). */
  daysUntilOpen: number;
  /** Days left before the claim deadline passes (0 = last day). */
  daysLeft: number;
  claimDate: string | null;
  claimDeadline: string | null;
}

type ClaimFields = Pick<Transaction, "claim_date" | "claim_deadline">;

/**
 * Where a delayed parcel sits in its claim window: waiting for the window to
 * open, inside it (act now), or past the deadline.
 */
export function claimWindowStatus(
  t: ClaimFields,
  now: Date = new Date(),
): ClaimWindow | null {
  const claimDate = t.claim_date ?? null;
  const claimDeadline = t.claim_deadline ?? null;
  if (!claimDate && !claimDeadline) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntilOpen = claimDate ? differenceInCalendarDays(parseISO(claimDate), today) : 0;
  const daysLeft = claimDeadline ? differenceInCalendarDays(parseISO(claimDeadline), today) : 0;

  let phase: ClaimPhase;
  if (daysUntilOpen > 0) phase = "upcoming";
  else if (claimDeadline && daysLeft < 0) phase = "expired";
  else phase = "open";

  return { phase, daysUntilOpen, daysLeft, claimDate, claimDeadline };
}

/** True when a delayed parcel needs the user to act (or is about to). */
export function needsClaimAttention(
  t: Pick<Transaction, "delivery_status" | "claim_date" | "claim_deadline">,
): boolean {
  return t.delivery_status === "delayed_claim";
}

/** Add whole days to an ISO date, returning an ISO date (local-timezone safe). */
export function addDaysIso(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/* One-tap tracking links                                              */
/* ------------------------------------------------------------------ */

export interface Carrier {
  /** Stable key. */
  id: string;
  /** Friendly display name. */
  name: string;
  /** Words/spellings that appear in a courier field for this carrier. */
  aliases: RegExp;
  /** Build the public tracking URL for a code. */
  url: (tracking: string) => string;
}

export const CARRIERS: Carrier[] = [
  {
    id: "royal-mail",
    name: "Royal Mail",
    aliases: /royal\s*mail|\brm\b|parcelforce/i,
    url: (t) => `https://www.royalmail.com/track-your-item#/tracking-results/${t}`,
  },
  {
    id: "evri",
    name: "Evri",
    aliases: /evri|hermes/i,
    url: (t) => `https://www.evri.com/track/parcel/${t}/details`,
  },
  {
    id: "dpd",
    name: "DPD",
    aliases: /\bdpd\b/i,
    url: (t) =>
      `https://www.dpd.co.uk/tracking/trackingSearch.do?search.searchType=0&search.parcelNumber=${t}`,
  },
  {
    id: "dhl",
    name: "DHL",
    aliases: /\bdhl\b/i,
    url: (t) => `https://www.dhl.com/gb-en/home/tracking.html?tracking-id=${t}`,
  },
  {
    id: "ups",
    name: "UPS",
    aliases: /\bups\b/i,
    url: (t) => `https://www.ups.com/track?loc=en_GB&tracknum=${t}`,
  },
  {
    id: "fedex",
    name: "FedEx",
    aliases: /fed\s*ex/i,
    url: (t) => `https://www.fedex.com/fedextrack/?trknbr=${t}`,
  },
  {
    id: "yodel",
    name: "Yodel",
    aliases: /yodel/i,
    url: (t) => `https://www.yodel.co.uk/tracking/${t}`,
  },
  {
    id: "amazon",
    name: "Amazon Logistics",
    aliases: /amazon/i,
    url: (t) => `https://track.amazon.co.uk/tracking/${t}`,
  },
];

function cleanTracking(tracking: string | null | undefined): string {
  return (tracking ?? "").replace(/\s+/g, "").trim();
}

/**
 * Work out the carrier from the courier text, falling back to well known
 * tracking-number shapes (UPS 1Z…, Royal Mail 2 letters + 9 digits + GB,
 * Evri 16-digit barcodes).
 */
export function detectCarrier(
  courier: string | null | undefined,
  tracking?: string | null,
): Carrier | null {
  const name = (courier ?? "").trim();
  if (name) {
    const hit = CARRIERS.find((c) => c.aliases.test(name));
    if (hit) return hit;
  }
  const code = cleanTracking(tracking);
  if (code) {
    if (/^1Z[0-9A-Z]{16}$/i.test(code)) return CARRIERS.find((c) => c.id === "ups") ?? null;
    if (/^[A-Z]{2}\d{9}GB$/i.test(code)) return CARRIERS.find((c) => c.id === "royal-mail") ?? null;
    if (/^\d{16}$/.test(code)) return CARRIERS.find((c) => c.id === "evri") ?? null;
    if (/^JD\d{16,}$/i.test(code)) return CARRIERS.find((c) => c.id === "dhl") ?? null;
  }
  return null;
}

export interface TrackingLink {
  url: string;
  /** Carrier name, or "Track" when we fell back to a universal lookup. */
  carrierName: string;
  /** True when we could not match a carrier and used a universal tracker. */
  universal: boolean;
  tracking: string;
}

/**
 * A direct tracking link for a parcel. Unknown couriers fall back to a
 * universal tracker so every code still opens something useful.
 */
export function trackingLink(
  courier: string | null | undefined,
  tracking: string | null | undefined,
): TrackingLink | null {
  const code = cleanTracking(tracking);
  if (!code) return null;
  const carrier = detectCarrier(courier, code);
  if (carrier) {
    return {
      url: carrier.url(encodeURIComponent(code)),
      carrierName: carrier.name,
      universal: false,
      tracking: code,
    };
  }
  return {
    url: `https://t.17track.net/en#nums=${encodeURIComponent(code)}`,
    carrierName: (courier ?? "").trim() || "Track parcel",
    universal: true,
    tracking: code,
  };
}
