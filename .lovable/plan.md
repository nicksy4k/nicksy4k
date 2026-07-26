Upgrade the About card in Settings > Data to a richer, on-brand info section.

## What we will build

1. App Header block
   - App name "Ledgerly" in display font with a small `v2.0.0` badge.
   - Tagline: "A precision personal finance and pocket-routing tracker."
   - Placed at the top of the About card content area.

2. Developer Credit card
   - Title/line: "Designed and developed by Nicksy4K."
   - Sub-text: "Powered by React, Supabase, and late-night coding sessions fueled by Monster Energy Drink!"
   - Styled as a compact nested card using the existing `Card` component with primary-tinted icon.

3. Interactive Changelog
   - Use the existing `Accordion` component from `src/components/ui/accordion.tsx` (already present in the project).
   - Label: "Changelog".
   - Entries:
     - v2.0.0: Midnight Indigo UI Refresh & Smart Suggestion Cleanup
     - v1.9.0: Dynamic Income Routing & Automated Pockets
     - v1.8.0: BNPL Engine & Cross-Tab Synchronization
   - Each entry shows a short one-line summary in the collapsed trigger and expands to a few bullet details about the release.

4. Styling
   - Use only semantic tokens from `src/styles.css` (`--color-primary`, `--color-card`, `--color-muted-foreground`, `--color-border`, etc.).
   - Match the Phase 2 Midnight Indigo design: rounded cards, subtle borders, primary/15 icon backgrounds, `Space Grotesk` for headings, `Inter` for body.

## Optional additions (open to your preference)
- A "Made with" tech stack row of small icons/logos (React, Supabase, Tailwind).
- A "Feedback / Report a bug" link/button that opens a mailto or GitHub issue URL.
- A "Data storage" mini-stat (number of cloud-synced records) already partially exists in the Storage card above it.

## Files to change
- `src/routes/settings.tsx` — expand the existing `About` card inside `DataCard` with the header, developer credit, and changelog.

No new dependencies, no backend changes, no RLS changes required.