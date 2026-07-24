## Quick add panel in New Transaction

Mirror the settle/edit dialog's "Quick add" block into the itemize step of `src/routes/new.tsx`, using the same retailer-first ranking.

### Changes (only `src/routes/new.tsx`)

1. Add a `frequentItems` memo built from `pastTransactions` (skip pending, dedupe by lowercased name, track `count`, `lastDate`, and `retailers` set), filtered through `useHiddenSuggestions().hiddenItems`. Same shape as `history.tsx`.
2. Add local state: `quickSelected: Set<string>` and `quickShowMore: boolean`. Reset both when navigating between steps (or when `retailer` changes to avoid stale retailer-scoped picks — leave selections intact within a step).
3. Ranking (identical to history):
   - Retailer matches first (when `retailer.trim()` is set and `f.retailers.has(retailerKey)`), then remaining by `count` desc then `lastDate` desc.
   - Default cap 12; "Show more / Show less" toggle reveals the rest.
   - Divider chip "Other frequents" between the two groups when retailer matches exist.
4. `addSelectedQuickItems()`: for each selected key, append a new line-item row with `item_name` set to `f.display`, `price` from `suggestPrice(name, retailer)` (retailer-aware, may be empty), `category` from `suggestCategory(name)` (may be empty), quantity 1. Never overwrite existing rows. Clear selection after add.
5. Render the panel just above the "Line items" list in step 2 (itemize step), same styling/markup as the history dialog for visual parity (bordered muted card, chip buttons, Add N items / Clear / Show more controls). Hide entirely when `frequentItems.length === 0`.

### Out of scope

- No changes to history dialog (already done).
- No new helpers — reuse `buildPriceHistory`, `buildCategoryHistory`, `suggestPrice`, `suggestCategory` from `src/lib/suggestions.ts`, and `sortLabels`/hidden filtering already imported.
- No schema changes.
