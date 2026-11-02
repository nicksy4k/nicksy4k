// Essential vs Fun/Personal classification for line items.
// Each item inherits a default from its category; an item-level
// `spend_type` overrides it. Stored inside the item JSON, so removing this
// feature leaves transactions untouched.
import type { LineItem, Transaction } from "./types";

export type SpendType = "essential" | "fun";

const ESSENTIAL_RE =
  /\b(groceries|grocery|food|household|subscriptions?|bills?|utilit|rent|council|energy|water|phone|mobile|broadband|internet|insurance|health|medic|pharmac|prescription|transport|travel|fuel|petrol|diesel|parking|childcare|school|toiletr|hygiene|cleaning|pet|debt|loan|repayment|tax|service charge)/i;

export function categoryDefault(category: string | null | undefined): SpendType {
  return ESSENTIAL_RE.test(category ?? "") ? "essential" : "fun";
}

export function itemSpendType(it: Pick<LineItem, "category"> & { spend_type?: SpendType | null }): SpendType {
  return it.spend_type ?? categoryDefault(it.category);
}

function isAux(it: LineItem) {
  return (
    !(it.price > 0) ||
    /\b(postage|shipping|delivery|p&p|buyer protection|service fee|bag|discount|voucher|promo)\b/i.test(it.item_name ?? "")
  );
}

/** Essential vs Fun totals (items only) and no-impulse days in a date range. */
export function spendSplit(txs: Transaction[], startISO: string, endISO: string, todayISO: string) {
  let essential = 0;
  let fun = 0;
  const funDays = new Set<string>();
  for (const t of txs) {
    if (t.is_pending || t.date < startISO || t.date > endISO) continue;
    for (const it of t.items ?? []) {
      if (isAux(it)) continue;
      const amt = it.price * (it.quantity ?? 1);
      if (itemSpendType(it) === "essential") essential += amt;
      else {
        fun += amt;
        funDays.add(t.date);
      }
    }
  }
  const end = todayISO < endISO ? todayISO : endISO;
  let elapsed = 0;
  for (let d = new Date(startISO + "T00:00:00Z"); d.toISOString().slice(0, 10) <= end; d.setUTCDate(d.getUTCDate() + 1)) elapsed++;
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    essential: r(essential),
    fun: r(fun),
    elapsedDays: elapsed,
    noImpulseDays: Math.max(0, elapsed - funDays.size),
  };
}
