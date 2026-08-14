# BNPL repayments and the Main Balance

## What I checked in your live data

- The £125.40 ClearPay row (13 Aug, 7 "repayment x of 4" items) is tagged **Main balance**, not BNPL, and is not pending. The anti-double-dip helper only ignores amounts tagged `bnpl:` — it does **not** zero this row. So the helper you suspected is not what's swallowing this £125.40.
- The Amazon 10 Aug purchase (£46.50) is the only row with a `bnpl:` tag this cycle, and £34.87 of it is correctly held back from Main Balance.
- Six payments were logged in Credit & Debt on 13 Aug ("paid in full 13/08/2026", £93.15 across Amazon BNPL, Amazon Toothbrush and George Clothing). **None of them produced a transaction row in the ledger.** Logging a debt payment from "Main" is supposed to write an outgoing transaction; for those six, nothing was written.

So the diagnosis is not confirmed yet, and I don't want to "fix" the wrong helper. There are two live candidates and step 1 is to settle which one you hit:

1. Payments logged in Credit & Debt silently failed to write their transaction rows (the write is fired after the debt update and errors are swallowed into a generic toast).
2. They were written with the **future installment date** (24 Aug / 4 Sep / 21 Sep / 9 Oct), which pushes them out of the current cycle so Main Balance never sees them — and the rows were later deleted from History when they looked like duplicates.

Either way the symptom matches yours exactly: money left your bank, nothing debited Main Balance.

## The fix

1. **Verify first.** Add explicit error surfacing to the debt/loan payment flow so a failed ledger write shows a real error instead of a success toast, and reproduce one payment end to end to see which candidate is real.
2. **Date repayments on the day you pay them.** A repayment transaction should be dated the payment date (today), not the scheduled installment date, so it lands in the cycle where the money actually left. The scheduled date stays on the debt/commitment for forecasting.
3. **Make the transaction/pocket write atomic with the debt update.** If the ledger write fails, the payment is not recorded as paid, and you get a clear error — no more silent gaps.
4. **Keep purchase vs repayment separate in the math.** Confirm and lock in with tests:
   - a new BNPL purchase holds back the `bnpl:` portion from Main Balance (current behaviour, correct),
   - a BNPL **repayment/settlement** always deducts in full from Main Balance or the chosen pocket, and never carries a `bnpl:` tag,
   - a pocket-funded repayment writes both the pocket withdrawal and the transaction so it nets against the pocket, not main.
5. **Label repayments clearly** in History (e.g. "BNPL repayment · <plan>") so they are visually distinct from BNPL purchases.

## About your £125.40

Because the manual ClearPay row is tagged Main balance and dated inside the current cycle, it *should* already be reducing Main Balance. Once the code fix is in I'll re-run the dashboard math against your actual rows for this cycle and tell you exactly which figure is off and why — if it turns out something else is inflating the balance (for example a routed-income deposit on 13 Aug), I'll report that rather than paper over it.

## Technical notes

- `mainExpensePortion` in `src/lib/format.ts` stays as-is; it is already repayment-safe. Tests get extra cases for repayment rows.
- Changes land in `src/routes/credit.tsx` (payment dialog / `useLedgerSync` call sites): payment date for the ledger row, error propagation, and rollback of the debt payment when the ledger write fails.
- `src/lib/ledgerSync.ts` gains a repayment label/category convention; no schema change.
- New tests in `src/lib/__tests__/ledgerSync.test.ts` and `format.test.ts`.
- Changelog entry prepended to `src/lib/changelog.ts`.
