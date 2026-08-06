/**
 * Smart Cleanup similarity engine.
 *
 * Groups likely-duplicate suggestion strings (retailer names / item names)
 * using case-insensitive normalisation, plural collapsing, whole-word substring
 * containment, and small-edit-distance fuzzy matching.
 *
 * Pure functions only — safe to unit-test and safe to run in the browser.
 * This module never touches the database; callers decide what to do with the
 * groups (typically: keep the master, hide the rest via `hiddenSuggestions`).
 */

export type SimilarityKind = "retailer" | "item";

export interface DuplicateGroup {
  /** Names in this group, ordered by frequency (most-used first). */
  names: string[];
  /** Frequency count for each name in `names`, same order. */
  counts: number[];
}

const RETAILER_NOISE = new Set(["ltd", "limited", "the", "co", "inc", "plc"]);

function stripPunct(s: string): string {
  return s.replace(/[.,'"`!?()[\]{}:;/\\-]+/g, " ");
}

function singularise(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 3 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function normalise(raw: string, kind: SimilarityKind): string {
  const cleaned = stripPunct(raw.toLowerCase()).replace(/\s+/g, " ").trim();
  const tokens = cleaned.split(" ").filter(Boolean);
  const filtered = kind === "retailer" ? tokens.filter((t) => !RETAILER_NOISE.has(t)) : tokens;
  return filtered.map(singularise).join(" ");
}

/** Damerau–Levenshtein (bounded — good enough for short names). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const dp: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[al][bl];
}

function isWholeWordSubstring(shorter: string, longer: string): boolean {
  if (!shorter || shorter === longer) return false;
  const pattern = new RegExp(`(^|\\s)${shorter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
  return pattern.test(longer);
}

export function areSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (isWholeWordSubstring(shorter, longer)) return true;
  const len = Math.max(a.length, b.length);
  if (len < 4) return false;
  const d = editDistance(a, b);
  if (len >= 8) return d <= 2;
  return d <= 1;
}

/** Union-find helper. */
class DSU {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

/**
 * Find duplicate groups from a list of visible suggestion names.
 * `frequency` maps normalised names to their usage count; missing entries
 * default to 0.
 */
export function findDuplicateGroups(
  names: string[],
  kind: SimilarityKind,
  frequency: Map<string, number> = new Map(),
): DuplicateGroup[] {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  const norms = unique.map((n) => normalise(n, kind));

  const dsu = new DSU(unique.length);
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      if (areSimilar(norms[i], norms[j])) dsu.union(i, j);
    }
  }

  const buckets = new Map<number, number[]>();
  for (let i = 0; i < unique.length; i++) {
    const r = dsu.find(i);
    const bucket = buckets.get(r) ?? [];
    bucket.push(i);
    buckets.set(r, bucket);
  }

  const groups: DuplicateGroup[] = [];
  for (const idxs of buckets.values()) {
    if (idxs.length < 2) continue;
    const withCounts = idxs
      .map((i) => ({
        name: unique[i],
        count: frequency.get(norms[i]) ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    groups.push({
      names: withCounts.map((x) => x.name),
      counts: withCounts.map((x) => x.count),
    });
  }
  // Stable order: largest groups first, then by first name.
  groups.sort((a, b) => b.names.length - a.names.length || a.names[0].localeCompare(b.names[0]));
  return groups;
}

/** Build a normalised frequency map from a list of raw occurrences. */
export function buildFrequency(occurrences: string[], kind: SimilarityKind): Map<string, number> {
  const m = new Map<string, number>();
  for (const raw of occurrences) {
    const n = normalise(raw ?? "", kind);
    if (!n) continue;
    m.set(n, (m.get(n) ?? 0) + 1);
  }
  return m;
}
