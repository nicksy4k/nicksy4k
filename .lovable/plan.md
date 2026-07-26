## Interactive guided tour with demo overlay

The tour becomes a hands-on walkthrough: while it's running, the dashboard renders a curated fake dataset (no DB writes), and each step offers a "Try it" action the user actually clicks. Exiting the tour restores the real data instantly.

### 1. Demo data overlay (no DB writes)

- New `src/lib/demoData.ts` exports a curated dataset (a few transactions with items, one pocket, two warranty items, one recurring income) shaped exactly like the real store types.
- New `src/lib/demoMode.tsx` provides a `DemoModeProvider` + `useDemoMode()` context with `{ active, start, stop, filterCategory, setFilterCategory, extraSpend, addExtraSpend, expandedTxnId, setExpandedTxnId }`.
- Wrap `TutorialProvider` children (or add above `AppLayout`) so demo state is app-wide but only affects the dashboard.
- `src/routes/index.tsx` reads `useDemoMode()`. When `active`, it swaps `items / incomes / savings` for the demo dataset before computing stats. `extraSpend` is subtracted from Left-to-Spend live. `filterCategory` narrows the category chart, warranty alerts stay demo-driven, and `expandedTxnId` toggles an inline itemized breakdown under the matching Recent row.

### 2. Tour steps with actions

`src/lib/dashboardTourSteps.ts` gains an optional `action?: { label, run, reset? }` per step. `TutorialProvider` renders a "Try it" button in the tooltip when `action` is present; `Next` also runs `reset` (if defined) so state is clean for the next step.

Steps updated:
- **Left-to-spend** → "Log a demo £12 coffee" → calls `addExtraSpend(12)`, number animates down. `reset` clears it.
- **Category chart** → "Filter to Groceries" → sets `filterCategory('Groceries')`. `reset` clears.
- **Warranty alerts** → "Open the first alert" → sets a `demoAlertOpenId` that the alert row honours to expand a details popover inline.
- **Recent** → "Expand this transaction" → sets `expandedTxnId` on the first demo transaction to reveal its line items with prices.
- Sidebar steps (New / Commitments / Settings) keep their current highlight-only behaviour (no destructive click during the tour).

### 3. Lifecycle wiring

- `TutorialProvider.start` calls `demo.start()`; `finish` (and `skip`) calls `demo.stop()`.
- On mount, the dashboard checks `demo.active` and renders `<Badge>Demo data · tour mode</Badge>` in the header for clarity.
- Cleanup: closing the tour clears filter/extraSpend/expanded IDs so nothing leaks to real data view.

### 4. Files touched

- New: `src/lib/demoData.ts`, `src/lib/demoMode.tsx`
- Edit: `src/lib/dashboardTourSteps.ts` (add `action` to relevant steps)
- Edit: `src/components/tutorial/TutorialProvider.tsx` (render Try-it button, call demo start/stop, run `action.run` / `action.reset`)
- Edit: `src/components/AppLayout.tsx` (mount `DemoModeProvider` around `TutorialProvider`)
- Edit: `src/routes/index.tsx` (consume demo overlay, add filter chip banner when a category is active, inline expand on Recent row, inline detail on warranty alert)

### Technical notes

- No schema changes. Everything is client-only React state; the Supabase store hooks are only bypassed at read-time on the dashboard while `demo.active`.
- Real routes (History, Reports, Commitments) are untouched — the overlay is dashboard-only, matching the tour's scope.
- Restoring real data on tour exit is a single state flip; no cache invalidation needed.
- Sidebar navigation steps stay non-interactive to avoid a mid-tour route change that would unmount the spotlight and lose demo state.

Ready to build on approval.