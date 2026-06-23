export function fmt(n: number) {
  return n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
}

/**
 * Today as a local-time `YYYY-MM-DD` string. Use this instead of
 * `new Date().toISOString().slice(0, 10)`, which is UTC and rolls over
 * to the next calendar day after midnight UTC in positive-offset zones.
 */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Portion of a transaction that actually came out of (or will come out of)
 * the main balance this cycle. BNPL splits are excluded because the money
 * hasn't left main yet — it's debt scheduled for later. Pocket splits stay
 * in because the auto-withdrawal we record credits main back, which the
 * full `total_amount` then debits, so they net out correctly.
 */
export function mainExpensePortion(tx: {
  total_amount: number;
  payment_splits?: { source: string; amount: number }[];
}): number {
  const bnplOffset = (tx.payment_splits ?? [])
    .filter((s) => s.source.startsWith("bnpl:"))
    .reduce((sum, s) => sum + s.amount, 0);
  return tx.total_amount - bnplOffset;
}
