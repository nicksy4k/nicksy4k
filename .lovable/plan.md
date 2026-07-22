## 1. Retailer-aware price autofill (New Transaction)

In `src/routes/new.tsx`, when an item name is chosen from (or typed to match) a past item, prefill `price` using this lookup order:

1. Most recent transaction where `retailer === current retailer` (case-insensitive) AND contains an item with the same `item_name` → use that line item's `price`.
2. Fallback: most recent transaction (any retailer) containing that item name → use that line item's `price`.
3. No match → leave the price blank.

Rules:
- Only autofill when the price field is currently **empty** (never overwrite a value the user has typed or edited).
- Trigger inside the existing `updateItem` handler when `patch.item_name` is set and resolves to a known name.
- Re-run once when the retailer changes and any item rows have a known name but empty price (so switching retailer improves the guess).
- Manual edits remain fully editable; no lock, no toast.

Implementation detail: add a memoised map keyed by `itemNameLower` → array of `{ retailerLower, price, date }` sorted desc by date, built from `pastTransactions`. A tiny `suggestPrice(itemName, retailer)` helper does the two-tier lookup.

## 2. Hidden-suggestion manager (Settings)

Retailer and item-name suggestions are derived from transaction history, so "delete" means **hide from the combobox** without touching past transactions.

New Supabase columns on `user_settings` (single row per user, already exists):
- `hidden_retailers text[] not null default '{}'`
- `hidden_items text[] not null default '{}'`

Wire-up:
- Extend the settings store hook to load/save these arrays.
- `src/routes/new.tsx`: filter `retailerSuggestions` and `itemNameSuggestions` through the hidden sets (case-insensitive) before rendering.
- `src/routes/history.tsx` retailer filter: same filter applied.

Settings UI (`src/routes/settings.tsx`):
- Two new cards, "Retailer suggestions" and "Item name suggestions", each showing every value currently derived from transactions.
- Each row: name + trash icon → moves it into the hidden array. Hidden entries appear in a collapsed "Hidden" section with an "Unhide" action.
- Empty state and reset-all button per card.
- No new add form here — retailers and items are still created by logging a transaction.

Categories manager stays as-is (already supports delete).

## 3. Technical notes

- Migration adds two `text[]` columns with defaults; no RLS changes needed (existing `user_settings` policies cover them).
- Regenerate Supabase types after migration runs; then update `src/lib/store.ts` (or the settings hook) to read/write the new fields.
- No changes to how transactions are stored — hiding is purely a presentation filter.
- Prettier on touched files; existing vitest suite unaffected.

## 4. Out of scope

- Pockets management (user said current behaviour is fine).
- Bulk rename of retailers/items across historical transactions.
- Any change to autofill for quantity, category, or notes.
