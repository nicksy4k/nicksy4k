## What I found

**1. Blush theme is muted by design.** In `src/styles.css`, `.theme-blush` uses very low chroma: `--primary: oklch(0.70 0.13 350)`, backgrounds at chroma 0.022–0.03, borders 0.03. That's a dusty plum, not bubblegum.

**2. The joy roll-up was never actually applied to the chart.** In `src/routes/index.tsx`:
- `byCategory` (lines 116–128) is built from all item categories with no reference to `prefs.joyCategories`.
- `joySpend` (lines 132–138) *sums* joy categories, but it's only used for the one-line "including X of planned fun" note under Left to spend. The joy categories are still listed individually in both the pie and the legend list — so selecting them appears to do nothing.
- `prefs.hideCategoryChart` is only respected on the dashboard (line 266). The `/reports` page renders its own pie + breakdown with no preference check, so toggling "hide the category breakdown chart" leaves the Reports chart fully visible. This is most likely the "toggle doesn't hide anything" symptom.

So: not a re-render/state bug — the preference is read correctly, it just isn't wired into the chart data or into Reports.

## Proposed colour values (`.theme-blush`)

Rich hot-pink hue ~348, higher chroma, pink-tinted surfaces, all text kept at high contrast:

```text
--background        oklch(0.17 0.045 345)   deep pink-black
--card / --popover  oklch(0.22 0.055 345)
--foreground        oklch(0.97 0.015 345)
--primary           oklch(0.72 0.24 350)    vivid bubblegum
--primary-foreground oklch(0.16 0.05 350)
--secondary         oklch(0.30 0.075 345)
--muted             oklch(0.28 0.06 345)
--muted-foreground  oklch(0.79 0.055 345)
--accent            oklch(0.38 0.11 345)
--border            oklch(0.42 0.10 345)    clearly pink edges
--input             oklch(0.32 0.08 345)
--ring              oklch(0.74 0.22 350)
--joy               oklch(0.80 0.17 15)
--chart-1..6        0.74/0.20/350, 0.78/0.17/15, 0.72/0.17/320, 0.80/0.14/60, 0.74/0.13/200, 0.78/0.13/290
--sidebar           oklch(0.15 0.045 345), sidebar-accent oklch(0.26 0.07 345), sidebar-border oklch(0.34 0.08 345)
--glow-1/2          pink glows at ~0.16 / 0.10 alpha
```

Contrast check: foreground on background ≈ 14:1, muted-foreground on card ≈ 6.5:1, dark `--primary-foreground` on the vivid primary ≈ 8:1 — all comfortably above AA.

## Fixes

**`src/routes/index.tsx`**
- Split `byCategory` into `chartCategories` (non-joy) plus a single synthetic `"Planned fun"` slice carrying `joySpend`, appended and colour-keyed to `var(--joy)`. Pie, legend list and tooltip all consume the rolled-up array, so selecting joy categories visibly collapses them into one friendly slice.
- Keep the existing "including X of planned fun" copy.

**`src/routes/reports.tsx`**
- Read `usePreferences()`; apply the same joy roll-up to its category data, and render the "Chart hidden — turn it back on in Settings → Personalise" placeholder when `hideCategoryChart` is on (KPIs and totals stay visible).

**`src/styles.css`** — replace the `.theme-blush` token block with the values above.

**`src/lib/changelog.ts`** — prepend a v2.9.1 entry (vivid blush theme, joy roll-up now applies to charts, chart-hide respected on Reports).

## Notes
- No database or preference-store changes needed; `joy_categories` / `hide_category_chart` already persist and hydrate correctly.
- Joy matching stays case-insensitive so renamed/re-cased categories still match.
