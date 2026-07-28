## Split "About" into its own Settings tab

Right now the What's New card, changelog link, privacy dialog, feedback link, and data-export tools all live inside the **Data** tab. Give **About** its own home and turn it into a proper "meet the app" surface.

### 1. New tab wiring (`src/routes/settings.tsx`)
- Add an `"about"` value to the `Tabs` list alongside Cycle / Categories / Data.
- Move everything About-related out of the Data tab. Data tab keeps only: Download my data (ZIP), Connected accounts, and destructive/account actions.
- If the URL hash is `#about` (used by the header version badge and What's New links), default the tab to About.

### 2. About tab layout (top → bottom)

````text
┌─────────────────────────────────────────────┐
│  App identity card                          │
│   Ledgerly logo · tagline · Beta badge      │
│   v2.4.0 · updated 28 Jul 2026              │
├─────────────────────────────────────────────┤
│  What's New card (existing WhatsNewCard)    │
├─────────────────────────────────────────────┤
│  Changelog card                             │
│   • "Open full changelog" (dialog / route)  │
│   • Export CSV · Print PDF                  │
├─────────────────────────────────────────────┤
│  Privacy & security card                    │
│   • Opens PrivacyDetailsDialog              │
│   • Short "how your data is stored" blurb   │
├─────────────────────────────────────────────┤
│  Help & feedback card                       │
│   • Report a bug   · Share an idea          │
│   • General feedback (mailto helpers)       │
├─────────────────────────────────────────────┤
│  Credits & legal footer                     │
│   Built by Nick · © 2026 · Beta disclaimer  │
└─────────────────────────────────────────────┘
````

### 3. Suggested additions worth including
- **App identity card** with logo, one-line tagline ("Personal money, on your terms."), Beta badge, and the version pill.
- **Feedback split buttons** — three mailto CTAs (`bug`, `idea`, `general`) using the existing `buildFeedbackMailto` helper, instead of the single header link.
- **Roadmap teaser** (static list, 3–5 bullets: "coming soon: shared households, bank sync trial, category budgets") so testers know what's next.
- **Keyboard shortcuts** collapsible (if/when we add any — placeholder for now, or skip until we ship shortcuts).
- **Credits line**: "Built with TanStack Start, Tailwind, shadcn/ui, Lovable Cloud." Small, muted.
- **Legal footer**: reuse the softened beta disclaimer text already on the auth page so it lives in one place.

### 4. Data tab after the move
Keeps: Download my data (ZIP), Connected accounts, Sign out, Delete account. Purely account/data ops — no marketing/about content.

### Technical notes
- No new deps; reuses `WhatsNewCard`, `ChangelogDialogTrigger`, `PrivacyDetailsDialog`, `buildFeedbackMailto`, `currentVersion`/`currentVersionDate`.
- Header version badge continues to link to `#about` and now lands on the dedicated tab.
- Prepend a `v2.5.0` entry to `src/lib/changelog.ts` per the standing rule.

### Open question
Anything you'd like cut from the suggested additions (e.g. skip the Roadmap teaser or the Credits line)? Otherwise I'll build it as above.