# Legal polish: copyright, cookies notice, faster access

Two of the five items are already live: the sign-up form already has a Beta Disclaimer checkbox that writes `accepted_beta_disclaimer_at` alongside the privacy timestamp, and both legal pages already show "Last updated: 8 August 2026". Those stay as they are — the rest is new work.

## 1. Copyright notices

Add a consistent `© 2026 Ledgerly · Built by Nicksy4K. All rights reserved.` line in three places:

- The auth/landing page footer (below the existing beta + privacy paragraph).
- A new global app footer (see item 3).
- Bottom of the Privacy Policy, Beta Disclaimer and new Cookie Notice pages.

Year is rendered dynamically so it never goes stale. The Settings About tab already carries a `© {year} Ledgerly` line — it stays, reworded to match the new wording.

## 2. Beta Disclaimer acceptance — verify only

Already implemented: the checkbox is required at sign-up and the timestamp is stored on the profile. No change beyond confirming the acknowledgement text mentions the new Cookie Notice link.

## 3. Faster access to legal pages

- **App footer**: a slim footer rendered once inside the main app shell, under the page content on every signed-in route — Privacy Policy · Beta Disclaimer · Cookie Notice · copyright line. Small, muted, non-intrusive.
- **Sidebar**: a "Legal" section in the sidebar footer area with compact links to the three pages, so they're reachable without opening Settings.
- **Settings**: add the Cookie Notice link next to the two existing legal links in the About tab.

## 4. New Cookie & Analytics Notice page (`/cookies`)

Same card layout and back-button behaviour as the other two legal pages, with its own head metadata and canonical URL. Sections:

1. **The short version** — no advertising cookies, no cross-site tracking, no third-party analytics scripts.
2. **What's actually stored** — the auth session token, and local preferences (theme, currency, tutorial/onboarding progress, demo-mode flag, cached UI state). Table of what each is for and how long it lasts.
3. **Strictly necessary vs optional** — the session token is required to stay signed in; preferences are convenience only.
4. **Analytics & error reporting** — describes any diagnostic/error capture the app performs and that it holds no advertising identifiers.
5. **How to opt out / clear** — sign out to drop the session, clear site data in your browser, Settings › Data to clear app data. Note that clearing strictly-necessary storage signs you out.
6. **Third parties that may set storage** — the identity provider and Google Sign-In when used.
7. **Changes & contact** — dated updates, admin@itemizedkeeper.co.uk.

Cross-links to Privacy Policy and Beta Disclaimer; those two pages get a link back to the Cookie Notice.

Because there are no non-essential cookies, no consent banner is added — a notice page is the correct and honest treatment.

## Technical notes

- New route file `src/routes/cookies.tsx` reusing the `Section` card pattern from `privacy.tsx`.
- Footer as a small shared component rendered in `src/components/AppLayout.tsx`; sidebar links in `src/components/app-sidebar.tsx` footer slot.
- Presentation-only: no schema, RLS, or auth changes.
- Before writing the Cookie Notice body, the actual storage keys the app writes are enumerated from the code so the list is accurate rather than generic.

## Changelog

Prepend a dated v2.12.5 entry to `src/lib/changelog.ts` covering the Cookie Notice page, footer/sidebar legal links, and copyright notices.
