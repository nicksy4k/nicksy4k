# Proper legal pages: Privacy Policy & Beta Disclaimer

Both routes exist today (`/privacy`, `/beta-disclaimer`) but are marked "Placeholder" and are linked from the sign-up checkboxes and auth footer. This replaces their content with your written copy, tidied and expanded where it matters, and drops the "Placeholder" badges.

## Privacy Policy (/privacy)

Sections, based on your draft plus a few standard ones testers/regulators expect:

1. **Who we are** — Ledgerly is a personal project run by an individual developer, contact admin@itemizedkeeper.co.uk. Data controller statement, UK/GDPR framing.
2. **What we collect** — profile (full name, display name, email, country, preferred currency, how you heard about us), the financial data you enter (transactions, items, receipts, incomes, commitments, subscriptions, savings, loans, debts), and technical context attached to feedback (app version, page, user agent).
3. **How your data is stored & secured** — encryption in transit and at rest, Row Level Security scoped to your account on every table, receipts in a private bucket served via short-lived signed links, auth handled by the identity provider (passwords never stored by the app).
4. **What the developer can and can't see** — your wording says data is "completely unreadable by the developer". Softened to be accurate: through the app, RLS blocks the developer exactly as it blocks any other user; administrative database tooling exists because backups and migrations require it, but is not used to browse your records. This matches the wording already shown in the in-app Privacy details dialog, so the two don't contradict each other.
5. **Third-party services** — Lovable Cloud / Supabase (hosting, database, storage, auth), Google Sign-In (optional), transactional email for feedback notifications, and the AI provider used by the receipt scanner (only when you scan a receipt; images are sent for extraction and not used to train models).
6. **Retention** — data kept while the account is active; deletion on request; exports available any time.
7. **Your data rights** — export ZIP from Settings, clear all data, request full account deletion, correct any record in-app, plus the standard access/objection rights and how to exercise them.
8. **Cookies & tracking** — session/auth storage only, no third-party analytics or advertising trackers.
9. **Children** — not intended for under-18s.
10. **Changes to this policy** — dated updates; material changes surfaced in the app.
11. **Contact** — admin@itemizedkeeper.co.uk.

## Beta Disclaimer (/beta-disclaimer)

Your four sections kept, lightly expanded:

1. **App status & purpose** — personal project, active beta, not an official financial record, not professional financial advice.
2. **User input & accuracy** — all figures derive from manual entry; no guarantee of report or pocket-balance accuracy.
3. **Beta testing expectations** — features may change, evolve, or break; data structures may need migration or reset; use fake or non-critical data where possible.
4. **Data backups & liability** — RLS-secured storage, but keep your own backups; no liability for lost data, calculation errors, or financial discrepancies.
5. **No warranty** (kept from the current page) — provided "as is", liability limited to the extent permitted by law.
6. **Feedback & contact** — in-app feedback button or admin@itemizedkeeper.co.uk.

## Shared polish

- Remove the "Placeholder" badge from both pages, set "Last updated: 8 August 2026".
- Keep the amber beta callout on the disclaimer page; add a short cross-link between the two pages.
- "Back" button currently always goes to `/auth`; make it go back to `/auth` for signed-out visitors and to Settings for signed-in ones so reading the policy from Settings isn't a dead end.
- Update each page's `head()` description to reflect the real content.
- Add a `/privacy` and `/beta-disclaimer` link pair in the Settings About area alongside the existing privacy details dialog, if not already present.

## Technical notes

- Presentation-only: edits to `src/routes/privacy.tsx` and `src/routes/beta-disclaimer.tsx`, plus a small link addition in Settings. No schema, store, or auth changes.
- Content reuses the existing `Section` card pattern on both pages, so styling stays consistent.
- Wording is drafted as the app owner's own statements — no compliance or certification claims.

## Changelog

Prepend a dated v2.12.4 entry to `src/lib/changelog.ts` noting the full Privacy Policy and Beta Disclaimer replacing the placeholders.
