import { describe, it, expect } from "vitest";
import { categorySpendingInCycle, computeBudgetStatuses } from "@/lib/budgets";
import type { ActiveCycle } from "@/lib/cycle";

const cycle: ActiveCycle = {
  startISO: "2026-08-01",
  endISO: "2026-08-31",
  start: new Date("2026-08-01"),
  end: new Date("2026-08-31"),
  isOverridden: false,
  type: "monthly",
};

function tx(
  date: string,
  items: { category: string; price: number; quantity?: number }[],
  opts?: { is_pending?: boolean; payment_splits?: { source: string; amount: number }[] },
) {
  const total = items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
  return {
    date,
    is_pending: opts?.is_pending ?? false,
    total_amount: total,
    payment_splits: opts?.payment_splits ?? [],
    items,
  };
}

describe("categorySpendingInCycle", () => {
  it("sums spending by category", () => {
    const spending = categorySpendingInCycle(
      [
        tx("2026-08-05", [
          { category: "Groceries", price: 30, quantity: 1 },
          { category: "Household", price: 12, quantity: 1 },
        ]),
        tx("2026-08-10", [{ category: "Groceries", price: 25, quantity: 1 }]),
      ],
      cycle,
    );
    expect(spending.get("Groceries")).toBeCloseTo(55, 4);
    expect(spending.get("Household")).toBeCloseTo(12, 4);
  });

  it("ignores pending transactions", () => {
    const spending = categorySpendingInCycle(
      [tx("2026-08-05", [{ category: "Groceries", price: 50 }], { is_pending: true })],
      cycle,
    );
    expect(spending.get("Groceries")).toBeUndefined();
  });

  it("ignores transactions outside the cycle", () => {
    const spending = categorySpendingInCycle(
      [tx("2026-07-30", [{ category: "Groceries", price: 50 }])],
      cycle,
    );
    expect(spending.get("Groceries")).toBeUndefined();
  });

  it("excludes BNPL portions from main-balance spending", () => {
    const spending = categorySpendingInCycle(
      [
        tx(
          "2026-08-05",
          [{ category: "Electronics", price: 100 }],
          { payment_splits: [{ source: "bnpl:klarna", amount: 60 }] },
        ),
      ],
      cycle,
    );
    expect(spending.get("Electronics")).toBeCloseTo(40, 4);
  });

  it("respects item quantity", () => {
    const spending = categorySpendingInCycle(
      [tx("2026-08-05", [{ category: "Snacks", price: 2, quantity: 5 }])],
      cycle,
    );
    expect(spending.get("Snacks")).toBeCloseTo(10, 4);
  });
});

describe("computeBudgetStatuses", () => {
  it("marks under-pace budgets as ok", () => {
    const statuses = computeBudgetStatuses(
      [{ id: "1", user_id: "u1", category: "Groceries", amount: 200, cycle_type: "monthly", created_at: "", updated_at: "" }],
      new Map([["Groceries", 50]]),
      cycle,
    );
    expect(statuses[0].spent).toBe(50);
    expect(statuses[0].remaining).toBe(150);
    expect(statuses[0].percent).toBe(0.25);
    expect(statuses[0].tone).toBe("ok");
  });

  it("marks over-budget as danger", () => {
    const statuses = computeBudgetStatuses(
      [{ id: "1", user_id: "u1", category: "Groceries", amount: 100, cycle_type: "monthly", created_at: "", updated_at: "" }],
      new Map([["Groceries", 120]]),
      cycle,
    );
    expect(statuses[0].tone).toBe("danger");
  });

  it("marks near-budget as warning", () => {
    const statuses = computeBudgetStatuses(
      [{ id: "1", user_id: "u1", category: "Groceries", amount: 100, cycle_type: "monthly", created_at: "", updated_at: "" }],
      new Map([["Groceries", 85]]),
      cycle,
    );
    expect(statuses[0].tone).toBe("warning");
  });
});
