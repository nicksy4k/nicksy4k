## Cycle Carryover

Automatically move the previous cycle's "Left to Spend" into the new cycle as an income row when a new cycle begins.

### Behaviour
- On first app load in a new cycle, detect that the last processed cycle key differs from the current one.
- Compute the previous cycle's leftover: `totalIncome − totalExpenses − savingsBalanceDelta` scoped to the previous cycle window (same math already used for "Left to Spend").
- If carryover is enabled and leftover ≠ 0, create a single income row:
  - `date` = first day of the new cycle
  - `source` = "Carryover from previous cycle"
  - `amount` = leftover (positive or negative)
  - `note` includes previous cycle label (e.g. `carryover:2026-07`) so it's idempotent and identifiable
- Record the processed cycle key in `user_settings` so it never runs twice.
- Negative carryovers appear as a negative income row, correctly reducing the new cycle's Left to Spend.

### Settings toggle
- Add `carryover_enabled` (default `true`) and `last_carryover_cycle_key` (text) to `user_settings`.
- Add a switch in `CycleSettingsCard`: "Carry unspent balance into next cycle" with helper text explaining positive and negative carry.
- When disabled, no new carryover rows are generated (existing ones remain untouched).

### Files
- `supabase/migrations/*` — add two columns to `user_settings`.
- `src/lib/cycle.ts` — extend settings read/write with the two new fields; helper `previousCycleWindow(now)`.
- `src/lib/carryover.ts` (new) — `runCarryoverIfNeeded({ incomes, transactions, savings, settings, upsertSetting, addIncome })`. Idempotent by cycle key + note tag.
- `src/components/AppLayout.tsx` — call the hook once per session after data loads, alongside existing rollover hook.
- `src/components/CycleSettingsCard.tsx` — new toggle.
- `src/routes/income.tsx` — render carryover income rows with a distinct label/badge (still editable/deletable if user wants to override).

### Technical notes
- Reuse existing income store methods; no schema change to `incomes`.
- Uses local computation of leftover based on already-loaded data — no extra queries.
- Idempotency: check `last_carryover_cycle_key` AND scan incomes for the tagged note before inserting, so cross-device runs don't double-post.
- If leftover is exactly 0, skip insert but still advance the key.

### Out of scope
- Retroactive carryover for past cycles before this feature ships (only forward from install).
- Per-pocket carryover (pockets already persist naturally).
