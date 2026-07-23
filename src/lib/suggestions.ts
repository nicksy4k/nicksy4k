import type { Transaction } from "./types";

/**
 * Historical price lookup: item name → newest-first list of prior prices
 * per retailer. Skips pending holds and non-positive prices.
 */
export function buildPriceHistory(
  pastTransactions: Transaction[],
): Map<string, { retailer: string; price: number; date: string }[]> {
  const map = new Map<string, { retailer: string; price: number; date: string }[]>();
  for (const t of pastTransactions) {
    if (t.is_pending) continue;
    const r = (t.retailer ?? "").trim().toLowerCase();
    for (const it of t.items ?? []) {
      const name = (it.item_name ?? "").trim().toLowerCase();
      if (!name) continue;
      const price = Number(it.price);
      if (!Number.isFinite(price) || price <= 0) continue;
      const arr = map.get(name) ?? [];
      arr.push({ retailer: r, price, date: t.date });
      map.set(name, arr);
    }
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
  return map;
}

export function suggestPrice(
  history: ReturnType<typeof buildPriceHistory>,
  itemName: string,
  retailerName: string,
): number | null {
  const key = itemName.trim().toLowerCase();
  if (!key) return null;
  const arr = history.get(key);
  if (!arr || arr.length === 0) return null;
  const r = retailerName.trim().toLowerCase();
  if (r) {
    const match = arr.find((e) => e.retailer === r);
    if (match) return match.price;
  }
  return arr[0].price;
}

/**
 * Historical category lookup: item name → newest-first list of categories.
 */
export function buildCategoryHistory(
  pastTransactions: Transaction[],
): Map<string, { category: string; date: string }[]> {
  const map = new Map<string, { category: string; date: string }[]>();
  for (const t of pastTransactions) {
    if (t.is_pending) continue;
    for (const it of t.items ?? []) {
      const name = (it.item_name ?? "").trim().toLowerCase();
      if (!name) continue;
      const cat = (it.category ?? "").trim();
      if (!cat) continue;
      const arr = map.get(name) ?? [];
      arr.push({ category: cat, date: t.date });
      map.set(name, arr);
    }
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
  return map;
}

export function suggestCategory(
  history: ReturnType<typeof buildCategoryHistory>,
  itemName: string,
): string | null {
  const key = itemName.trim().toLowerCase();
  if (!key) return null;
  const arr = history.get(key);
  return arr && arr.length > 0 ? arr[0].category : null;
}
