# Ledgerly 3.0 — mobile app first, then budgets

Three headline features. Mobile-first PWA leads and ships as 3.0 on its own, so you stop typing the URL as soon as it lands.

## 1. Mobile-first PWA (the 3.0 release)

**Installable app.** App manifest, icons, theme colour and splash metadata so Ledgerly installs to your home screen from Safari or Chrome and launches full-screen with no browser chrome — an app icon, not a bookmark. No offline caching, so you never get served a stale build.

**Quick-add on mobile.** A persistent bottom action button for new spend on small screens, opening a stripped-down single-screen capture (amount, retailer, category, source) that you can itemise later — three taps to log a shop.

**Mobile layout pass.** A bottom tab bar on phones instead of the drawer sidebar (Dashboard, Outgoings, Add, History, More), larger tap targets in lists, and sticky totals on Outgoings, History and Reports so the number you care about never scrolls away.

**Install prompt.** A dismissible one-time hint in-app showing how to add to home screen, with the correct instructions for iOS versus Android.

Offline capture is deliberately out of scope — it needs conflict handling and can serve stale builds. Worth its own release if you ever want it.

## 2. Budgets & forecasting (3.1)

**Per-category budgets, per cycle.** Set a target for any category (Groceries £250, Fun £80), stored against your cycle type so they roll over automatically.

**Safe-to-spend.** One big number on the dashboard:

```text
main balance
  - unpaid outgoings due before the cycle ends
  - pocket money already spoken for
  = safe to spend for the rest of this cycle
```

Shown with days remaining and a per-day figure: "£184 left, 11 days, £16/day".

**Budgets page.** A new `/budgets` route with spent / target / remaining per category, progress bars that turn amber at 80% and red past 100%, and a pace marker for how far into the cycle you are. Unbudgeted categories listed underneath for one-click promotion.

**Forecast.** End-of-cycle projection from spend so far plus remaining known outgoings, and a strip showing the last six cycles' actual-vs-budget. Joy categories keep their blur/roll-up treatment.

## 3. Bank / CSV import & reconciliation (3.2)

**Import wizard.** Upload a bank CSV, map columns (date / description / amount / balance) with the mapping remembered per bank, preview before anything is written.

**Smart matching.** Rows are matched against existing transactions (within a few days and pennies) and recurring outgoings by name, then bucketed: matched (confirm), new (import with a suggested category), ignore (transfers, savings moves).

**Reconciliation.** A closing-balance comparison against Ledgerly's main balance with the difference itemised.

**Duplicate safety.** Each imported row stores a fingerprint so overlapping statements never double-count.

## Technical notes

- PWA is manifest-only: `public/manifest.webmanifest`, generated icon set under `public/`, and head tags (manifest, theme-color, apple-touch-icon) in `src/routes/__root.tsx`. No service worker, no `vite-plugin-pwa`.
- Mobile navigation is a new bottom-bar component alongside `app-sidebar.tsx`, switched on the existing `useIsMobile` hook, so desktop layout is untouched. Sidebar-only items move into a "More" sheet.
- Quick-add reuses the existing new-transaction mutation path in `src/lib/store.ts` with the `is_pending` flow already built for placeholders.
- Phase 2: new `budgets` table (user_id, category, amount, cycle_type) with RLS and grants; maths in a new `src/lib/budgets.ts` with tests, reusing `getActiveCycle`/`isInCycle` and `perCycleTotal`.
- Phase 3: client-side CSV parsing, matching in `src/lib/import.ts` reusing `suggestionSimilarity`, plus an `import_fingerprint` column on transactions with a per-user unique index.
- Each phase ends with tests, a changelog entry and a version bump.
