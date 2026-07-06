# Fix Reports category aggregation

When a category filter is active, KPI and list amounts must reflect only matching items — not the full transaction total.

## Per-transaction matched amount
Add a helper inside `ReportsPage`:

```ts
function matchedAmount(t: Transaction): number {
  const itemsSum = t.items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
  const main = mainExpensePortion(t);
  if (!catFilterActive) return main;
  if (itemsSum <= 0) return 0;
  const matched = t.items
    .filter((i) => selectedCats.has(i.category))
    .reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
  return (matched / itemsSum) * main; // preserve BNPL ratio
}
```

## KPI
- `totalSpent` = sum of `matchedAmount(t)` over `filtered`.
- `avg` = `totalSpent / filtered.length` (unchanged formula, new numerator).
- Transactions count stays as `filtered.length`.

## List view
- Row amount = `matchedAmount(t)`.
- When `catFilterActive`, show a small muted line under the amount: `of {fmt(mainExpensePortion(t))}` so the full receipt context isn't lost.

## Category breakdown
- Already correct (aggregates per item with BNPL scaling). No change.

## Files
- Edited: `src/routes/reports.tsx`
