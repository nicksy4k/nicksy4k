import { format } from "date-fns";

import type { Debt, Loan } from "./types";

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

export function loanPaid(l: Loan) {
  return (l.payments ?? []).filter((p) => p.type !== "topup").reduce((s, p) => s + p.amount, 0);
}
export function loanRemaining(l: Loan) {
  return Math.max(0, l.total_amount - loanPaid(l));
}
export function debtPaid(d: Debt) {
  return (d.payments ?? []).reduce((s, p) => s + p.amount, 0);
}
export function debtRemaining(d: Debt) {
  return Math.max(0, d.total_amount - debtPaid(d));
}

export type SourceChoice = { kind: "main" } | { kind: "pocket"; name: string } | { kind: "other" };

export function sourceLabel(source?: string): string {
  if (!source || source === "main") return "Main balance";
  if (source === "other") return "Other (not deducted)";
  if (source.startsWith("pocket:")) return `Pocket · ${source.slice(7)}`;
  return source;
}
export function encodeSource(c: SourceChoice): string {
  if (c.kind === "main") return "main";
  if (c.kind === "other") return "other";
  return `pocket:${c.name}`;
}
