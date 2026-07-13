## Auto-fill remainder when adding/selecting Pockets

Replace the current "default to 0.00" behavior in three places so a newly-added or newly-selected Pocket line pre-fills with the remaining unpaid / unallocated balance. Manual typing still overrides.

### 1. `src/components/PaymentSplitEditor.tsx` (Spend flow)
- In `handleSourceChange`, when the new source is a pocket (`pocket:*`) or `main`/`other`, and the current row's `amount` is empty, set `amount` to the current remainder (transaction `total` minus already-allocated across other rows).
- In `add()`, insert the new row pre-filled with the current remainder as its amount (only if remainder > 0). Leave `source` as `"main"` default — the auto-fill applies regardless of which source is picked next, since selecting a different source keeps a manually-blank amount and re-triggers the fill via `handleSourceChange`.
- Skip auto-fill for `bnpl:new` selections (BNPL amount is intentionally user-driven per plan).

### 2. `src/routes/income.tsx` — one-off income splits
- Update the "Add split" handler (currently pushes `{ pocket: "", amount: "" }`) to pre-fill `amount` with `remainder` (income total minus current `splitSum`) when > 0.
- When the user picks a pocket in an existing row whose amount is still blank, also fill with the current remainder (small tweak in the `updateSplit({ pocket })` path).

### 3. `src/routes/income.tsx` → `RecurringAllocationsEditor`
- Update `add()` to seed `amount` with `Math.max(0, amount - sumOfFixedAllocations)` instead of `0`, so a new allocation defaults to the leftover recurring-income amount.
- No change to `cover_commitments` rows (amount stays auto).

### Non-goals
- No schema changes.
- No change to save/validation logic — remainder math is already enforced downstream.
- BNPL split amounts remain manual.
