# Easier BNPL plans that stay in sync

Make adding a Clearpay-style "pay in 4 every 14 days" plan quick and obvious, make BNPL a clear payment choice when logging a purchase, and make sure the plan on Credit & Debt and the instalment row in Outgoings always agree.

## 1. Provider presets when adding a plan

In the New debt form, when the type is a BNPL plan, show one-tap presets:

- Clearpay — 4 payments, every 14 days, first payment today
- Klarna Pay in 3 — 3 payments, every 30 days, first payment today
- PayPal Pay in 3 — 3 payments, monthly, first payment today
- Custom — set your own

Picking a preset fills in the number of payments, how often they repeat, and the first date, then shows the schedule ("4 × £22.50 — 14 Sep, 28 Sep, 12 Oct, 26 Oct") which can still be edited date by date. A "how often" choice (weekly / every 2 weeks / every 4 weeks / monthly) is added, because today the dates are always generated monthly — that's the main reason Clearpay plans are fiddly to enter.

The same presets and the same schedule preview appear in the BNPL option when logging a purchase, so both routes behave identically.

## 2. BNPL when logging a purchase

BNPL already exists as a payment source on the new-purchase form, but it is buried inside "Add another source". Changes:

- Surface a clear "Pay later (Clearpay/Klarna)" choice at the payment step with the presets above.
- Show the plan summary inline before saving: what leaves today, and what the remaining instalments are.
- Add the same pay-later option to the Quick add panel (plan details kept minimal: provider preset + total).

## 3. Keeping plans and outgoings in step

This is the part that most needs tightening. Each BNPL plan creates a linked instalment row in Outgoings, but the two sides currently advance dates differently.

- The instalment row records the plan's rhythm (e.g. every 14 days) instead of being assumed monthly.
- Ticking the instalment paid in Outgoings jumps to the **next date from the plan's own schedule**, not "+1 month / +4 weeks". The plan's remaining dates are shown as the default choice.
- Ticking it paid asks where the money comes from (main balance or a pocket), the same as paying on Credit & Debt — instead of always taking it from the Bill Money pocket.
- Undoing a payment on either side reverses it on the other: the plan's payment is removed, the instalment row returns to its previous date, and the money goes back where it came from.
- When the final instalment is paid, the plan is marked settled and the instalment row is removed from Outgoings (as it does today), with a confirmation message.
- The instalment row shows progress ("3 of 4 paid — £22.50 left") so the Outgoings page matches the Credit & Debt card at a glance.

## 4. Checks before finishing

Walk the full loop in the running app and confirm figures match at each step:

1. Add a Clearpay plan with the preset, first payment today.
2. Check the Outgoings instalment row shows the correct amount and the next date 14 days out.
3. Pay the next instalment from Outgoings → plan balance drops, progress advances, next date matches the plan schedule.
4. Undo it → both sides return to where they were, money restored.
5. Pay from the Credit & Debt side → Outgoings row advances identically.
6. Repeat to the final instalment → plan settles, outgoing disappears.

## Technical notes

- `BnplDetails.cadence` gains `four-weekly`; `generateInstallmentDates` handles it. A shared `BNPL_PRESETS` map (installments, cadence, first-payment-today) lives with the split editor so `DebtsTab` and `new.tsx` use one source.
- `DebtsTab`'s date generator currently hardcodes `setMonth(+i)` — replaced with `generateInstallmentDates`.
- Auto-created commitments store the plan cadence in `commitments.cadence` (currently only `monthly`/`annual` are used; the column is free text). `perCycleAmount` already understands `weekly`/`fortnightly`/`four-weekly`, so per-cycle totals become correct too.
- `ResetOptions` gets a plan-aware branch: when `commitment.debt_id` points at a BNPL debt, offer the remaining `installment_dates` as the roll-forward options.
- `markOutgoingPaid` takes an explicit funding source instead of always writing a Bill Money withdrawal; the existing `FundingSourceDialog` is reused on the Outgoings page and in the dashboard attention card. `unmarkOutgoingPaid` reverses to the same source.
- `syncDebtAfterCommitmentPayment` / `syncCommitmentAfterDebtPayment` / `undoDebtPaymentForCommitment` stay the single sync path; add unit tests for a 4×14-day plan covering pay, undo, and final settle.
- Changelog entry added per project convention.
