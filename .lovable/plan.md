## Quick-add frequent items in the settle flow

Add a compact "Quick add" panel inside the settle/edit dialog in `src/routes/history.tsx` (visible only when `isPending` is off — i.e. actually itemizing). It lets you tap several past items at once and appends them as line items using the same autofill helpers already used per-row.

### UI

- Placed just above the "Line items" list (`src/routes/history.tsx:1236`).
- Header: "Quick add" + small muted subtitle "Tap items to add. Retailer's picks first."
- Grid of toggle chips (shadcn `Badge`/`Button` variant `outline`, wrap-friendly). Selected chips flip to filled/primary.
- Order: retailer-specific frequent items first (by usage count desc, then most-recent), then a divider, then global frequents. Cap at ~12 chips with a "Show more" toggle to reveal up to ~30.
- Bottom row: `Add N items` primary button (disabled when 0 selected) + `Clear` ghost button. Optional per-chip qty stepper is out of scope — everything added at qty 1; user can bump qty on the row afterwards.
- Hidden-items list (`useHiddenSuggestions().hiddenItems`) filters the chips, same as the item Combobox.

### Behaviour

- Build a `frequentItems` memo from `useTransactions().items`: non-pending, item_name non-empty, filtered by hidden list, grouped by lower-cased name. Track `{ name (display = most recent casing), count, lastDate, retailers: Set<string> }`. Sort: retailer match desc → count desc → lastDate desc.
- On `Add N items`: for each selected name, push a new row (same shape as `addRow`) with:
  - `item_name` = display name
  - `price` = `suggestPrice(priceHistory, name, retailer)` formatted like existing code (`.toFixed(2)`), else `""`
  - `category` = `suggestCategory(categoryHistory, name)` ?? `""`
  - `quantity` = `"1"`, `notes` = `""`
  - Reuse the same helpers from `src/lib/suggestions.ts` already imported in this file.
- If the current rows contain only a single blank row (no name, no price), replace it; otherwise append.
- Clear selection after adding; toast `"Added N items"`.
- Selection state: local `Set<string>` (lowercased key), reset when dialog opens/closes or when `transaction.id` changes.

### Out of scope

- No quick-add on the New Transaction route (`new.tsx`) — request is about the settle flow. Can mirror later if wanted.
- No changes to suggestion storage, hidden-items UI, or the Combobox itself.
- No qty pickers on chips, no drag-reorder.

### Technical notes

- All logic stays inside `EditTransactionDialog` in `src/routes/history.tsx`; no new files needed.
- Uses existing `priceHistory` / `categoryHistory` memos (already computed for the item Combobox) — just add a `frequentItems` memo alongside them.
- Uses shadcn `Button` (variant `outline` / `default`) for chips to stay consistent with the current design system; no new deps.
