# App Tutorial (Post-Setup)

Add a short, hybrid onboarding tutorial that fires the moment a user clicks **Finish setup** and lands on the dashboard, and can be re-launched any time from Settings.

## Flow

```text
Setup wizard
  └─ Finish → mark onboarding_completed, mark tutorial_pending
              → navigate("/")
Dashboard mounts
  └─ if tutorial_pending → open Welcome modal
       "Welcome to Ledgerly" · 2-paragraph intro · [Start tour] [Skip]
       └─ Start tour → spotlight coach-marks (Next / Back / Skip)
            1. "Left to spend" hero KPI
            2. Spending-by-category chart
            3. Return/warranty alerts card
            4. Recent transactions list
            5. Sidebar → "New transaction"
            6. Sidebar → "Commitments"
            7. Sidebar → "Settings" (mention re-run)
       └─ End (Finish or Skip at any point) → mark tutorial_completed
```

Skip anywhere = counted as completed; the tour never auto-opens again.
Re-run from **Settings → Data → Setup wizard card** (new "Run tutorial" button beside the existing wizard controls).

## Persistence

Store a single new boolean on `user_settings`:

- `tutorial_completed BOOLEAN NOT NULL DEFAULT false`

A localStorage cache (`ledgerly.tutorial.completed`) gives 0-ms first-paint, mirroring the pattern already used by `useOnboardingStatus` and `useCycleSettings`.

The wizard's `handleFinish` also writes a session flag `ledgerly.tutorial.pending = "1"` so the dashboard knows to auto-open the welcome modal on the very next mount (avoids a race with the redirect and avoids auto-opening on later logins).

## Components / files

New:
- `src/lib/tutorial.ts` — `useTutorialStatus()` hook (`completed`, `markComplete`, `reset`) + `markPending()` / `consumePending()` helpers backed by sessionStorage.
- `src/components/tutorial/TutorialProvider.tsx` — mounts a `<Popover>`-based spotlight overlay controlled by context; exposes `useTutorial().start(steps)`.
- `src/components/tutorial/Spotlight.tsx` — dimmed backdrop with a cut-out around the current step's target element, plus a tooltip card (Back / Next / Skip, step counter, progress dots). Uses a `ResizeObserver` and `requestAnimationFrame` to reposition on scroll/resize; falls back to a centred modal when the target isn't in the DOM (e.g. sidebar collapsed on mobile).
- `src/components/tutorial/WelcomeModal.tsx` — Shadcn `Dialog` with the 2-paragraph intro and Start / Skip buttons.
- `src/lib/dashboardTourSteps.ts` — array of steps `{ selector, title, body, placement }`.

Edits:
- `src/routes/__root.tsx` — wrap the app in `<TutorialProvider>`.
- `src/routes/index.tsx` — on mount, if `consumePending()` **or** an explicit `?tour=1` query param is set, open the welcome modal. Add `data-tour` attributes to: hero KPI, category chart card, warranty card, recent card.
- `src/components/app-sidebar.tsx` — add `data-tour` attributes to the New Transaction, Commitments, and Settings nav items so the tour can target them.
- `src/components/setup/SetupWizard.tsx` — in `handleFinish`, after `markComplete()`, call `markTutorialPending()` before `navigate({ to: "/" })`.
- `src/routes/settings.tsx` (`SetupWizardCard`) — add a "Run tutorial" button that navigates to `/?tour=1` (which triggers the welcome modal via the query param path).

## Migration

```sql
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN NOT NULL DEFAULT false;
```

Grants and RLS already cover `user_settings`; no policy changes needed.

## Technical notes

- Spotlight uses `getBoundingClientRect()` on the target selector; the overlay is a fixed-position SVG mask so it works over the sticky header and sidebar without layout thrash.
- Steps that target sidebar items force the sidebar open (`SidebarProvider`'s `setOpen(true)`) before measuring, so mobile / collapsed users still see the highlight.
- Escape key = Skip = mark completed.
- The wizard's redirect to `/setup` in `AppLayout` is gated on `onboarding_completed`, so it never interferes with `/?tour=1` after setup is done.
- No new dependencies — built on existing Shadcn `Dialog`, `Popover`, `Button`, and Tailwind.
