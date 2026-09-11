# Easier delivery tracking

Make "this is a delivery" easy to set when logging a purchase, and let you move an order along its journey with one tap instead of editing the transaction.

## Delivery steps

Four steps instead of three:

- Awaiting dispatch (amber)
- In transit (blue)
- Out for delivery (indigo) — new
- Received (green, currently called "Delivered")

Existing orders keep their current step; nothing is lost.

## When adding a purchase

- **Full form:** the "Expecting delivery" switch moves to the top of the details step, right under the date and shop, so it is the first thing you see rather than buried under the receipt section. Turning it on still reveals optional courier and tracking number.
- **Pending holds:** the same switch now shows for pending holds too (it is currently hidden).
- **Quick add:** a compact "Expecting delivery" toggle with optional courier/tracking, shown under the category row.

As now: with a courier or tracking number the order starts as In transit, otherwise Awaiting dispatch.

## Moving an order along

On each History transaction that is a delivery, a row of one-tap buttons shows only the sensible next steps:

- Awaiting dispatch → "Mark dispatched & add tracking" (opens a small dialog for courier + tracking, and sets In transit), plus "Out for delivery" and "Received"
- In transit → "Out for delivery", "Received"
- Out for delivery → "Received"
- Received → no buttons; a small "Reopen" option in case it was tapped by mistake

Courier and tracking, when set, are shown on the card next to the status badge so you can see them without opening the edit dialog. The existing Edit dialog keeps its full delivery section, now with the extra step.

Also updated: the History delivery filter and the dashboard "on the way" count treat Out for delivery as still on its way.

## Technical details

- No database change: `delivery_status` is a free-text column; add `out_for_delivery` to `DELIVERY_STATUSES` and `META` in `src/lib/delivery.ts`, relabel `delivered` to "Received", and include the new status in `isAwaitingDelivery`. Add a `nextDeliverySteps(status)` helper for the button set.
- `src/lib/types.ts` — widen the `delivery_status` union.
- New `src/components/history/DeliveryActions.tsx` — the button row plus the courier/tracking dialog, calling `updateTransaction` from the store; used in `src/routes/history.tsx` in place of the single "Mark delivered" button.
- `src/routes/new.tsx` — hoist the delivery block above the receipt block and render it in the pending branch too.
- `src/components/QuickAddSheet.tsx` — add `expectingDelivery`, `courier`, `trackingNumber` state and pass the three fields to `addTransaction`.
- `src/components/history/EditTransactionDialog.tsx` picks up the new status automatically via `DELIVERY_STATUSES`.
- `src/routes/history.tsx` search param `delivery` gains `out_for_delivery`; `on_the_way` includes it.
- Prepend a changelog entry to `src/lib/changelog.ts`; verify with a typecheck and a browser pass.
