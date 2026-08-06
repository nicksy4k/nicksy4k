# Fix: pocket-funded loans/debts never record the outgoing money

## What's wrong

In the Credit & Debt module, choosing a Pocket as the funding source records **only** the pocket withdrawal. The withdrawal releases that money back into the main balance, but no outgoing transaction is ever created — so the main balance is inflated by the amount and nothing appears in the transactions list. This is exactly the £50 sister top-up you saw.

This is confirmed in the shared ledger helper used by Credit & Debt: for a pocket source it writes the savings withdrawal and returns early, skipping the transaction it writes for a "Main balance" source.

The same helper backs every outgoing action in the module, so the bug applies to:
- Creating a new loan funded from a pocket
- Logging a loan top-up from a pocket
- Paying a debt / first BNPL installment from a pocket

The mirror case has the same shape: logging a loan **repayment** into a pocket writes only the pocket deposit, so the incoming money is never recorded and the main balance drops by that amount instead of staying flat.

## How the rest of the app already does it

The New Transaction split-payment flow (pocket-funded spend) writes **both**: a pocket withdrawal *and* a full transaction tagged with a `pocket:<name>` payment split. The two net out, so the main balance stays correct and the spend shows in history. Credit & Debt should follow the same convention.

## The fix

1. **Outgoing from a pocket** — write the pocket withdrawal *and* the outgoing transaction (labelled e.g. "Loan to Sarah" / "Top-up loan · Sarah", category Loans/Debt), tagged with a `pocket:<name>` payment split so reporting knows it was pocket-funded and doesn't double-count.
2. **Incoming into a pocket** — write the pocket deposit *and* the matching income entry, so the main balance nets out instead of dipping.
3. "Other / external" source keeps behaving as today (no ledger entries) since that money never touches your accounts.
4. Add tests covering: pocket-funded loan create, pocket-funded top-up, pocket-funded debt payment, and pocket repayment — each asserting both rows are written and the net main-balance effect is zero.

## Your existing £50

The fix only applies going forward. Your sister's £50 top-up already has the withdrawal but no outgoing transaction. Easiest correction: add a one-off transaction dated yesterday for £50 ("Top-up loan · <sister>", category Loans) with the Savings pocket as the payment split — I can walk you through it, or add it for you once the fix is in.

## Technical notes

- Change is contained to the `useLedgerSync` helper (`debit` / `credit`) in `src/routes/credit.tsx`; all five call sites inherit the fix.
- Transactions get `payment_splits: [{ source: "pocket:<name>", amount }]`, matching `buildPocketWithdrawalRows` / `mainExpensePortion` conventions in `src/lib/splits.ts` and `src/lib/format.ts`.
- No schema change needed.
- Prepend a changelog entry to `src/lib/changelog.ts`.
