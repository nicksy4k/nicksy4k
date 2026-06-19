import { useEffect, useState } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  parseISO,
  setDate,
  startOfDay,
  getDaysInMonth,
} from "date-fns";

// ============================================================================
// Income Cycle Sync Engine
// A single, app-wide source of truth for the active financial cycle window.
// Persisted in localStorage and broadcast across the app via a tiny pub/sub.
// All date math uses local `yyyy-MM-dd` formatting — never `.toISOString()` —
// to avoid UTC timezone shifts that would mis-bucket transactions by a day.
// ============================================================================

export type CycleType = "four-weekly" | "monthly";

export interface CycleSettings {
  type: CycleType;
  /** Local YYYY-MM-DD anchor for both modes. */
  anchor: string;
  /** Optional manual override for the CURRENT cycle only. */
  override?: {
    startISO: string;
    endISO: string; // inclusive last day of cycle
  } | null;
}

const STORAGE_KEY = "ledgerly.cycle.v2";

export const DEFAULT_CYCLE: CycleSettings = {
  type: "monthly",
  anchor: format(new Date(), "yyyy-MM-dd"),
  override: null,
};

// ---------- persistence ----------

export function loadCycleSettings(): CycleSettings {
  if (typeof window === "undefined") return DEFAULT_CYCLE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CYCLE;
    const parsed = JSON.parse(raw) as Partial<CycleSettings>;
    return {
      type: parsed.type === "four-weekly" ? "four-weekly" : "monthly",
      anchor: parsed.anchor || DEFAULT_CYCLE.anchor,
      override: parsed.override ?? null,
    };
  } catch {
    return DEFAULT_CYCLE;
  }
}

export function saveCycleSettings(s: CycleSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("ledgerly:cycle-changed"));
}

// ---------- core calculation ----------

export interface ActiveCycle {
  /** Local YYYY-MM-DD inclusive start. */
  startISO: string;
  /** Local YYYY-MM-DD inclusive end. */
  endISO: string;
  /** JS Date at start of day (local). */
  start: Date;
  /** JS Date at start of day (local) for the inclusive end. */
  end: Date;
  isOverridden: boolean;
  type: CycleType;
}

function fmt(d: Date) {
  return format(d, "yyyy-MM-dd");
}

/**
 * Compute the cycle window containing `today` (defaults to now) based on
 * the chosen type + anchor. Manual override wins if today is inside it.
 */
export function getActiveCycle(
  settings: CycleSettings,
  today: Date = new Date(),
): ActiveCycle {
  const t = startOfDay(today);

  // Manual override (only valid if today sits inside it)
  if (settings.override) {
    const ovStart = startOfDay(parseISO(settings.override.startISO));
    const ovEnd = startOfDay(parseISO(settings.override.endISO));
    if (t >= ovStart && t <= ovEnd) {
      return {
        startISO: settings.override.startISO,
        endISO: settings.override.endISO,
        start: ovStart,
        end: ovEnd,
        isOverridden: true,
        type: settings.type,
      };
    }
  }

  const anchor = startOfDay(parseISO(settings.anchor));

  if (settings.type === "four-weekly") {
    const days = differenceInCalendarDays(t, anchor);
    const n = Math.floor(days / 28);
    const start = addDays(anchor, n * 28);
    const end = addDays(start, 27); // inclusive (28-day window)
    return {
      startISO: fmt(start),
      endISO: fmt(end),
      start,
      end,
      isOverridden: false,
      type: settings.type,
    };
  }

  // Monthly: cycle starts on the anchor's day-of-month.
  const anchorDom = anchor.getDate();
  // Candidate start = this month's anchor day (clamped to month length)
  const thisMonth = new Date(t.getFullYear(), t.getMonth(), 1);
  const clamp = (base: Date) =>
    setDate(base, Math.min(anchorDom, getDaysInMonth(base)));
  let start = clamp(thisMonth);
  if (t < start) {
    // Anchor day hasn't arrived this month yet → cycle started previous month
    start = clamp(addMonths(thisMonth, -1));
  }
  const nextStart = clamp(addMonths(start, 1));
  const end = addDays(nextStart, -1); // inclusive last day
  return {
    startISO: fmt(start),
    endISO: fmt(end),
    start,
    end,
    isOverridden: false,
    type: settings.type,
  };
}

/** True if an ISO date (YYYY-MM-DD) falls inside the cycle inclusive. */
export function isInCycle(dateISO: string, cycle: ActiveCycle): boolean {
  return dateISO >= cycle.startISO && dateISO <= cycle.endISO;
}

/**
 * Advance a due-date by exactly one cycle step. Accepts either an
 * `ActiveCycle` (uses its `type`) or an explicit `CycleType` so that
 * individual bills with a different frequency than the global engine
 * can still be rolled forward correctly.
 * Four-weekly → +28d, Monthly → +1 calendar month.
 * This is the ONLY place rollover math lives.
 */
export function advanceDueDate(
  dueISO: string,
  cycleOrType: ActiveCycle | CycleType,
): string {
  const type: CycleType =
    typeof cycleOrType === "string" ? cycleOrType : cycleOrType.type;
  const base = parseISO(dueISO);
  const next = type === "four-weekly" ? addDays(base, 28) : addMonths(base, 1);
  return fmt(next);
}

/**
 * Roll a due date forward in cycle-sized steps until it lands on or after
 * the target ISO date. Handles bills that have been missed for several cycles.
 */
export function rollDueDateForward(
  dueISO: string,
  targetISO: string,
  cycle: ActiveCycle,
): string {
  let cur = dueISO;
  let guard = 0;
  while (cur < targetISO && guard < 240) {
    cur = advanceDueDate(cur, cycle);
    guard++;
  }
  return cur;
}

// ---------- React hook ----------

export function useCycleSettings() {
  const [settings, setSettings] = useState<CycleSettings>(() =>
    loadCycleSettings(),
  );

  useEffect(() => {
    const sync = () => setSettings(loadCycleSettings());
    window.addEventListener("ledgerly:cycle-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ledgerly:cycle-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = (next: CycleSettings) => {
    saveCycleSettings(next);
    setSettings(next);
  };

  return { settings, update };
}

export function useActiveCycle(): ActiveCycle {
  const { settings } = useCycleSettings();
  return getActiveCycle(settings);
}
