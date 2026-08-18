# One "Needs your attention" card on the dashboard

Right now the dashboard always shows a "Return / warranty alerts" card (even when it says "No active protections"), a separate delivery tile, and a subscription-offers block bolted onto the outgoings card. This merges the noisy bits into a single alerts card that only appears when something genuinely needs attention.

## What changes

### 1. New combined alerts card
One card, titled "Needs your attention", that renders **only** when at least one item qualifies. When nothing qualifies, it is removed from the layout entirely (no empty state, no grey box).

It gathers three kinds of rows, in priority order:

- **Returns closing** — a return window expiring within the next 7 days (or already expired within the last day).
- **Warranties ending** — a warranty expiring within the next 30 days.
- **Deliveries on the way** — a single summary row: "2 orders on the way" with a Track link to History.

Subscription offers ending keep working, but move into this same card as a fourth row type instead of sitting inside the outgoings card.

### 2. Only urgent protections surface
Today every protection with a future expiry shows on the dashboard, including ones a year out. After this change the dashboard shows only the urgent ones (7 days for returns, 30 days for warranties) — the same thresholds the app already uses to colour a protection amber.

### 3. Dismiss stays, and is per-item
Each protection row keeps its tick ("Mark handled") button, which permanently dismisses that item from the dashboard — same behaviour as today. Dismissing the last row makes the whole card disappear.

The delivery row is not dismissible (it disappears on its own when orders are marked delivered); the card offers Track instead.

### 4. Protections filter on History (no new page)
Because the dashboard now hides non-urgent protections, History gains a filter/toggle to show only transactions carrying a return window or warranty:

- Toggle sits with the existing History filters; sub-filter by Active, Expiring soon, Expired, Dismissed.
- Each row keeps its usual History layout plus type badge, expiry date and days-left chip.
- Dismissed items can be restored (un-dismiss) so a mistaken tick is recoverable.
- Reachable from a "View all" link in the alerts card, which opens History with the filter pre-applied.

### 5. Outgoings card left clean
The "Outgoings this cycle" block becomes its own standalone card again, with the promo block removed from it.

## Technical notes

- New `src/components/dashboard/AttentionCard.tsx` holding the merged card and the existing `AlertRow` (moved out of `src/routes/index.tsx`).
- Urgency selection reuses `protectionStatus()` from `src/lib/protection.ts` (warn threshold is already 7 days for returns, 30 for warranties); dashboard filter keeps rows where status is `warn` or `expired` and `dismissed_at` is null.
- History filter added in `src/routes/history.tsx` (URL search param so the dashboard can deep-link into it); no new route, no schema or query changes.
- Un-dismiss reuses the existing transaction `update` in `src/lib/store.ts`, setting `dismissed_at` to null; no migration needed.
- Add a dated entry to `src/lib/changelog.ts`.
