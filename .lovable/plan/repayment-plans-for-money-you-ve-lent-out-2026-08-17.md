# Repayment plans for money you've lent out

Turn each loan on the "Owed to me" tab from a running total into a proper repayment plan: how much is due, when, how often, and how long until it's cleared.

## What you'll get

**Set up a plan on any loan** — new or existing. On the loan form (and via an "Add payment plan" button on loans that don't have one yet) you set:

- Instalment amount (or instead: "clear it in N payments" and the amount is worked out for you)
- How often: weekly, fortnightly, 4-weekly, monthly
- First payment date

**A clear picture on the loan card:**

- Next payment due: amount and date, with a "due in 3 days" / "5 days overdue" badge
- Payments made vs payments remaining (e.g. "4 of 12 paid")
- Projected clear date — "on track to be repaid by 14 Mar 2027" — recalculated whenever a payment lands
- Progress bar as today, plus an amber/red state when a scheduled payment is overdue

**Schedule view** — expand a loan to see every scheduled instalment: due date, amount, and whether it's paid, due, or upcoming. Paid rows link to the actual payment recorded.

**Recording payments:**

- "Record payment" pre-fills the next scheduled instalment amount and date, so the normal case is two taps
- **Pay early** — record the next instalment before its due date; the schedule pulls forward and the clear date improves
- **Extra / part payment** — pay any other amount. Extra money reduces the balance and shortens the plan (fewer instalments), rather than shrinking each payment. A short summary tells you the effect: "That knocks 2 payments off — cleared 2 months sooner."
- A short payment leaves the shortfall due, and the remainder rolls onto the next instalment

**Adjust the plan** — change amount, frequency or next due date at any time (they renegotiated, or you want it cleared faster). The schedule and clear date recalculate from what's already been paid; nothing already recorded is touched.

**Existing loans keep working.** A loan with no plan behaves exactly as it does today; the card just offers "Add payment plan". Adding one uses the balance still outstanding, so history stays intact.

## Not in this change

Debts / BNPL already have instalment dates and a linked outgoing, so they're left alone here. Reminders and notifications for due payments are a separate piece of work — for now the due/overdue badges live on the loan card and the dashboard "Owed to me" area.

## Technical details

- Migration on `public.loans`: nullable `plan_amount numeric`, `plan_cadence text` (`weekly` | `fortnightly` | `four_weekly` | `monthly`), `plan_start_date date`, `plan_next_due date`. Nullable means every existing row is simply "no plan". Existing RLS/grants unchanged; regenerate types.
- New `src/lib/loanPlan.ts`, pure and unit-tested: builds the instalment schedule from plan fields plus `payments` (skipping `topup` entries, as `loanPaid` already does), returns `{ schedule, nextDue, remainingCount, projectedClearDate, overdueBy }`, and provides `applyExtraPayment` maths for the "knocks N payments off" summary. Cadence stepping reuses `date-fns` the way `src/lib/cycle.ts` and `recurringIncome.ts` do.
- `src/components/credit/OwedToMeTab.tsx`: plan fields in the loan dialog, plan summary + due badge on the card, an accordion schedule (Accordion is already imported there), and prefilled amounts routed through the existing `PaymentDialog` / `FundingSourceDialog` flow — no change to how money is recorded via `useLedgerSync`.
- Plan advancement is derived from `payments`, not stored per-instalment, so undoing or deleting a payment automatically rewinds the schedule. `plan_next_due` is only a stored override for manual adjustments.
- Tests in `src/lib/__tests__/loanPlan.test.ts`; changelog entry and version bump on ship.
