# Refund Feature

Add a per-item refund workflow to the History tab. Refunds never mutate the original transaction's items or total — they are recorded as a separate refund log on the transaction, plus a positive income (and pocket deposit, when applicable) so the money re-enters the running balance correctly.

## 1. Data model

New column on `transactions`:

- `refunds jsonb not null default '[]'::jsonb`

Each refund entry (stored in the JSON array):

```text
{
  id, refunded_at, amount,
  destination: "main" | "pocket:<name>",
  reason?: string,
  item_ids: string[],      // LineItem ids refunded (may be empty for pure partial)
  income_id: string,       // link to the generated income row
  savings_id?: string      // set when destination is a pocket
}
```

Types added in `src/lib/types.ts`:

- `Refund` interface
- `Transaction.refunds?: Refund[]`

Migration adds the column and grants (RLS already scoped to `user_id`, no policy changes needed).

## 2. Store changes (`src/lib/store.ts`)

- `useTransactions().add/update` already forwards arbitrary fields — extend the insert/update payloads to include `refunds`.
- Add a new helper `refundTransaction(tx, { amount, destination, reason, itemIds })` on the transactions hook that, in order:
  1. Inserts an `incomes` row: `source = "Refund · <retailer>"`, `category = "Refund"` (auto-create the category if missing via `useIncomeCategories`), `amount`, `date = today`, `notes` = reason + "Refund of tx <id>".
  2. If `destination` starts with `pocket:`, inserts a `savings` deposit into that pocket (mirrors existing split-deposit pattern) so pocket balance grows.
  3. Appends a new `Refund` entry to `tx.refunds` and updates the transaction row.
  All three steps run sequentially; if any step fails, surface a toast and stop (no rollback needed because the refund entry is written last).

## 3. UI — Refund dialog (`src/routes/history.tsx`)

Add a refund action to each transaction card (icon button next to the existing Edit pencil, using `Undo2` or `RotateCcw` from lucide). Hidden for `is_pending` transactions.

Dialog contents:

- **Item checklist** — each line item with checkbox, name, qty × price, subtotal. Items that appear in any prior refund's `item_ids` show a muted "Already refunded" tag and are disabled.
- **Amount input** — number field defaulting to the sum of selected items' subtotals; recalculates whenever the checklist changes unless the user has manually edited it (track with a `touched` flag). Clamped to `≤ tx.total_amount − sum(prior refunds)`.
- **Destination pocket dropdown** — mandatory. Options: "Main Balance" + every pocket derived from `useSavings()` (same aggregation used in `PaymentSplitEditor`). Allows selecting a pocket even at zero balance (refund can seed one).
- **Reason** — optional textarea.
- Footer: Cancel / Confirm refund. Confirm calls `refundTransaction(...)`, toasts success, closes.

Validation:
- At least one item selected OR a manually entered amount > 0.
- Amount > 0 and ≤ remaining refundable balance.
- Destination chosen.

## 4. Visual tagging

- Transaction card header: show a badge based on refund totals:
  - `sum(refunds.amount) >= tx.total_amount` → "Refunded" (destructive/neutral variant).
  - `sum > 0` → "Partially refunded".
- Inside the item list (both the search-matched preview and the full list): items whose `id` is in any refund's `item_ids` render with strikethrough on the name and a small "Refunded" chip.
- Edit dialog: show a read-only "Refund history" section listing each refund (date, amount, destination, reason) when `tx.refunds?.length > 0`.

## 5. Income tab surfacing

No structural change needed — the generated income row already appears in `src/routes/income.tsx` history. Its `notes` field carries the reference back to the original transaction. Ensure "Refund" is present in the income category list on first use (insert once if missing).

## 6. Out of scope

- Editing or deleting an existing refund (add later if needed).
- Reversing pocket deposits or income when a refund is voided.
- Reporting-tab treatment of refunds (existing spend math is unchanged because the original transaction total is preserved and the refund shows up as income).

## Technical notes

- Migration:
  ```sql
  ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS refunds jsonb NOT NULL DEFAULT '[]'::jsonb;
  ```
- Regenerate Supabase types after the migration; `useTransactions` payloads cast via `as never` already, so no type friction.
- Refund category seeding uses `useIncomeCategories().add("Refund")` guarded by a `.includes` check.
- All monetary math uses the existing `+(...).toFixed(2)` pattern to avoid float drift.
