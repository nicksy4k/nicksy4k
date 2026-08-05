# Demo Seed: Bulletproof Date Math + Clean Cache on Demo Login

Goal: when a visitor clicks "View Demo Account", the dashboard KPIs light up immediately with the seeded spending, income and commitments.

## Why it currently reads £0

The seed writes a manual cycle-override window (roughly 3 weeks back to 9 days ahead) and dates rows relative to today. The dashboard, however, derives its active window from the user's cycle settings, and the browser keeps a local cached copy of those settings (`ledgerly.cycle.v2` in localStorage) that survives the demo sign-in reload. So the freshly seeded window and the window the dashboard actually uses can disagree, and rows land outside it.

## Fix

### 1. Seed inside the naturally derived cycle (no override)

- Stop writing `cycle_override_start` / `cycle_override_end` for the demo account — clear them to null.
- Keep the monthly cycle anchored to the 1st of the current month. That makes the derived active window exactly "1st of this month → end of this month", which always contains today.
- Generate every seeded date dynamically, clamped so it can never fall before the 1st of the current month:
  - Transactions: today, today − 1, today − 2, today − 3, today − 5 (clamped).
  - Income: salary dated at the later of the 1st of the month and today − 14.
  - Pocket opening deposits: 1st of the current month.
- Because both the window and the rows are computed from the same "today", the data is always inside the active cycle regardless of what day of the month the demo is opened.

### 2. Commitments due inside the current week

- Paid commitment: last paid = today − 2, previous due = today − 2, next due = today + 28 (rolled forward as normal).
- Unpaid commitment: due today + 2.
- Both clamped to stay inside the current month so they show in the cycle's commitment list and in the waterfall funding.

### 3. Clear all client cache on demo login

In the demo sign-in path on the auth screen, after the session is set and before the redirect:

- Remove the cached cycle settings key from localStorage so the dashboard cannot start from a previous visitor's or previous account's window.
- Clear the React Query cache.
- Then do the hard navigation to `/` as it does today, so every hook refetches from the server.

## Technical notes

- `src/lib/api/demo-seed.server.ts`: replace `iso(-n)` free-form offsets with a `startOfMonth`-clamped helper; set `cycle_override_start`/`cycle_override_end` to `null`; keep `cycle_anchor` at the 1st.
- `src/routes/auth.tsx`: in `startDemo`, after `supabase.auth.setSession`, `localStorage.removeItem("ledgerly.cycle.v2")` and `queryClient.clear()` before `window.location.assign("/")`.
- No schema changes, no changes to real users' data.
- Prepend a changelog entry to `src/lib/changelog.ts` for the demo seed fix.
