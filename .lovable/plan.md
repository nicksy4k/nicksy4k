## How the status icons currently work

Each row shows exactly one of three indicators, based only on the row's own `paid` flag and the waterfall funding calc — the cycle window is NOT part of this decision:

- Green tick (`Check` in a filled circle) — `paid === true`. Set when you tap the "Paid" toggle, or when a payment auto-marks it.
- Yellow dot — `paid === false` AND the Bill Money pocket balance (allocated top-down by earliest due date) still covers this bill.
- Red dot — `paid === false` AND the pocket has run out by the time the waterfall reaches this bill (shortfall).

The waterfall sorts ALL unpaid commitments by `next_due_date` ascending and subtracts each amount from the Bill Money balance in order. Cycle end is only used for the "Left to pay before reset" KPI and the shortfall banner — not for the per-row icon.

## Why your July view looks mixed

Pulled the live rows. A snapshot of the unpaid ones with due dates INSIDE the current cycle (they should not be green yet):

```text
Service Charge      £60.00   due 17 Jul   unpaid
test sub            £24.67   due 19 Jul   unpaid
Paramount+           £4.99   due 19 Jul   unpaid
ClearPay Amazon     £17.00   due 20 Jul   unpaid
NowTV Sports        £27.99   due 20 Jul   unpaid
Audible              £5.99   due 21 Jul   unpaid
Max Fun Donation     £5.00   due 23 Jul   unpaid
Michelle Disney+     £5.99   due 25 Jul   unpaid
MY Disney+           £4.99   due 26 Jul   unpaid
```

These are genuinely still due this cycle, so the icon logic is correct to leave them as yellow/red dots. The rows already showing a green tick (Xbox Game Pass 26 Jul, NowTV Boost 3 Aug, Phone plan 3 Aug, BNPL installments, Netflix 10 Aug, etc.) all have `paid = true` on the record — that's why they render as ticks.

So: nothing is broken. The icon is a *payment state*, not a *cycle state*. A bill dated 26 Jul that you marked paid on 2 Jul stays green forever until the global rollover engine flips it back to unpaid at the next cycle boundary.

## What you're probably expecting

You're reading the tick as "already handled for this cycle" — i.e. anything with `next_due_date > cycle.end` should show green because it can't hit this cycle anymore. That's a reasonable mental model but isn't what the code does today.

## Proposal — add a cycle-aware "covered" state (opt-in, no data changes)

Only if you approve, I'll change `src/routes/commitments.tsx` so each row picks its indicator in this order:

1. `paid === true` → green tick (unchanged).
2. `next_due_date > cycle.end` (falls in a future cycle) → green tick with a subtler outline + tooltip "Covered — not due this cycle".
3. Unpaid, due this cycle, waterfall-funded → yellow dot (unchanged).
4. Unpaid, due this cycle, shortfall → red dot (unchanged).

Effects:
- The shortfall KPI, "Left to pay before reset", and the funding waterfall stay exactly as they are (they already filter by `< resetDate`).
- Rows like Xbox Game Pass 26 Jul, NowTV Boost 3 Aug, etc. would show green whether or not they were manually marked paid, matching your expectation.
- No DB migration, no changes to rollover, no changes to the paid toggle behaviour.

If you'd rather keep tick = "you paid it" and add a NEW icon (e.g. a small calendar-check) for the "future cycle" case, say the word and I'll wire that instead.

## Alternative if you actually want them cleared

If the intent is "these should all be marked paid because they've been handled", the fix isn't visual — it's a one-shot data update to flip `paid = true` for the listed July rows. Tell me which cadence you want (all rows in a chosen date range, or a specific list) and I'll prepare a migration.
