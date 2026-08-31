// Pure money formatting — no React, no Supabase, safe to import anywhere
// (server functions, MCP tools, tests). The active format is set by
// `src/lib/preferences.ts` on the client.

export interface CurrencyDef {
  code: string;
  symbol: string;
  locale: string;
  label: string;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: "GBP", symbol: "£", locale: "en-GB", label: "British Pound" },
  { code: "USD", symbol: "$", locale: "en-US", label: "US Dollar" },
  { code: "EUR", symbol: "€", locale: "en-IE", label: "Euro" },
  { code: "ZAR", symbol: "R", locale: "en-ZA", label: "South African Rand" },
  { code: "CAD", symbol: "CA$", locale: "en-CA", label: "Canadian Dollar" },
  { code: "AUD", symbol: "AU$", locale: "en-AU", label: "Australian Dollar" },
  { code: "NZD", symbol: "NZ$", locale: "en-NZ", label: "New Zealand Dollar" },
  { code: "INR", symbol: "₹", locale: "en-IN", label: "Indian Rupee" },
  { code: "JPY", symbol: "¥", locale: "ja-JP", label: "Japanese Yen" },
  { code: "CHF", symbol: "CHF", locale: "de-CH", label: "Swiss Franc" },
  { code: "SEK", symbol: "kr", locale: "sv-SE", label: "Swedish Krona" },
  { code: "NOK", symbol: "kr", locale: "nb-NO", label: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", locale: "da-DK", label: "Danish Krone" },
  { code: "PLN", symbol: "zł", locale: "pl-PL", label: "Polish Złoty" },
  { code: "AED", symbol: "AED", locale: "en-AE", label: "UAE Dirham" },
  { code: "NGN", symbol: "₦", locale: "en-NG", label: "Nigerian Naira" },
];

export const CUSTOM_CURRENCY = "CUSTOM";

export interface MoneyFormat {
  /** Currency code from CURRENCIES, or CUSTOM_CURRENCY. */
  currency: string;
  /** Only used when currency === CUSTOM_CURRENCY. */
  customSymbol: string;
  symbolPosition: "before" | "after";
}

export const DEFAULT_MONEY: MoneyFormat = {
  currency: "GBP",
  customSymbol: "¤",
  symbolPosition: "before",
};

let active: MoneyFormat = DEFAULT_MONEY;

export function setActiveMoney(next: MoneyFormat) {
  active = next;
}

export function getActiveMoney(): MoneyFormat {
  return active;
}

export function currencySymbol(f: MoneyFormat = active): string {
  if (f.currency === CUSTOM_CURRENCY) return f.customSymbol || "¤";
  return CURRENCIES.find((c) => c.code === f.currency)?.symbol ?? "£";
}

export function formatMoney(n: number, f: MoneyFormat = active): string {
  const value = Number.isFinite(n) ? n : 0;
  const def = CURRENCIES.find((c) => c.code === f.currency);

  if (def && f.symbolPosition === "before") {
    try {
      return value.toLocaleString(def.locale, { style: "currency", currency: def.code });
    } catch {
      /* fall through to manual formatting */
    }
  }

  const symbol = currencySymbol(f);
  const abs = Math.abs(value).toLocaleString(def?.locale ?? "en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = value < 0 ? "-" : "";
  return f.symbolPosition === "after" ? `${sign}${abs}\u00a0${symbol}` : `${sign}${symbol}${abs}`;
}

// ===== Allocation / split maths =====
// Shared by income routing, new-transaction payment splits and
// PaymentSplitEditor so rounding and tolerance rules can never drift apart.

/** Float comparison tolerance for money (well under a penny). */
export const MONEY_EPSILON = 0.0001;

/** Sum of a set of draft amounts that may be strings or numbers. */
export function sumAmounts(values: Array<string | number | null | undefined>): number {
  return values.reduce<number>((s, v) => s + (typeof v === "number" ? v : parseFloat(v ?? "") || 0), 0);
}

/** What's left of `total` after `allocated`, rounded to 2dp. Negative = over-allocated. */
export function remainderOf(total: number, allocated: number): number {
  return +(total - allocated).toFixed(2);
}

export function isOverAllocated(total: number, allocated: number): boolean {
  return allocated > total + MONEY_EPSILON;
}

export function isFullyAllocated(total: number, allocated: number): boolean {
  return Math.abs(total - allocated) <= MONEY_EPSILON;
}
