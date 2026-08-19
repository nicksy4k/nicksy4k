# Upcoming outgoings in the "Needs your attention" card

Add a fourth row type to the dashboard alerts card: recurring outgoings (bills and subscriptions) due in the next 7 days, colour-coded by whether Bill Money covers them, with a one-tap "Mark paid".

## What you'll see

A "Due soon" section inside the existing card, listing up to 5 unpaid outgoings whose next due date falls between today and 7 days out (overdue rows included and sorted first). Each row shows the name, amount, and a date chip:

- Green — Bill Money covers it (after covering everything due earlier).
- Amber — only partly covered by what's left in the pocket.
- Red — no money left in the pocket for it, or it's already overdue.

A small line under the section states how much Bill Money is available versus how much is due in the window.

Each row has a "Mark paid" tick. Tapping it does exactly what the Outgoings page does: sets paid, logs the auto transaction, deducts from Bill Money, syncs the linked BNPL debt if any, and rolls the due date forward — using the row's own cadence (annual rolls a year, everything else follows your global cycle: monthly or 4-weekly). A toast confirms with an "Undo" that reverses the same way the Outgoings page's unmark does.

Rows disappear from the card once paid; the card hides entirely when nothing needs attention, exactly as now. There's a "View all" link to the Outgoings page.

## Technical notes

- Extract the current `markPaid` / `unmarkPaid` bodies from `src/routes/commitments.tsx` into a shared helper (`src/lib/markOutgoingPaid.ts`) that takes the store mutators (`update`, `addTransaction`, `removeTransaction`, `addSaving`), the commitment and the new due date. Both the Outgoings page and the dashboard call it, so behaviour cannot drift.
- New `dueSoonOutgoings(commitments, savings, now)` selector (in `src/lib/outgoings.ts`) returning rows with a `funded: "full" | "partial" | "none"` flag. Funding reuses the same waterfall the Outgoings page runs: sort unpaid due rows by date, allocate the Bill Money pocket balance down the list.
- `AttentionCard.tsx` gains `dueSoon` and `onMarkPaid` props plus a `DueRow` subcomponent; `src/routes/index.tsx` computes the list from `useCommitments()` + `useSavings()` and passes the handler.
- Due-date roll-forward on the dashboard uses the existing `advanceForCommitment(next_due_date, cadence, cycle)`; no cadence picker on the dashboard (the Outgoings page keeps its full confirm dialog).
- No schema or query changes. Add a dated entry to `src/lib/changelog.ts`.
