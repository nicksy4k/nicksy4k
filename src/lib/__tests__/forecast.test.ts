import { describe, expect, it } from "vitest";
import { computeSafeToSpend } from "@/lib/forecast";
import type { ActiveCycle } from "@/lib/cycle";
import type { Commitment, IncomeEntry, SavingsEntry, Transaction } from "@/lib/types";

function cycle(startISO: string, endISO: string): ActiveCycle {
  return {
    startISO,
    endISO,
    start: new Date(startISO + "T00:00:00"),
    end: new Date(endISO + "T00:00:00"),
    isOverridden: false,
    type: "monthly",
  };
}

function tx(total: number, date: string, opts?: { is_pending?: boolean; bnpl?: number }): Transaction {
  return {
    id: crypto.randomUUID(),
    date,
    retailer: "Shop",
    total_amount: total,
    receipt_attached: false,
    receipt_type: "None",
    receipt_location: "",
    items: [],
    is_pending: opts?.is_pending ?? false,
    payment_splits: opts?.bnpl ? [{ source: `bnpl:${crypto.randomUUID()}`, amount: opts.bnpl }] : [],
    created_at: new Date().toISOString(),
  } as Transaction;
}

function income(amount: number, date: string): IncomeEntry {
  return {
    id: crypto.randomUUID(),
    date,
    source: "Salary",
    amount,
    category: "Salary",
    created_at: new Date().toISOString(),
  };
}

function saving(amount: number, date: string, kind: "deposit" | "withdrawal" = "deposit", account = "Bill Money"): SavingsEntry {
  return {
    id: crypto.randomUUID(),
    date,
    kind,
    amount,
    account,
    created_at: new Date().toISOString(),
  };
}

function commitment(amount: number, nextDue: string, paid = false): Commitment {
  return {
    id: crypto.randomUUID(),
    item_name: "Bill",
    store: "Provider",
    payment_method: "Card",
    amount,
    category: "Household",
    paid,
    next_due_date: nextDue,
    cadence: "monthly",
    is_subscription: false,
    created_at: new Date().toISOString(),
  };
}

describe("computeSafeToSpend", () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const start = `${year}-${month}-01`;
  const end = `${year}-${month}-${new Date(year, today.getMonth() + 1, 0).getDate()}`;

  it("returns full main balance when no unpaid outgoings", () => {
    const c = cycle(start, end);
    const res = computeSafeToSpend({
      cycle: c,
      incomes: [income(1000, start)],
      transactions: [tx(200, start)],
      savings: [saving(100, start)],
      commitments: [],
    });
    expect(res.mainBalance).toBe(700);
    expect(res.unpaidOutgoings).toBe(0);
    expect(res.safeToSpend).toBe(700);
  });

  it("subtracts unpaid outgoings due inside the cycle", () => {
    const c = cycle(start, end);
    const res = computeSafeToSpend({
      cycle: c,
      incomes: [income(1000, start)],
      transactions: [tx(200, start)],
      savings: [],
      commitments: [commitment(300, `${year}-${month}-15`)],
    });
    expect(res.mainBalance).toBe(800);
    expect(res.unpaidOutgoings).toBe(300);
    expect(res.safeToSpend).toBe(500);
    expect(res.unpaidCount).toBe(1);
  });

  it("ignores paid outgoings", () => {
    const c = cycle(start, end);
    const res = computeSafeToSpend({
      cycle: c,
      incomes: [income(1000, start)],
      transactions: [tx(200, start)],
      savings: [],
      commitments: [commitment(300, `${year}-${month}-15`, true)],
    });
    expect(res.unpaidOutgoings).toBe(0);
    expect(res.safeToSpend).toBe(800);
  });

  it("ignores outgoings due after the cycle ends", () => {
    const c = cycle(start, end);
    const nextMonth = `${year}-${String(today.getMonth() + 2).padStart(2, "0")}-01`;
    const res = computeSafeToSpend({
      cycle: c,
      incomes: [income(1000, start)],
      transactions: [],
      savings: [],
      commitments: [commitment(300, nextMonth)],
    });
    expect(res.unpaidOutgoings).toBe(0);
    expect(res.safeToSpend).toBe(1000);
  });

  it("excludes pending transactions from expenses", () => {
    const c = cycle(start, end);
    const res = computeSafeToSpend({
      cycle: c,
      incomes: [income(1000, start)],
      transactions: [tx(200, start, { is_pending: true })],
      savings: [],
      commitments: [],
    });
    expect(res.mainBalance).toBe(1000);
    expect(res.safeToSpend).toBe(1000);
  });

  it("excludes BNPL portions from expenses", () => {
    const c = cycle(start, end);
    const res = computeSafeToSpend({
      cycle: c,
      incomes: [income(1000, start)],
      transactions: [tx(500, start, { bnpl: 300 })],
      savings: [],
      commitments: [],
    });
    expect(res.mainBalance).toBe(800);
    expect(res.safeToSpend).toBe(800);
  });

  it("handles four-weekly cycles", () => {
    const c: ActiveCycle = {
      startISO: "2026-08-03",
      endISO: "2026-08-30",
      start: new Date("2026-08-03T00:00:00"),
      end: new Date("2026-08-30T00:00:00"),
      isOverridden: false,
      type: "four-weekly",
    };
    const res = computeSafeToSpend({
      cycle: c,
      incomes: [income(1000, "2026-08-03")],
      transactions: [tx(200, "2026-08-10")],
      savings: [],
      commitments: [commitment(300, "2026-08-20")],
    });
    expect(res.mainBalance).toBe(800);
    expect(res.unpaidOutgoings).toBe(300);
    expect(res.safeToSpend).toBe(500);
  });

  it("returns zero per-day when on the last cycle day", () => {
    const lastDay = `${year}-${month}-${new Date(year, today.getMonth() + 1, 0).getDate()}`;
    const c = cycle(lastDay, lastDay);
    const res = computeSafeToSpend({
      cycle: c,
      incomes: [income(100, lastDay)],
      transactions: [],
      savings: [],
      commitments: [],
    });
    expect(res.daysRemaining).toBe(0);
    expect(res.perDay).toBe(res.safeToSpend);
  });
});
