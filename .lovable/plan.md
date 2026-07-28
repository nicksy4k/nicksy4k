## Changelog upgrade for Settings

Four related improvements plus a workflow note.

### 1. Extract the changelog into shared data (`src/lib/changelog.ts`)
- Move the inline entries in `src/routes/settings.tsx` into a typed array: `{ version, title, date (ISO), icon, highlights: string[] }`.
- Single source of truth for the summary card, full view, and exports.

### 2. "What's New" summary card (About tab, top)
- New card above the existing About/Changelog block.
- Shows the top **3** latest entries as compact rows: version + title + relative date ("2 days ago") + first highlight.
- Actions: "See all changes" (opens full view) and dismissable "Got it" that stores last-seen version in `localStorage`. A subtle "New" dot appears on the Settings tab trigger and the card until dismissed for versions newer than last-seen.

### 3. Version badge + timestamp in the Settings page header
- Small pill next to the "Settings" title: `v2.3.0 · updated 28 Jul 2026` linked to open the full changelog.
- Version pulled from the changelog list's first entry (no separate config to drift).

### 4. Full changelog view — modal on desktop, full-page route on mobile
- New route `src/routes/changelog.tsx` for a dedicated scrollable page (SEO-friendly, deep-linkable, ideal for mobile).
- On desktop, the "See all changes" trigger opens a `Dialog` that renders the same list inside a scroll area; on `md-` viewports we skip the dialog and `navigate('/changelog')` instead so it fills the screen.

### 5. Export as PDF or CSV
- New "Export changelog" split button in the changelog card.
  - **CSV**: build a Blob with columns `Version, Date, Title, Highlight` (one row per highlight) — pure browser, no dep.
  - **PDF**: reuse the existing `window.print()` pattern (like Reports). Add a `PrintableChangelog` hidden component and a print-only CSS rule so only it renders when triggered from the changelog view. Avoids adding a PDF lib.

### 6. Standing rule
Save a project memory so every future change automatically prepends a new entry to `src/lib/changelog.ts` with today's date before finishing.

### Technical notes
- No schema changes, no new deps.
- Icons come from existing `lucide-react` imports.
- Relative dates via `date-fns` `formatDistanceToNow` (already installed).
- `localStorage` key `ledgerly:changelog:lastSeen` stores the acknowledged version string.
