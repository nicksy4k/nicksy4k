# Smart Cleanup for Suggestions

Add a "Scan for Duplicates" tool to Settings → Suggestions that groups similar retailer / item names and lets the user pick a Master to keep and hide the rest — using the existing `hiddenSuggestions` mechanism, which never touches transactions.

## Database safety (how it's guaranteed)

Suggestions are already derived from historical `transactions.retailer` and `transactions.items[].item_name`. "Removing" a suggestion today = adding the string to `user_settings.hidden_retailers` / `hidden_items` so it stops appearing in comboboxes. This tool reuses that exact mechanism — it only writes to `user_settings`. No update, delete, or migration touches `transactions`, `receipts`, storage, or any historical row. Receipts and past line items remain byte-for-byte unchanged; the master name shown in old rows is whatever was originally recorded.

Copy in the dialog will make this explicit: "Hides duplicates from future dropdowns. Past transactions and receipts are never modified."

## New files

- `src/lib/suggestionSimilarity.ts` — pure grouping logic + unit-testable.
- `src/components/SmartCleanupDialog.tsx` — the wizard UI.
- `src/lib/__tests__/suggestionSimilarity.test.ts` — cases for the matcher.

## Grouping algorithm (`suggestionSimilarity.ts`)

Input: `string[]` (the visible catalog for retailers or items). Output: `Group[]` where each group has 2+ related names.

Normalisation for comparison only (display keeps the original casing):
- lowercase, trim
- collapse whitespace
- strip trailing punctuation
- singularise a trailing `s`/`es` (naive rule: `energies → energy`, `cans → can`)
- strip common noise tokens for retailers only: `ltd`, `limited`, `the`

Grouping rules — union-find over pairs that satisfy ANY of:
1. Normalised strings equal (pure case / whitespace / plural dupes).
2. One normalised string is a whole-word substring of the other (`monster` ⊂ `monster energy`).
3. Damerau–Levenshtein distance ≤ 1 for len ≥ 4, or ≤ 2 for len ≥ 8 (catches `tesco`/`tescos`, `sainsburys`/`sainsbury`, single-typo pairs).

Order each group by frequency in the source data (most-used first) so the default "suggested master" is the most-used spelling. Skip singletons.

## Wizard UI (`SmartCleanupDialog.tsx`)

Trigger: a "Scan for duplicates" button added at the top of both `SuggestionManager` cards in `src/routes/settings.tsx` (one for retailers, one for items). Each card owns its own dialog scoped to its catalog + hide callbacks.

Dialog layout:
- Header: "Smart Cleanup — Retailers" / "Items", with the safety note.
- If no groups: empty state ("No likely duplicates found").
- Otherwise: a stepper `Group X of N` with three actions per group:
  - **Keep both** (skip — no writes)
  - **Merge** — one item is selected as Master via radio; all others become "will be hidden". Frequency count shown next to each option to guide the choice.
  - **Back / Next** navigation, **Finish** on last group.
- Footer running tally: "N suggestions will be hidden."

Apply step: on Finish, call `hideRetailer` / `hideItem` for each non-master name across all merged groups. Toast summary. Groups marked "Keep both" do nothing.

Frequency counts come from a `Map<normalisedName, count>` computed from the same `transactions` array already available in `SettingsPage`, passed into the dialog.

## Wiring in `src/routes/settings.tsx`

- Compute per-catalog frequency maps alongside the existing `useSortedCatalog` result.
- Extend `SuggestionManager` props with `onScan: () => void` OR render the button + dialog inline in `SettingsPage` next to each `SuggestionManager` (simpler; keeps `SuggestionManager` unchanged).
- Filter the catalog passed to the scanner through `filterHidden` so already-hidden names aren't re-suggested.

## Out of scope

- No renaming of historical `transactions.retailer` / item names.
- No schema changes, no migrations, no edits to any table other than the existing `user_settings.hidden_retailers` / `hidden_items` arrays.
- No changes to the receipt storage bucket.

## Verification

- New unit tests cover: pluralisation, substring, whitespace/case, single-typo, "no false-positive across unrelated names".
- Manual pass: seed catalog like `["Monster", "Monster Energy", "Tesco", "Tescos", "Aldi"]` → groups `{Monster, Monster Energy}` and `{Tesco, Tescos}`, Aldi ignored.
- After merging: hidden badge appears in the existing "Hidden" section of the same card; the visible dropdown loses the merged entries; a past transaction using the hidden name still renders untouched on History.
