# Reports & Analytics View

Add a new `/reports` route for flexible spending analysis outside the 28-day cycle.

## Route
- Create `src/routes/reports.tsx` (`createFileRoute("/reports")`).
- Add "Reports" nav item to `src/components/AppLayout.tsx` (BarChart3 icon, between History and Past Cycles).

## Data query
- Load categories from the existing categories store for the multi-select options.
- Query `transactions` directly via `supabase.from("transactions").select("*")` scoped to `user_id = auth.uid()` (RLS enforces), filtered by:
  - `.gte("date", startDate)` and `.lte("date", endDate)`
  - `.eq("is_pending", false)` — exclude unsettled pending holds from analytics
  - `.order("date", { ascending: false })`
- Category filter applied client-side against each transaction's line-item categories (since categories live on `items`, not the transaction row).
- Read-only — no writes, no cycle logic, does not touch existing dashboard/cycle state.

## Filters (top of page)
- **Date range**: two shadcn Date Pickers (Start / End). Default: last 30 days (today − 30 → today).
- **Categories**: shadcn multi-select popover with checkboxes over all user categories. Default: all selected (empty = all). Include a "Clear" / "All" quick action.
- Filters update local state; query re-runs via `useQuery` keyed on `[startDate, endDate]`; category filter is a client-side derived filter (cheap, avoids extra roundtrips).

## KPIs
- **Total Spent** card: sum of matched transactions using `mainExpensePortion` from `src/lib/format.ts` so BNPL-deferred amounts are excluded (consistent with rest of app). Also show transaction count and average per transaction as small secondary stats.

## Visuals
- **Category breakdown**: recharts Pie Chart (recharts already in project — used elsewhere). Aggregate spend per category by walking each transaction's `items[]`, summing `price * (quantity ?? 1)` per category, and scaling proportionally to `mainExpensePortion` so pie totals match the KPI. Legend shows category name + amount + %.
- Use color tokens from `src/lib/colors.ts` if a palette helper exists; otherwise map through chart-*  CSS variables.

## Transaction list
- Below the chart, render matched transactions as rows: Date · Retailer · Categories (chips from item categories) · Amount (formatted via `fmt`).
- Empty state when nothing matches: "No transactions in this range."

## Files
- **New**: `src/routes/reports.tsx`
- **Edited**: `src/components/AppLayout.tsx` (nav entry + type union)

## Out of scope
- No CSV export, no saved filter presets, no comparison-to-previous-period, no drill-down navigation.
- No schema changes.
