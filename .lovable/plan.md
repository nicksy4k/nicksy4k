
# Recurring income → pocket auto-allocation + commitments auto-cover

## What we're building

1. Each recurring income template can define a list of **pocket allocations** (e.g. £300 → Food, £200 → Bill Money). When the template posts an income, those amounts are automatically deposited into the named pockets. Any remainder stays in main balance.
2. On the Bill Money pocket allocation (or any allocation), an **"auto-cover commitments"** toggle can replace the fixed amount with a dynamic sum: total of commitments due between now and the next posting date of that template, minus the pocket's current balance. Whatever's left of the income after prior allocations goes to main.
3. If the income is smaller than the total configured allocations, allocations are funded in listed order and stop when the income is depleted (later ones get partial/zero). A toast warns when this happens.

## How it works

### Data model
- Add nullable `allocations` JSONB column to `recurring_incomes` (migration).
- Shape: `Array<{ id: string; pocket: string; kind: "fixed" | "cover_commitments"; amount: number; order: number }>`.
  - `fixed`: use `amount` as-is.
  - `cover_commitments`: `amount` ignored; resolved at post time.

### Generator (`src/lib/recurringIncome.ts`)
When a template posts on date `D`:
1. Insert income row (unchanged).
2. Compute `nextDate` = `advanceByCadence(D, cadence)`.
3. Walk allocations in `order`:
   - `fixed`: `alloc = min(amount, remaining)`.
   - `cover_commitments`: fetch active commitments with `next_due_date` in `[D, nextDate)`, sum `amount`, subtract current pocket balance (from `savings` deltas for that account name), clamp to `[0, remaining]`.
   - Insert a `savings` row `{ kind: "deposit", account: pocket, amount: alloc, date: D, notes: "Auto from <source>" }` when `alloc > 0`.
   - Decrement `remaining`.
4. If any allocation was clipped, show a toast (via a small event queue drained on the next tick in the hook).

Backfill catch-up posts (existing loop that inserts multiple missed dates) reuse the same per-date allocation logic.

### UI (`src/routes/income.tsx`)
In the recurring income dialog, add an "Auto-allocate to pockets" section:
- List of rows: pocket name (combobox seeded from existing pocket names), amount input, "Cover commitments due before next payday" checkbox (disables amount, shows "auto" placeholder), drag/reorder handles or up/down arrows.
- "+ Add allocation" button.
- Live preview line under the total: `£579 income → £300 Food, £200 Bill Money (auto), £79 main`.
- Empty state (no allocations) → posts entirely to main balance (current behaviour).

Template row in the list gets a small badge chip showing configured pockets when allocations exist.

### Notes
- Uses existing `savings` table for pocket movements — no separate pocket table needed (matches how splits already work).
- `cover_commitments` reads `commitments` table for the user filtered by `next_due_date` window; independent of `paid` flag so a bill already paid this cycle doesn't get re-funded → we exclude `paid = true` commitments too.
- Manual "Post now" runs the same allocation path.
- Deleting a pocket allocation from a template does not touch past posts.

## Files

- **Migration**: add `allocations jsonb not null default '[]'` to `public.recurring_incomes`.
- **Edit `src/lib/types.ts`**: add `RecurringIncomeAllocation` type; extend `RecurringIncome`.
- **Edit `src/lib/recurringIncome.ts`**: per-post allocation loop, pocket balance lookup, commitments window query, warn-on-shortfall.
- **Edit `src/lib/store.ts`**: pass `allocations` through `useRecurringIncomes` add/update.
- **Edit `src/routes/income.tsx`**: allocations editor in dialog, preview line, badges in list.

## Out of scope

- Percentage-based allocations (only fixed £ + auto-cover for now).
- Editing past allocations retroactively.
- Per-commitment selection (auto-cover always uses all unpaid commitments in the window).
