# Keep pay-later plans, outgoings and Bill Money in step

Today the two sides only half-talk to each other. Confirmed by reading the code:

- Marking an outgoing paid does log a payment against the linked debt (any kind), takes it from the chosen pocket, and tags the logged spend with the outgoing — that direction works.
- Logging a repayment on the debts page only ticks the outgoing when the debt is a pay-later plan. A standard debt (e.g. Rent Arrears) leaves the outgoing sitting unpaid.
- A repayment logged on the debts page writes a spend that isn't tied to the outgoing, so the Outgoings page can't see where the money came from and the Bill Money "needed"/shortfall figures still assume Bill Money will cover it.
- Removing or undoing a repayment on the debts page doesn't untick the outgoing.
- Nothing pushes updates between open pages or devices: each page holds its own cached copy for a minute, so a change made on one screen can look stale on another.

## What changes

1. **One shared payment routine.** Both the Outgoings page and the debts page run the same logic: tick the outgoing, roll its next due date to the next scheduled instalment, log the spend against the plan, move the money from the chosen source, and record the payment on the plan. Whichever side you use, both sides end up identical.

2. **Debts page ticks the outgoing for every linked debt**, not just pay-later plans, and stamps the logged spend with the outgoing plus the source you picked.

3. **Bill Money figures follow the real source.** Because debt-side payments are now tagged, the Outgoings summary counts only what Bill Money genuinely has to cover, and instalments paid from Main balance or another pocket show their real source instead of inflating the shortfall.

4. **Undo works from both sides.** Deleting or undoing a repayment on the debts page reopens the outgoing (due date restored, money refunded to the pocket it came from), matching the existing Undo on the outgoings side.

5. **Live updates across open screens.** The dashboard, Outgoings and Credit screens subscribe to changes on payments, outgoings, spends and pockets, so a payment made anywhere refreshes the other screens immediately — including a second tab or your phone.

## Technical notes

- Extract the write path from `src/lib/markOutgoingPaid.ts` into a single `applyLinkedPayment` / `reverseLinkedPayment` pair in `src/lib/bnplSync.ts`, called by both `markOutgoingPaid` and the `FundingSourceDialog` confirm handler in `src/components/credit/DebtsTab.tsx`.
- Debt-side path: replace the bare `ledger.debit(...)` with the shared routine so the transaction carries `commitment_id` and `payment_splits`, and drop the `kind === "bnpl"` gate on `syncCommitmentAfterDebtPayment`.
- Keep the existing per-cycle idempotency (`commitment_id` + `date` match in `debt.payments`) so neither side can double-log.
- Reverse path: on debt payment delete, find the payment's `commitment_id`, restore `prev_due_date`, clear `paid`, remove the linked transaction and refund the pocket.
- Realtime: migration adding `commitments`, `debts`, `transactions`, `savings` to `supabase_realtime`, plus a `useLedgerRealtime()` hook mounted once in `src/routes/__root.tsx` that invalidates the matching query keys on change (single channel, torn down on unmount).
- Vitest coverage for both directions: pay on each side, undo on each side, and Bill Money needed-by-source after a Main-balance instalment.
- Changelog entry per project convention.
