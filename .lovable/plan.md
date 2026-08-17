# Ledgerly 3.0 — "Know what's left, everywhere"

Three headline features, built in order so each one stands on its own if you want to stop early. The theme: Ledgerly stops being a record of what you spent and starts telling you what you can spend.

## 1. Budgets & forecasting (the flagship)

**Per-category budgets, per cycle.** Set a target for any category (Groceries £250, Fun £80). Budgets live in a new table keyed to your cycle type, so they roll over automatically each cycle without re-entry.

**Safe-to-spend.** One big number on the dashboard, computed as:

```text
main balance
  - unpaid outgoings due before the cycle ends
  - pocket money that is already spoken for
  = safe to spend for the rest of this cycle
```

Shown with days-remaining and a per-day figure, so "£184 left, 11 days, £16/day" reads at a glance.

**Budget page.** A new `/budgets` route: one row per budgeted category with spent / target / remaining, a progress bar that turns amber at 80% and red past 100%, and a "pace" marker showing whether you're ahead or behind for how far into the cycle you are. Unbudgeted categories are listed underneath with their spend so you can promote them into a budget in one click.

**Forecast.** End-of-cycle projection based on spend so far plus remaining known outgoings, plus a small trend strip showing the last six cycles' actual-vs-budget per category. Joy categories keep their existing blur/roll-up treatment.

**Dashboard changes.** Safe-to-spend becomes the hero card; the top three budgets closest to their limit appear as compact bars.

## 2. Mobile-first PWA

**Installable app.** App manifest, icons, theme colour and splash metadata so Ledgerly installs to the home screen and launches without browser chrome. This alone fixes most of the "it feels like a website on my phone" problem.

**Quick-add on mobile.** A persistent bottom action for new spend on small screens, opening a stripped-down single-screen capture (amount, retailer, category, source) that itemises later — three taps to log a shop.

**Mobile layout pass.** Bottom tab bar on phones instead of the drawer sidebar, larger tap targets on lists, and sticky totals on Outgoings, History and Budgets so the number you care about never scrolls away.

Offline capture is deliberately out of scope for 3.0 — it needs conflict handling and is worth its own release. If you want it, say so and I'll fold it in as a fourth phase.

## 3. Bank / CSV import & reconciliation

**Import wizard.** Upload a CSV from your bank, map columns (date / description / amount / balance) with the mapping remembered per bank, and preview rows before anything is written.

**Smart matching.** Each imported row is matched against what Ledgerly already knows: existing transactions within a few days and pennies, and recurring outgoings by name. Rows come back in three buckets — matched (confirm), new (import as a transaction with a suggested category from your existing suggestion engine), and ignore (transfers, savings moves).

**Reconciliation.** After import, a summary comparing the statement's closing balance to Ledgerly's main balance, with the difference itemised so you can find what's missing.

**Duplicate safety.** Every imported row stores a fingerprint, so re-importing an overlapping statement never double-counts.

## Suggested order

1. Budgets & safe-to-spend (biggest daily payoff, no new external formats)
2. PWA + mobile pass (makes daily logging painless)
3. CSV import & reconciliation (largest surface area, best done last)

Each phase ends with tests, a changelog entry and a version bump: 3.0.0 on phase 1, 3.1 and 3.2 after — or hold all three and ship 3.0 as one release. Tell me which you prefer.

## Technical notes

- New `budgets` table (user_id, category, amount, cycle_type, created_at) with RLS and grants; budgets are per category per cycle type, not per dated cycle, so they persist.
- Budget maths goes in a new `src/lib/budgets.ts` with unit tests, reusing `getActiveCycle` / `isInCycle` from `src/lib/cycle.ts` and `perCycleTotal` from `src/lib/outgoings.ts`. Safe-to-spend reuses the existing main-balance calculation rather than a second implementation.
- PWA is manifest-only (`public/manifest.webmanifest` + head tags in `src/routes/__root.tsx`) — no service worker, so nothing can serve stale builds.
- CSV parsing happens client-side; matching logic lives in `src/lib/import.ts` with tests, reusing `suggestionSimilarity`. Imported rows get an `import_fingerprint` column on transactions with a unique index per user.
- Mobile navigation is a new component alongside `app-sidebar.tsx`, switched on `useIsMobile`, so desktop is untouched.
