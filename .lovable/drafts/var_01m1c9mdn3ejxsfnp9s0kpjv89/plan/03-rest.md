## 2. Forecast / safe-to-spend

One headline number on the dashboard, above the fold:

```text
main balance
  - unpaid outgoings due before the cycle ends
  - pocket money already spoken for
  = safe to spend
```

Rendered as "184 left · 11 days · 16/day", with a small breakdown you can expand to see exactly which outgoings were subtracted. Turns amber when the per-day figure drops below your recent average daily spend. This is the cheapest of the five to build — the cycle engine, outgoings totals and pocket maths all already exist.

## 3. Insights / trends

A section on Reports that answers "what changed", not "what happened":

- Biggest movers vs last cycle ("takeaways up 18%, groceries down 9%")
- Subscription creep: outgoings whose amount rose since last renewal, and promo prices about to revert
- Quiet wins: categories you spent less on
- A six-cycle sparkline per top category

## 4. Search across everything

A command palette on Cmd/Ctrl+K and a search icon in the header. One box that matches transactions, retailers, items, outgoings, debts, loans and settings pages, grouped by type, keyboard-navigable, jumping straight to the record. With 20+ pages the app has outgrown menu navigation.

## 5. Receipt scanner for everyone

Currently admin-only. Opening it up needs a per-user monthly scan cap (the `receipt_scans` table already logs usage), a visible "3 of 10 scans left this month" counter in Settings, and an admin-adjustable cap. Most visible upgrade for real users, but it spends AI credits, so the cap matters.

## Suggested order

Forecast first (cheap, high daily value, no new tables), then Budgets (the big one), then Insights, Search, Scanner.

## Technical notes

- Budgets: new `budgets` table (user_id, category, amount, cycle_type) with RLS and grants; maths in `src/lib/budgets.ts` reusing `getActiveCycle`/`isInCycle` and `perCycleTotal`.
- Forecast: pure computation in `src/lib/forecast.ts` over existing hooks — no schema change.
- Insights: aggregation in `src/lib/insights.ts` comparing current vs previous cycle windows; Reports page section.
- Search: `cmdk` (already present via shadcn command component) indexing in-memory store data.
- Scanner: cap enforced server-side in `receipt-scan.functions.ts` by counting `receipt_scans` rows in the current month; flag widened in `src/lib/features.ts`.
- Each phase ends with tests, a changelog entry and a version bump.
