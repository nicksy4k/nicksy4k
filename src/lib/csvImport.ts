/**
 * Bank statement CSV parsing (Revolut format first, with a generic fallback).
 * Pure functions only — no database access — so they can be unit tested.
 */

export type ImportKind = "expense" | "income" | "internal";

export interface ParsedRow {
  key: string;
  date: string; // yyyy-MM-dd (local)
  description: string;
  amount: number; // always positive
  kind: ImportKind;
  state: string; // COMPLETED / PENDING / ...
  type: string;
  raw: Record<string, string>;
}

/** Minimal RFC4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function toIsoDate(v: string): string | null {
  const t = v.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/); // UK dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function toNumber(v: string | undefined): number {
  if (!v) return NaN;
  return Number(v.replace(/[£$€,\s]/g, ""));
}

const INTERNAL_RE = /\b(to pocket|from pocket|pocket|vault|savings|to gbp|exchanged to|round[- ]?up)\b/i;

/** Tidy merchant names: strip ref numbers / card noise, title-case shouty text. */
export function cleanDescription(d: string): string {
  let s = d.replace(/\s+/g, " ").trim();
  s = s.replace(/^(TFR|CARD PAYMENT TO|PAYMENT TO|POS)\s+/i, "");
  s = s.replace(/\s+\d{5,}.*$/, "");
  if (s === s.toUpperCase() && /[A-Z]/.test(s)) {
    s = s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return s || d.trim();
}

export function parseStatement(text: string): ParsedRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const iDate = idx("completed date", "started date", "date", "transaction date");
  const iStarted = idx("started date");
  const iDesc = idx("description", "merchant", "name", "reference");
  const iAmt = idx("amount", "value");
  const iFee = idx("fee");
  const iState = idx("state", "status");
  const iType = idx("type");
  const iProduct = idx("product");
  if (iDate < 0 || iDesc < 0 || iAmt < 0) {
    throw new Error("Couldn't find Date, Description and Amount columns in this file.");
  }
  const out: ParsedRow[] = [];
  rows.slice(1).forEach((r, n) => {
    const raw: Record<string, string> = {};
    header.forEach((h, i) => (raw[h] = r[i] ?? ""));
    const date = toIsoDate(r[iDate] || (iStarted >= 0 ? r[iStarted] : "") || "");
    const amt = toNumber(r[iAmt]);
    const fee = iFee >= 0 ? toNumber(r[iFee]) || 0 : 0;
    if (!date || !Number.isFinite(amt) || amt === 0) return;
    const state = (iState >= 0 ? r[iState] : "COMPLETED").trim().toUpperCase() || "COMPLETED";
    if (state === "REVERTED" || state === "DECLINED" || state === "FAILED") return;
    const type = (iType >= 0 ? r[iType] : "").trim().toUpperCase();
    const product = (iProduct >= 0 ? r[iProduct] : "").trim().toLowerCase();
    const desc = (r[iDesc] ?? "").trim();
    const internal =
      (product && product !== "current") || type === "EXCHANGE" || INTERNAL_RE.test(desc);
    const total = Math.round((Math.abs(amt) + (amt < 0 ? Math.abs(fee) : 0)) * 100) / 100;
    out.push({
      key: `${n}`,
      date,
      description: cleanDescription(desc),
      amount: total,
      kind: internal ? "internal" : amt < 0 ? "expense" : "income",
      state,
      type,
      raw,
    });
  });
  return out;
}

export interface ExistingEntry {
  date: string;
  amount: number;
  label: string;
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.abs(Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000;
}

/** Find an existing ledger entry with the same amount within ±2 days. */
export function findDuplicate(
  row: ParsedRow,
  existing: ExistingEntry[],
): ExistingEntry | undefined {
  return existing.find(
    (e) => Math.abs(e.amount - row.amount) < 0.005 && dayDiff(e.date, row.date) <= 2,
  );
}
