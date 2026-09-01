## Technical details

**Data (staged migration, applies when the draft is accepted)** — new `public.loan_shares`: `id uuid pk`, `token text unique` (24+ random chars), `loan_id uuid references public.loans(id) on delete cascade`, `user_id uuid not null`, `note text`, `expires_at timestamptz null`, `revoked_at timestamptz null`, `view_count int not null default 0`, `last_viewed_at timestamptz`, `created_at timestamptz not null default now()`. GRANTs: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`, `ALL` to `service_role`, **no anon grant**. RLS on, owner-scoped policies via `auth.uid() = user_id`. Regenerate types.

**Server functions** in `src/lib/api/loanShare.functions.ts`:
- `createLoanShare` / `listLoanShares` / `revokeLoanShare` — `.middleware([requireSupabaseAuth])`, RLS-scoped, token generated with `crypto.getRandomValues` inside the handler.
- `getSharedStatement` — public, unauthenticated, input `{ token }`. Loads `supabaseAdmin` inside the handler (anon has no grant on `loans`), validates token exists, not revoked, not expired, then returns a **narrow projection only**: person_name, total, payments, plan fields, start_date, notes, lender display name from `profiles`. Never the loan `user_id` or anything else. Increments `view_count`. Unknown/revoked/expired → a `{ status: "unavailable" }` result, not a 500.

**Public route** `src/routes/s.$token.tsx` — SSR on, no auth gate, loader calls the public server fn, `errorComponent` + `notFoundComponent` defined. Renders a shared presentational component extracted from the existing statement markup so the PDF and the web page stay in sync; `src/lib/loanStatement.ts` keeps `buildLoanStatementHtml` for printing and gains a shared row/summary builder the route reuses. `head()` gets its own title/description; no og:image. `noindex` meta so links don't get crawled.

**UI** — `StatementDialog` in `src/components/credit/OwedToMeTab.tsx` gains a Share section: create button, link display with Copy, `navigator.share` when available (guarded, client-only), expiry select, and Revoke on an existing link. Existing Print and Copy-text actions unchanged.

**Tests** — token validity/expiry/revocation logic extracted into a pure helper in `src/lib/loanShare.ts` with Vitest coverage.

Changelog entry and version bump on ship.
