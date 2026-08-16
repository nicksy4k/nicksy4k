import { describe, expect, it } from "vitest";

import { buildPriceHistory, recentForSuggestions } from "../suggestions";
import type { Transaction } from "../types";

function tx(date: string, name: string, price: number): Transaction {
  return {
    id: `${date}-${name}`,
    date,
    retailer: "Shop",
    total_amount: price,
    receipt_attached: false,
    receipt_type: "None",
    receipt_location: "",
    notes: "",
    items: [{ id: `${date}-${name}-i`, item_name: name, price, quantity: 1, category: "Food" }],
  } as unknown as Transaction;
}

describe("recentForSuggestions", () => {
  it("returns the input untouched when under the limit", () => {
    const list = [tx("2026-01-01", "Milk", 1)];
    expect(recentForSuggestions(list, 10)).toBe(list);
  });

  it("keeps only the newest transactions", () => {
    const list = [tx("2024-01-01", "Old", 1), tx("2026-01-01", "New", 2)];
    const out = recentForSuggestions(list, 1);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-01-01");
  });

  it("bounds the price history it builds", () => {
    const many = Array.from({ length: 400 }, (_, i) =>
      tx(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`, `item-${i}`, i + 1),
    );
    const history = buildPriceHistory(many);
    expect(history.size).toBeLessThanOrEqual(300);
  });
});
