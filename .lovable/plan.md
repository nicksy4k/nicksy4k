
## Problem

### 1. Wrong due date on auto-created BNPL commitment
In `src/routes/credit.tsx` (~line 1028), when a new BNPL debt is saved with **"Pay 1st installment now"**, the linked commitment is created with:

```ts
next_due_date: format(addMonths(new Date(today), 1), "yyyy-MM-dd")
```

This ignores the `installment_dates` array the user just configured in the dialog — so the commitment lands on an arbitrary "today + 1 month", not on installment #2's actual scheduled date. It should use `data.installment_dates[1]` (the first *unpaid* installment).

Also: when a BNPL is created **without** "Pay 1st now", `credit.tsx` creates **no commitment at all** — only the `/new.tsx` split-payment path does. That's the second half of the same date bug: the Commitments tab silently gets no row, so users perceive whichever path did fire (usually `/new.tsx` inline, where `next_due_date: dates[0]` is already correct).

### 2. No two-way sync between BNPL repayments and their Commitment
Today the two surfaces write to their own tables and only talk in one direction:

- **`credit.tsx` → commitments:** logging a repayment on the Credits & Debts tab pushes into `debts.payments`, debits the ledger, and calls `maybeKillCommitment` (which only *deletes* the commitment when the whole plan is cleared). It never marks the current-cycle commitment as `paid` or rolls its `next_due_date` forward. So paying early on Credits leaves the Commitment still showing as due.
- **`commitments.tsx` → debts:** `onConfirmReset` marks the commitment paid, logs a transaction, and debits Bill Money — but never appends a `LedgerPayment` to the linked `debts.payments`. So the BNPL balance on Credits & Debts never decreases. `onUnmarkPaid` has the same gap in reverse.

No DB triggers are needed — the app is the single writer for both tables, and both use the standard client. Sync should live in the same handlers that already touch each side.

## Fix

### A. Correct commitment date on BNPL creation (`src/routes/credit.tsx`)

In the `onSave` handler for new debts:

1. Compute the commitment's `next_due_date` from `data.installment_dates`:
   - If `payFirstNow` → `installment_dates[1]` (fallback to `installment_dates[0]` if only one date).
   - Otherwise → `installment_dates[0]`.
   - Final fallback to `addMonths(today, 1)` only when the array is empty (defensive).
2. Move the `addCommitment(...)` call **out of the `if (payFirstNow)` block** so a commitment is created for every new BNPL plan with `installments_total > 0` (matching the behaviour of `/new.tsx`). When `payFirstNow` is false, `last_paid_date: null` and `remainingCount = n`.

### B. Two-way sync helpers (new file `src/lib/bnplSync.ts`)

Small pure-ish helpers so both surfaces call the same code:

- `syncCommitmentAfterDebtPayment(debtId, paidDate)` — find commitment where `debt_id === debtId`; set `paid: true`, `last_paid_date: paidDate`, `prev_due_date: current next_due_date`, advance `next_due_date` to the next entry in the debt's `installment_dates` after the current one (or leave null when the plan is on its last installment). Reuses `useCommitments().update`.
- `syncDebtAfterCommitmentPayment(commitment, paidDate, source)` — append a `LedgerPayment` to the linked debt's `payments` (id, date, amount = commitment.amount, type: "payment", source, notes: "Auto: commitment marked paid"). Reuses `useDebts()`.
- `undoDebtPaymentForCommitment(commitment)` — remove the most recent `payments[]` entry that was auto-linked to this commitment (matched by a stable marker in `notes` or by commitment_id-stamped payment id) so `onUnmarkPaid` fully reverses the debt side.

To make the undo reliable, extend `LedgerPayment` writes from commitments to include a `commitment_id?: string` field on the payment record (JSON column, no migration needed) so we can remove exactly the right row.

### C. Wire the helpers

- **`src/routes/credit.tsx`** — inside the `FundingSourceDialog.onConfirm` block for debts (after `update(pending.debt.id, { payments: next })` and `ledger.debit(...)`), call `syncCommitmentAfterDebtPayment(pending.debt.id, pending.date)` **before** the kill-switch check. Kill-switch still runs afterwards for the fully-cleared case.
- **`src/routes/commitments.tsx`** — in `onConfirmReset`, when `c.debt_id`, call `syncDebtAfterCommitmentPayment(c, paidDate, { kind: "pocket", name: BILL_POCKET })`. In `onUnmarkPaid`, when `c.debt_id`, call `undoDebtPaymentForCommitment(c)` alongside the existing transaction/pocket refund.

### D. Cache invalidation

Both helpers already go through the `useCommitments` / `useDebts` mutators, which call `qc.invalidateQueries` for their own key. Add a cross-invalidate at each call site (`qc.invalidateQueries({ queryKey: ["debts"] })` from the commitments side, and `{ queryKey: ["commitments"] }` from the credit side) so the *other* tab refreshes immediately when a user switches to it.

## Out of scope

- No DB migration or Postgres trigger — the app is the single writer and JSON-column payment history already supports the extra `commitment_id` marker.
- Rollover engine (`useCommitmentRollover`) is unchanged; it will keep correctly advancing the commitment on cycle boundaries whether or not the payment came from Credits or Commitments.
- No UI changes in the dialogs themselves.

## Verification

- Create a new BNPL plan (with and without "Pay 1st now"); confirm the resulting commitment's `next_due_date` matches installment #2 (or #1) shown in the dialog.
- Log an early repayment from Credits & Debts; confirm the linked commitment flips to paid, `next_due_date` advances, and the Commitments tab reflects it without a manual refresh.
- Mark the same BNPL commitment paid from the Commitments tab; confirm the debt's remaining balance drops by one installment and history shows the new payment row.
- Undo the commitment payment; confirm the debt's most recent auto-payment is removed and remaining balance restores.
