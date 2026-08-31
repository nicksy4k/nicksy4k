# Phase 2 feature details

## 1. Forecast / Safe-to-spend

Add a headline card to the dashboard that answers "how much can I spend?".

```text
main balance today
  - outgoings due before the cycle ends and not yet paid
  - pocket / BNPL allocations already committed
  = safe to spend
```

Show the figure large, with days remaining in the cycle and a per-day amount. Keep the existing main-balance number visible but secondary, so users still see the raw account total.

### Implementation notes

- New pure function in `src/lib/forecast.ts`: `computeSafeToSpend(balance, commitments, cycleWindow, allocations)`.
- Reuse `getActiveCycle`, commitment cadence logic, and pocket totals from existing modules.
- Only count an outgoing if its next due date falls inside the current cycle and it is unpaid.
- Excluded: pending transactions (they are already in main balance) and future income.
- Server function under `src/lib/forecast.functions.ts` returns the dashboard headline.
- Add `src/lib/__tests__/forecast.test.ts` covering monthly and four-weekly cycles, paid vs unpaid outgoings, and empty cycles.

## 2. Budgets per category

New `/budgets` route. Users set a target amount for any spending category. Targets are stored against the user's cycle type so they roll over automatically.

### Page layout

- Top: cycle selector and "total budgeted vs spent" summary.
- Budgeted categories: progress bar with spent / target / remaining, pace marker at `(days elapsed / cycle length)` of target, and colour coding (green under 80%, amber 80-100%, red over 100%).
- Unbudgeted categories: one-click "add budget" for any category with spend in the current cycle.
- Empty state when no budgets exist.

### Data model

- New `public.budgets` table: `user_id`, `category`, `amount`, `cycle_type`, `created_at`, `updated_at`.
- RLS and grants as required by the project rules.
- Unique index on `(user_id, category, cycle_type)`.

### Implementation notes

- New `src/lib/budgets.ts` for queries and cycle-aware spent calculation.
- Reuse `perCycleTotal` and category aggregation already used in Reports.
- Add budget create/edit/delete flow in `src/routes/budgets.tsx`.
- Add tests in `src/lib/__tests__/budgets.test.ts`.

## 3. Insights / trends

Extend `/reports` with a "Trends" section that compares the current cycle against the previous one.

### First insights

- Biggest movers: categories with largest percentage change in spend.
- Subscription creep: total recurring outgoings vs last cycle, flagging new or increased commitments.
- Cycle summary strip: current spend, projected end-of-cycle spend, and budget status.

### Implementation notes

- Pure helpers in `src/lib/insights.ts` operating on two cycle windows.
- Reuse existing aggregation queries; no new tables.
- Keep joy-category blur/roll-up treatment consistent with Reports.
- Add `src/lib/__tests__/insights.test.ts`.

## 4. Global search

A Cmd+K command palette reachable from any authenticated page.

### Scope

- Transactions by retailer or item name.
- Outgoings / commitments by name.
- Debts and loans by person name.
- Settings pages and static routes.

### Implementation notes

- New `src/components/CommandPalette.tsx` using the existing dialog/dropdown primitives.
- Debounce server function `searchEverything` in `src/lib/search.functions.ts`.
- Limit results per category and rank exact matches first.
- Keyboard navigation: arrow keys to move, Enter to navigate, Esc to close.
- Add a visible search button in the app header for discoverability.

## Release checklist

- Prepend dated entry to `src/lib/changelog.ts` (v3.3.0).
- Bump version in `package.json`.
- Run `tsgo` and `bunx vitest run`.
- Verify each new route has unique `head()` metadata.
- Verify mobile layout at 390px for dashboard headline and budgets page.
