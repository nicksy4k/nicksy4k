# Mobile UI Tidy-Up Pass

Goal: the whole app should feel calm and readable on a phone — key numbers big and obvious, secondary detail collapsed or wrapped, nothing spilling out of a card, and no doubled-up padding.

## What's causing the cramped feel today

- Every page wrapper uses a fixed `p-6 md:p-10`, but the app shell already adds `p-4` around the page content — so on a phone content is inset twice and the usable width shrinks.
- Page titles are `text-3xl` on mobile, which eats vertical space and pushes the real data below the fold.
- Several stat grids and header rows use fixed multi-column or flex layouts that don't collapse cleanly at 390px, so labels and amounts get squeezed or clipped.
- Cards use `p-5`/`p-6` padding at all sizes, leaving little room for the numbers themselves.

## The plan

### 1. One shared page shell
Introduce a small `PageHeader` / page-container pattern and apply it to every route (dashboard, outgoings, history, savings, income, credit, reports, archive, settings, new):
- Container: no extra horizontal padding on mobile (the shell provides it), roomier from `md:` up.
- Title: `text-2xl` on mobile, `text-3xl md:text-4xl` above; subtitle drops to a single wrapped line; action buttons move to their own full-width row on mobile instead of fighting the title.

### 2. Card density tuned per breakpoint
- Card padding becomes `p-4 md:p-5` (or `p-4 md:p-6` for hero cards).
- Stat grids: single column or 2-up on mobile, promoting to 3/4-up from `sm:`/`lg:`.
- Amounts stay `tabular-nums` and get `text-xl`/`text-2xl` on mobile so they remain the loudest thing on screen.

### 3. Information hierarchy on the busiest screens
- **Dashboard**: primary balance card stays large and full-width; the secondary stat tiles become a compact 2-up grid; lower-priority panels (delivery, alerts, encouragement) collapse into accordions or condensed rows on mobile.
- **Outgoings**: summary keeps the four figures but as a 2×2 grid on mobile; the cycle-range and shortfall cards stack with wrapped text; each list row shows name + amount + status prominently, with dates/category/notes moved to a second muted line that truncates rather than wraps forever.
- **History**: rows become name/amount on the top line, date/retailer/badges on a muted second line; badges wrap; the wide table view stays desktop-only with a card list on mobile.
- **Credit (Owed to me / Debts)**: card headers use the grid + `min-w-0` + `shrink-0` pattern so long names truncate instead of pushing the amount off-screen; schedules stay collapsed by default on mobile.
- **Reports**: filters stack full-width; charts get a fixed mobile height and horizontal scroll only where genuinely needed.
- **Settings**: section cards get consistent spacing; dense two-column rows stack on mobile.

### 4. Overflow safety net
Apply the responsive header pattern (`grid-cols-[minmax(0,1fr)_auto]` on mobile, `min-w-0` on text containers, `shrink-0` on icons, `truncate` on single-line headings) anywhere a row mixes text with fixed-size controls, and add `break-words` to free-text fields (notes, retailer names, plan descriptions).

## Technical notes

- Presentation-only: Tailwind class changes plus small layout components. No data, query, or business-logic changes.
- New shared pieces: `src/components/PageHeader.tsx` and a `PageContainer` wrapper, reused across routes so spacing stays consistent going forward.
- Verification: Playwright screenshots at 390×844 for dashboard, outgoings, history, credit, reports and settings, before/after, checking for horizontal overflow (`scrollWidth > clientWidth`).
- Changelog: new dated entry in `src/lib/changelog.ts` for the mobile polish release.
