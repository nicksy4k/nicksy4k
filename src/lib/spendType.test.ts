import { describe, it, expect } from "vitest";
import { categoryDefault, itemSpendType, spendSplit } from "./spendType";
import type { Transaction } from "./types";

const tx = (date: string, items: Transaction["items"]): Transaction =>
  ({ id: date, date, retailer: "x", total_amount: 0, receipt_attached: false, receipt_type: "None", receipt_location: "", items }) as Transaction;

describe("spend type", () => {
  it("Groceries, Household and Subscriptions default to Essential", () => {
    expect(categoryDefault("Groceries")).toBe("essential");
    expect(categoryDefault("Household")).toBe("essential");
    expect(categoryDefault("Subscriptions")).toBe("essential");
  });
  it("Entertainment and Clothing default to Fun", () => {
    expect(categoryDefault("Entertainment")).toBe("fun");
    expect(categoryDefault("Clothing")).toBe("fun");
  });
  it("item override wins over category default", () => {
    expect(itemSpendType({ category: "Groceries", spend_type: "fun" })).toBe("fun");
  });
  it("days with only essential spend count as no-impulse days", () => {
    const s = spendSplit(
      [
        tx("2026-11-05", [{ id: "a", item_name: "Milk", price: 1.5, category: "Groceries" }]),
        tx("2026-11-06", [{ id: "b", item_name: "Plushie", price: 12, category: "Entertainment" }]),
      ],
      "2026-11-05",
      "2026-12-02",
      "2026-11-07",
    );
    expect(s).toEqual({ essential: 1.5, fun: 12, elapsedDays: 3, noImpulseDays: 2 });
  });
});
