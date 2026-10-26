import { describe, it, expect } from "vitest";
import { habitStats, pulse, priceChecks } from "../insights";
import type { Transaction } from "../types";

const tx = (date: string, retailer: string, items: [string, number, number?][], extra: Partial<Transaction> = {}) =>
  ({
    id: date + retailer, date, retailer, total_amount: items.reduce((s, [, p, q]) => s + p * (q ?? 1), 0),
    receipt_attached: false, receipt_type: "None", receipt_location: "",
    items: items.map(([n, p, q], i) => ({ id: String(i), item_name: n, price: p, quantity: q, category: "Other" })),
    ...extra,
  }) as Transaction;

const txs = [
  tx("2026-10-10", "Tesco", [["Monster Ultra", 1.5, 4], ["Bread", 1]]),
  tx("2026-10-12", "Premier", [["Monster Ultra", 2.2]]),
  tx("2026-10-14", "Deliveroo", [["Chicken box", 12], ["Delivery fee", 2.99]]),
  tx("2026-10-15", "Tesco", [["Monster Ultra", 9]], { is_pending: true }),
];

describe("insights", () => {
  it("counts energy drink units by quantity and ignores pending", () => {
    const s = habitStats(txs, ["monster"], "2026-10-08", "2026-11-04");
    expect(s).toEqual({ count: 5, orders: 2, total: 8.2, avgUnit: 1.64 });
  });
  it("counts every item from a takeaway retailer", () => {
    expect(habitStats(txs, ["deliveroo"], "2026-10-08", "2026-11-04").total).toBe(14.99);
  });
  it("counts no-spend days in the elapsed part of the cycle", () => {
    const p = pulse(txs, "2026-10-08", "2026-11-04", "2026-10-14");
    expect(p.daysElapsed).toBe(7);
    expect(p.noSpend).toBe(4);
    expect(p.streak).toBe(0);
  });
  it("finds best and highest price for repeat items", () => {
    const m = priceChecks(txs).find((x) => x.item === "Monster Ultra")!;
    expect(m.low).toMatchObject({ price: 1.5, retailer: "Tesco" });
    expect(m.high).toMatchObject({ price: 2.2, retailer: "Premier" });
  });
});

import { pastCycleWindows } from "../api/insights-ai.functions";
describe("pastCycleWindows", () => {
  it("steps back 28 days per four-weekly cycle with no gaps", () => {
    const w = pastCycleWindows("2026-10-08", "2026-11-04", "four-weekly", 3);
    expect(w).toEqual([
      { start: "2026-10-08", end: "2026-11-04" },
      { start: "2026-09-10", end: "2026-10-07" },
      { start: "2026-08-13", end: "2026-09-09" },
    ]);
  });
});
