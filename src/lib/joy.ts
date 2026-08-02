// "Planned fun" roll-up. Categories a user flags as joy spending are collapsed
// into a single friendly slice instead of being singled out in charts and lists.

export const JOY_SLICE = "Planned fun";
export const JOY_COLOR = "var(--joy)";

export interface CategorySlice {
  name: string;
  value: number;
}

/**
 * Collapses every joy-flagged category into one `Planned fun` slice appended at
 * the end. Matching is case-insensitive so re-cased categories still match.
 */
export function rollUpJoy<T extends CategorySlice>(
  slices: T[],
  joyCategories: string[],
): CategorySlice[] {
  const joy = new Set(joyCategories.map((c) => c.trim().toLowerCase()).filter(Boolean));
  if (joy.size === 0) return slices;

  const rest: CategorySlice[] = [];
  let joyTotal = 0;
  for (const s of slices) {
    if (joy.has(s.name.trim().toLowerCase())) joyTotal += s.value;
    else rest.push({ name: s.name, value: s.value });
  }
  if (joyTotal <= 0) return rest;
  return [...rest, { name: JOY_SLICE, value: Math.round(joyTotal * 100) / 100 }];
}

/** Chart colour for a slice, honouring the joy accent for the rolled-up slice. */
export function sliceColor(name: string, fallback: (key: string) => string): string {
  return name === JOY_SLICE ? JOY_COLOR : fallback(name);
}
