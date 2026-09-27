# Claim details in the Edit Transaction dialog

Right now the Edit Transaction dialog lets you pick the "Delayed / Possibly Lost" status, but the claim dates and reference can only be entered via the "Report delayed / lost" button on the History card. This makes the edit dialog self-sufficient.

## What changes

**Edit Transaction dialog** (`src/components/history/EditTransactionDialog.tsx`):

- When the delivery status is set to "Delayed / Possibly Lost", a claim section appears with:
  - **Claim can be raised from** (date picker)
  - **Claim deadline** (date picker, with the same 48 hours / 7 / 14 / 30 days quick presets used elsewhere)
  - **Case or order reference** (optional text)
- Saving the dialog writes these fields together with the status.
- Switching the status away from "Delayed / Possibly Lost" (e.g. to Received) clears the claim fields so no stale reminders linger.
- Existing values are pre-filled when editing a transaction that already has claim details.

## Technical notes

- Reuses the existing `claim_date`, `claim_deadline`, `claim_reference` columns and the `addDaysIso` helper from `src/lib/delivery.ts` — no database changes.
- Mirrors the field layout of `DelayedClaimDialog.tsx` so both entry points behave identically.
- Dated changelog entry in `src/lib/changelog.ts`.
