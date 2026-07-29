## Goal

Replace the current inline signup form on `/auth` with a richer multi-field beta signup that captures profile info, preferred currency, and requires legal/beta acceptance. Add placeholder Privacy Policy and Beta Disclaimer pages.

## What to build

### 1. `profiles` table (new migration)

New table `public.profiles` keyed by `auth.users.id`:
- `full_name`, `display_name`, `country`, `currency` (default `GBP`), `heard_about` (nullable), `accepted_privacy_at`, `accepted_beta_disclaimer_at`, plus standard timestamps.
- GRANTs + RLS: users can select/insert/update their own row; `service_role` full access. No anon access.
- `handle_new_user()` trigger on `auth.users` insert that inserts a row from `raw_user_meta_data` (full_name, display_name, country, currency, heard_about, accepted_privacy_at, accepted_beta_disclaimer_at) so Google OAuth signups also get a profile row (empty defaults are fine — they can complete later).

### 2. `/auth` signup redesign

- Split the auth card into two modes as today (Sign in / Sign up). Sign-in unchanged.
- Sign-up mode swaps to a longer form with these fields:
  - Full name *
  - Display name *
  - Email *
  - Password * (min 6, existing show/hide)
  - Country / region (Select — short curated list: UK, US, Canada, Australia, Ireland, Other)
  - Main currency (Select dropdown: GBP £, USD $, EUR €, CAD $, AUD $, other common — default GBP)
  - How did you hear about us? (Select: Friend, Social media, Beta tester group, Search, Other)
  - Required checkbox: "I've read and agree to the Privacy Policy" (links `/privacy`)
  - Required checkbox: "I understand Ledgerly is in beta — features may change, some flows may be incomplete, and I will not rely on it as an official financial record. As a beta tester, I'll use fake or non-critical data where possible." (links `/beta-disclaimer`)
- Submit calls `supabase.auth.signUp` with `options.data` containing all profile fields + acceptance timestamps, so the DB trigger populates `profiles`.
- Client-side validation with zod (name lengths, email, password ≥ 6, both checkboxes ticked).
- Keep the existing Google sign-in button, beta banner, hero, feature cards, feedback + privacy footer.
- Keep layout responsive; long form scrolls within the card on small screens.

### 3. Placeholder policy routes

- `src/routes/privacy.tsx` — Privacy Policy placeholder styled to match the app (Midnight Indigo tokens, Card layout), sections: What we collect, How it's stored (RLS + encryption, softened wording matching existing `PrivacyDetailsDialog`), Third-party services (Supabase/Lovable Cloud), Your rights (export via Settings, delete on request), Contact `admin@itemizedkeeper.co.uk`, Last updated date. Clear "placeholder — will be replaced before public launch" note.
- `src/routes/beta-disclaimer.tsx` — Beta terms placeholder: beta status, no reliance for financial/tax purposes, recommendation to use fake data, right to change/remove features, no warranty, contact.
- Both routes are public (top-level), SSR on, with proper `head()` meta and a back-to-app link.

### 4. Changelog

Prepend a dated entry to `src/lib/changelog.ts` describing the new signup flow and policy pages.

## Out of scope

- Editing profile fields post-signup (can follow later in Settings).
- Real legal review — pages ship as clearly-labelled placeholders.
- Backfilling profiles for existing users (trigger only fires for new signups; existing users keep working via `auth.users` as today).

## Technical notes

- Migration order per project rules: CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY, then the `handle_new_user` trigger function (`SECURITY DEFINER`, `SET search_path = public`) and trigger on `auth.users`.
- Meta fields passed via `supabase.auth.signUp({ options: { data: {...} } })` land in `raw_user_meta_data` and are read by the trigger.
- Currency value stored as ISO code (`GBP`) so it can drive formatting later (not wiring `formatCurrency` in this pass — memory: only ship what was asked).
- No changes to sign-in flow, Google OAuth, or existing users' data.
