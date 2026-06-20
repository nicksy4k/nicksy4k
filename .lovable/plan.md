## Goal
Add itemization to debts: store line items in a new `debt_items` table, capture them in the Add Debt modal with auto-totaling, and show an expandable breakdown in the debt list.

## 1. Database (migration)

New table `public.debt_items`:
- `id uuid pk default gen_random_uuid()`
- `debt_id uuid not null references public.debts(id) on delete cascade`
- `user_id uuid not null` (denormalized so RLS can scope without a join)
- `item_name text not null`
- `price numeric(12,2) not null default 0`
- `quantity integer not null default 1`
- `created_at timestamptz not null default now()`

Index on `debt_id`. GRANTs to `authenticated` + `service_role`. RLS enabled with policies scoping all actions to `auth.uid() = user_id` (mirrors existing `debts` policies).

No changes to existing `debts` table — `total_amount` stays the source of truth; items are additive context.

## 2. Types & store

- `src/lib/types.ts`: add `DebtItem` interface.
- `src/lib/store.ts`: add `useDebtItems(debtId?)` hook following the same Supabase pattern used by other entities, with `add`, `addMany`, `update`, `remove`. Fetch all items for the user once; components filter by `debt_id`.
- Regenerate `src/integrations/supabase/types.ts` (happens automatically after migration).

## 3. Add Debt modal updates (`src/routes/credit.tsx`)

Inside the existing Add Debt dialog, below the existing fields, add an optional **Items** section styled like the line-item editor in the expense logging UI:
- Rows of `item_name` / `price` / `quantity` with a trash button.
- "+ Add item" button to append a row.
- Computed `itemsTotal = sum(price * quantity)` shown beneath the list.

Auto-total behavior:
- While the user has not manually edited Total Amount, the Total field mirrors `itemsTotal` live.
- Track `totalDirty` flag; flip to true on manual edit of Total.
- If `totalDirty` and `itemsTotal > 0` and they differ, show an inline warning under the Total field: *"Items total £X doesn't match £Y. [Use items total]"* — the link resets to items total and clears the dirty flag.

On submit:
- Insert the debt as today (unchanged logic, including BNPL first-installment + commitment side effects).
- If there are any non-empty item rows, insert them into `debt_items` with the new `debt_id`. Use `addMany` (single insert call). Failure to insert items rolls back via toast warning but keeps the debt (items are non-critical).

## 4. Debt list/detail view

In the debts list rendering (the existing Accordion per debt), add an **Items** subsection inside the expanded content:
- If the debt has items: render a compact card with a small table (Item · Qty · Price · Line total) and a footer row showing the items subtotal vs the debt total (with a muted note if they differ).
- If none: small "No items recorded" hint with an inline "+ Add items" button that opens a lightweight inline editor (same row component as the modal) to add/edit/remove items post-hoc.

Edit/delete of individual items uses the `useDebtItems` mutations; no other debt fields are touched.

## 5. Out of scope

- No changes to existing debt totals, commitments, BNPL kill-switch, or RLS on other tables.
- No itemization for `loans` (separate module).
- No bulk import / receipt parsing.

## Technical notes

- Reuse `Input`, `Button`, `Card`, `Accordion` — no new UI primitives.
- Component split: extract a small `DebtItemsEditor` component (used by both the Add modal and the inline post-hoc editor) and a `DebtItemsList` read-only view.
- Money formatting via existing `fmt()`.
- All Supabase calls go through the browser client already imported in `credit.tsx` / `store.ts`.
