/**
 * Safe evaluator for simple spend sums like "18 + 14.50 - 2" or "3*4.99".
 * Supports + - * / and parentheses. Returns null when the input isn't valid.
 */
export function evalSpend(input: string): number | null {
  const src = input.replace(/[£,\s]/g, "");
  if (!src) return null;
  if (!/^[0-9.+\-*/()]+$/.test(src)) return null;
  let i = 0;
  const peek = () => src[i];
  function num(): number {
    if (peek() === "(") {
      i++;
      const v = expr();
      if (peek() !== ")") throw new Error("paren");
      i++;
      return v;
    }
    if (peek() === "-") {
      i++;
      return -num();
    }
    const m = /^\d*\.?\d+|^\d+\.?/.exec(src.slice(i));
    if (!m) throw new Error("num");
    i += m[0].length;
    return parseFloat(m[0]);
  }
  function term(): number {
    let v = num();
    while (peek() === "*" || peek() === "/") {
      const op = src[i++];
      const r = num();
      if (op === "/" && r === 0) throw new Error("div0");
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function expr(): number {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = src[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  try {
    const v = expr();
    if (i !== src.length || !Number.isFinite(v)) return null;
    return Math.round(v * 100) / 100;
  } catch {
    return null;
  }
}

export interface ScratchItem {
  id: string;
  name: string;
  amount: number;
  on: boolean;
  /** Put aside: locked out of the dashboard's play money until bought or removed. */
  reserved?: boolean;
}

export function scratchTotal(items: ScratchItem[]): number {
  return Math.round(items.filter((x) => x.on).reduce((s, x) => s + (x.amount || 0), 0) * 100) / 100;
}

/** Total of items marked "put aside" (ring-fenced), regardless of the what-if tick. */
export function reservedTotal(items: ScratchItem[]): number {
  return Math.round(items.filter((x) => x.reserved).reduce((s, x) => s + (x.amount || 0), 0) * 100) / 100;
}
