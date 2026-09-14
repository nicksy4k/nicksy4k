# Keep pay-later plans, outgoings and Bill Money in step

Today the two sides only half-talk to each other. Confirmed by reading the code:

- Marking an outgoing paid does log a payment against the linked debt (any kind), takes it from the chosen pocket, and tags the logged spend with the outgoing — that direction works.
- Logging a repayment on the debts page only ticks the outgoing when the debt is a pay-later plan. A standard debt (e.g. Rent Arrears) leaves the outgoing sitting unpaid.
- A repayment logged on the debts page writes a spend that isn't tied to the outgoing, so the Outgoings page never learns it was paid.
- Removing or undoing a repayment on the debts page doesn't untick the outgoing.
- Nothing pushes updates between open pages or devices: each page holds its own cached copy for a minute, so a change made on one screen can look stale on another.

## What changes

1. **One shared payment routine.** Both the Outgoings page and the debts page run the same logic: tick the outgoing, roll its next due date to the next scheduled instalment, log the spend against the plan, move the money from the chosen source, and record the payment on the plan. Whichever side you use, both sides end up identical.

2. **Debts page ticks the outgoing for every linked debt**, not just pay-later plans, and stamps the logged spend with the outgoing plus the source you picked.

3. **"Needed" means everything due this cycle.** The Bill Money figure counts every unpaid scheduled outgoing and every debt/pay-later repayment falling inside the current cycle, no matter where the money will actually come from. That's the true "this must be covered" number, so what's left is genuinely safe to spend. The earlier split that discounted rows paid from elsewhere is removed.

4. **Undo works from both sides.** Deleting or undoing a repayment on the debts page reopens the outgoing (due date restored, money refunded to the pocket it came from), matching the existing Undo on the outgoings side.

5. **Live updates across open screens.** Dashboard, Outgoings and Credit subscribe to changes on payments, outgoings, spends and pockets, so a payment made anywhere refreshes the other screens immediately — including a second tab or your phone.

## Technical notes

- Extract the write path from `src/lib/markOutgoingPaid.ts` into a shared `applyLinkedPayment` / `reverseLinkedPayment` pair in `src/lib/bnplSync.ts`, called by both `markOutgoingPaid` and the `FundingSourceDialog` confirm handler in `src/components/credit/DebtsTab.tsx`.
- Debt-side path: replace the bare `ledger.debit(...)` with the shared routine so the transaction carries `commitment_id` and `payment_splits`, and drop the `kind === "bnpl"` gate on `syncCommitmentAfterDebtPayment`.
- Keep the existing per-cycle idempotency (`commitment_id` + `date` match in `debt.payments`) so neither side can double-log.
- Needed figure: revert `billMoneyNeeded`/`paidElsewhere` in `OutgoingsSummary.tsx` and drop `neededBySource` from the shortfall path in `src/routes/commitments.tsx`; needed = every unpaid row due before the cycle reset, including debt repayments due this cycle that have no separate outgoing row. Keep `lastFundingSources` only as the "paid from" label and the default source preselect.
- Same total feeds the dashboard's safe-to-spend/attention figures so both screens agree.
- Realtime: migration adding `commitments`, `debts`, `transactions`, `savings` to `supabase_realtime`, plus a `useLedgerRealtime()` hook mounted once in `src/routes/__root.tsx` that invalidates the matching query keys (single channel, torn down on unmount).
- Vitest: pay and undo from each side, plus needed-total coverage proving a Main-balance-paid instalment still counts until it's paid.
- Changelog entry per project convention.
