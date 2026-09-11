import { describe, expect, it } from "vitest";
import { carryoverHasDrifted, isAutoCarryoverRow, leftoverFromRows } from "@/lib/carryover";

describe("leftoverFromRows", () => {
  it("is income minus main expenses minus net savings", () => {
    const leftover = leftoverFromRows(
      [{ total_amount: 100, payment_splits: null }],
      [{ amount: 500 }],
      [{ kind: "deposit", amount: 50 }],
    );
    expect(leftover).toBe(350);
  });

  it("excludes BNPL splits from main expenses", () => {
    const leftover = leftoverFromRows(
      [{ total_amount: 100, payment_splits: [{ source: "bnpl:x", amount: 75 }] }],
      [{ amount: 100 }],
      [],
    );
    expect(leftover).toBe(75);
  });

  it("adds withdrawals back to the main balance", () => {
    expect(leftoverFromRows([], [], [{ kind: "withdrawal", amount: 20 }])).toBe(20);
  });

  it("matches the real-world regression: a re-dated purchase inflates the window", () => {
    const incomes = [{ amount: 1072.77 }];
    const savingsNet = [{ kind: "withdrawal" as const, amount: 83.93 }];
    const stale = leftoverFromRows(
      [{ total_amount: 994.91, payment_splits: null }, { total_amount: 56.74, payment_splits: null }],
      incomes,
      savingsNet,
    );
    const fresh = leftoverFromRows(
      [{ total_amount: 994.91, payment_splits: null }],
      incomes,
      savingsNet,
    );
    expect(stale).toBe(105.05);
    expect(fresh).toBe(161.79);
    expect(carryoverHasDrifted(stale, fresh)).toBe(true);
  });
});

describe("carryoverHasDrifted", () => {
  it("ignores sub-penny noise", () => {
    expect(carryoverHasDrifted(161.79, 161.79)).toBe(false);
    expect(carryoverHasDrifted(161.79, 161.792)).toBe(false);
  });

  it("flags a real difference", () => {
    expect(carryoverHasDrifted(161.79, 161.78)).toBe(true);
  });
});

describe("isAutoCarryoverRow", () => {
  it("accepts app-generated rows", () => {
    expect(
      isAutoCarryoverRow({
        source: "Carryover from previous cycle",
        notes: "Auto-generated carryover:2026-08-14 · from 2026-08-14 → 2026-09-10",
      }),
    ).toBe(true);
  });

  it("never touches manually entered income", () => {
    expect(isAutoCarryoverRow({ source: "DWP UC", notes: null })).toBe(false);
    expect(
      isAutoCarryoverRow({ source: "Carryover from previous cycle", notes: "my own note" }),
    ).toBe(false);
  });
});
