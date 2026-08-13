# Commitments summary cards: math, order, colour

## 1. Why the totals look "unpaid only"

The filters themselves don't check `paid` — the three cycle cards already sum paid and unpaid rows. The real cause is the date: when you confirm a payment, the row's `next_due_date` is advanced into the next cycle (the old date is stored in `prev_due_date`). So a paid bill stops matching `next_due_date < resetDate` and silently drops out of every cycle total.

Fix: judge cycle membership by the date the item was *due in this cycle*, not the rolled-forward one.

```text
cycleDate(item) = item.paid ? (item.prev_due_date ?? item.next_due_date) : item.next_due_date
```

Apply that helper to `commitmentsDueThisCycle`, `subsDueThisCycle` (and therefore `totalOutgoings`). `leftToPay` and the waterfall `fundedMap` keep using `next_due_date` plus `!paid`, so they are unchanged.

Result: the three cycle cards show the full 28-day budget footprint, and a new line under "Total outgoings" reads "paid £X · remaining £Y" so the split is still visible.

## 2. Layout order

Move "Every cycle (all tracked)" out of the active-cycle run so the row reads as one sentence:

```text
Commitments  +  Subscriptions  =  Total outgoings  ->  Left to pay
                    Every cycle (all tracked)  [below, separated]
```

The four active-cycle cards become a `sm:grid-cols-2 lg:grid-cols-4` grid. "Every cycle (all tracked)" moves underneath as its own full-width, quieter card (muted background, smaller figure) — it's a reference number, not part of the cycle equation.

## 3. Colour and hierarchy

Semantic tokens only, no raw colours:

- Commitments this cycle - `text-foreground` (calm baseline)
- Subscriptions this cycle - `text-foreground`
- Total outgoings this cycle - `text-primary`, card keeps `border-primary/30 bg-primary/5`
- Left to pay before reset - `text-destructive` when above zero, `text-primary` when fully covered (£0.00 = good news), card gains `border-destructive/40 bg-destructive/5` while money is outstanding; text bumped to `text-3xl` so it's the loudest figure on the row
- "paid" portion in the sublines - `text-muted-foreground`
- Every cycle (all tracked) - `text-muted-foreground`, `text-xl`

## Technical notes

- `src/routes/commitments.tsx`: add a `cycleDate()` helper, use it in the two `useMemo` totals, add paid/remaining split for the total card, regroup the grid, apply the colour classes.
- No changes to funding logic, `src/lib/outgoings.ts`, or the database.
- Add a v2.13.2 entry to `src/lib/changelog.ts`.
