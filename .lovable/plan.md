## Goal

Three personalization upgrades from beta feedback: pick your currency, pick a softer theme, and make spending charts feel encouraging rather than judgemental.

---

## 1. Currency selector

**Current state (verified):** signup already collects a currency into the `profiles.currency` column, but nothing reads it. Every money display goes through one helper — `fmt()` in `src/lib/format.ts` — which is hardcoded to `en-GB` / `GBP`. It's called in 14 files (~110 call sites), plus ~15 hardcoded `£` labels in form fields (`Amount (£)`, the setup wizard prefixes) and one `"£"#,##0.00` number format in the Excel export.

**Approach — one central preference, no data migration.** Amounts stay plain numbers in the database; only presentation changes. No conversion or FX rates: choosing a currency changes the symbol and formatting, it does not convert historic figures. The settings screen will say this plainly.

- New `src/lib/currency.tsx`: a `CurrencyProvider` + `useCurrency()` hook mounted in `AppLayout`, reading `profiles.currency` (and a new `currency_symbol` column for custom symbols) via React Query, with an optimistic `setCurrency` mutation. Defaults to GBP; falls back to GBP instantly during load so nothing flashes.
- A built-in list: GBP £, USD $, EUR €, ZAR R, CAD CA$, AUD AU$, NZD NZ$, INR ₹, JPY ¥, CHF, SEK/NOK/DKK kr, PLN zł, plus **Custom…** (free-text symbol, 1–4 chars, and a symbol-position toggle for before/after the number).
- `fmt()` becomes locale-aware and takes an optional currency context; every component switches to `const { fmt } = useCurrency()`. The bare `fmt` export stays as a GBP fallback for non-React code paths (MCP tools, print/export helpers), which get the resolved currency passed in explicitly.
- Hardcoded `(£)` field labels become `({symbol})`, the setup wizard input prefixes become the active symbol, and the Excel export builds its number format from the active symbol.

**Where the setting lives:** a new **Preferences** tab in `/settings` (alongside Cycle, Account, …) holding both currency and theme, so personalization is in one obvious place. The setup wizard gets a currency step-one field too, prefilled from signup.

---

## 2. Theme customization & softer colors

**Current state:** a single dark Midnight Indigo palette in `src/styles.css` under `:root` — primary is a fully saturated indigo (`oklch(0.60 0.22 270)`) used for the background glow, rings, and chart 1. That saturation on a near-black background is exactly what reads as "intimidating".

**Approach — presets as CSS classes, not new token names.** Every token name stays identical, so no component changes are needed; only the values swap.

- Restructure `src/styles.css` so the token block is emitted once per theme class on `<html>`: `.theme-midnight`, `.theme-blush`, `.theme-slate`, `.theme-daylight`. Existing `:root` keeps Midnight as the no-JS default.
- **Softening pass on Midnight itself:** drop primary chroma (~0.22 → ~0.16), lift background lightness slightly, and tone the two radial background glows down (0.18/0.12 → ~0.10/0.07). Same identity, much calmer.
  - **Blush (Soft Pink):** warm dark plum surfaces with a dusty rose primary and coral/lilac chart ramp.
  - **Muted Slate:** neutral blue-grey surfaces, low-chroma steel primary — the most "office safe" option.
  - **Daylight:** an optional light theme (light surfaces, same accent family) — worth including since "intimidating" often means "too dark", and `color-scheme` is already handled in one place.
- Chart palettes (`--chart-1..6`) get per-theme values so pie/bar charts stay harmonious rather than clashing with a pink accent.
- **Accessibility:** every foreground/background pair checked against WCAG AA (4.5:1 body, 3:1 large text and UI borders); tuned in OKLCH lightness so contrast is deliberate rather than guessed. Rings/focus states keep a visible 3:1 against their adjacent surface in all four presets.
- Persistence: theme stored in `profiles` (new `theme` column) plus a `localStorage` mirror applied by a tiny inline script in `__root.tsx`, so the chosen theme paints on first frame with no flash for signed-in users on reload.
- UI: a theme picker card in the new Preferences tab showing four live swatch previews (surface + primary + chart dots), applying instantly on click.

---

## 3. Guilt-free / positive spending UI

Small, opt-out-able touches rather than gimmicks:

- **Neutral framing in copy.** Reports/dashboard headings shift from verdict language to observation: "Where your money went" instead of totals presented like a scorecard; category tooltips read "£X across 6 visits" rather than emphasising the biggest offender.
- **A "Joy" category flag.** In Settings › Categories, any category can be marked as *planned fun* (takeaways, hobbies, treats). Joy categories render in a warm accent and, on the dashboard, roll up into a single friendly "Fun money this cycle: £X of your £Y allowance" line — reframing discretionary spend as budgeted-for, not leaked.
- **Positive reinforcement nudges.** A small rotating encouragement chip on the dashboard driven by real data: "Under your cycle plan with 9 days to go", "3rd cycle in a row you've logged every receipt", "Groceries down £18 vs last cycle". Only shown when something genuinely positive is true — never a scold, and never a fake compliment.
- **Chart comfort controls** in Preferences: a *Blur amounts* toggle (numbers masked until hover/tap — useful in public), and *Hide category pie* for anyone who'd rather not see the breakdown at all. The pie keeps its data; it just collapses to a summary row.
- Streaks and nudges are cosmetic and dismissible; no red/danger colouring on any discretionary category unless it's an actual overdue commitment.

---

## Technical details

**Files touched**
- New: `src/lib/currency.tsx`, `src/components/CurrencySettingsCard.tsx`, `src/components/ThemePickerCard.tsx`, `src/lib/theme.tsx`, `src/lib/encouragement.ts`.
- Edited: `src/lib/format.ts`, `src/styles.css`, `src/routes/settings.tsx` (new Preferences tab), `src/routes/__root.tsx` (no-flash theme script), `src/components/AppLayout.tsx` (providers), `src/components/setup/SetupWizard.tsx`, `src/lib/reportExport.ts`, `src/components/PrintableReport.tsx`, and the 14 files calling `fmt()`.
- Tests: extend `src/lib/__tests__/format.test.ts` for symbol/locale/custom-symbol/position cases.

**Database (one migration)**
- `profiles`: add `currency_symbol text`, `symbol_position text default 'before'`, `theme text default 'midnight'`.
- `user_settings`: add `joy_categories text[] default '{}'`, `blur_amounts boolean default false`, `hide_category_chart boolean default false`.
- Existing RLS on both tables already scopes to the owner; no new policies needed.

**Risk notes:** the `fmt()` migration is mechanical but wide — it'll be done file-by-file with a typecheck after each batch. No stored amount is ever rewritten, so switching currency is fully reversible.

**Changelog:** prepend a v2.9.0 entry covering currency, themes, and comfort controls.
