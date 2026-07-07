
## Goal

Add recurring income templates that automatically generate income entries on their next date based on a chosen cadence — same "single source of truth" pattern as `commitmentRollover`, but scoped to income.

## Data model

New table `public.recurring_incomes` (owner-scoped RLS, same pattern as `incomes`):

- `source` text
- `amount` numeric
- `category` text (defaults to "Other")
- `notes` text nullable
- `cadence` text — one of `weekly` | `fortnightly` | `four-weekly` | `monthly`
- `next_date` date — when the next entry should post
- `last_generated_date` date nullable — last time it auto-created an income row
- `active` boolean default true — pause without deleting
- standard `id / user_id / created_at / updated_at` + update trigger
- GRANTs to `authenticated` and `service_role`; RLS policies scoped to `auth.uid()`

No changes to the existing `incomes` table. Generated entries are just normal rows in `incomes` (no back-reference needed for v1 — keeps history/edits/deletes trivial).

## Generation engine

New hook `useRecurringIncomeGenerator()` in `src/lib/recurringIncome.ts`, mounted once at the app root next to `useCommitmentRollover()`:

1. On mount and whenever the local date changes, fetch all active `recurring_incomes` for the user.
2. For each row where `next_date <= today`:
   - Insert an `incomes` row (`date = next_date`, source/amount/category/notes copied from template).
   - Advance `next_date` by one cadence step until it lands strictly after today (catches multiple missed cycles, guarded like `rollDueDateForward`).
   - Update `last_generated_date = today`.
3. Guarded by a `running` ref + a `localStorage` daily marker (`ledgerly.recurringIncome.lastRunISO`) so it runs at most once per calendar day per device.
4. On completion invalidates the `incomes` and `recurring_incomes` query keys.

Cadence math lives alongside the existing cycle helpers: extend `advanceDueDate` OR add a small `advanceByCadence(dueISO, cadence)` helper in `src/lib/cycle.ts` covering weekly (+7d), fortnightly (+14d), four-weekly (+28d), monthly (+1 month). Reuse it in the generator.

## UI on Income page (`src/routes/income.tsx`)

Add a new "Recurring income" card between the "Add income" card and the cycle summary:

- List each template: source, amount, category badge, cadence label, "Next: {date}", paused badge if inactive.
- Row actions: Edit, Pause/Resume, Delete, and "Post now" (generates immediately and advances `next_date`).
- "Add recurring" button opens a dialog with: source, amount, category (reuse `useIncomeCategories`), cadence select, first-post date (defaults to today), notes, active toggle.
- Edit uses the same dialog prefilled.
- Empty state: short helper text explaining what recurring income does.

No changes to the existing "Add income" form or history list — they continue to work on `incomes` rows regardless of source.

## Store additions (`src/lib/store.ts`)

New `useRecurringIncomes()` hook mirroring `useCommitments()`: `items`, `add`, `update`, `remove`. Fetched via TanStack Query on key `["recurring_incomes"]`.

## Files

- New: `supabase` migration for `recurring_incomes` table + RLS + grants + updated_at trigger
- New: `src/lib/recurringIncome.ts` (generator hook)
- Edited: `src/lib/types.ts` (add `RecurringIncome` type + `IncomeCadence`)
- Edited: `src/lib/cycle.ts` (add `advanceByCadence`)
- Edited: `src/lib/store.ts` (add `useRecurringIncomes`)
- Edited: `src/routes/__root.tsx` (mount `useRecurringIncomeGenerator`)
- Edited: `src/routes/income.tsx` (new Recurring income card + dialog)

No new dependencies. No changes to the existing `incomes` schema.

## Out of scope for v1

- Per-template split routing to pockets (can be added later as a JSON `splits` column on `recurring_incomes`).
- End date / occurrence count.
- Server-side cron generation — client-on-open is sufficient for a personal app; can be promoted to `pg_cron` + a public hook route later without schema changes.
