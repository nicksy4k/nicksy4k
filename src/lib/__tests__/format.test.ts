import { describe, it, expect } from "vitest";
import { mainExpensePortion } from "../format";

describe("mainExpensePortion", () => {
  it("returns total when there are no splits", () => {
    expect(mainExpensePortion({ total_amount: 42.5 })).toBe(42.5);
  });

  it("returns total when splits are empty", () => {
    expect(mainExpensePortion({ total_amount: 20, payment_splits: [] })).toBe(20);
  });

  it("subtracts BNPL portion from total", () => {
    expect(
      mainExpensePortion({
        total_amount: 100,
        payment_splits: [{ source: "bnpl:abc", amount: 75 }],
      }),
    ).toBe(25);
  });

  it("ignores pocket splits (they net out against the transaction row)", () => {
    expect(
      mainExpensePortion({
        total_amount: 100,
        payment_splits: [
          { source: "pocket:Food", amount: 40 },
          { source: "main", amount: 60 },
        ],
      }),
    ).toBe(100);
  });

  it("only BNPL splits offset main when mixed with pockets", () => {
    expect(
      mainExpensePortion({
        total_amount: 100,
        payment_splits: [
          { source: "pocket:Food", amount: 30 },
          { source: "bnpl:x", amount: 50 },
          { source: "main", amount: 20 },
        ],
      }),
    ).toBe(50);
  });

  it("sums multiple BNPL splits", () => {
    expect(
      mainExpensePortion({
        total_amount: 100,
        payment_splits: [
          { source: "bnpl:a", amount: 30 },
          { source: "bnpl:b", amount: 20 },
        ],
      }),
    ).toBe(50);
  });
});
