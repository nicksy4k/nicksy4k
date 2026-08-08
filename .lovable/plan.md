# Admin-controlled announcement banner

A message you can switch on/off and edit yourself from the Admin tab in Settings, shown at the top of the app's front page. First use: tell people to use the Feedback button (top right) because email is having issues.

## What you get

**Admin tab › Announcement banner card**
- On/off switch
- Title field (optional, e.g. "Email issues")
- Message field (multi-line)
- Style picker: Info / Warning / Critical (changes the colour)
- Live preview of exactly what users will see, plus a Save button
- Shows when it was last updated

**What users see**
- A dismissible banner at the top of the dashboard (front page), above the page content.
- Same banner on the signed-out login/landing page, so visitors who can't sign in still see it.
- Dismissing hides it for that person until you change the message again (dismissal is keyed to the message's updated time), so an edited notice reappears.
- Text mentions the Feedback button; the banner itself also opens the feedback dialog when clicked from inside the app.

## Technical notes

- New table `public.app_announcements` — single row (`id` fixed to 1): `enabled boolean`, `title text`, `message text`, `variant text` (info/warning/critical), `updated_at timestamptz`.
  - Grants: `SELECT` to `anon` and `authenticated` (so the signed-out landing page can read it), `UPDATE` to `authenticated` gated by `has_role(auth.uid(),'admin')`, `ALL` to `service_role`. RLS enabled with those policies; no insert/delete for users.
  - Migration seeds the single row, disabled, pre-filled with the email-issues wording so you only need to flick the switch.
- `src/lib/announcement.ts` — `useAnnouncement()` query hook (short stale time) + `useUpdateAnnouncement()` mutation.
- `src/components/AnnouncementBanner.tsx` — presentation + dismissal in `localStorage`.
- `src/components/AdminAnnouncementCard.tsx` — the editor, rendered in the Admin tab of `src/routes/settings.tsx` next to the demo controls.
- Rendered in `src/routes/index.tsx` (dashboard) and on `src/routes/auth.tsx` above the sign-in card.
- Changelog: prepend a dated v2.12.6 entry to `src/lib/changelog.ts`.
