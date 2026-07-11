
## Goal

Lock down the two areas that have caused build/math regressions:
1. Recurring income → pocket allocations (waterfall order, clipping, `cover_commitments` need calc, in-flight tracking).
2. Settle-flow split payments (main-balance portion, pocket withdrawal rows, BNPL installment math with "first payment today").

Tests must run in CI-friendly fashion (`bun test` / `vitest run`), no network, no Supabase.

## Deliverables

### 1. Tooling

- Add dev deps: `vitest`, `@vitest/coverage-v8`, `happy-dom` (for any React helpers), `@types/node` already present.
- Add `vitest.config.ts` with `test.environment = "node"`, alias `@` → `src` (reuse `vite-tsconfig-paths`).
- Add scripts:
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`

### 2. Small refactors to make logic testable (no behaviour change)

- **`src/lib/recurringIncome.ts`**: export `computeCoverAmount` and the internal `applyAllocations` types so tests can drive it directly with in-memory caches (already exported; just export `computeCoverAmount`).
- **`src/lib/splits.ts`** (new): extract pure helpers currently inlined in `PaymentSplitEditor` / `history.tsx` / `new.tsx`:
  - `deriveSplitRows(total, splits, opts)` → normalized `{ main, pockets: [{name, amount}], bnpl: [{plan, amount, firstToday}], other }`.
  - `computeBnplInstallments(total, count, firstToday)` → `{ firstAmt, perInstallment, lastInstallment }` with penny-accurate remainder-on-last logic (mirrors `new.tsx` #10 fix).
  - `buildPocketWithdrawalRows(userId, date, retailer, splits)` → array shaped for `savings` insert.
  Rewrite callers to import these helpers. Zero UI/behaviour change.

### 3. Test files

```text
src/lib/__tests__/
  format.test.ts             # mainExpensePortion: no splits, bnpl offset, mixed
  splits.test.ts             # deriveSplitRows, computeBnplInstallments, buildPocketWithdrawalRows
  recurringIncome.test.ts    # applyAllocations + computeCoverAmount
```

**format.test.ts** — cases:
- transaction with no splits → returns `total_amount`
- one BNPL split → subtracts BNPL portion
- multiple splits including pocket + BNPL → only BNPL offsets main

**splits.test.ts** — cases:
- `computeBnplInstallments(100, 4, false)` → 4 × 25, last = 25
- `computeBnplInstallments(100, 4, true)` → first today 25, remaining 3 × 25
- `computeBnplInstallments(10, 3, false)` → 3.33, 3.33, 3.34 (last absorbs remainder, sum = 10.00)
- `computeBnplInstallments(10, 3, true)` → first today 3.33, remaining 2 installments 3.33 + 3.34 = 6.67
- `deriveSplitRows`: pockets + BNPL + main = total; main = total − pockets − bnpl − other
- `buildPocketWithdrawalRows`: one `withdrawal` row per pocket split, correct account/amount/date/notes

**recurringIncome.test.ts** — with in-memory fixtures (no Supabase mock needed since `applyAllocations` receives caches as args, but writes via `supabase.from("savings").insert`; mock via `vi.mock("@/integrations/supabase/client")` returning a chainable stub that records inserted rows):
- Template £579, allocations [Food fixed 300, Bills fixed 200] → deposits 300 + 200, main remainder 79 flows implicitly (not deposited); no warnings.
- Template £400, allocations [Food fixed 300, Bills fixed 200] → deposits 300 + 100, `clipped` warning present.
- `cover_commitments` allocation with £250 need and £100 existing balance → deposits 150.
- `cover_commitments` with existing balance ≥ need → deposits 0, no row inserted.
- Two templates funding same pocket on same postDate via shared `inFlight` map → second sees first's deposit, doesn't double-fund (need 300, bal 0, tpl A deposits 300, tpl B `cover_commitments` deposits 0).
- Allocation order respected: higher-order alloc gets clipped, not lower-order.
- `computeCoverAmount` unit: commitments outside `[from, to)` are excluded.

### 4. Supabase mock

Single `src/lib/__tests__/mocks/supabase.ts`:
- `createSupabaseMock()` returns `{ client, inserts, updates, seed(table, rows) }`.
- `client.from(table)` returns chainable object supporting `.insert().select()`, `.select().eq().eq()`, `.update().eq()`, `.delete().in()`.
- Records every write into `inserts[table]` for assertions.

Used via `vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.client }))` at top of `recurringIncome.test.ts`.

### 5. CI hook

- README snippet: `bun run test`.
- Don't add GitHub Actions config (out of scope).

## Out of scope

- Component-level rendering tests for `PaymentSplitEditor` (the pure helpers cover the math; DOM tests can come later).
- E2E / Playwright.
- Backfilling tests for unrelated modules (rollover, cycle, protection) — can follow in a second pass if desired.

## Verification

- `bun add -d vitest @vitest/coverage-v8 happy-dom`
- `bun run test` → all green.
- `tsgo` clean on the new files + refactored call sites.
