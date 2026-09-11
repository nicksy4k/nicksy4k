import type { Transaction } from "./types";

export type DeliveryStatus =
  | "awaiting_dispatch"
  | "in_transit"
  | "out_for_delivery"
  | "delivered";

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  "awaiting_dispatch",
  "in_transit",
  "out_for_delivery",
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
    t.delivery_status === "out_for_delivery"
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
    default:
      return [];
  }
}
