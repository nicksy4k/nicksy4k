## Goal

Add an "About the Developer" story plus a "Support Development" card to the public landing page and to Settings > About.

Note on placement: `src/routes/index.tsx` is the signed-in Dashboard. The actual public landing/login page is `src/routes/auth.tsx` (bento-grid hero + beta notice + legal footer), so the story section goes there. Say the word if you'd rather it also appear on the Dashboard.

## 1. New shared components

- `src/components/AboutStory.tsx` — the "The Story Behind Ledgerly" card.
  - Heading: "Built for Real-World Cash Flow. Fuelled by Caffeine."
  - Full story copy as supplied (Nick intro, spreadsheets/28-day cycles, ADHD & Autism structure needs, Monster-fuelled build with React/Supabase/Lovable, pride in the result).
  - Prop `variant?: "full" | "condensed"` so Settings can render a 2-paragraph short version from the same source text.
- `src/components/SupportDevCard.tsx` — compact "Buy the Dev a Monster ⚡" card.
  - Body: "Enjoying Ledgerly? If this app saves you spreadsheet headaches, consider supporting hosting costs or fueling the next feature update!"
  - Two buttons, `target="_blank" rel="noopener noreferrer"`:
    - "⚡ Buy Me a Monster" → https://buymeacoffee.com/ledgerly
    - "☕ Support on Ko-fi" → https://ko-fi.com/ledgerly
  - Buttons stack full-width on mobile, side-by-side from `sm:`.

## 2. Landing page (`src/routes/auth.tsx`)

- Insert a new section below the bento feature grid / above the existing legal footer: story card on the left, support card alongside on `lg:` and stacked below on smaller screens.
- Keep the existing beta notice and footer untouched.

## 3. Settings (`src/routes/settings.tsx`)

- Inside `AboutTab`, add the condensed story card and the same `SupportDevCard` (placed after the app-info/What's New cards, before the technical/version details).

## 4. Design & responsiveness

- Semantic tokens only (`bg-card`, `border-border/60`, `text-muted-foreground`, `primary` accents, existing focus-ring styles) — no hardcoded colours, so Midnight Indigo dark surfaces and electric indigo rings carry through.
- Fluid typography and padding (`p-5 md:p-7`, `text-sm md:text-base`), max prose width, tested for narrow Chromebook widths and mobile.

## 5. Changelog

- Prepend a dated entry to `src/lib/changelog.ts` (v2.8.2) noting the About/Support section.

## Technical details

Both new components are presentational, no data fetching, so they are safe to import from the public `auth` route (no server-function or auth dependency). Donation URLs are constants at the top of `SupportDevCard.tsx` so they're trivial to swap for the real handles later.
