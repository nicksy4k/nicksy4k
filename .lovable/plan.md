# Link standard debts to recurring outgoings

Your instinct is right — this isn't a bug, it's a gap. The linking machinery already exists, but only BNPL plans ever get linked: BNPL debts auto-create their commitment with a `debt_id`, and there is no way to attach an existing debt to an outgoing you created by hand.

Confirmed on your account: the "Rent Arrears" outgoing (£50, last paid 15 Aug, next due 15 Sep) has no debt link, and the "Rent Arrears - Flat 4, 16 Bunnet Road" standard debt has three payments logged (15 May, 15 Jun, 15 Jul) — the August one is missing because marking the outgoing paid had nothing to sync to.

## What changes

1. **Link a debt from the outgoing form.** The Add/Edit outgoing dialog gets a "Counts towards a debt" picker listing your open standard debts (BNPL-created rows stay locked to their own plan and aren't editable here). Choosing one stores the link; "None" clears it.

2. **Every payment syncs, not just the first.** Marking a linked outgoing paid records a payment against the debt, dated to the day you marked it, and taking the amount from the outgoing. Today's guard only ever logs one payment per outgoing ever, so a recurring arrears payment would sync once and never again — that gets replaced by a per-date guard so each cycle logs exactly one payment and re-marking the same cycle can't double up.

3. **Undo reverses it.** Undoing a paid outgoing removes that cycle's auto-logged debt payment (it already deletes the transaction and refunds the Bill Money pocket), so balances stay consistent in both directions.

4. **No double counting.** The debt payment is a ledger entry against the balance owed; the actual money movement stays the single auto-logged transaction the outgoing already creates. Nothing is deducted twice.

5. **Standard debts don't get the BNPL treatment.** The BNPL "advance to next installment" and "delete the commitment when cleared" behaviours stay BNPL-only. When a standard debt reaches zero you'll get a prompt on the outgoing ("this debt is now cleared — stop this outgoing?") rather than the row silently disappearing.

6. **Visibility.** The outgoing's details sheet shows the linked debt name and remaining balance, and the debt card on Credit & Debt shows which outgoing feeds it.

7. **Your August payment.** Once linked, I'll add the missing 15 Aug £50 payment to the arrears debt so the balance is correct going forward. Nothing else about the existing three payments changes.

## Technical notes

- `commitments.debt_id` and the `bnplSync` helpers already exist; no schema change is needed.
- `syncDebtAfterCommitmentPayment` dedupe key changes from `commitment_id` to `commitment_id + date`; `undoDebtPaymentForCommitment` targets the payment matching the commitment's `last_paid_date`.
- Source tagging on the auto-logged payment stays `pocket:Bill Money`, matching what `markOutgoingPaid` already does.
- The missing August payment is a one-off data write to that debt's `payments` array.
- Changelog entry added per project convention.
