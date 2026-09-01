import { describe, expect, it } from "vitest";

import { amountForCount, applyExtraPayment, buildLoanPlan, stepDate } from "../loanPlan";
import type { LedgerPayment, Loan } from "../types";

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "l1",
    person_name: "Alex",
    total_amount: 600,
    start_date: "2026-01-01",
    payments: [],
    created_at: "2026-01-01T00:00:00Z",
    plan_amount: 100,
    plan_cadence: "monthly",
    plan_start_date: "2026-02-01",
    plan_next_due: "2026-02-01",
    ...overrides,
  };
}

const pay = (amount: number, date = "2026-02-01"): LedgerPayment => ({
  id: crypto.randomUUID(),
  date,
  amount,
  type: "payment",
});

describe("stepDate", () => {
  it("steps each cadence", () => {
    expect(stepDate("2026-01-01", "weekly")).toBe("2026-01-08");
    expect(stepDate("2026-01-01", "fortnightly")).toBe("2026-01-15");
    expect(stepDate("2026-01-01", "four_weekly")).toBe("2026-01-29");
    expect(stepDate("2026-01-01", "monthly")).toBe("2026-02-01");
    expect(stepDate("2026-01-01", "weekly", 3)).toBe("2026-01-22");
  });
});

describe("buildLoanPlan", () => {
  it("returns null without a plan", () => {
    expect(buildLoanPlan(loan({ plan_amount: null, plan_cadence: null }))).toBeNull();
  });

  it("builds a full schedule and clear date", () => {
    const p = buildLoanPlan(loan(), "2026-01-15")!;
    expect(p.totalCount).toBe(6);
    expect(p.remainingCount).toBe(6);
    expect(p.nextDue?.dueDate).toBe("2026-02-01");
    expect(p.projectedClearDate).toBe("2026-07-01");
    expect(p.overdueBy).toBe(0);
  });

  it("marks paid instalments and advances the next due date", () => {
    const p = buildLoanPlan(loan({ payments: [pay(200)], plan_next_due: "2026-04-01" }), "2026-03-15")!;
    expect(p.paidCount).toBe(2);
    expect(p.remainingCount).toBe(4);
    expect(p.nextDue?.dueDate).toBe("2026-04-01");
    expect(p.projectedClearDate).toBe("2026-07-01");
  });

  it("treats a short payment as a part instalment", () => {
    const p = buildLoanPlan(loan({ payments: [pay(40)] }), "2026-01-15")!;
    expect(p.nextDue?.status).toBe("part");
    expect(p.nextDue?.covered).toBe(40);
    expect(p.remaining).toBe(560);
  });

  it("flags overdue instalments", () => {
    const p = buildLoanPlan(loan(), "2026-02-06")!;
    expect(p.overdueBy).toBe(5);
    expect(p.nextDue?.status).toBe("due");
  });

  it("ignores top-ups when counting repayments", () => {
    const topup: LedgerPayment = { id: "t", date: "2026-02-01", amount: 100, type: "topup" };
    const p = buildLoanPlan(loan({ total_amount: 700, payments: [topup, pay(100)] }), "2026-02-02")!;
    expect(p.paid).toBe(100);
    expect(p.paidCount).toBe(1);
    expect(p.totalCount).toBe(7);
  });

  it("uses an uneven final instalment", () => {
    const p = buildLoanPlan(loan({ total_amount: 250 }), "2026-01-01")!;
    expect(p.totalCount).toBe(3);
    expect(p.schedule[2]!.amount).toBeCloseTo(50, 2);
  });

  it("reports no clear date once settled", () => {
    const p = buildLoanPlan(loan({ payments: [pay(600)] }), "2026-02-01")!;
    expect(p.remaining).toBe(0);
    expect(p.projectedClearDate).toBeNull();
    expect(p.nextDue).toBeNull();
  });
});

describe("top-up repayment adjustments", () => {
  it("adds a one-off repayment before the next regular payment", () => {
    const p = buildLoanPlan(
      loan({
        total_amount: 603,
        plan_next_due: "2026-09-19",
        repayment_adjustments: [
          { id: "extra", due_date: "2026-09-10", amount: 3, type: "extra" },
        ],
      }),
      "2026-09-01",
    )!;
    expect(p.schedule[0]!.kind).toBe("extra");
    expect(p.schedule[0]!.dueDate).toBe("2026-09-10");
    expect(p.schedule[0]!.amount).toBe(3);
    expect(p.nextDue?.dueDate).toBe("2026-09-10");
  });

  it("increases the next regular payment without changing the cadence", () => {
    const p = buildLoanPlan(
      loan({
        total_amount: 603,
        plan_next_due: "2026-09-19",
        repayment_adjustments: [
          { id: "increase", due_date: "2026-09-19", amount: 3, type: "increase" },
        ],
      }),
      "2026-09-01",
    )!;
    expect(p.schedule[0]!.amount).toBe(103);
    expect(p.schedule[1]!.dueDate).toBe("2026-10-19");
    expect(p.schedule.reduce((sum, entry) => sum + entry.amount, 0)).toBeCloseTo(603, 2);
  });
});

describe("scheduled one-off repayments", () => {
  it("keeps the regular cadence while including an extra payment on its own date", () => {
    const p = buildLoanPlan(
      loan({
        repayment_adjustments: [
          { id: "michelle-extra", due_date: "2026-02-10", amount: 3, type: "extra" },
        ],
      }),
      "2026-02-01",
    )!;

    expect(p.schedule[0]).toMatchObject({ kind: "regular", dueDate: "2026-02-01", amount: 100 });
    expect(p.schedule[1]).toMatchObject({ kind: "extra", dueDate: "2026-02-10", amount: 3 });
    expect(p.schedule[2]).toMatchObject({ kind: "regular", dueDate: "2026-03-01", amount: 100 });
    expect(p.projectedClearDate).toBe("2026-07-01");
    expect(p.remaining).toBe(600);
  });
});

describe("applyExtraPayment", () => {
  it("shortens the plan", () => {
    const r = applyExtraPayment(loan(), 200, "2026-01-15")!;
    expect(r.paymentsSaved).toBe(2);
    expect(r.oldClearDate).toBe("2026-07-01");
    expect(r.newClearDate).toBe("2026-05-01");
  });
});

describe("amountForCount", () => {
  it("divides the total", () => {
    expect(amountForCount(600, 6)).toBe(100);
    expect(amountForCount(100, 3)).toBe(33.33);
  });
});

describe("payments made before the plan started", () => {
  it("does not shrink the first scheduled instalment", () => {
    const p = buildLoanPlan(
      loan({ payments: [pay(29, "2026-01-18")] }),
      "2026-01-20",
    )!;
    expect(p.nextDue?.amount).toBe(100);
    expect(p.nextDue?.covered).toBe(0);
    expect(p.nextDue?.dueDate).toBe("2026-02-01");
    // 571 outstanding at plan start => 6 instalments (5 x 100 + 71)
    expect(p.totalCount).toBe(6);
    expect(p.schedule[5]!.amount).toBe(71);
  });

  it("still counts payments made after the plan started", () => {
    const p = buildLoanPlan(
      loan({ payments: [pay(29, "2026-01-18"), pay(40, "2026-02-01")] }),
      "2026-02-02",
    )!;
    expect(p.nextDue?.amount).toBe(100);
    expect(p.nextDue?.covered).toBe(40);
  });
});

describe("counting payments toward the plan", () => {
  it("counts a payment made after the plan was set up but before the first due date", () => {
    const p = buildLoanPlan(
      loan({
        plan_start_date: "2026-08-19",
        plan_next_due: "2026-08-19",
        plan_created_at: "2026-08-17T10:00:00Z",
        payments: [pay(100, "2026-08-18")],
      }),
      "2026-08-19",
    )!;
    expect(p.schedule[0]!.status).toBe("paid");
    expect(p.paidCount).toBe(1);
  });

  it("counts a payment explicitly linked to an instalment", () => {
    const linked: LedgerPayment = {
      id: "x",
      date: "2026-01-18",
      amount: 100,
      type: "payment",
      instalment_due_date: "2026-02-01",
    };
    const p = buildLoanPlan(loan({ payments: [linked] }), "2026-01-20")!;
    expect(p.schedule[0]!.status).toBe("paid");
    // Remaining instalments re-date from the stored next-due; the UI advances it.
    expect(p.paidCount).toBe(1);
  });

  it("still excludes untouched pre-plan history", () => {
    const p = buildLoanPlan(loan({ payments: [pay(29, "2026-01-18")] }), "2026-01-20")!;
    expect(p.nextDue?.covered).toBe(0);
  });
});

describe("payments linked to a previous plan", () => {
  it("does not count them against the new plan's instalments", () => {
    const old: LedgerPayment = {
      id: "old",
      date: "2026-08-18",
      amount: 100,
      type: "payment",
      instalment_due_date: "2026-08-19",
    };
    const p = buildLoanPlan(
      loan({
        payments: [old],
        plan_start_date: "2026-09-19",
        plan_next_due: "2026-09-19",
        plan_created_at: "2026-09-01T15:00:00Z",
      }),
      "2026-09-01",
    )!;
    expect(p.paidCount).toBe(0);
    expect(p.schedule[0]!.dueDate).toBe("2026-09-19");
    expect(new Set(p.schedule.map((s) => s.dueDate)).size).toBe(p.schedule.length);
  });
});
