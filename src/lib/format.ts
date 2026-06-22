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
