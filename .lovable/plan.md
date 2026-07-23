## Settle-flow parity with New Transaction

Bring the settle/edit dialog in `src/routes/history.tsx` up to the same input ergonomics the New Transaction screen already has, plus one new capability (add-category inline) that will apply in both places.

### 1. Item name → Combobox with history suggestions

In `src/routes/history.tsx` `EditTransactionDialog`:

- Replace the plain `<Input>` at line 1214-1218 with the existing `Combobox` (`src/components/ui/combobox.tsx`, already used in `src/routes/new.tsx`).
- Build an `itemNameSuggestions` memo from `useTransactions().items`: unique, non-pending item names, filtered through `useHiddenSuggestions().hiddenItems`, sorted with `sortLabels`. Same shape as `new.tsx`.
- Reuse the existing price-autofill helper pattern from `new.tsx` so picking a known item prefills price when the price field is empty (retailer-first, then global). Do not overwrite a price the user typed.
- Keep the existing category autofill behaviour that already exists on this row (if none, add the same "look up most recent category for this item name" logic mirrored from `new.tsx` — same safety rule: never overwrite a manual pick).
- Keep `autoFocus` behaviour for the first row on a pending settle.

### 2. Inline "Add new category" in the Category select

Applies to both the settle/edit dialog (`src/routes/history.tsx` line 1237-1255) and the New Transaction line-item Category select in `src/routes/new.tsx`.

- Append a sentinel `__add_new__` item at the bottom of each `<SelectContent>`, rendered as "＋ New category…".
- When picked, open a small prompt (shadcn `Dialog` with a single `Input` + Save/Cancel — no route change) to type the new name.
- On save: trim, dedupe case-insensitively against existing categories, call `useCategories().add(name)`, then set that new value on the current line item. Toast on success; toast error on empty/duplicate.
- No changes to the Settings category manager — it already handles delete/reset.

### Out of scope

- Retailer field in the settle dialog (retailer isn't edited there — the settle dialog reuses the pending row's retailer).
- Income category picker (this is only for expense line items, matching the request).
- No schema changes; `categories` table + `useCategories` already support add.

### Technical notes

- `Combobox` supports `autoFocus` — pass it through for the pending-settle first row.
- Price/category history maps: extract the memo builders from `new.tsx` into `src/lib/suggestions.ts` (pure functions taking `Transaction[]`) so both routes share one implementation instead of duplicating.
- The add-category mini-dialog is a shared local component inside each route file, or lifted to `src/components/AddCategoryDialog.tsx` to avoid duplication — prefer the shared component.
