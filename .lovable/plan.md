## Homepage / sign-in redesign — bento-grid landing page

Redesign `src/routes/auth.tsx` from a single centered card into a two-zone landing page: a left/right hero block that sells the app, and a bento-grid of feature cards that wraps the sign-in form. The existing email/password auth logic and SEO metadata are preserved; the page adds a Google OAuth option and small UX polish.

### Design choices

User selected: **Feature cards around form** layout with **app feature highlights** and an **illustrated hero**. The existing Midnight Indigo palette and Space Grotesk / Inter typography remain locked.

### Changes

1. **Generate a hero illustration**
   - Create a dark Midnight Indigo-themed abstract finance/dashboard visual (e.g., glowing cycle rings, floating cards, subtle data particles).
   - Upload it as a Lovable asset and import it in the route.

2. **Build a bento-grid landing page in `src/routes/auth.tsx`**
   - Top section: large headline, one-line tagline, and the hero illustration.
   - Bento grid of feature cards:
     - **Itemized tracking** — log every item, not just totals.
     - **Receipts & warranties** — attach receipts and get expiry alerts.
     - **Income routing & pockets** — auto-route income and keep sinking funds.
     - **Cycle-based budgeting** — budget around your income cycle (monthly or 4-weekly).
   - The sign-in card sits as the largest or central card in the grid, blending into the bento layout.

3. **Enhance the sign-in card**
   - Add a **Google OAuth** button (per Lovable Cloud auth defaults).
   - Add a password visibility toggle.
   - Keep the existing `signInWithPassword` / `signUp` flow and `emailRedirectTo` logic.
   - Preserve form validation and toast/error handling.

4. **SEO / metadata**
   - Update the head meta title/description to read as a landing page.

5. **Responsive behavior**
   - Single column on mobile, bento grid on tablet/desktop.
   - Cards use the existing `--card` / `--border` tokens so they stay theme-aware.

### Files touched

- `src/routes/auth.tsx` — new landing layout and auth form
- New `src/assets/auth-hero.png` asset pointer (or generated equivalent)

### No schema changes

The page is purely client-side UI. OAuth backend is already supported by Lovable Cloud; the Google button uses the existing `supabase` client with `signInWithOAuth({ provider: 'google' })`.

### Acceptance criteria

- `/auth` shows a branded landing page with hero, feature cards, and a sign-in card.
- Email/password sign-in and sign-up still work.
- Google sign-in button works.
- Page is responsive and matches the existing Midnight Indigo theme.
- Meta title/description are updated for landing-page SEO.