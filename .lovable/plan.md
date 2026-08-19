# Attribute a recorded payment to a scheduled instalment

## What's happening with Michelle's loan

Her plan starts 19 Aug (£50/month) and you logged her £50 payment on **18 Aug** — one day before the plan's first due date.

The schedule currently ignores every repayment dated *before* the plan start date, on the assumption that older payments are already baked into the opening balance. That rule was added to fix the earlier "next payment is £21" bug, but it also swallows a payment made a day early, so instalment 1 still shows as due today.

## The fix

**1. Let a payment be attributed to an instalment (main fix).**
In the "Payment schedule" list, each unpaid instalment gets a "Mark paid" action offering:

- **Link an existing payment** — pick from repayments already recorded on the loan that aren't yet attributed (Michelle's £50 on 18 Aug would appear here). Nothing new is recorded; no double counting.
- **Record a payment now** — the existing Record-payment flow, prefilled with the instalment amount and date.

Attribution is stored on the payment entry itself, so undoing or deleting the payment rewinds the schedule as it does today.

**2. Count early payments automatically.**
A repayment dated before the plan start but *on or after the plan was set up* should count against instalment 1 instead of being treated as history. New loans get this for free; for existing plans the manual link above covers the gap.

**3. Michelle's loan specifically.** Once shipped, open her schedule and link the 18 Aug £50 to instalment 1 — it flips to paid, and the next due date moves to 19 Sep.

## Technical details

- `LedgerPayment` gains an optional `instalment_due_date?: string` (payments live in `loans.payments` jsonb — no migration needed for this part).
- `buildLoanPlan` in `src/lib/loanPlan.ts`: before the date-window filter, apply explicitly attributed payments to their instalment; the remaining pool keeps today's behaviour.
- Migration adds nullable `plan_created_at timestamptz` on `public.loans`; payments dated on/after `plan_created_at::date` count against the schedule even if earlier than `plan_start_date`. Backfill left null for existing rows (behaviour unchanged for them). Grants/RLS untouched; regenerate types.
- `src/components/credit/OwedToMeTab.tsx`: per-instalment "Mark paid" menu in the accordion schedule, plus a small picker dialog listing unattributed `type: "payment"` entries.
- Extend `src/lib/__tests__/loanPlan.test.ts`: attributed payment marks the right instalment, early-but-post-setup payment counts, pre-plan history still excluded.
- Changelog entry (v3.1.6) per project rule.
