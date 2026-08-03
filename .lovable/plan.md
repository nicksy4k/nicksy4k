## Goal

Keep "Soft Blush" as the deep plum option and add a 5th preset: **Bubblegum Pink** (`.theme-bubblegum`) — a light, candy-pink surface theme with punchy hot-pink accents.

Note on files: this project doesn't have `src/components/ThemePickerCard.tsx` or `src/lib/theme.tsx`. The equivalents are `src/lib/preferences.ts` (theme registry + apply logic) and `src/components/PreferencesCards.tsx` (the picker UI, which renders from the registry automatically).

## 1. Theme registry — `src/lib/preferences.ts`

Add to the `THEMES` array after Blush:

```
id: "bubblegum"
name: "Bubblegum Pink"
blurb: "Bright candy pink — light, warm and unapologetic."
swatches: ["oklch(0.97 0.02 345)", "oklch(0.62 0.24 350)", "oklch(0.66 0.21 15)", "oklch(0.64 0.18 320)"]
```

`THEME_IDS`, the `coerce()` validator, and the Settings picker all derive from this array, so no other wiring is needed there.

Also update `applyThemeClass()`: `colorScheme` is currently `theme === "daylight" ? "light" : "dark"`. Change to a light-theme set so `bubblegum` also reports `light` (otherwise native form controls, scrollbars and autofill render dark on a light page).

## 2. CSS tokens — `src/styles.css`

New `.theme-bubblegum` block placed after `.theme-blush`, mirroring the full token list every theme defines (background/foreground, card, popover, primary, secondary, muted, accent, destructive, success, warning, joy, border, input, ring, chart-1..6, sidebar-*, glow-1/2, radius).

Proposed values (light surfaces, high-chroma pink accents):

```text
--background        oklch(0.98 0.015 345)   ~ #fdf2f8 candy white-pink
--card              oklch(1.00 0.006 345)   near-white with a pink cast
--foreground        oklch(0.26 0.08 345)    deep berry text (AA on both above)
--primary           oklch(0.62 0.24 350)    ~ #ec4899 hot pink
--primary-foreground oklch(0.99 0.01 345)   white on hot pink (AA at body size)
--secondary         oklch(0.94 0.035 345)
--muted             oklch(0.95 0.025 345)
--muted-foreground  oklch(0.48 0.08 345)    AA-passing secondary text
--accent            oklch(0.92 0.06 340)
--border            oklch(0.86 0.09 345)    visible bubblegum edges
--input             oklch(0.88 0.075 345)
--ring              oklch(0.62 0.24 350)    pink focus ring
--destructive       oklch(0.58 0.20 25)
--success           oklch(0.55 0.13 160)
--warning           oklch(0.70 0.14 75)
--joy               oklch(0.66 0.20 15)
charts              rotating pinks/rose/coral/violet/teal tuned for light bg
sidebar             slightly deeper pink (oklch(0.96 0.03 345)) with pink border
glow-1/2            low-alpha hot pink / coral
```

Contrast targets: body text ≥ 7:1 on background, muted text ≥ 4.5:1, white on `--primary` ≥ 4.5:1 (chosen lightness 0.62 keeps this true). Any token that fails gets its lightness nudged before shipping.

## 3. Verification

- Switch through all five presets in Settings → Personalise and screenshot the dashboard, Reports charts and sidebar under Bubblegum to check chart legibility on light surfaces.
- Confirm the pre-hydration theme bootstrap in `src/routes/__root.tsx` picks up the new class (it reads the cached theme id, so no change expected — will verify no flash of dark).

## 4. Changelog

Prepend a dated v2.9.x entry to `src/lib/changelog.ts` noting the new Bubblegum Pink preset.
