# One "Outgoings" page with a filter toggle

Commitments and Subscriptions become a single page. The two lists are already the same data (subscriptions are commitments with a flag), so the split mostly duplicates cards and maths.

## What you get

**One page: Outgoings** (`/commitments`, sidebar entry renamed "Outgoings"). At the top of the list, a segmented control:

- **All** — every tracked outgoing
- **Subscriptions** — the flagged ones
- **Bills** — everything that isn't a subscription

The filter only changes the list; the summary cards always describe the whole cycle so the numbers never move around under you. Rows show a small "Sub" badge in All view so you can still tell them apart, plus the existing status dot/tick.

**Half as many cards.** Today there are six blocks above the list. Replaced with:

- One summary card, four figures in a row: **Bills this cycle · Subscriptions this cycle · Total outgoings · Left to pay** (left to pay keeps the red/green emphasis).
- Cycle dates, "every cycle (all tracked)" total and the Bill Money shortfall line all fold into one compact strip beneath it, with "Change cycle" still one tap away.
- The status legend moves behind a small "What do the icons mean?" toggle instead of always occupying a row.

**Nothing else changes.** Offer/promo alerts, the promo badges, the "Confirm payment reset?" step, undo, the move-to-subscriptions tooling, BNPL sync and Bill Money auto-deduction all carry over exactly as they behave now. Adding is one button whose dialog has the subscription toggle (and cadence/offer fields appear when it's on), so there's one add flow instead of two.

**Old links keep working.** `/subscriptions` stays as a route that redirects to the combined page with the Subscriptions filter pre-selected, so bookmarks and the dashboard link don't break.

## Technical notes

- New `src/components/outgoings/` pieces extracted from the two routes so neither file stays ~950 lines: `OutgoingsSummary.tsx` (cards + cycle strip), `OutgoingsList.tsx` (rows + status tooltips), `OutgoingRow.tsx`, `OutgoingDialog.tsx` (add/edit, merges the commitment and subscription forms behind the `is_subscription` switch), `OutgoingDetailsDialog.tsx` (details + confirm-payment-reset + promo actions).
- `src/routes/commitments.tsx` becomes the container: shared data hooks, cycle maths (`cycleDate`/`inCycle` and the funding waterfall as they are today), filter state in a `?view=all|subs|bills` search param.
- `src/routes/subscriptions.tsx` reduced to `beforeLoad` redirect → `/commitments?view=subs`.
- `src/components/app-sidebar.tsx`: single "Outgoings" entry, Subscriptions entry removed.
- `src/routes/index.tsx`: dashboard promo alerts and links point at the new route/param.
- No database or business-logic changes; `src/lib/subscriptions.ts`, `src/lib/outgoings.ts`, `src/lib/cycle.ts` untouched.
- New dated entry in `src/lib/changelog.ts`.
