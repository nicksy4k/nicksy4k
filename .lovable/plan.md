# Move existing commitments into Subscriptions

You have 15 rows on Commitments in the "Subscriptions" category (NowTV x4, Disney+ x2, Netflix, Spotify, Amazon Prime, Paramount+, Xbox Game Pass, Audible, Max Fun, Lyca phone plan, test sub) plus a couple of borderline ones (Vodafone mobile is filed under Utilities).

Rather than a one-off database edit you can't see or undo, the cleanest route is a small in-app migration tool, so you stay in control and it keeps working for anything you add later.

## What you get

**A one-time prompt on the Commitments page.** When commitments exist that look like subscriptions but aren't flagged yet, a card appears at the top: "15 of your commitments look like subscriptions — move them to the Subscriptions page?" with a checklist of the matches (all ticked by default, untick anything you want to keep as a bill) and a "Move selected" button. The card disappears once there's nothing left to move, or if you dismiss it.

Detection rule: category is "Subscriptions", or the store name matches a known list of common providers (Netflix, Spotify, Disney+, NowTV, Amazon Prime, Xbox, Audible, Paramount+, Apple, Google, YouTube, etc.). BNPL-linked rows are never offered.

**A per-row action.** Every commitment row's menu gets "Move to Subscriptions", and every subscription row gets "Move back to Commitments" — so one-offs like the Vodafone plan (currently Utilities) can be moved without the bulk card, and mistakes are reversible.

Moving a row only sets its subscription flag; the amount, due date, paid state, category and payment method all stay exactly as they are, so cycle totals, the Bill Money waterfall and your shortfall figure don't shift by a penny. Cadence defaults to monthly, editable afterwards on the Subscriptions page (useful for the annual ones).

## Technical notes

- `src/lib/subscriptions.ts` — add `SUBSCRIPTION_PROVIDERS` list and `looksLikeSubscription(c)` / `unmigratedSubscriptions(items)` helpers.
- `src/components/MoveToSubscriptionsCard.tsx` (new) — checklist card, batch `update({ is_subscription: true, cadence: 'monthly' })` on selected ids, invalidate the commitments query, toast with an Undo that flips them back. Dismissal stored in `localStorage`.
- `src/routes/commitments.tsx` — render the card above the list; add "Move to Subscriptions" to the row actions.
- `src/routes/subscriptions.tsx` — add "Move back to Commitments" to the row actions.
- `src/lib/changelog.ts` — new dated entry.

No database migration needed; the `is_subscription` and `cadence` columns already exist.
