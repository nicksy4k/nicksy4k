# Pass 2 + 3 — Correctness, UX, Performance & Polish

Executing the remaining items from `.lovable/plan.md`. Item #1 stays skipped (verified last turn: current math nets correctly).

## Pass 2 — Correctness & UX

**#7 Dashboard charts respect quantity + BNPL** (`src/routes/index.tsx`)
- By-category totals: use `item.price * (item.quantity ?? 1)`.
- By-retailer totals: use `mainExpensePortion(t)` instead of `total_amount`.
- Exclude `is_pending` rows from both aggregations (they're pre-auth holds, not real spend).

**#8 `cover_commitments` uses stale pocket balance** (`src/lib/recurringIncome.ts`)
- In `applyAllocations`, track in-flight deposits per pocket for the current run so multiple templates funding the same pocket on the same postDate don't each see the same "starting" balance and under-fund.
- Fix: subtract already-scheduled deposits from the counted balance when computing the top-up gap.

**#9 Settle flow gets split editor** (`src/routes/history.tsx`)
- When editing a transaction (especially a pending → settle conversion), render `PaymentSplitEditor` so users can attribute the final spend across Main / Pockets / BNPL / Other.
- Wire the same side-effects the new-transaction flow uses (pocket withdrawals, BNPL debt+commitment creation).

**#10 BNPL rounding drift** (`src/routes/new.tsx`)
- When "first payment today" is on: `remainingAmt = s.amt − firstAmt`, `perInstallment = round2(remainingAmt / remainingInstallments)`, and the LAST installment absorbs the rounding remainder so debt total = sum of installments to the penny.

**#11 `AuthGate` navigates during render** (`src/routes/__root.tsx`)
- Move the "signed-in on /auth → redirect home" branch out of render into a `useEffect`.

## Pass 3 — Performance & Polish

**#12 N+1 queries in `applyAllocations`** (`src/lib/recurringIncome.ts`)
- Hoist commitments + savings fetches out of per-postDate / per-allocation loops; fetch once at the top and reuse.

**#13 Serial commitment UPDATEs** (`src/lib/commitmentRollover.ts`)
- `Promise.all` the row updates instead of awaiting each one.

**#14 Query `staleTime`** (`src/lib/store.ts`)
- Add `staleTime: 60_000` to the big list queries: `transactions`, `incomes`, `savings`, `commitments`, `debts`, `loans`, `recurring_incomes`.

**#15 Cycle settings double render** (`src/lib/cycle.ts`)
- Remove the redundant `setSettings(next)` call after `saveCycleSettings` (the subscription already fires).

**#16 Per-route error boundaries**
- Add a small `errorComponent` to each route (`income`, `savings`, `history`, `commitments`, `credit`, `reports`, `archive`, `new`, `settings`) so one query failure doesn't blank the whole shell. Reuse a shared minimal error component.

## Out of scope (flagged in original audit)
- Server-side RPC for rollover / recurring income.
- Unique constraint on `incomes` (needs data cleanup migration first).
- Any visual redesign beyond #9's settle editor.

## Order of execution
Pass 2 first (correctness), then Pass 3 (perf/polish). Single build verification at the end.
