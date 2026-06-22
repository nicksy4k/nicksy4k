# Already done — skipping

After scanning the codebase:
- **Commitment Visual States** — already shipped (per your note).
- **Category Selector on Commitments** — already in `src/routes/commitments.tsx` (state at line 485, `<Select>` at lines 535–545, persisted at line 515). No work needed.

# In scope this round

## 1. Past Cycle Archives

Add a historical lookup so you can review any previous cycle's performance without changing the active cycle.

**New helper** in `src/lib/cycle.ts`:
- `getCycleAt(settings, isoDate)` — same maths as `getActiveCycle` but for an arbitrary date. Returns the same `ActiveCycle` shape.
- `listRecentCycles(settings, count = 12, today?)` — returns the last N cycle windows (newest first) by stepping back 28 days / 1 month from the active cycle's start. Labels formatted `22 May – 18 Jun 2026`.

**New route** `src/routes/archive.tsx` (`/archive`):
- Dropdown of recent cycles (default 12, "Load older" button adds 12 more).
- Picking a cycle shows the same KPI cards as the dashboard (Spent, Income, Saved, Items, Left to spend) plus:
  - Category breakdown pie (reusing `CHART_COLORS`, see §3 below).
  - Top retailers list.
  - Commitments due in that window with their paid/unpaid state at the time (derived from `last_paid` history we already have).
  - Transactions list with a Receipt button (reuses signed-URL helper from dashboard alerts).
- Read-only — no edits from this view; "Edit in History" links jump to `/history` filtered to the cycle.

**Nav**: add an "Archive" link to `src/components/AppLayout.tsx`.

## 2. Local-date default on date pickers (UTC drift fix)

Today the new-transaction / new-income / new-saving forms seed the date input with `new Date().toISOString().slice(0, 10)`, which is UTC. In UK time after midnight UTC (or any positive-offset zone in summer) this picks tomorrow / yesterday.

**New helper** `todayLocalISO()` in `src/lib/format.ts`:
```ts
export function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
```

Swap the call sites:
- `src/routes/new.tsx:47`
- `src/routes/income.tsx:70`
- `src/routes/savings.tsx:41`
- `src/routes/income.tsx:37,43` (cycle baseStart fallback)

Leaves the existing `<Input type="date">` UI untouched.

## 3. Pocket ↔ Category Pie color sync

Pull the hard-coded pie palette out of `src/routes/index.tsx` into a shared module so both views speak the same language.

**New module** `src/lib/colors.ts`:
- Exports `CHART_COLORS` (move the existing array verbatim).
- `colorForKey(key: string)` — deterministic hash → index into `CHART_COLORS`, so "Amazon Credit" always maps to the same swatch wherever it appears.

Updates:
- `src/routes/index.tsx` — import from `@/lib/colors`; switch the category pie / legend to `colorForKey(category)` instead of positional indexing, so a pocket of the same name lights up the same colour.
- `src/routes/savings.tsx` — render a small colour dot next to each pocket name (account header + deposit/withdraw rows) using `colorForKey(account)`.
- `src/routes/income.tsx` — in the destination-pocket dropdown and split rows, replace the generic wallet icon tint with the pocket's token colour for instant visual recognition.

No new colours introduced — purely re-using the existing palette so the same key produces the same swatch everywhere.

# Out of scope (still on the backlog, separate turn)

- Manual Carry-Over Prep
- Setup Wizard & Auth Polish

# Files touched
- new: `src/routes/archive.tsx`, `src/lib/colors.ts`
- edit: `src/lib/cycle.ts`, `src/lib/format.ts`, `src/components/AppLayout.tsx`, `src/routes/index.tsx`, `src/routes/new.tsx`, `src/routes/income.tsx`, `src/routes/savings.tsx`

No database changes required — archives read from existing transactions / incomes / savings filtered by date range.
