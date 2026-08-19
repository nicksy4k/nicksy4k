import { describe, expect, it } from "vitest";
import { CYCLES_PER_YEAR, dueSoonOutgoings, perCycleAmount, perCycleTotal } from "../outgoings";
import type { Commitment, SavingsEntry } from "../types";

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

describe("dueSoonOutgoings", () => {
  const now = new Date("2026-08-19T12:00:00Z");
  const pocket = (amount: number): SavingsEntry[] => [
    {
      id: "s1",
      date: "2026-08-01",
      kind: "deposit",
      amount,
      account: "Bill Money",
      notes: undefined,
      created_at: "2026-08-01",
    } as SavingsEntry,
  ];

  it("only returns unpaid rows due within the window, overdue first", () => {
    const rows = dueSoonOutgoings(
      [
        commitment({ item_name: "Late", amount: 10, next_due_date: "2026-08-15" }),
        commitment({ item_name: "Soon", amount: 10, next_due_date: "2026-08-22" }),
        commitment({ item_name: "Later", amount: 10, next_due_date: "2026-09-30" }),
        commitment({ item_name: "Done", amount: 10, next_due_date: "2026-08-20", paid: true }),
      ],
      pocket(1000),
      now,
    ).rows;
    expect(rows.map((r) => r.commitment.item_name)).toEqual(["Late", "Soon"]);
    expect(rows[0].overdue).toBe(true);
    expect(rows[0].daysUntil).toBe(-4);
    expect(rows[1].daysUntil).toBe(3);
  });

  it("waterfalls the Bill Money pocket in due order", () => {
    const { rows, totalDue, pocketBalance } = dueSoonOutgoings(
      [
        commitment({ item_name: "A", amount: 40, next_due_date: "2026-08-20" }),
        commitment({ item_name: "B", amount: 40, next_due_date: "2026-08-21" }),
        commitment({ item_name: "C", amount: 40, next_due_date: "2026-08-22" }),
      ],
      pocket(50),
      now,
    );
    expect(pocketBalance).toBe(50);
    expect(totalDue).toBe(120);
    expect(rows.map((r) => r.funded)).toEqual(["full", "partial", "none"]);
  });

  it("lets earlier unpaid rows outside the window consume the pocket first", () => {
    const { rows } = dueSoonOutgoings(
      [
        commitment({ item_name: "Overdue big", amount: 100, next_due_date: "2026-08-01" }),
        commitment({ item_name: "Upcoming", amount: 20, next_due_date: "2026-08-21" }),
      ],
      pocket(100),
      now,
    );
    expect(rows.find((r) => r.commitment.item_name === "Upcoming")!.funded).toBe("none");
  });
});
