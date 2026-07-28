
## Why Claude can't see your main balance

Claude only has the 7 MCP tools we shipped: transactions, commitments, savings, categories, plus three write tools. There's no tool that exposes **income** or the **cycle window** the app uses to compute "Left to Spend" on the dashboard.

In the app itself, main balance for a cycle is:

```text
leftToSpend = income(in cycle) − mainExpensePortion(transactions in cycle) − netSavings(in cycle)
```

Without income rows or the cycle boundaries, Claude has no way to reach that number — which is exactly what it told you.

## Plan: add 3 read-only MCP tools

Add these tools under `src/lib/mcp/tools/` and register them in `src/lib/mcp/index.ts`. All read-only, all scoped by RLS to the signed-in user, matching the existing tool pattern.

1. **`list_incomes`** — reads `incomes` table.
   - Optional inputs: `since`, `until` (YYYY-MM-DD), `limit` (default 25, max 200).
   - Returns id, date, source, amount, category, notes.

2. **`get_active_cycle`** — reads `user_settings` and computes the current cycle window using the same logic as the app (`src/lib/cycle.ts`), including manual override.
   - No inputs.
   - Returns `{ type, startISO, endISO, anchor, carryoverEnabled }`.

3. **`get_main_balance`** — the direct answer to "what's left in my main balance".
   - Optional inputs: `startISO`, `endISO` (default = active cycle from tool #2).
   - Server-side computes, using the same formulas as `src/routes/index.tsx`:
     - `totalIncome` = sum of `incomes.amount` in window
     - `totalExpenses` = sum of `mainExpensePortion(transaction)` for transactions in window (subtracts BNPL splits, ignores pocket splits — reuses the existing `mainExpensePortion` helper from `src/lib/format.ts`)
     - `netSavings` = deposits − withdrawals in window
     - `leftToSpend = totalIncome − totalExpenses − netSavings`
   - Returns all four numbers plus the cycle window used, so Claude can explain the breakdown, not just the total.

## Technical notes

- Extract the cycle-window math from `src/lib/cycle.ts` into a pure helper (or import the existing pure functions) so the MCP handler can compute the window server-side without React hooks.
- Reuse `mainExpensePortion` from `src/lib/format.ts` (already covered by `src/lib/__tests__/format.test.ts`) so main-balance math stays identical to the dashboard.
- After edits, run `app_mcp_server--extract_mcp_manifest` to regenerate `.lovable/mcp/manifest.json`; bump version in `defineMcp` to `0.3.0`.
- Prepend a `v2.6.2` entry to `src/lib/changelog.ts` covering the new MCP tools.

No schema changes, no new dependencies, no changes to app UI.
