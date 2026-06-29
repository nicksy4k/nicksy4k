## Pending / Placeholder Transactions

A lightweight mode for supermarket pre-auths (e.g. Asda). Reserve the money instantly with just a retailer + estimated total, then "Settle" the next day to enter real items and the final price.

### 1. Data model

Add one nullable column to `transactions`:

- `is_pending` (boolean, default `false`)

Migration also backfills existing rows to `false`. `Transaction` type gains `is_pending?: boolean`. No other schema changes — itemization stays optional at the DB level; the UI enforces it normally and relaxes it when pending.

### 2. Fast entry on `/new`

- Add a **"Mark as Pending Hold"** Switch at the top of Step 1, beside the retailer field.
- When ON:
  - Hide Step 2 entirely. Step indicator collapses to a single step.
  - Replace the items section with one **Estimated total (£)** input.
  - Hide receipt block, protection block, notes, and the payment-split editor.
  - Save button appears directly on Step 1.
  - Only validation: retailer required, estimated total > 0.
- On save: create the transaction with `is_pending = true`, a single synthetic line item (`item_name: "Pending estimate"`, price = estimated total, qty 1, category "Other"), no payment splits (defaults to main balance), no receipt, no protection.
- Because there are no `bnpl:` splits, `mainExpensePortion` already subtracts the full amount from "Left to Spend" → money is reserved automatically. No calculation changes needed.

### 3. Visual treatment in `/history`

- Header row: add an amber **"Pending"** badge (`bg-amber-500/15 text-amber-600 border-amber-500/30`) next to the retailer when `is_pending`.
- Amount renders in amber + with `~` prefix (e.g. `~£42.10`) to signal it's an estimate.
- Replace the inline edit pencil with a primary **"Settle"** button for pending rows (the existing edit pencil stays for non-pending).
- Pending rows are sorted/listed identically to others — no separate section.

### 4. Settle flow

- "Settle" opens the existing `EditTransactionDialog` (same component used by the edit pencil), pre-loaded with the pending transaction.
- Add a **"Still pending"** Switch at the top of the dialog, bound to `is_pending`. Defaults to current value; user unchecks it to settle.
- When the dialog opens for a pending transaction, clear the synthetic "Pending estimate" placeholder row so the user starts with one empty line ready for real items.
- On save: same validation as today (requires at least one priced line item) when `is_pending` is unchecked. When kept pending, allow zero line items and just update the estimated total / retailer.
- Saving propagates `is_pending` through `update(...)`.

### 5. Files touched

- `supabase/migrations/<new>.sql` — add `is_pending` column with default + backfill.
- `src/lib/types.ts` — add `is_pending?: boolean` to `Transaction`.
- `src/lib/store.ts` — include `is_pending` in transaction insert/update/select mapping.
- `src/routes/new.tsx` — add Pending toggle, conditional rendering, fast-save branch.
- `src/routes/history.tsx` — amber badge, amount styling, Settle button, dialog Pending toggle + relaxed validation.

### 6. Out of scope

- No changes to BNPL, pockets, commitments, or cycle math (pending pre-auths always come out of main balance, matching real pre-auth behaviour).
- No reminders/notifications for unsettled pending rows (can add later if wanted).
