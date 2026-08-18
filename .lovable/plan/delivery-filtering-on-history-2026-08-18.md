# Delivery filtering on History

Extend the new History filter dropdown so it can also narrow the list to orders by delivery state, matching how the protections filter works today.

## What you'll get

One dropdown on History with two groups:

- **Protections** — All protections, Active, Expiring soon, Expired, Handled (unchanged)
- **Deliveries** — On the way (awaiting dispatch + in transit), Awaiting dispatch, In transit, Delivered

Picking any option replaces the current one (the two groups are mutually exclusive), the choice lives in the URL so it can be bookmarked and deep-linked, and "Clear filters" resets it.

The "Track" button on the dashboard's "Needs your attention" card will link straight to History filtered to **On the way**.

Note on "due for delivery": transactions only store a delivery status (awaiting dispatch / in transit / delivered) — there's no expected-delivery date on a transaction, so there's nothing to date-filter against. If you want a real "due today / overdue" view later, that needs a new expected-delivery-date field on transactions, which I'd do as a separate change.

## Technical details

- `src/routes/history.tsx`
  - Extend `validateSearch` with a `delivery` param accepting `on_the_way | awaiting_dispatch | in_transit | delivered`; keep the existing `protection` param.
  - Selecting a delivery option clears `protection` and vice versa; the Select's value derives from whichever param is set.
  - Add the delivery predicate to the existing `filtered` memo using `isAwaitingDelivery` / direct status comparison from `src/lib/delivery.ts`, include `delivery` in `hasFilters`, the memo deps and the pagination reset effect, and clear it in `clearFilters`.
  - Use `SelectGroup` / `SelectLabel` for the two grouped sections.
- `src/components/dashboard/AttentionCard.tsx` — point the delivery row's "Track" link at `/history` with `search={{ delivery: "on_the_way" }}`.
- Prepend a v3.1.4 entry to `src/lib/changelog.ts`.
- Verify with a typecheck and a quick browser pass over the filtered URLs.
