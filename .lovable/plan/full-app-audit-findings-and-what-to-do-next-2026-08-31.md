# Full app audit — findings and what to do next

The app is in good shape structurally: every page has unique title/description metadata, date maths deliberately avoids UTC drift, and database mutations check for errors and refresh the right caches. The issues found are polish and consistency, not architecture. Below is what I'd fix, then where I'd take the app next.

## Confirmed issues

**1. Pages flash "nothing here yet" while data loads**
The shared data hooks in `src/lib/store.ts` return only `data` and throw away the loading flag, so on a slow connection the dashboard, history, income, outgoings, savings, credit and archive pages briefly show their empty states ("No transactions yet.") before the real data appears. Looks like data loss to the user.

**2. Icon-only buttons that screen readers can't announce**
- Delete allocation row in `src/routes/income.tsx` — no label at all
- Open receipt in `src/routes/archive.tsx`
- Open receipt / Mark handled / Mark paid in `src/components/dashboard/AttentionCard.tsx`
These use `title` (or nothing); history rows already do it correctly with `aria-label`.

**3. Split/remainder maths written three separate times**
`src/routes/income.tsx`, `src/routes/new.tsx` and `src/components/PaymentSplitEditor.tsx` each re-implement "total minus allocated, rounded to 2dp" plus their own over-allocation tolerance check. Fixing a rounding edge case in one silently leaves the other two wrong.

**4. Retired Subscriptions page is still search-indexable**
`src/routes/subscriptions.tsx` only redirects to Outgoings but still publishes its own page metadata, competing with the real Outgoings page in search results.

**5. Four "god" files**
`new.tsx` (1258 lines), `income.tsx` (1089), `settings.tsx` (1071), `history.tsx` (1005) mix page setup, dialogs, money maths and layout. This is what causes issue 3 to keep happening.

## Proposed work — Phase 1: fixes and polish

1. Expose loading state from the store hooks and add proper skeletons/loading rows to every list page, so empty states only show when the data really is empty.
2. Add `aria-label` to all icon-only buttons listed above (keeping tooltips), and sweep the rest of the app for the same pattern.
3. Create one shared money helper (`remainder`, `isOverAllocated`, `isFullyAllocated`) in `src/lib/money.ts` and point income, new-transaction and the split editor at it. Add unit tests.
4. Add `noindex` to the retired Subscriptions redirect page.
5. Live mobile pass at 390px across every page (audit was static only), fixing any overflow, cramped tap targets under 44px, or dialogs that don't scroll.

No behaviour or data changes — same numbers, same saves.

## Proposed work — Phase 2: pick a direction for 3.3

Ideas that fit what's already built, roughly in value order:

- **Budgets per category and per cycle** — set a limit for Groceries, Joy, etc., see progress bars on the dashboard and warnings as you approach. The cycle engine and category data already exist; this is the biggest missing pillar of a money app.
- **Insights / trends** — "you spent 18% more on takeaways this cycle", biggest movers vs last cycle, subscription creep detection. Reports currently shows what happened, not what changed.
- **Forecast to end of cycle** — projected balance on payday given known outgoings, pending transactions and repayment plans. Answers "will I make it?".
- **Search across everything** — one command palette to jump to a transaction, retailer, debt or setting. With 20+ pages the app has outgrown pure navigation.
- **Receipt scanner for everyone** — currently admin-only; opening it up with a monthly scan cap would be the most visible upgrade for real users.

## Technical notes

- Phase 1 touches `src/lib/store.ts` (return `isLoading` alongside `items`, additive so no call site breaks), the seven list routes, `src/lib/money.ts`, `src/routes/subscriptions.tsx`, and the accessibility spots listed.
- Breaking up the four large files is deliberately excluded from Phase 1 — high churn, no user-visible gain. Better done incrementally as each area is next touched for a feature.
- Changelog entry (v3.2.2) prepended to `src/lib/changelog.ts` per project rule.
