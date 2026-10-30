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

/** Fees, postage, protection and discount lines — not real "items". */
const AUX_RE =
  /\b(postage|shipping|delivery|p\s*&\s*p|courier|buyer'?s?\s*protection|protection fee|service (fee|charge)|platform fee|small order fee|bag (fee|charge)|carrier bag|discount|voucher|promo(tion)?|coupon|tip|rider tip|fee)\b/i;
export function isAuxiliary(it: { item_name?: string | null; category?: string | null; price?: number }): boolean {
  if ((it.price ?? 0) < 0) return true;
  return AUX_RE.test(it.item_name ?? "") || /^(fees?|postage|delivery|discounts?)$/i.test((it.category ?? "").trim());
}

/** Bills, utilities and subscriptions that share words with habit keywords ("energy", "prime", "pod"). */
const NOT_HABIT_RE =
  /\b(octopus|edf|e\.?on|ovo|british gas|scottish power|sse|bulb|so energy|utility|bill|tariff|electric(ity)?|gas|amazon prime|prime video|prime membership|podcast|ipod|airpods?)\b/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word, case-insensitive keyword match (prefix allowed so "plush" matches "plushie"). */
export function matches(text: string | null | undefined, keywords: string[]): boolean {
  const t = lc(text);
  if (!t || NOT_HABIT_RE.test(t)) return false;
  return keywords.some((k) => {
    const kw = k.trim().toLowerCase();
    if (!kw) return false;
    return new RegExp(`(^|[^a-z0-9])${escapeRe(kw)}`, "i").test(t);
  });
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
      if (isAuxiliary(it)) continue;
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
      if (!name || !(it.price > 0) || isAuxiliary(it)) continue;
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

/** A user habit: preset or custom, optionally with a per-cycle budget. */
export interface CustomHabit extends HabitPreset {
  budget?: number | null;
  /** Scratchpad item id whose amount acts as the budget. */
  scratchId?: string | null;
  hidden?: boolean;
}

/** Merge saved habits over the presets (saved preset rows override, hidden ones drop out). */
export function mergeHabits(saved: CustomHabit[] | null | undefined): CustomHabit[] {
  const list = Array.isArray(saved) ? saved : [];
  const byId = new Map(list.map((h) => [h.id, h]));
  const presets = HABIT_PRESETS.map((p) => ({ ...p, ...(byId.get(p.id) ?? {}) }));
  const custom = list.filter((h) => !HABIT_PRESETS.some((p) => p.id === h.id));
  return [...presets, ...custom].filter((h) => !h.hidden);
}

/** Keywords from a comma-separated string, trimmed, lowercased, de-duplicated. */
export function parseKeywords(s: string): string[] {
  return [...new Set(s.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean))];
}

/** Budget progress: pct used (can exceed 100) and amount left (never below 0). */
export function budgetProgress(spent: number, budget: number) {
  if (!(budget > 0)) return null;
  const pct = Math.round((spent / budget) * 100);
  return { pct, left: Math.max(0, Math.round((budget - spent) * 100) / 100), over: spent > budget };
}

/**
 * Play-money runway: how many days the remaining play money lasts at the
 * current daily burn, and whether it reaches payday.
 */
export function playRunway(play: number, burn: number, daysLeft: number) {
  const safeDaily = daysLeft > 0 ? Math.round((Math.max(0, play) / daysLeft) * 100) / 100 : Math.max(0, play);
  if (play <= 0) return { days: 0, reachesPayday: daysLeft === 0, safeDaily: 0 };
  if (burn <= 0) return { days: Infinity, reachesPayday: true, safeDaily };
  const days = Math.floor(play / burn);
  return { days, reachesPayday: days >= daysLeft, safeDaily };
}

/** Line items priced at or under the threshold (default £5) in range. */
export function smallSpends(txs: Transaction[], startISO: string, endISO: string, threshold = 5) {
  let count = 0;
  let total = 0;
  const names = new Map<string, number>();
  for (const t of usable(txs)) {
    if (!inRange(t.date, startISO, endISO)) continue;
    for (const it of t.items ?? []) {
      if (!(it.price > 0) || it.price > threshold || isAuxiliary(it)) continue;
      const q = it.quantity ?? 1;
      count += q;
      total += it.price * q;
      const n = (it.item_name ?? "").trim() || "Item";
      names.set(n, (names.get(n) ?? 0) + it.price * q);
    }
  }
  const top = [...names.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amt]) => ({ name, total: Math.round(amt * 100) / 100 }));
  return { count, total: Math.round(total * 100) / 100, top };
}

const PLATFORMS: { name: string; keys: string[] }[] = [
  { name: "Just Eat", keys: ["just eat", "justeat"] },
  { name: "Deliveroo", keys: ["deliveroo"] },
  { name: "Uber Eats", keys: ["uber eats", "ubereats"] },
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Takeaway orders grouped by platform and day of week. */
export function takeawayBreakdown(txs: Transaction[], keywords: string[], startISO: string, endISO: string) {
  const plat = new Map<string, { orders: number; total: number }>();
  const days = DOW.map((d) => ({ day: d, orders: 0 }));
  for (const t of usable(txs)) {
    if (!inRange(t.date, startISO, endISO)) continue;
    const r = lc(t.retailer);
    const retailerHit = matches(t.retailer, keywords);
    const items = (t.items ?? []).filter(
      (it) => retailerHit || matches(it.item_name, keywords) || matches(it.category, keywords),
    );
    if (!items.length) continue;
    const amt = items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
    const name = PLATFORMS.find((p) => p.keys.some((k) => r.includes(k)))?.name ?? "Direct / in-store";
    const e = plat.get(name) ?? { orders: 0, total: 0 };
    e.orders += 1;
    e.total += amt;
    plat.set(name, e);
    days[parseISO(t.date).getDay()].orders += 1;
  }
  const platforms = [...plat.entries()]
    .map(([name, e]) => ({ name, orders: e.orders, total: Math.round(e.total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
  return { platforms, days };
}

/** Repeat items whose latest price is above the best price seen. */
export function priceAlerts(checks: PriceCheck[]) {
  return checks
    .filter((c) => c.last.price > c.low.price)
    .map((c) => ({ ...c, extra: Math.round((c.last.price - c.low.price) * 100) / 100 }));
}
