## Historical Category Auto-Fill for line items

Mirror the existing price-autofill pattern in `src/routes/new.tsx` for the item's Category.

### Changes in `src/routes/new.tsx`

1. **Default line items to blank category.**
   - Change `emptyItem(defaultCat: Category = "Other")` to default to `""` (empty string).
   - Update the initial `useState<DraftItem[]>([emptyItem(categories[0] ?? "Other")])` and the "Add item" handler (which uses `lastAddedId`) to call `emptyItem()` with no default. Type stays `Category` (which is `string`).
   - Pending-hold placeholder path keeps using `categories[0] ?? "Other"` (unchanged) since the user never sees that field.

2. **Build a `categoryHistory` memo** alongside `priceHistory`:
   - Map<itemNameLower, Array<{ category, date }>> sorted newest-first.
   - Skip `t.is_pending` and entries with empty category, same as price map.

3. **Add `suggestCategory(itemName)`** helper — returns the most recent category for that item name, or `null` if never seen. No retailer tier needed (per spec: just most recent).

4. **Extend `updateItem` safety-first autofill** when `patch.item_name` is set:
   - Existing price block stays.
   - New block: if `!next.category` (empty / never chosen), call `suggestCategory(next.item_name)`; if it returns a value, assign it. Never overwrite a category the user already picked.

5. **Category `<Select>` UI**: ensure it renders correctly with an empty value (show placeholder like "Choose category"). Verify the existing `SelectTrigger`/`SelectValue` shows a placeholder when `value=""`. If a placeholder isn't already wired, add `placeholder="Category"` on `SelectValue` and pass `value={it.category || undefined}` to `Select` so Radix shows the placeholder state.

6. **Save validation**: in `save()`'s `cleanItems` filter, additionally require `i.category.trim()` to be non-empty; if any qualifying item is missing a category, `toast.error("Pick a category for every item.")` and abort. This enforces the "forced choice" empty-state rule.

### Out of scope

- No changes to price autofill, retailer logic, settings hidden-suggestions, or history/edit flows.
- No schema changes — categories already live inside each line item in `transactions.items`.

### Technical notes

- `Category` is a `string` alias, so `""` is type-safe without touching `src/lib/types.ts`.
- Retailer-change `useEffect` doesn't need a category counterpart — category isn't retailer-dependent.
