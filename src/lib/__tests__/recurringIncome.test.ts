import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock, type SupabaseMock } from "./mocks/supabase";

let mock: SupabaseMock;

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return mock.client;
  },
}));

// Import AFTER vi.mock so the module resolves to the mock.
import { applyAllocations, computeCoverAmount } from "../recurringIncome";
import type { RecurringIncome } from "../types";

function template(
  amount: number,
  allocations: RecurringIncome["allocations"],
): RecurringIncome {
  return {
    id: "t1",
    user_id: "user-1",
    source: "Salary",
    amount,
    cadence: "monthly",
    next_date: "2026-07-01",
    category: "Salary",
    notes: null,
    active: true,
    last_generated_date: null,
    allocations,
    created_at: "",
    updated_at: "",
  } as unknown as RecurringIncome;
}

beforeEach(() => {
  mock = createSupabaseMock();
});

describe("computeCoverAmount", () => {
  it("includes only commitments inside [from, to)", () => {
    const commits = [
      { amount: 100, next_due_date: "2026-07-05" }, // in
      { amount: 50, next_due_date: "2026-08-05" }, // out (>= to)
      { amount: 25, next_due_date: "2026-06-30" }, // out (< from)
      { amount: 200, next_due_date: null }, // ignored
    ];
    const bal = new Map<string, number>();
    const inFlight = new Map<string, number>();
    expect(
      computeCoverAmount("Bills", "2026-07-01", "2026-08-01", commits, bal, inFlight),
    ).toBe(100);
  });

  it("subtracts existing pocket balance", () => {
    const commits = [{ amount: 300, next_due_date: "2026-07-05" }];
    const bal = new Map([["Bills", 200]]);
    const inFlight = new Map<string, number>();
    expect(
      computeCoverAmount("Bills", "2026-07-01", "2026-08-01", commits, bal, inFlight),
    ).toBe(100);
  });

  it("subtracts in-flight deposits so a second template doesn't double-fund", () => {
    const commits = [{ amount: 300, next_due_date: "2026-07-05" }];
    const bal = new Map<string, number>();
    const inFlight = new Map([["Bills", 300]]);
    expect(
      computeCoverAmount("Bills", "2026-07-01", "2026-08-01", commits, bal, inFlight),
    ).toBe(0);
  });

  it("clamps to zero when balance exceeds need", () => {
    const commits = [{ amount: 100, next_due_date: "2026-07-05" }];
    const bal = new Map([["Bills", 500]]);
    expect(
      computeCoverAmount("Bills", "2026-07-01", "2026-08-01", commits, bal, new Map()),
    ).toBe(0);
  });
});

describe("applyAllocations", () => {
  it("funds fixed allocations in order and leaves remainder for main", async () => {
    const tpl = template(579, [
      { kind: "fixed", pocket: "Food", amount: 300, order: 1 },
      { kind: "fixed", pocket: "Bills", amount: 200, order: 2 },
    ]);
    const warnings = await applyAllocations({
      userId: "user-1",
      template: tpl,
      postDate: "2026-07-01",
      nextDate: "2026-08-01",
      inFlight: new Map(),
      commitments: [],
      pocketBalances: new Map(),
    });
    expect(warnings).toEqual([]);
    const rows = mock.inserts["savings"] ?? [];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ account: "Food", amount: 300, kind: "deposit" });
    expect(rows[1]).toMatchObject({ account: "Bills", amount: 200, kind: "deposit" });
  });

  it("clips a later allocation when income runs out and warns", async () => {
    const tpl = template(400, [
      { kind: "fixed", pocket: "Food", amount: 300, order: 1 },
      { kind: "fixed", pocket: "Bills", amount: 200, order: 2 },
    ]);
    const warnings = await applyAllocations({
      userId: "user-1",
      template: tpl,
      postDate: "2026-07-01",
      nextDate: "2026-08-01",
      inFlight: new Map(),
      commitments: [],
      pocketBalances: new Map(),
    });
    expect(warnings.length).toBe(1);
    const rows = mock.inserts["savings"] ?? [];
    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBe(300);
    expect(rows[1].amount).toBe(100);
  });

  it("cover_commitments only tops up the gap", async () => {
    const tpl = template(1000, [
      { kind: "cover_commitments", pocket: "Bills", amount: 0, order: 1 },
    ]);
    await applyAllocations({
      userId: "user-1",
      template: tpl,
      postDate: "2026-07-01",
      nextDate: "2026-08-01",
      inFlight: new Map(),
      commitments: [{ amount: 250, next_due_date: "2026-07-15" }],
      pocketBalances: new Map([["Bills", 100]]),
    });
    const rows = mock.inserts["savings"] ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ account: "Bills", amount: 150 });
  });

  it("cover_commitments deposits nothing when balance already covers", async () => {
    const tpl = template(1000, [
      { kind: "cover_commitments", pocket: "Bills", amount: 0, order: 1 },
    ]);
    await applyAllocations({
      userId: "user-1",
      template: tpl,
      postDate: "2026-07-01",
      nextDate: "2026-08-01",
      inFlight: new Map(),
      commitments: [{ amount: 250, next_due_date: "2026-07-15" }],
      pocketBalances: new Map([["Bills", 500]]),
    });
    expect(mock.inserts["savings"] ?? []).toEqual([]);
  });

  it("shared inFlight prevents double-funding across two templates", async () => {
    const commits = [{ amount: 300, next_due_date: "2026-07-15" }];
    const bal = new Map<string, number>();
    const inFlight = new Map<string, number>();

    // Template A: fixed 300 into Bills.
    await applyAllocations({
      userId: "user-1",
      template: template(500, [
        { kind: "fixed", pocket: "Bills", amount: 300, order: 1 },
      ]),
      postDate: "2026-07-01",
      nextDate: "2026-08-01",
      inFlight,
      commitments: commits,
      pocketBalances: bal,
    });
    // Template B: cover_commitments — should see A's 300 in-flight and deposit 0.
    await applyAllocations({
      userId: "user-1",
      template: template(500, [
        { kind: "cover_commitments", pocket: "Bills", amount: 0, order: 1 },
      ]),
      postDate: "2026-07-01",
      nextDate: "2026-08-01",
      inFlight,
      commitments: commits,
      pocketBalances: bal,
    });

    const rows = mock.inserts["savings"] ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ account: "Bills", amount: 300 });
  });

  it("respects allocation order — first alloc wins, second gets clipped", async () => {
    const tpl = template(100, [
      { kind: "fixed", pocket: "Food", amount: 80, order: 1 },
      { kind: "fixed", pocket: "Bills", amount: 50, order: 2 },
    ]);
    const warnings = await applyAllocations({
      userId: "user-1",
      template: tpl,
      postDate: "2026-07-01",
      nextDate: "2026-08-01",
      inFlight: new Map(),
      commitments: [],
      pocketBalances: new Map(),
    });
    expect(warnings.length).toBe(1);
    const rows = mock.inserts["savings"] ?? [];
    expect(rows[0]).toMatchObject({ account: "Food", amount: 80 });
    expect(rows[1]).toMatchObject({ account: "Bills", amount: 20 });
  });
});
