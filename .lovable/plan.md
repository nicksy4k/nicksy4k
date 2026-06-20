## Branding fixes + signed-in user identity

### 1. Fix the "Monry" typo and align brand to "Ledgerly"

In `src/routes/__root.tsx`, the head metadata still reads *"Nick's Monry Tracker"* in three places (title, `og:title`, `twitter:title`). Replace all three with `"Ledgerly — Personal Finance Tracker"` so the browser tab, link previews, and Twitter cards match the in-app brand the rest of the routes already use.

No other "Monry" references exist; every other route file is already on Ledgerly.

### 2. Surface the signed-in user in the sidebar

The sidebar currently shows the Ledgerly logo and a bare "Sign out" button — nothing tells you which account is active. Add a compact user block at the bottom of the sidebar (above/replacing the standalone Sign out button) that shows:

- A small circular avatar with the user's initial (derived from email)
- The user's email on one line, truncated if long
- A small icon-only Sign out button next to it

Data source: `supabase.auth.getUser()` on mount + subscribe to `onAuthStateChange` for updates. Keep it local to `AppLayout.tsx` — no new store, no new route.

Visual style: matches existing sidebar tokens (muted foreground, `bg-sidebar-accent/40` pill, same rounded-xl + ring treatment as the logo tile for the avatar). On mobile (sidebar collapses to a top bar), the user block sits inline at the right edge of the header row.

### 3. Forward-looking note (no code this turn)

Once other people use the app, the natural next steps are: a `profiles` table with `display_name` + `avatar_url`, a profile-edit screen in Settings, and swapping the email-initial avatar for the uploaded one. Flagging only — not building now since you said this is personal use.

### Files touched
- `src/routes/__root.tsx` — fix three "Monry" strings
- `src/components/AppLayout.tsx` — add user identity block, wire `supabase.auth.getUser()` + `onAuthStateChange`, restyle sign-out

### Out of scope
- No profiles table, no avatar upload, no display-name editing
- No changes to auth flow, routes, or any other page
