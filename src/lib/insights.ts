import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Transaction } from "./types";

/** A habit is tracked by matching item names / categories / retailers against keywords. */
export interface HabitPreset {
  id: string;
  label: string;
  emoji: string;
  keywords: string[];
}

export const HABIT_PRESETS: HabitPreset[] = [
  {
    id: "energy",
    label: "Energy drinks",
    emoji: "🥤",
    keywords: ["energy", "monster", "red bull", "redbull", "relentless", "prime", "rockstar", "boost"],
  },
  {
    id: "takeaway",
    label: "Takeaways",
    emoji: "🍔",
    keywords: ["takeaway", "deliveroo", "just eat", "uber eats", "mcdonald", "kfc", "domino", "pizza", "burger king"],
  },
  {
    id: "plush",
    label: "Plushies",
    emoji: "🧸",
    keywords: ["plush", "squishmallow", "soft toy", "teddy", "jellycat"],
  },
  {
    id: "vape",
    label: "Vape supplies",
    emoji: "💨",
    keywords: ["vape", "e-liquid", "eliquid", "pod", "coil"],
  },
];

const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();

function matches(text: string, keywords: string[]): boolean {
  const t = lc(text);
  return keywords.some((k) => t.includes(k.toLowerCase()));
}

function inRange(date: string, startISO: string, endISO: string) {
  return date >= startISO && date <= endISO;
}

const usable = (txs: Transaction[]) => txs.filter((t) => !t.is_pending);

export interface HabitStats {
  count: number; // units (quantity-weighted)
  orders: number; // distinct transactions
  total: number;
  avgUnit: number;
}

/**
 * Item-level habit stats. A line item counts when its name or category matches;
 * if the retailer matches (e.g. Deliveroo) every item in that transaction counts.
 */
export function habitStats(
  txs: Transaction[],
  keywords: string[],
  startISO: string,
  endISO: string,
): HabitStats {
  let count = 0;
  let total = 0;
  let orders = 0;
  for (const t of usable(txs)) {
    if (!inRange(t.date, startISO, endISO)) continue;
    const retailerHit = matches(t.retailer, keywords);
    let hit = false;
    for (const it of t.items ?? []) {
      if (retailerHit || matches(it.item_name, keywords) || matches(it.category, keywords)) {
        const q = it.quantity ?? 1;
        count += q;
        total += it.price * q;
        hit = true;
      }
    }
    if (hit) orders += 1;
  }
  total = Math.round(total * 100) / 100;
  return { count, orders, total, avgUnit: count > 0 ? Math.round((total / count) * 100) / 100 : 0 };
}

/** Spend per day across [startISO, min(endISO, todayISO)]. */
export function dailySpend(txs: Transaction[], startISO: string, endISO: string, todayISO: string) {
  const last = endISO < todayISO ? endISO : todayISO;
  const days: { date: string; total: number }[] = [];
  if (last < startISO) return days;
  const n = differenceInCalendarDays(parseISO(last), parseISO(startISO));
  const byDate = new Map<string, number>();
  for (const t of usable(txs)) {
    if (!inRange(t.date, startISO, last)) continue;
    const amt = (t.items ?? []).reduce((s, i) => s + i.price * (i.quantity ?? 1), 0) || t.total_amount;
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + amt);
  }
  for (let i = 0; i <= n; i++) {
    const d = format(addDays(parseISO(startISO), i), "yyyy-MM-dd");
    days.push({ date: d, total: Math.round((byDate.get(d) ?? 0) * 100) / 100 });
  }
  return days;
}

export function pulse(txs: Transaction[], startISO: string, endISO: string, todayISO: string) {
  const days = dailySpend(txs, startISO, endISO, todayISO);
  const spent = Math.round(days.reduce((s, d) => s + d.total, 0) * 100) / 100;
  const noSpend = days.filter((d) => d.total <= 0).length;
  let streak = 0;
  for (let i = days.length - 1; i >= 0 && days[i].total <= 0; i--) streak++;
  const burn = days.length ? Math.round((spent / days.length) * 100) / 100 : 0;
  const daysLeft = Math.max(0, differenceInCalendarDays(parseISO(endISO), parseISO(todayISO)));
  return { spent, noSpend, streak, burn, daysElapsed: days.length, daysLeft };
}

export function topMerchants(txs: Transaction[], startISO: string, endISO: string, limit = 5) {
  const m = new Map<string, { name: string; visits: number; total: number }>();
  for (const t of usable(txs)) {
    if (!inRange(t.date, startISO, endISO)) continue;
    const name = (t.retailer ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const e = m.get(key) ?? { name, visits: 0, total: 0 };
    e.visits += 1;
    e.total += t.total_amount;
    m.set(key, e);
  }
  return [...m.values()]
    .map((e) => ({ ...e, total: Math.round(e.total * 100) / 100, avg: Math.round((e.total / e.visits) * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export interface PriceCheck {
  item: string;
  buys: number;
  low: { price: number; retailer: string };
  high: { price: number; retailer: string };
  last: { price: number; retailer: string; date: string };
}

/** Items bought at least twice, with lowest/highest/latest unit price. */
export function priceChecks(txs: Transaction[], limit = 6): PriceCheck[] {
  const m = new Map<string, { item: string; rows: { price: number; retailer: string; date: string }[] }>();
  for (const t of usable(txs)) {
    for (const it of t.items ?? []) {
      const name = (it.item_name ?? "").trim();
      if (!name || !(it.price > 0)) continue;
      const key = name.toLowerCase();
      const e = m.get(key) ?? { item: name, rows: [] };
      e.rows.push({ price: it.price, retailer: t.retailer ?? "", date: t.date });
      m.set(key, e);
    }
  }
  const out: PriceCheck[] = [];
  for (const { item, rows } of m.values()) {
    if (rows.length < 2) continue;
    const byPrice = [...rows].sort((a, b) => a.price - b.price);
    const byDate = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
    out.push({ item, buys: rows.length, low: byPrice[0], high: byPrice[byPrice.length - 1], last: byDate[0] });
  }
  return out.sort((a, b) => b.buys - a.buys).slice(0, limit);
}
