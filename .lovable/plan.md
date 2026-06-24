## Goal

When a split-payment transaction creates a new BNPL plan, also auto-create a linked recurring **commitment** so the remaining installments show up in the active cycle tracker — matching the behaviour that already exists in the manual "Add BNPL debt" flow on `/credit`.

## Why it's missing today

`src/routes/new.tsx` calls `addDebt(...)` for the BNPL split and stops there. The `/credit` page's `BnplFormModal` save-handler creates the debt **and** an `addCommitment({...debt_id})` row; the split-payment path skipped that second step.

## Behaviour

For every `bnpl:new` split saved from the Log Transaction flow:

1. Create the debt (already happens) and capture `debtId`.
2. Immediately create one linked commitment row:
   - `item_name`: `"<Plan name> Installment"`
   - `store`: plan name
   - `payment_method`: `"BNPL"`
   - `category`: `"Debt"`
   - `amount`: per-installment amount (see table below)
   - `next_due_date`: first **future** installment date (see table)
   - `last_paid_date`: `null` for the no-pay-today branch; `today` when installment #1 was taken now
   - `prev_due_date`: `null`
   - `paid`: `false`
   - `debt_id`: the new debt's id
   - `notes`: `"Auto-linked to BNPL plan (<remaining> of <total> remaining)."`
3. Skip the commitment when the plan has **0 remaining installments** after the today-deduction (i.e. user picked `installments = 1` and "first payment today" — nothing left to schedule).

### Per-installment amount + first due date

| Branch | Amount | next_due_date |
|---|---|---|
| Standard (no "pay today") | `s.amt / installments` | `dates[0]` (already the first scheduled date) |
| "First payment today" | `remainingAmt / (installments − 1)` | `remainingDates[0]` (first date after today) |

Both rounded to 2dp, same convention as the existing BNPL math.

### Cycle integration

No extra code needed — `useCommitmentRollover` walks all commitments and advances `next_due_date` whenever the cycle rolls, so the new row participates automatically. The existing "settled debt → drop linked commitment" kill-switch on `/credit` already keys off `debt_id`, so cleanup keeps working.

## Files

- **`src/routes/new.tsx`** — in the `bnpl:new` branch of `save()`, after each `addDebt(...)` resolves, call `addCommitment({...})` with the fields above. Pull `useCommitments` from `@/lib/store` and destructure `add: addCommitment` alongside the existing hooks.

No schema changes. No changes to `PaymentSplitEditor`, `/credit`, `/commitments`, or the rollover engine.

## Out of scope

- Letting the user customise the commitment name/category from the split editor (uses the same defaults as `/credit`).
- Back-filling commitments for BNPL plans created **before** this change — only new split-payment BNPL plans get one.
- Changing commitment cadence storage (commitments don't store cadence today; rollover is cycle-driven).
