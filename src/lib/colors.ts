// Shared chart palette so Pockets, the dashboard category pie, and any
// future tag visualisation all speak the same language. A given key
// (category name, pocket name) always maps to the same swatch.

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--muted-foreground)",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deterministic colour token for a string key (case-insensitive). */
export function colorForKey(key: string): string {
  if (!key) return CHART_COLORS[CHART_COLORS.length - 1];
  return CHART_COLORS[hash(key.toLowerCase()) % CHART_COLORS.length];
}
