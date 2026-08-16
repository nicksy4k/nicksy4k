import { describe, expect, it } from "vitest";
import { CYCLES_PER_YEAR, perCycleAmount, perCycleTotal } from "../outgoings";
import type { Commitment } from "../types";

function commitment(partial: Partial<Commitment>): Commitment {
  return {
    id: crypto.randomUUID(),
    item_name: "Item",
    store: "Store",
    payment_method: "Card",
    amount: 10,
    last_paid_date: null,
    next_due_date: "2026-08-20",
    prev_due_date: null,
    notes: null,
    paid: false,
    category: "Bills",
    is_subscription: false,
    cadence: "monthly",
    ...partial,
  } as Commitment;
}

describe("perCycleAmount", () => {
  it("leaves a monthly charge untouched on a monthly cycle", () => {
    expect(perCycleAmount(30, "monthly", "monthly")).toBe(30);
  });

  it("spreads an annual charge over 12 monthly cycles", () => {
    expect(perCycleAmount(120, "annual", "monthly")).toBe(10);
  });

  it("spreads an annual charge over 13 four-weekly cycles", () => {
    expect(perCycleAmount(130, "annual", "four-weekly")).toBeCloseTo(10, 10);
  });

  it("scales a monthly charge down on a four-weekly cycle", () => {
    // 12 charges a year across 13 cycles.
    expect(perCycleAmount(130, "monthly", "four-weekly")).toBeCloseTo(120, 10);
  });

  it("scales weekly and fortnightly charges to the cycle length", () => {
    expect(perCycleAmount(10, "weekly", "monthly")).toBeCloseTo((10 * 52) / 12, 10);
    expect(perCycleAmount(10, "weekly", "four-weekly")).toBeCloseTo(40, 10);
    expect(perCycleAmount(20, "fortnightly", "four-weekly")).toBeCloseTo(40, 10);
  });

  it("matches a four-weekly charge one-for-one on a four-weekly cycle", () => {
    expect(perCycleAmount(25, "four-weekly", "four-weekly")).toBeCloseTo(25, 10);
  });

  it("treats an unknown or missing cadence as one charge per cycle", () => {
    expect(perCycleAmount(15, undefined, "four-weekly")).toBe(15);
    expect(perCycleAmount(15, "quarterly", "monthly")).toBe(15);
  });

  it("knows how many cycles fall in a year", () => {
    expect(CYCLES_PER_YEAR.monthly).toBe(12);
    expect(CYCLES_PER_YEAR["four-weekly"]).toBe(13);
  });
});

describe("perCycleTotal", () => {
  const items = [
    commitment({ amount: 100, cadence: "monthly", is_subscription: false }),
    commitment({ amount: 12, cadence: "monthly", is_subscription: true }),
    commitment({ amount: 120, cadence: "annual", is_subscription: true }),
  ];

  it("splits bills and subscriptions on a monthly cycle", () => {
    const t = perCycleTotal(items, "monthly");
    expect(t.bills).toBeCloseTo(100, 10);
    expect(t.subs).toBeCloseTo(22, 10); // 12 + 120/12
    expect(t.total).toBeCloseTo(122, 10);
    expect(t.count).toBe(3);
  });

  it("charges less per cycle on a four-weekly cycle", () => {
    const monthly = perCycleTotal(items, "monthly");
    const fourWeekly = perCycleTotal(items, "four-weekly");
    expect(fourWeekly.total).toBeCloseTo((monthly.total * 12) / 13, 10);
    expect(fourWeekly.total).toBeLessThan(monthly.total);
  });

  it("defaults to a monthly cycle when none is given", () => {
    expect(perCycleTotal(items).total).toBeCloseTo(perCycleTotal(items, "monthly").total, 10);
  });

  it("returns zeroes for an empty list", () => {
    expect(perCycleTotal([], "four-weekly")).toEqual({ bills: 0, subs: 0, total: 0, count: 0 });
  });

  it("uses the live amount so promo pricing is reflected", () => {
    const promo = [
      commitment({
        amount: 5,
        standard_price: 15,
        promo_price: 5,
        cadence: "monthly",
        is_subscription: true,
      }),
    ];
    expect(perCycleTotal(promo, "monthly").subs).toBe(5);
  });
});
