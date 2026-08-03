## What's already there vs. missing

Checked `src/routes/new.tsx` and `src/routes/history.tsx`:

- Removing an item row (`removeItem` in new.tsx, `removeRow` in history.tsx) deletes silently — **no undo**.
- Validation exists but is **toast-only** (e.g. "Retailer is required", "Add at least one line item with a price") — nothing highlights the offending field.
- There is a one-line keyboard tip under the itemise step in new.tsx, but **no shortcut reference** anywhere, and none in the history edit/settle dialogs.

So all three requests are still outstanding.

## 1. Undo on item removal

Both routes: capture the removed row (plus its index) before dropping it, then show a sonner toast with an Undo action that re-inserts it at the same position.

```
toast("Item removed", { action: { label: "Undo", onClick: () => restore() } })
```

- Keeps the existing guard that the last remaining row can't be removed in new.tsx.
- Restores all row fields (name, price, qty, category, joy flag) exactly, so undo is lossless.
- Same treatment for the history edit dialog rows.

## 2. Inline validation

Add a lightweight per-form error state (`Record<string, string>`) in each route, set during the existing save/validation paths instead of only firing toasts.

- Fields covered: retailer, pending estimate, per-row item name and price, per-row category, protection expiry date, split amounts/BNPL details.
- Offending input gets `aria-invalid` plus a destructive border, with a small `text-destructive` message under it.
- The first invalid field is focused and scrolled into view on failed save.
- Errors clear as soon as the field is edited.
- Keep a single summary toast ("Fix N field(s) before saving") so the existing feedback isn't lost.

## 3. Keyboard shortcut reference

New `src/components/KeyboardShortcutsDialog.tsx` — a small dialog listing:

- `Enter` — move from item name to price / start next item
- `Shift + Enter` — previous field
- `↑ / ↓` — move between suggestion results in the item and retailer comboboxes
- `Esc` — dismiss suggestions / close dialog
- `⌘ / Ctrl + Enter` — save the transaction

Triggered by a keyboard icon button in the header of the new-transaction page and of the history edit/settle dialogs, and by pressing `?` when focus isn't in a text field. The existing inline tip line in new.tsx stays, with a "See all shortcuts" link into the dialog.

## Technical notes

- Undo uses sonner's `action` API (already the project's toast lib) — no new dependencies.
- Validation state is local to each route; no changes to the store, save logic, or database.
- All work is presentational — save behaviour and data written are unchanged.

## Changelog

Prepend a dated v2.9.3 entry to `src/lib/changelog.ts` covering undo-on-remove, inline validation, and the shortcuts reference.
