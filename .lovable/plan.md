
# Ledgerly Audit — Fix Plan

I audited the app end-to-end. Below are the real problems worth fixing, grouped by priority. I've bundled these into three passes so you can approve all or just the top tier.

---

## Pass 1 — Critical fixes (data integrity)

These cause wrong numbers, duplicate rows, or orphaned data. Do these first.

1. **Pocket splits double-counted on dashboard** (`src/lib/format.ts`, `src/routes/index.tsx`)
   `leftToSpend = income − expenses − savingsBalance` subtracts pocket spend twice: once inside `mainExpensePortion` and again via the savings withdrawal. Fix `mainExpensePortion` to subtract pocket-split portions so main-balance math nets correctly, and audit the by-retailer/by-category charts to use it.

2. **Recurring income can duplicate rows if `next_date` update fails** (`src/lib/recurringIncome.ts`)
   Advance `next_date` first (optimistic) or wrap insert+advance in a single RPC. At minimum: if the update fails, roll the inserts back (delete by matched `user_id + date + source + amount`) and re-throw so the daily guard is not set.

3. **New device / cleared browser skips commitment rollover forever** (`src/lib/commitmentRollover.ts`)
   Replace the "first run = skip" branch with: run rollover normally on any device whose guard key is missing. The DB row's `paid` state is idempotent — running the reset once too many is safe; skipping is not.

4. **Sign-out doesn't clear per-user local guards** (`src/routes/__root.tsx`)
   On `SIGNED_OUT` also `localStorage.removeItem` the recurring-income and commitment-rollover guard keys so user B on the same browser isn't blocked by user A's stamp.

5. **Deleting a debt leaves an orphaned BNPL commitment** (`src/lib/store.ts` `useDebts.remove`)
   Before deleting the debt, delete `commitments` where `debt_id = id`. Same when the debt is cleared via the existing kill-switch (verify it already does this).

6. **`clearAllData` misses `recurring_incomes` and `categories`** (`src/lib/store.ts`)
   Add both tables so "clear all" actually clears everything.

---

## Pass 2 — Correctness & UX

7. **Dashboard charts don't respect quantity or BNPL** (`src/routes/index.tsx`)
   - By-category: use `it.price * (it.quantity ?? 1)`.
   - By-retailer: use `mainExpensePortion(t)` not `total_amount`.
   - Exclude `is_pending` rows from analytics (or split them into their own "pending" slice).

8. **`cover_commitments` uses all-time pocket balance** (`src/lib/recurringIncome.ts`)
   When multiple templates run in the same session and both fund the same pocket, later ones see earlier deposits and under-fund. Compute the pocket balance once at the start of `applyAllocations` per postDate, or subtract in-flight deposits from the counted balance.

9. **Settle flow can't add pocket/BNPL splits** (`src/routes/history.tsx`)
   When converting a pending hold to a real transaction, expose the same `PaymentSplitEditor` used in `/new` so users can attribute the final spend correctly.

10. **BNPL rounding drift** (`src/routes/new.tsx`)
    When "first payment today" is on, compute `remainingAmt = s.amt − firstAmt` and set `perInstallment = remainingAmt / remainingInstallments` with the last installment absorbing the rounding remainder, so the debt total always equals the sum of installments to the penny.

11. **`AuthGate` navigates during render** (`src/routes/__root.tsx`)
    Move the `/auth`-when-signed-in redirect into a `useEffect`.

---

## Pass 3 — Performance & polish

12. **N+1 Supabase queries in `applyAllocations`** — hoist the commitments + savings fetches out of the per-postDate / per-allocation loops.
13. **Serial UPDATEs in `rolloverAllCommitments`** — `Promise.all` the row updates.
14. **Query `staleTime`** — set `staleTime: 60_000` on the big list queries (`transactions`, `incomes`, `savings`, `commitments`, `debts`, `loans`) so tab-focus doesn't refetch everything.
15. **Cycle settings double-render** (`src/lib/cycle.ts`) — drop the redundant `setSettings(next)` after `saveCycleSettings`.
16. **Child-route `errorComponent`** — add a small error component to each route so a single query failure doesn't blank the shell.

---

## What I will NOT change without your say-so

- Introducing a server-side RPC for rollover / recurring-income generation (bigger architectural change; happy to do it, but flagging separately).
- Adding a unique constraint on `incomes(user_id, date, source, amount)` — this would need a data-cleanup migration first.
- Any visual/UX redesign beyond the settle-flow split editor.

---

## Suggested order of approval

- **Approve Pass 1** — I'll ship the five critical data-integrity fixes and verify with a build.
- **Then Pass 2 + 3** — I can bundle these into one follow-up, or split.

Tell me which passes to run (e.g. "do pass 1", "do all three", or cherry-pick numbers like "1, 2, 5, 7, 12").
