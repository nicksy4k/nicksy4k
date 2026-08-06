# Subscriptions tracker

Subscriptions become a first-class type of commitment, so everything still comes out of the same Bill Money pocket and one "total outgoings per cycle" figure. No second, parallel system.

## What you get

**A Subscriptions page** (`/subscriptions`) listing every subscription with its price, next renewal date, category, billing cadence (monthly or annual), and paid/unpaid state — same look and behaviour as Commitments. Commitments keeps working exactly as it does, with subscriptions filtered out of its main list so nothing is double-counted visually.

**Shared money math.** Subscriptions are stored as commitments, so the Bill Money pocket balance, "left to pay this cycle", dashboard totals, and cycle rollover already include them with no extra maths. A small "Subscriptions" sub-total is shown on both pages so you can see the split.

**Monthly and annual renewals.** Each row carries its own cadence. Annual subscriptions only appear as due in the cycle they actually renew in; they no longer get rolled forward month by month.

**Offer / promo pricing.** Each subscription can record:
- Current (discounted) price and the date the offer ends
- The standard price it reverts to

While the offer is live, the row shows the discounted price plus a badge like "Offer ends 14 Sep — then £17.99".

**Promo-ending reminders.** A few days before an offer ends (configurable, default 3), a card appears at the top of the Subscriptions page — and a matching alert on the dashboard next to the existing warranty/return alerts. Each alert has three actions:
- **Log a new offer** — enter a new discounted price and end date; the row keeps the promo state
- **Snooze** — hides it until your next sign-in
- **Let it renew at full price** — dismisses the alert; on the offer end date the price automatically becomes the standard price

If you never act, the price switches to the standard price on the end date so your outgoings total stays honest.

## Technical notes

Database migration on `public.commitments` (no new table, so all existing pocket/cycle/BNPL logic applies unchanged):

- `is_subscription boolean not null default false`
- `cadence text not null default 'monthly'` — `'monthly' | 'annual'`
- `promo_price numeric`, `promo_ends_on date`, `standard_price numeric`
- `promo_alert_snoozed_until timestamptz`

Code changes:

- `src/lib/types.ts` — extend `Commitment` with the fields above.
- `src/lib/cycle.ts` — `advanceDueDate` gains a per-row cadence argument; annual rows advance by 12 months.
- `src/lib/commitmentRollover.ts` — pass each row's cadence into the roll-forward, and apply promo expiry in the same pass: when `promo_ends_on <= today` and `standard_price` is set, write `amount = standard_price` and clear the promo fields.
- `src/lib/subscriptions.ts` (new) — effective-price helper, days-until-promo-end, alert selection and snooze handling.
- `src/routes/subscriptions.tsx` (new) — list, add/edit dialog (name, provider, category, cadence, renewal date, price, optional offer price + end date + standard price), paid toggle reusing the existing commitments payment path, promo alert cards.
- `src/routes/commitments.tsx` — filter `is_subscription = false` from the list, add a "Subscriptions" sub-total line and a link across.
- `src/routes/index.tsx` — promo-ending alerts alongside the existing protection alerts.
- `src/components/app-sidebar.tsx` — nav entry.
- `src/lib/changelog.ts` — new dated entry.
