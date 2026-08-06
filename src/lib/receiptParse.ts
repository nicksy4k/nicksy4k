/**
 * Helpers for normalising AI-extracted receipt data before it reaches the form.
 */

export interface ScannedItem {
  name: string;
  price: number;
  quantity: number;
  category: string | null;
  confidence: number;
}

/** "£12.34", "12,34", "1,234.50", "-2.00" → number | null */
export function parseMoney(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (!raw) return null;
  let s = String(raw).trim();
  const negative = /^-/.test(s) || /\(.*\)/.test(s);
  s = s.replace(/[^0-9.,]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // European style: comma is the decimal separator
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/** Tidy up shouty till-roll names: "ASDA SMTPRICE MILK 2PT" → "Asda Smtprice Milk 2pt" */
export function tidyName(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim();
  if (!s) return "";
  const mostlyUpper = s.replace(/[^A-Za-z]/g, "").length > 0 && s === s.toUpperCase();
  if (!mostlyUpper) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Expand multi-buy lines: "2 @ £1.50", "3 x 0.99", "2 FOR 3.00".
 * Returns { quantity, unitPrice } when the line encodes a multi-buy.
 */
export function parseMultiBuy(
  name: string,
  price: number,
): { quantity: number; unitPrice: number; name: string } | null {
  const at = name.match(/(\d+)\s*(?:@|x|×)\s*£?\s*([\d.,]+)/i);
  if (at) {
    const qty = parseInt(at[1], 10);
    const unit = parseMoney(at[2]);
    if (qty > 0 && unit !== null) {
      return { quantity: qty, unitPrice: unit, name: tidyName(name.replace(at[0], "")) };
    }
  }
  const forMatch = name.match(/(\d+)\s*for\s*£?\s*([\d.,]+)/i);
  if (forMatch) {
    const qty = parseInt(forMatch[1], 10);
    const totalPrice = parseMoney(forMatch[2]) ?? price;
    if (qty > 0 && totalPrice !== null) {
      return {
        quantity: qty,
        unitPrice: +(totalPrice / qty).toFixed(2),
        name: tidyName(name.replace(forMatch[0], "")),
      };
    }
  }
  return null;
}

/** Normalise a raw AI item into a form-ready row. */
export function normaliseItem(item: {
  name?: string | null;
  price?: number | string | null;
  quantity?: number | string | null;
  category?: string | null;
  confidence?: number | null;
}): ScannedItem | null {
  const rawName = tidyName(String(item.name ?? ""));
  if (!rawName) return null;
  const price = parseMoney(item.price ?? null);
  if (price === null) return null;
  let quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
  let unitPrice = price;
  let name = rawName;

  const multi = parseMultiBuy(rawName, price);
  if (multi && multi.name) {
    quantity = multi.quantity;
    unitPrice = multi.unitPrice;
    name = multi.name;
  }

  return {
    name,
    price: +unitPrice.toFixed(2),
    quantity,
    category: item.category?.trim() || null,
    confidence: Math.min(1, Math.max(0, Number(item.confidence ?? 1) || 0)),
  };
}

/** Match "ASDA STORES 4021" against retailers already used, so spellings stay consistent. */
export function matchRetailer(extracted: string, known: string[]): string {
  const raw = extracted.replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  const exact = known.find((k) => k.toLowerCase() === lower);
  if (exact) return exact;
  const contained = known
    .filter((k) => k.trim().length >= 3)
    .filter((k) => lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower))
    .sort((a, b) => b.length - a.length)[0];
  if (contained) return contained;
  return tidyName(raw);
}

/** Sum of the ticked rows, rounded to pennies. */
export function itemsTotal(items: { price: number; quantity: number }[]): number {
  return +items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2);
}
