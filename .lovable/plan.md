## Add MCP write tools for assistants

`create_transaction` already exists in `src/lib/mcp/tools/create-transaction.ts`, so this adds the two missing capabilities and tightens the existing one. All tools reuse `supabaseForUser` / `requireAuth` so they run under the signed-in user's RLS.

### 1. `add_items_to_transaction` (new)
File: `src/lib/mcp/tools/add-items-to-transaction.ts`

- Input: `transaction_id` (uuid), `items` (array of `{ name, price, quantity?, category? }`), optional `mark_settled` boolean, optional `new_total_amount` override.
- Fetches the row (RLS scopes to the user), appends to the existing `items` JSONB array, and — unless `new_total_amount` is provided — recomputes `total_amount` as the sum of all item `price × (quantity ?? 1)`.
- When `mark_settled: true`, also sets `is_pending = false`. Otherwise leaves the pending flag as-is (matches the "settle" flow the app already uses).
- Returns the updated row as `structuredContent.transaction` plus a short text summary.
- Annotations: `readOnlyHint: false`, `idempotentHint: false`.

### 2. `mark_commitment_paid` (new)
File: `src/lib/mcp/tools/mark-commitment-paid.ts`

- Input: `commitment_id` (uuid), optional `paid_date` (YYYY-MM-DD, defaults to today UTC).
- Updates the commitment: `paid = true`, `last_paid_date = paid_date`. Does **not** advance `next_due_date` — the app's global `useCommitmentRollover` engine owns that on the next cycle, and manual advance stays a UI-only action (matches the existing "unmark paid" contract that relies on `prev_due_date`).
- Returns the updated commitment.
- Annotations: `readOnlyHint: false`, `idempotentHint: true` (setting paid to true twice is a no-op).

Note on BNPL sync: the app's `src/lib/bnplSync.ts` mirrors commitment→debt payments only from inside the React UI hook. Doing that from the MCP tool would duplicate business logic on the server. Keeping the tool to a plain commitment update is the safe first cut; we can add a follow-up tool later if assistants need to log the matching debt payment.

### 3. Small tightening of existing `create_transaction`
Same file: `src/lib/mcp/tools/create-transaction.ts`

- Add `payment_splits` input (optional, same shape the app stores) so assistants can record split payments, not just single-source charges.
- Keep everything else as-is.

### 4. Register the new tools
File: `src/lib/mcp/index.ts` — import the two new tool modules and add them to the `tools` array of `defineMcp`.

### 5. Refresh the manifest
Run `app_mcp_server--extract_mcp_manifest` once to regenerate `.lovable/mcp/manifest.json` so the Agent integrations panel and connected clients see the new tools.

### 6. Changelog
Prepend a `v2.6.1` entry to `src/lib/changelog.ts` noting the three new MCP write capabilities (per the standing changelog rule).

### Out of scope
- No schema changes — every field used already exists on `transactions` / `commitments`.
- No UI changes.
- No auto-sync between commitments and BNPL debts from MCP (called out above).
