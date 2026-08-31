# Cycle safety audit and account integrity check

## Goal
Confirm that the budgeting/cycle-related incident did not leave other financial records in an inconsistent state, and audit every automatic writer for the same stale-settings risk.

## Current evidence
- The main account is configured for a four-weekly cycle and has authoritative settings saved in the database.
- Its current commitment rows show August `prev_due_date` values, September `next_due_date` values, and unpaid status, matching the restored cycle transition.
- The account has a single visible carryover income for the restored cycle in the rows reviewed so far.

## Work
1. **Audit automatic writers**
   - Trace all code paths that create or update financial records automatically: commitment rollover, cycle carryover, recurring income generation, BNPL/debt synchronisation, and outgoing-paid synchronisation.
   - Confirm each path waits for authoritative account/user settings and cannot use a stale local cache to perform writes.
   - Check for duplicate-run protection, idempotency, account scoping, and cache invalidation after writes.
   - Add focused regression tests for any unsafe path found, without changing unrelated features.

2. **Verify the main account data**
   - Compare the saved cycle window against commitment due dates, paid flags, and linked transaction dates.
   - Check for duplicate carryover rows, duplicate automatically generated income, duplicate linked debt/commitment payments, and suspicious records created around the incident window.
   - Verify that the Rent Arrears repayment and other linked outgoing/debt records are represented once and reconcile with the ledger.
   - Review balances and cycle totals for unexplained duplicate inflows or outflows.

3. **Remediate only confirmed issues**
   - If the code audit finds another unsafe writer, make the smallest targeted code fix and add a regression test.
   - If the data check finds remaining duplicate or incorrect rows, prepare a narrowly scoped database migration for approval rather than editing data directly.
   - Record any user-visible changes in the changelog.

4. **Validate**
   - Run the relevant automated tests and the full suite if the audit changes shared cycle/ledger code.
   - Re-query the affected account after any approved repair and confirm no duplicate or inconsistent rows remain.
   - Check the live preview for cycle dates, commitments, balances, and linked debt/outgoing state.

## Technical boundaries
- Read-only database inspection first; no data changes without a reviewed migration.
- Preserve the existing four-weekly cycle behavior and do not alter unrelated budgeting/UI work.
- Treat localStorage as a display fallback only; financial writes must use authoritative settings loaded for the signed-in account.
