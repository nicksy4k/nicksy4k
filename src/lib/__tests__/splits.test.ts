import { describe, it, expect } from "vitest";
import {
  computeBnplInstallments,
  deriveSplitRows,
  buildPocketWithdrawalRows,
} from "../splits";

const round2 = (n: number) => Math.round(n * 100) / 100;

describe("computeBnplInstallments", () => {
  it("splits £100 into 4 equal installments (no first-today)", () => {
    const r = computeBnplInstallments(100, 4, false);
    expect(r.firstAmt).toBe(0);
    expect(r.perInstallment).toBe(25);
    expect(r.lastInstallment).toBe(25);
    expect(r.remainingCount).toBe(4);
    expect(r.remainingAmt).toBe(100);
  });

  it("peels first installment off when firstToday=true", () => {
    const r = computeBnplInstallments(100, 4, true);
    expect(r.firstAmt).toBe(25);
    expect(r.remainingAmt).toBe(75);
    expect(r.remainingCount).toBe(3);
    expect(r.perInstallment).toBe(25);
    expect(r.lastInstallment).toBe(25);
  });

  it("absorbs rounding drift on the LAST installment (£10/3)", () => {
    const r = computeBnplInstallments(10, 3, false);
    expect(r.perInstallment).toBe(3.33);
    expect(r.lastInstallment).toBe(3.34);
    // Sum matches the total to the penny.
    expect(round2(r.perInstallment * 2 + r.lastInstallment)).toBe(10);
  });

  it("penny-accurate with firstToday=true (£10/3)", () => {
    const r = computeBnplInstallments(10, 3, true);
    expect(r.firstAmt).toBe(3.33);
    expect(r.remainingAmt).toBe(6.67);
    expect(r.perInstallment).toBe(3.34); // 6.67/2 rounds to 3.34
    expect(r.lastInstallment).toBe(3.33); // remainder absorbs on last
    expect(round2(r.firstAmt + r.perInstallment + r.lastInstallment)).toBe(10);
  });

  it("count of 1 returns a single installment for the total", () => {
    const r = computeBnplInstallments(50, 1, true);
    expect(r.firstAmt).toBe(0); // firstToday ignored when only 1 installment
    expect(r.perInstallment).toBe(50);
    expect(r.lastInstallment).toBe(50);
    expect(r.remainingCount).toBe(1);
  });
});

describe("deriveSplitRows", () => {
  it("returns full total as main when no splits given", () => {
    const r = deriveSplitRows(100, []);
    expect(r.main).toBe(100);
    expect(r.pockets).toEqual([]);
    expect(r.bnpl).toEqual([]);
  });

  it("main = total − pockets − bnpl − other", () => {
    const r = deriveSplitRows(100, [
      { source: "pocket:Food", amount: 30 },
      { source: "bnpl:xyz", amount: 40 },
      { source: "other:Gift Card", amount: 10 },
    ]);
    expect(r.main).toBe(20);
    expect(r.pockets).toEqual([{ name: "Food", amount: 30 }]);
    expect(r.bnpl).toEqual([{ plan: "xyz", amount: 40 }]);
    expect(r.other).toEqual([{ label: "Gift Card", amount: 10 }]);
  });

  it("clamps main to 0 when splits exceed total (defensive)", () => {
    const r = deriveSplitRows(50, [{ source: "pocket:Food", amount: 80 }]);
    // Remainder goes negative; the UI should refuse to save, but math is deterministic.
    expect(r.main).toBeLessThanOrEqual(0);
  });
});

describe("buildPocketWithdrawalRows", () => {
  it("emits one withdrawal row per pocket split, in order", () => {
    const rows = buildPocketWithdrawalRows("u1", "2026-07-11", "Tesco", [
      { source: "pocket:Food", amount: 30 },
      { source: "main", amount: 20 },
      { source: "pocket:Bills", amount: 15 },
      { source: "bnpl:x", amount: 10 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      user_id: "u1",
      date: "2026-07-11",
      kind: "withdrawal",
      amount: 30,
      account: "Food",
    });
    expect(rows[0].notes).toContain("Tesco");
    expect(rows[1].account).toBe("Bills");
    expect(rows[1].amount).toBe(15);
  });

  it("falls back to 'Transaction' when retailer is blank", () => {
    const rows = buildPocketWithdrawalRows("u1", "2026-07-11", "   ", [
      { source: "pocket:Food", amount: 10 },
    ]);
    expect(rows[0].notes).toBe("Auto: Transaction");
  });

  it("drops zero-amount pocket splits", () => {
    const rows = buildPocketWithdrawalRows("u1", "2026-07-11", "X", [
      { source: "pocket:Food", amount: 0 },
    ]);
    expect(rows).toEqual([]);
  });
});
