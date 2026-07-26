## Problem
The Smart Cleanup wizard currently only lets you pick a single "master" via radio buttons — so in groups of 3+ similar entries you can't say "keep these two, hide these three."

## Change
Replace the radio-per-row model in `src/components/SmartCleanupDialog.tsx` with a per-row **Keep / Hide** toggle so each entry in a group is decided independently.

### UI per group
- Each row shows: name, usage count, and a two-state toggle (Keep ↔ Hide).
- Default: the most-used entry starts as **Keep**, all others start as **Hide** (preserves current one-click behavior for the common 2-item case).
- At least one row must remain **Keep**; toggling the last Keep off is blocked (button disabled + hint text).
- Replace the "Keep both — leave untouched" radio with a small **"Keep all in this group"** link/button that flips every row to Keep.
- Group header shows a live tally: "Keeping X · Hiding Y".

### Data model
Change `Decision` from `{ action: "keep" } | { action: "merge"; masterIndex }` to:
```
type Decision = { hide: Set<number> } // indices within group.names to hide
```
- "Keep all" = empty set.
- Apply step iterates all groups, collects each `group.names[i]` where `i ∈ hide`, dedupes across groups, and calls `onHide(name)` — same safety guarantees (only writes to `hidden_retailers` / `hidden_items`, never touches transactions/receipts).

### Footer
- Global counter switches from "N will be hidden" (master-based) to a true sum of every row marked Hide across all groups.
- Finish button label unchanged: `Finish · hide N`.

## Out of scope
- Similarity grouping logic (`src/lib/suggestionSimilarity.ts`) is untouched.
- No schema or Supabase changes.
- No changes to how suggestions are surfaced elsewhere.

## Verification
- Extend `src/lib/__tests__/suggestionSimilarity.test.ts`? Not needed — grouping is unchanged. Manual check: open Settings → Suggestions → Scan for duplicates on a 3+ group, verify independent toggles, "Keep all" link, and that Finish hides exactly the toggled-off rows.
