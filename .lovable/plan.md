# Setup Wizard

A 4-step onboarding wizard at `/setup`, gated by an explicit `onboarding_completed` flag, re-openable from Settings, with per-step "Keep current" vs "Replace" choice so it's safe to re-run.

## Steps
1. **Cycle settings** — cycle type (monthly / 4-weekly), anchor date, carryover toggle.
2. **Balance & pockets** — starting main balance + initial pockets (name + color, add/remove rows).
3. **Categories** — pick from a default set (Groceries, Bills, Transport, Fun, Health, etc.) or add custom ones.
4. **Income & commitments** — first recurring income (amount + cadence + next date) and a starter list of commitments (name, amount, due date, category, frequency).

Final "Finish" screen summarises what will be written, then flips the completed flag and redirects to `/`.

## Re-run safety (per step)
Each step loads current data and shows one of:
- **Keep current** — skip, write nothing.
- **Replace** — overwrite/append with the new values shown.

Destructive replacements (pockets, categories, commitments) show a confirmation with counts before writing. Cycle settings and starting balance are always edit-in-place (single row).

## First-run trigger
- Add `onboarding_completed boolean default false` to `user_settings`.
- A top-level `useEffect` in `AppLayout` (or root) redirects to `/setup` when the flag is false and the user is authenticated.
- Wizard sets it to `true` on Finish.

## Re-run entry point
- Settings → Data tab: a "Re-run setup wizard" button that navigates to `/setup` (flag stays true; wizard behaves the same, just doesn't auto-redirect afterward).

## Technical notes
- **Migration:** add `onboarding_completed` to `user_settings`.
- **New route:** `src/routes/setup.tsx` — public-facing but requires auth; uses the existing `_authenticated` gate by living at `src/routes/_authenticated/setup.tsx`. Auto-redirect logic lives in `AppLayout` so unauthenticated users hit `/auth` first.
- **New component:** `src/components/setup/SetupWizard.tsx` — stepper UI (reuse sticky stepper pattern from `new.tsx`), one sub-component per step.
- **Reuse:** cycle logic from `src/lib/cycle.ts`, recurring income helpers from `src/lib/recurringIncome.ts`, pocket colors from `src/lib/colors.ts`.
- **Settings entry:** add "Re-run setup wizard" button in `src/routes/settings.tsx` Data tab, near the About card.

## Out of scope
- No wizard for BNPL/debts/loans (those are transactional, not setup).
- No forced re-onboarding on schema upgrades.
