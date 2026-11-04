import { describe, it, expect } from "vitest";
import { categoryStats, priceChecks } from "./insights";

const tx = (date: string, retailer: string, items: any[]) => ({ id: date + retailer, date, retailer, items }) as any;
const txs = [
  tx("2026-10-01", "Asda", [{ item_name: "Bread", price: 1.2, category: "Groceries" }, { item_name: "Crisps", price: 2, category: "Snacks" }]),
  tx("2026-11-01", "Asda", [{ item_name: "Bread", price: 1.4, category: "Groceries" }, { item_name: "Postage", price: 3, category: "Groceries" }]),
  tx("2026-11-02", "Tesco", [{ item_name: "Bread", price: 1.6, category: "Groceries" }, { item_name: "Plush", price: 10, category: "Toys" }]),
  tx("2026-10-02", "Shop", [{ item_name: "Plush", price: 9, category: "Toys" }]),
];

describe("grocery & snack tracking", () => {
  it("price check skips grocery/snack items but keeps others", () => {
    const items = priceChecks(txs).map((p) => p.item);
    expect(items).toEqual(["Plush"]);
  });
  it("totals groceries per cycle, excluding postage, with average of earlier cycles", () => {
    const s = categoryStats(txs, "groceries", { startISO: "2026-10-29", endISO: "2026-11-25" }, [{ startISO: "2026-10-01", endISO: "2026-10-28" }]);
    expect(s.total).toBe(3);
    expect(s.shops).toBe(2);
    expect(s.avg).toBe(1.2);
    expect(s.changePct).toBe(150);
  });
});
