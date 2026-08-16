# Full recurring outgoings (every cycle)

## What you'll see

Alongside "Total outgoings this cycle" (which only counts what's actually due inside the current window), a second figure showing your **regular commitment load** — every bill and subscription you track, regardless of due date.

Commitments page, under the total card:

```text
Total outgoings this cycle        Every cycle (all tracked)
        £480.97                          £527.40
   bills £412 + subs £68.97      28 bills + subs · annuals spread monthly
```

Rules used for the "every cycle" figure:

- Every commitment and subscription row counts once, whether or not it falls due in the current window and whether or not it's paid.
- Annual subscriptions are spread (amount ÷ 12) so one big renewal doesn't distort the typical cycle. The tooltip/subline says so.
- Promo pricing uses the current amount, matching how funding works today.
- BNPL-linked rows are included (they are real outgoings) — flagged in the subline count.

Same card mirrored on the Subscriptions page, and the dashboard outgoings line gains a short "· £527.40 typical per cycle" suffix.

## Technical notes

- Add a shared helper in `src/lib/subscriptions.ts` (or a small `src/lib/outgoings.ts`): `perCycleTotal(items)` returning `{ bills, subs, total }` with annual rows divided by 12.
- `src/routes/commitments.tsx`: compute from `allItems`, render a 5th summary card (grid becomes `lg:grid-cols-5`, or 4 cols with the new card on a second row on smaller widths).
- `src/routes/subscriptions.tsx`: same helper, mirrored card.
- `src/routes/index.tsx`: append the typical-per-cycle figure to the existing outgoings line.
- No database or funding-logic changes.
- Add a v2.12.3 entry to `src/lib/changelog.ts`.
