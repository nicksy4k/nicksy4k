## Multi-Select Category Filter + Filtered Total on History

Replace the single-select category dropdown on `/history` with a multi-select, and show a live "Total for selected categories" summary that sums only matching line items.

### Changes to `src/routes/history.tsx`

1. **State**: replace `categoryFilter: string` with `selectedCategories: Set<string>` (default empty = "All categories").
2. **Filter UI**: swap the `<Select>` for a Shadcn `Popover` + `Command` multi-select (checkbox list of all categories present in transactions), with a trigger button showing:
   - "All categories" when none selected
   - "{Category}" when one selected
   - "{N} categories" when multiple
   - A small "Clear" affordance when any are selected
3. **Filter logic**: a transaction is included if it has at least one item whose category is in `selectedCategories` (or if the set is empty).
4. **Filtered total (new)**:
   - `useMemo` that iterates the currently visible transactions and sums `price × quantity` **only for items whose category is in `selectedCategories`** — never the whole transaction total.
   - Also count matching items and unique transactions for the label.
5. **Summary placement**: render a muted banner directly under the filter row (same visual style as the existing search-match summary), only when `selectedCategories.size > 0`. Example: `"12 items across 4 transactions in 2 categories · Total: £123.45"`.
6. **Interaction with search summary**: keep both banners independent; they can appear stacked when both a search query and category filters are active.

### Non-goals

- No changes to Reports, Dashboard, or DB.
- No change to how transaction cards render items (refund strikethroughs, subtotals, etc. stay as-is).
- Refund-adjusted totals are out of scope for this summary — it sums original line-item cost, matching the existing search-match total's convention.

### Verification

- Prettier format the file.
- Run existing vitest suite; no logic in tested helpers changes.
