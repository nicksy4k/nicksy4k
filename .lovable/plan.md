## Goal

When a search query is active on the History page, show only the matching **line items** (with their per-item cost) instead of the full transaction. Keep the transaction header (retailer, date, total) as context, and offer a "View rest of transaction" toggle to reveal the remaining non-matching items.

## Behaviour

Applies only when `q.trim() !== ""` and the match is on an item name. Retailer/notes/location matches still show the full transaction as today (nothing hidden).

For each transaction card in the filtered list where at least one line item matches the query:
- Collapsed card body renders a compact list of just the matching items: item name (with the matched substring highlighted via `<mark>`), category chip, qty, unit price, and line total (`price × qty`).
- A subtotal row shows "Matched X of Y items · £Z" so the user immediately sees how much of the transaction the search accounts for.
- A "View rest of transaction" text button expands the full item table (current table layout, unchanged) inline underneath. Toggles to "Hide rest".
- The existing Collapsible chevron / full expanded view (receipt, protection, notes, edit/delete actions) still works exactly as today when the row is expanded via the chevron — the item-level view is purely an addition to the collapsed header area.

When no search query is present, or the query only matches retailer/notes/location, the card renders exactly as today (no item preview, no subtotal, no extra button).

## Highlighting

Small helper that splits a string on the needle (case-insensitive) and wraps matches in a `<mark>` styled with `bg-primary/20 text-foreground rounded px-0.5`. Used for the item name in the preview list only — retailer text stays untouched to avoid visual noise.

## Files

- `src/routes/history.tsx` — only file touched.
  - Extract the item-name match test into a small helper so the filter and the render share it.
  - Add `MatchedItemsPreview` sub-component rendered inside the existing `CollapsibleTrigger` block (or just above it, above the item count badge line), gated on `needle && matchingItems.length > 0`.
  - Local `useState<Set<string>>` for "show rest" per transaction id, or a `useState<string | null>` since only one is typically open — a `Set` keeps it simple.
  - Reuse `fmt`, `colorForKey` for the category chip color already in use elsewhere.

No store, schema, or type changes. No new dependencies.

## Out of scope

- Filtering by category still shows the whole transaction (category filter is coarse and per-item filtering there would hide too much).
- Changing the expanded (chevron-open) detail view.
- Persisting the "show rest" toggle across reloads.
