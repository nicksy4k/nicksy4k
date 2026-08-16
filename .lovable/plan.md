# Ledgerly deep-dive: audit findings and proposed fixes

I ran the full test suite, the linter, a backend security scan, and a dependency scan, then read through the data layer, cycle maths, and routes. Here is what I found and what I suggest doing about it.

## Health check results

- Tests: 39/39 passing across 5 files (ledger sync, splits, formatting, suggestion matching, recurring income).
- Dependencies: no high or critical vulnerabilities.
- Backend security scan: 3 warnings, no critical issues. Two are already documented as intentional (public announcement banner, debt item ownership). The third flags that signed-in users can run a database helper function — I checked, and the only such function is the role checker `has_role`, which is read-only and required for admin permission checks to work at all. That one is safe.
- Linter: **894 errors** — the whole codebase has drifted out of formatting. This is the only failing check.

## Issues worth fixing

1. **Formatting baseline is broken.** 891 of the 894 errors are auto-fixable formatting. Right now the linter is useless as a signal because it always fails.
2. **`/subscriptions` has no page metadata.** Every other page defines its own title and description; this redirect route does not.
3. **Annual subscriptions are divided by 12 even on a 4-weekly cycle.** In `perCycleTotal`, an annual plan is always spread across 12 cycles. On a 4-weekly cycle there are 13 cycles a year, so annual costs are overstated by roughly 8% and monthly bills are overstated too (13 charges counted per year instead of 12). The "Every cycle (all tracked)" figure on Outgoings and the dashboard is therefore slightly wrong for 4-weekly users.
4. **Every list loads its entire table.** Transactions, incomes, savings, and history all fetch every row with no limit or pagination. With 173 transactions today it is fine; it degrades steadily as the ledger grows, and History renders all of them at once.
5. **Thin test coverage on the riskiest maths.** Cycle window calculation, carryover, commitment rollover, per-cycle outgoing totals, and subscription promo pricing have no tests, yet they are where past bugs came from.
6. **Three route files are very large** — `history.tsx` (1,827 lines), `credit.tsx` (1,804), `new.tsx` (1,259). They mix data fetching, dialogs, and layout in one file, which makes each change riskier than it needs to be.

## Proposed work, in order

**Pass 1 — clean baseline (low risk)**
- Run the formatter, confirm the linter is clean, re-run tests.
- Add a proper `head()` to the subscriptions route.

**Pass 2 — correctness (small, targeted)**
- Make `perCycleTotal` cycle-aware: pass the user's cycle type in and use 13 cycles a year for 4-weekly (annual ÷ 13, and monthly bills scaled to the cycle length) instead of assuming 12.
- Add tests covering: cycle window boundaries, per-cycle totals for both cycle types, annual amortisation, and promo-vs-standard subscription pricing.

**Pass 3 — scale and maintainability (larger, optional)**
- Paginate History (page size around 50, with "load more") and bound the transaction query used for suggestions to a recent window.
- Split `history.tsx` and `credit.tsx` into a route shell plus focused components, the way the Outgoings page was already refactored.

**Housekeeping**
- Dismiss the database-function warning as reviewed and safe, and record why in the security notes.
- Add a changelog entry for whatever ships.

## Technical notes

- `perCycleTotal` in `src/lib/outgoings.ts` currently takes only `Commitment[]`; it would gain a cycle-type argument, with call sites in `src/routes/commitments.tsx` and `src/routes/index.tsx` reading the type from the existing cycle settings hook.
- Pagination would use TanStack Query's infinite query against the existing `transactions` query in `src/lib/store.ts`, keeping the current ordering.
- No database schema changes are needed for any of this.

Tell me which passes you want. Pass 1 and 2 are the ones I would do straight away; pass 3 is a bigger refactor best done on its own.
