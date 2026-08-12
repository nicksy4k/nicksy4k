# Delivery & Order Tracking

Track online orders from purchase to doorstep, using the existing transaction records.

## 1. Database

Add three optional fields to transactions:
- `delivery_status` — one of `awaiting_dispatch`, `in_transit`, `delivered` (empty for normal purchases)
- `courier`
- `tracking_number`

All nullable, so existing transactions are untouched. Existing access rules already scope transactions to their owner, so no policy changes are needed.

## 2. New Transaction form (/new)

- New "Expecting delivery" switch placed directly under the receipt section, above the protection fields.
- When ON, reveal two optional inputs: Courier and Tracking number. Neither is required and neither blocks saving.
- On save with the switch ON: status is set to `in_transit` when a courier or tracking number was entered, otherwise `awaiting_dispatch`. When OFF, all three fields stay empty.

## 3. History page (/history)

- Colour-coded badge on any transaction that has a delivery status:
  - Awaiting Dispatch — amber, 📦
  - In Transit — blue, 🚚
  - Delivered — green, check icon
- "Mark delivered" action button on cards whose status is awaiting dispatch or in transit; sets status to delivered and refreshes the list.
- Edit Transaction dialog gains a delivery section: status selector plus Courier and Tracking number, so details can be corrected later. Editing a transaction that had no delivery info can add it.

## 4. Dashboard ghost card

- Small stat card near the return/warranty alerts counting transactions that are awaiting dispatch or in transit, with a link through to History.
- The card renders only when that count is above zero; at zero it is removed from the layout entirely (not hidden or greyed out).

## Technical notes

- Migration adds the three nullable text columns to `public.transactions`; no grant or policy changes required.
- `Transaction` type in `src/lib/types.ts` gains `delivery_status?: "awaiting_dispatch" | "in_transit" | "delivered" | null`, `courier?: string | null`, `tracking_number?: string | null`.
- `useTransactions().add` in `src/lib/store.ts` must pass the new fields through; `update` already forwards arbitrary patches, so "Mark delivered" and edit saves reuse it.
- Badge rendering and labels live in one small shared helper (e.g. `src/lib/delivery.ts`) used by history and the dashboard, with semantic colour tokens rather than hardcoded colours.
- Add a dated entry to `src/lib/changelog.ts` for this release.
