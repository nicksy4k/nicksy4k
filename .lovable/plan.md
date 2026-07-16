Plan: Persist cycle settings + Transaction search

Scope for this session

1. Persist budget cycle settings to the backend
2. Transaction search on the History page

Everything else (currency setting, password reset, loans/debts FK cascade fix) moves to the later roadmap.

---

### 1. Persist budget cycle settings

Today `src/lib/cycle.ts` stores `type`, `anchor`, and `override` in `localStorage` under `ledgerly.cycle.v2`. That means every device/browser has its own cycle config, and the dashboard, commitments, rollover, and archive routes all show different windows depending on where you log in.

Backend
- New `user_settings` table with one row per user:
  - `user_id uuid PK REFERENCES auth.users(id) ON DELETE CASCADE`
  - `cycle_type text NOT NULL DEFAULT 'monthly'` (`'monthly'` | `'four-weekly'`)
  - `cycle_anchor date NOT NULL DEFAULT current_date`
  - `cycle_override_start date`
  - `cycle_override_end date`
  - `updated_at timestamptz` + trigger
- GRANT + RLS scoped to `auth.uid() = user_id` (select/insert/update).

Client
- Update `src/lib/cycle.ts`:
  - Replace `loadCycleSettings` / `saveCycleSettings` with a React Query-backed store:
    - `useCycleSettings()` fetches from `user_settings` on mount, upserts on `update()`.
    - Keep localStorage as a **read-only fallback** for the first paint before the query resolves, then migrate once (upsert local → DB, clear local key) the first time we successfully load a signed-in session.
  - Preserve the same public API (`settings`, `update`, `useActiveCycle`, `getActiveCycle`, etc.) so no consumer needs changing.
- `CycleSettingsCard` needs no visible changes; it just now writes to the backend.

Sync + UX
- `router.invalidate()` + `queryClient.invalidateQueries({ queryKey: ['user_settings'] })` on sign-in/out so switching accounts loads the right cycle.
- On the first successful cloud load, dispatch the existing `ledgerly:cycle-changed` event so dashboard/commitments recompute immediately.

---

### 2. Transaction search on History page

`src/routes/history.tsx` currently lists transactions grouped by day with no filtering — hard to find a specific purchase once you have a few hundred.

Additions to `src/routes/history.tsx`
- Sticky filter bar above the list containing:
  - Search input (debounced ~200 ms) — matches `retailer`, any `items[].name`, and `notes` (case-insensitive `includes`).
  - Category `Select` — populated from the user's expense categories, plus "All categories".
  - Date range: two `<Input type="date">` fields (from / to), defaulting to empty.
  - "Clear" button when any filter is active.
- Filtering happens client-side over the already-loaded transactions (same source as today) so we don't add extra network round-trips.
- Empty state when filters return nothing: "No transactions match — try clearing filters."
- Result count badge next to the header (e.g. "42 of 318").
- Preserve current inline edit / settle / delete actions untouched.

No schema or store changes required for this piece — it's UI + a `useMemo` filter over `useTransactions()`.

---

### Order of implementation

1. Migration for `user_settings` (surfaces for approval first).
2. Refactor `src/lib/cycle.ts` to read/write the new table with localStorage fallback + one-shot migration.
3. Add the filter bar and memoized filter logic to `src/routes/history.tsx`.
4. Verify: run existing vitest suite + typecheck, spot-check dashboard/commitments still resolve the correct cycle after sign-in.