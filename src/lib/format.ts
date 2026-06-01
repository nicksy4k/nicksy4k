export function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
