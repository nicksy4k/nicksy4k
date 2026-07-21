## Dropdown Consistency Pass

Goal: every dropdown across the app sorts data-driven options alphabetically, and shares a small set of UX polish patterns. Fixed semantic lists (e.g. cadence: Weekly → Monthly, deposit/withdrawal, standard/BNPL) keep their meaningful order — alphabetizing them would be worse.

### 1. Alphabetize data-driven option lists

Apply `[...list].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }))` (case-insensitive, natural number order) at the render site for:

- Categories — `src/routes/new.tsx` (already sorted, switch to shared helper), `src/routes/income.tsx` (2 spots, same), `src/routes/history.tsx` category multi-select, `src/routes/commitments.tsx` category select.
- Pockets — `src/routes/credit.tsx` (2 destination selects), `src/components/PaymentSplitEditor.tsx` (2 pocket selects), `src/components/RefundDialog.tsx` destination, `src/routes/income.tsx` pocket routing.
- Retailers / item-name Combobox suggestions in `src/routes/new.tsx` (`src/components/ui/combobox.tsx` consumers).
- History retailer filter (`src/routes/history.tsx` line 1169).

Add one helper `sortLabels()` in `src/lib/utils.ts` so every call site uses the same comparator.

### 2. Keep semantic order (do NOT alphabetize)

- Cadences: Weekly / Fortnightly / 4-weekly / Monthly (`income.tsx`, `PaymentSplitEditor.tsx`, `CycleSettingsCard.tsx`).
- Savings kind: Deposit / Withdrawal.
- Debt type: Standard / BNPL.
- Protection durations (`ProtectionFields`): time-ordered.
- Archive cycle list: newest-first date order.
- Destination selects that mix "Main balance" + pockets + "Other": pin Main first, sort pockets alphabetically between, keep Other/BNPL last.

### 3. Extra UX polish (applied where the list can grow)

Only for selects with dynamic/long lists (categories, pockets, retailers). Skip for 2–4 option static selects.

- **Searchable when long**: swap `<Select>` for a Shadcn `Popover` + `Command` combobox when the option count is > 8. Targets: category selects in `new.tsx`, `income.tsx`, `commitments.tsx`; retailer filter in `history.tsx`; destination pocket selects when the user has many pockets.
- **Empty state**: show a muted "No categories yet — add one in Settings" / "No pockets yet" row instead of an empty menu.
- **Inline "Add new…"** row where creation already exists (income pocket select already has this) — extend the same pattern to category selects in `new.tsx` and `commitments.tsx` so a missing category can be added without leaving the form.
- **Colour dots** next to pocket and category names in every dropdown, reusing `colorForKey` from `src/lib/colors.ts` (already done in `RefundDialog`; extend to `PaymentSplitEditor`, `credit.tsx`, `income.tsx`).
- **Selected badge** in the History category multi-select trigger stays as-is; add a "Select all / Clear" pair inside the popover for faster filtering.
- **Keyboard**: rely on Shadcn defaults (already good); ensure `autoFocus` on the search input when a Command combobox opens.
- **Truncation**: long pocket/retailer names get `truncate` + `title` tooltip inside `SelectItem` so the trigger never overflows on mobile.

### 4. Non-goals

- No schema or data migrations.
- No changes to how values are stored — purely presentation/sort order.
- Cadence, savings-kind, debt-type, protection-duration, archive-cycle selects are intentionally left in their existing order.

### 5. Verification

- `bunx vitest run` (no logic in tested helpers changes).
- Prettier on touched files.
- Spot-check: open New Transaction, Income, Commitments, History filters, Credit modals, Refund dialog, and Payment Split editor and confirm option order + colour dots + empty states.

### Open question

Do you want the searchable-combobox upgrade (item 3, bullet 1) included in this pass, or should I ship only the alphabetize + polish (dots, empty states, inline-add, truncation) now and keep search-in-dropdown for a follow-up?
