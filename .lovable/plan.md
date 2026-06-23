## Goal

Pay for a single transaction from multiple sources. Example: £120 Amazon order = £80 from "Amazon Credit" pocket + £40 on a new "Klarna – Amazon" BNPL plan. The app records both side-effects automatically and remembers the split.

## UX — new "Payment" step on `/new`

Adds a step between **Receipt** and **Items**, so the wizard becomes **Receipt → Items → Payment**. (Putting it last means the total is already known.)

The Payment step shows a stack of **split lines**. Each line has:

- **Source** dropdown: `Main balance`, every Pocket (color-dotted, same tokens as Savings), `BNPL (new plan)`, `Other`.
- **Amount** input.

A live **Remainder** strip under the lines mirrors the Income page pattern:
- `Allocated £X · Remainder £Y` against the calculated total.
- If Remainder ≠ 0 on save → defaults to **Main balance** (same convention as Income). Negative remainder (over-allocated) blocks save.

### BNPL inline mini-form

Selecting `BNPL (new plan)` expands the row to capture what's needed to create the debt on save:
- **Plan name** (default: `"<Retailer> – BNPL"`, editable, e.g. "Klarna – Amazon")
- **Installments** (number, default 3)
- **First payment date** (default = transaction date)
- **Cadence** (Weekly / Fortnightly / Monthly — generates `installment_dates[]`)

No "attach to existing debt" path in this build — chose **Create new BNPL debt inline** per your answer.

### Pocket auto-deduct

Per your answer, any pocket split writes a matching **Savings withdrawal** on save:
- `account` = pocket name, `amount` = split amount, `date` = transaction date
- `notes` = `"Auto: <Retailer> txn <short-id>"` so it's traceable in Savings → History.

## Data model

### Migration — `transactions.payment_splits` (JSONB)

```sql
ALTER TABLE public.transactions
  ADD COLUMN payment_splits jsonb NOT NULL DEFAULT '[]'::jsonb;
```

Shape per entry:
```ts
{ source: "main" | "pocket:<name>" | "bnpl:<debtId>" | "other", amount: number, label?: string }
```

History and Archive can render this later (e.g. "Amazon Credit £80 · Klarna £40"). Not changing those screens in this build beyond a small line in the transaction row.

No changes to `debts` / `savings` schemas — we reuse existing tables.

## Save-time flow

In `save()` (order matters; all sequential awaits):

1. Validate splits sum == total (allowing remainder→main rule above).
2. For each `pocket:*` split → `useSavings().add({ kind: "withdrawal", account, amount, date, notes })`.
3. For each `bnpl:new` split → `useDebts().add({ kind: "bnpl", name, total_amount, installments_total, installment_dates, start_date: date })`, capture returned id, then rewrite that split's `source` to `bnpl:<newId>` before persisting to the transaction.
4. `useTransactions().add({ ..., payment_splits })`.
5. Toast + navigate to `/history`.

Failure handling: if any step throws, surface the error toast and don't navigate. (No cross-table rollback — these are independent ledger records.)

## Files

- **Migration** — add `payment_splits` jsonb column.
- **`src/lib/types.ts`** — add `PaymentSplit` type and `payment_splits?: PaymentSplit[]` on `Transaction`.
- **`src/lib/store.ts`** — pass `payment_splits` through `useTransactions().add`.
- **`src/routes/new.tsx`** — add Payment step (3rd step), split editor, BNPL mini-form, remainder bar, orchestrated save.
- **`src/components/PaymentSplitEditor.tsx`** (new) — encapsulates the split UI so `new.tsx` stays readable; reuses pocket color tokens from `src/lib/colors.ts`.
- **`src/routes/history.tsx`** — small read-only "Paid with" line under each transaction (one-liner, e.g. `Pocket · Amazon Credit £80 · Klarna – Amazon £40`).

## Out of scope (call out, don't build)

- Editing splits after save (will require recomputing/undoing the side-effects — separate task).
- Splitting an **existing** transaction retroactively.
- Attaching to an existing BNPL debt (you picked "create new" — easy to add later).
- Changes to Archive / Dashboard visualisations.
- Refund/return flows that reverse the auto-withdrawal.
