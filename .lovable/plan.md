## Problem

Your main account (`32a96aba-…`) has a duplicate auto-generated carryover income sitting inside the current cycle, which is why "Left to Spend" is wrong.

Rows in `public.incomes` (user-scoped):

| date | source | amount | notes |
|---|---|---|---|
| 2026-07-17 | Carryover from previous cycle | 223.21 | `Auto-generated carryover:2026-06-19 · from 2026-06-19 → 2026-07-16` |
| 2026-07-28 | Carryover from previous cycle | 207.87 | `Auto-generated carryover:2026-06-28 · from 2026-06-28 → 2026-07-27` |

Current cycle: 4-weekly, anchor `2026-07-17` → window **17 Jul → 13 Aug 2026**. Both carryovers land in that window, so the prior remainder is being counted twice (over-count ≈ **£207.87**).

The `2026-06-28` key doesn't align to any 4-weekly cycle from the current anchor, which means the cycle settings changed after the first carryover ran. `user_settings.last_carryover_cycle_key = 2026-06-19` was then out of sync with the newly-computed "previous cycle key", so `useCycleCarryover` re-ran and inserted a second carryover.

## Fix (two parts)

### 1. Data repair (one-off)

Delete only the extra carryover row for this user and reset the guard so the correct one remains authoritative:

- Delete the income row dated `2026-07-28`, source `Carryover from previous cycle`, notes starting `Auto-generated carryover:2026-06-28`.
- Leave the legitimate `2026-07-17` carryover in place.
- Set `user_settings.last_carryover_cycle_key = '2026-06-19'` (the key of the carryover that remains) so the hook won't re-fire.

Scoped strictly to `user_id = 32a96aba-d2c5-40d7-ae02-11479fa05cf1`.

### 2. Harden the carryover guard (`src/lib/carryover.ts` + `useCycleCarryover` hook)

Currently the guard relies solely on `last_carryover_cycle_key`. If cycle settings change, the computed previous-cycle key changes and the guard misses that a carryover for the same active window already exists.

Add a second, data-driven check before inserting: query `incomes` for any row in the **current active cycle window** whose `source = 'Carryover from previous cycle'` AND `notes LIKE 'Auto-generated carryover:%'`. If one already exists, skip the insert and just update `last_carryover_cycle_key` to match. This makes the guard idempotent regardless of anchor/cadence changes.

No UI changes; behaviour only.

## Out of scope

- Not touching the other account (`d2c1cb28-…`).
- Not changing cycle settings or any other income/transaction rows.
- Not modifying rollover, BNPL sync, or reports logic.

## Verification

After the repair, re-query `incomes` for the current cycle window and confirm exactly one carryover row remains; the dashboard "Left to Spend" should drop by £207.87 to the correct value.