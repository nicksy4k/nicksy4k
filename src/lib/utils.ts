import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Case-insensitive, natural-number aware alphabetical comparator.
 * Use everywhere dropdown/menu options are rendered from dynamic data
 * (categories, pockets, retailers, item names) so ordering stays consistent
 * across the app.
 */
const labelCollator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

export function sortLabels<T extends string>(list: Iterable<T>): T[] {
  return Array.from(list).sort((a, b) => labelCollator.compare(a, b));
}

export function sortBy<T>(list: Iterable<T>, key: (item: T) => string): T[] {
  return Array.from(list).sort((a, b) => labelCollator.compare(key(a), key(b)));
}
