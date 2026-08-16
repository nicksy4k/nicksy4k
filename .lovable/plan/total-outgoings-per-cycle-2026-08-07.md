# Total outgoings per cycle

## What you'll see

**Commitments page** — the summary row becomes four figures that read as one story:

```text
Commitments this cycle   Subscriptions this cycle   TOTAL OUTGOINGS   Left to pay
        £412.00                   £68.97               £480.97          £145.50
```

- "Total outgoings" = every bill + subscription **due inside the current cycle**, paid or not. This is the number you budget with.
- "Left to pay" keeps its current meaning (unpaid only) and stays highlighted.
- The total card gets a one-line breakdown underneath: "bills £412.00 + subs £68.97".

**Subscriptions page** — the same "Total outgoings this cycle" card is mirrored there, so the figure is visible from either page rather than only one.

**Dashboard** — a compact "Outgoings this cycle" line added to the existing commitments/bills area showing total due and how much is still unpaid, linking to Commitments.

Note on the current "Commitments" card: it sums _all_ commitment rows regardless of due date, which can read higher than the cycle. It will be changed to cycle-scoped so all four figures add up consistently.

## Answer: how Subscriptions affects Recurring Income / Bill Money

Short version: it already works, nothing is being missed.

Subscriptions are not a separate table — they are commitment rows with an `is_subscription` flag, and they share the same "Bill Money" pocket. The recurring-income "cover commitments" allocation loads **all unpaid rows from `commitments`** with no subscription filter, then funds the gap between what's due in the window and the pocket's current balance. So every subscription you moved across is already counted when your income auto-deposits into Bill Money.

Two behaviours worth knowing:

- Annual subscriptions only count in the cycle their renewal date falls in — they don't inflate every month's deposit.
- Promo pricing: the deposit uses the current `amount`, and the rollover engine swaps in the standard price on the promo end date, so the following deposit automatically covers the higher charge.

The plan adds no logic change here; the new totals card uses the same due-in-cycle rule as the funding waterfall, so the number you see matches the number Bill Money is funded to.

## Technical notes

- `src/routes/commitments.tsx`: add `commitmentsDueThisCycle` and `totalOutgoings` memos using the existing `resetDate` window (`next_due_date < resetDate`); replace `totalCommitments` in the first card; add the total card to the grid (4 columns on desktop).
- `src/routes/subscriptions.tsx`: read all commitments via `useCommitments()`, compute the same split, render a mirrored total card.
- `src/routes/index.tsx`: add the compact outgoings line near the existing commitments/promo section.
- No database or funding-logic changes; `src/lib/recurringIncome.ts` stays as is.
- Add a v2.12.2 entry to `src/lib/changelog.ts`.
