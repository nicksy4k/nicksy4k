import { describe, expect, it } from "vitest";
import { netMainEffect, planCredit, planDebit } from "../ledgerSync";

const args = { amount: 50, date: "2026-08-05", label: "Top-up loan · Sarah", category: "Loans" };

describe("planDebit", () => {
  it("pocket-funded outflow writes BOTH a withdrawal and a tagged transaction", () => {
    const plan = planDebit({ kind: "pocket", name: "Savings" }, args);
    expect(plan.saving).toMatchObject({ kind: "withdrawal", amount: 50, account: "Savings" });
    expect(plan.transaction).toMatchObject({
      retailer: "Top-up loan · Sarah",
      total_amount: 50,
      category: "Loans",
      payment_splits: [{ source: "pocket:Savings", amount: 50 }],
    });
    expect(netMainEffect(plan)).toBe(0);
  });

  it("main-funded outflow writes only the transaction and debits main", () => {
    const plan = planDebit({ kind: "main" }, args);
    expect(plan.saving).toBeNull();
    expect(plan.transaction?.payment_splits).toEqual([]);
    expect(netMainEffect(plan)).toBe(-50);
  });

  it("external source touches nothing", () => {
    const plan = planDebit({ kind: "other" }, args);
    expect(plan.saving).toBeNull();
    expect(plan.transaction).toBeNull();
    expect(netMainEffect(plan)).toBe(0);
  });

  it("defaults the category to Debt for debt payments", () => {
    const plan = planDebit({ kind: "pocket", name: "Buffer" }, { ...args, category: undefined });
    expect(plan.transaction?.category).toBe("Debt");
  });
});

describe("planCredit", () => {
  it("repayment into a pocket writes BOTH the deposit and the income", () => {
    const plan = planCredit({ kind: "pocket", name: "Savings" }, { ...args, category: undefined });
    expect(plan.saving).toMatchObject({ kind: "deposit", amount: 50, account: "Savings" });
    expect(plan.income).toMatchObject({ amount: 50, category: "Loan repayment" });
    expect(netMainEffect(plan)).toBe(0);
  });

  it("repayment into main writes only the income", () => {
    const plan = planCredit({ kind: "main" }, args);
    expect(plan.saving).toBeNull();
    expect(netMainEffect(plan)).toBe(50);
  });

  it("external repayment touches nothing", () => {
    const plan = planCredit({ kind: "other" }, args);
    expect(plan.income).toBeNull();
    expect(netMainEffect(plan)).toBe(0);
  });
});
