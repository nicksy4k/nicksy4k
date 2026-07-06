# Quick correctness pass

Fix the two real bugs (G1, G14) and tighten the two items that were already partly built (G2, G13).

## G1 — Unify Income cycle with global cycle

Replace the Income page's private 28-day localStorage cycle with the global cycle engine so Monthly / 4-weekly settings apply everywhere.

- Delete `CYCLE_KEY`, `loadCycle`, `saveCycle`, `currentCycle` and the local `CycleSettings` type from `src/routes/income.tsx`.
- Use `useActiveCycle()` + `isInCycle()` from `@/lib/cycle` (same pattern as Dashboard) to derive current-cycle income totals, and `getCycleAt()` for historical lookups.
- Remove the page-local "override cycle end" control; if that override was genuinely useful for income, it now lives once in Settings (the global `override` field is already there).
- Keep all existing UI: totals card, allocation panel, entry list — just re-source the window.

## G14 — Don't wipe `paid` on commitments not due yet

`commitmentRollover.ts:80-83` resets `paid=false` for every commitment on every cycle change. Wrong for bills whose `next_due_date` lands beyond the new cycle (quarterly bills, bills paid early for a future cycle, BNPL installments on a different cadence than the global cycle).

- In `rolloverAllCommitments()`, only reset `paid`/`last_paid_date` for a commitment when its `next_due_date` actually rolled forward this run (i.e. `patch.next_due_date` was set) OR when its existing `next_due_date` sits inside the newly-active cycle window.
- Concretely: compute `dueInsideNewCycle = c.next_due_date >= cycle.startISO && c.next_due_date <= cycle.endISO` (after any patch). Reset `paid` only when `patch.next_due_date` is set OR `dueInsideNewCycle`.

## G2 — Settle flow polish (small)

The button and modal exist; polish so it feels like a distinct action rather than a relabeled edit form.

- In the settle dialog (`history.tsx:481+`), when `transaction.is_pending && isPending` (i.e. still-pending edit) keep current behavior; when the user is settling (was pending, now unchecking):
  - Auto-focus the first item name input on open when `transaction.is_pending`.
  - Under the total field show a subtle helper: "Estimated hold was {£X}. Enter the final receipt amount." using the original pending total.
  - Change the primary CTA copy already handles this; also add a small amber banner at the top of the dialog while `isPending` is still true reading "This transaction is a pending hold — uncheck 'Still pending' when settling."

## G13 — Verify mobile sign-out, remove dead hidden button

Sign-out is reachable on mobile via the avatar row. The extra hidden ghost button at `AppLayout.tsx:78-85` is dead code that just adds noise — remove it. No behavior change.

## Files

- Edited: `src/routes/income.tsx`, `src/lib/commitmentRollover.ts`, `src/routes/history.tsx`, `src/components/AppLayout.tsx`
- No schema changes, no new dependencies.
