# Fix the £56.74 gap in "Left to spend"

## What I found

Your bank is right and the app is wrong by exactly £56.74 — and it is the Morrisons shop, as you suspected.

The new cycle started today (11 Sept). When it rolled over, the app wrote a "Carryover from previous cycle" income of **£105.05**. Recomputing that same window (14 Aug → 10 Sept) from your live data now gives **£161.79** — a difference of £56.74.

Why: at the moment the rollover ran (03:58 today), the Morrisons shop was still sitting in the old cycle at £56.74. It was afterwards moved to 11 Sept and corrected to £56.44. So that shop got subtracted twice — once frozen inside the carryover figure, and again in the new cycle.

Corrected carryover £161.79 gives:

```text
income 513.27 + 56.74  −  spending 76.39  −  savings 300.00  =  193.62
```

which is your real bank balance to the penny.

## The fix

**1. Correct today's carryover figure**

Update the 11 Sept "Carryover from previous cycle" entry from £105.05 to £161.79. "Left to spend" then reads £193.62.

**2. Stop it happening again — self-healing carryover**

Right now the carryover is written once and never revisited, so any later edit to a past-cycle entry (changing a date, fixing an amount, deleting a row) silently leaves the figure stale.

Change it so that on app load, when a carryover entry already exists for the current cycle, the app recomputes the previous cycle's leftover and quietly corrects the entry's amount if it has drifted. No duplicate rows are ever created, and manually-entered income is untouched — only rows the app auto-generated.

**3. Show the workings**

Add a small "Recalculate now" action to the cycle settings card so you can force the check yourself, and show the previous-cycle window and figure it used.

## Technical details

- One-off data correction to the `incomes` row `0e69ec1f-...` for user `32a96aba-...`: amount 105.05 → 161.79.
- `src/lib/carryover.ts`
  - Extract the existing-row lookup so it returns the row `id` and `amount`, not just existence.
  - When a tagged auto-generated row exists for the current cycle: recompute `computePrevLeftover` and, if it differs by more than half a penny, `update` that row's amount and refresh the notes suffix; invalidate the `incomes` query.
  - Keep `lastCarryoverCycleKey` as the "already inserted" marker, but no longer use it to skip the reconcile pass — the pass must run on every mount once `isReady` is true. Guard with the existing `running` ref so it fires once per mount.
  - Never touch rows whose notes lack the `Auto-generated carryover:` tag.
- `src/components/CycleSettingsCard.tsx` — add a "Recalculate carryover" button calling the exported reconcile function and toasting the resulting figure.
- Add unit coverage in `src/lib/__tests__/` for the drift-correction branch (stale row → corrected amount; manual row → untouched).
- Prepend a v3.4.1 entry to `src/lib/changelog.ts`.
