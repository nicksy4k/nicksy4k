
## Goal

Let a signed-in user (who registered with email/password) attach their Google identity to the same account, so future Google sign-ins land in the existing Ledgerly account instead of creating a new one.

## Approach

Supabase Auth supports **Manual Identity Linking** via `supabase.auth.linkIdentity({ provider: 'google' })`. This must be enabled on the project (Auth settings → "Manual linking"), then triggered from the app while the user is already signed in. On return, the Google identity is attached to the current `auth.users` row — no data migration needed.

We'll also surface the currently-linked identities and allow unlinking Google (only when at least one other identity remains, so the user can't lock themselves out).

## Changes

1. **Enable manual linking** on the Supabase Auth config (one-time setting).
2. **Settings → Account tab** (in `src/routes/settings.tsx`): add a new "Connected accounts" card that:
   - Lists identities from `supabase.auth.getUserIdentities()` (email, google) with connected/not-connected state.
   - "Connect Google" button → calls `supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo: window.location.origin + '/settings' } })`.
   - "Disconnect" button on Google row → `supabase.auth.unlinkIdentity(identity)`, disabled if it's the only identity.
   - Toast on success/error, refresh identities list.
3. **No schema changes** — linking lives in `auth.identities`, managed by Supabase.

## Notes / caveats

- The Google account's email must not already belong to a different Supabase user. If it does, linking fails with a clear error (we'll surface it in a toast) and the user's options are: sign in as that other account and delete it, or use a different Google account.
- We keep the existing Google sign-in on the auth page unchanged.

## Technical details

- Use `supabase.auth.linkIdentity` / `unlinkIdentity` / `getUserIdentities` from `@supabase/supabase-js` (already installed).
- Linking uses the same OAuth broker flow as sign-in; `redirectTo` should be a public same-origin URL — we'll use `/settings` so the user lands back on the same tab.
