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
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// Income Cycle Sync Engine
// A single, app-wide source of truth for the active financial cycle window.
// Persisted per-user in Supabase (`user_settings`) with a localStorage cache
// so the first paint has correct data before the network round-trip completes.
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

const CACHE_KEY = "ledgerly.cycle.v2";

export const DEFAULT_CYCLE: CycleSettings = {
  type: "monthly",
  anchor: format(new Date(), "yyyy-MM-dd"),
  override: null,
};

// ---------- local cache (first-paint fallback) ----------

function readCache(): CycleSettings {
  if (typeof window === "undefined") return DEFAULT_CYCLE;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
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

function writeCache(s: CycleSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(s));
}

function broadcast() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ledgerly:cycle-changed"));
}

// Legacy sync accessors — kept so any imperative caller still resolves
// a reasonable value. Prefer the hooks below for reactive reads.
export function loadCycleSettings(): CycleSettings {
  return readCache();
}

// ---------- DB sync ----------

type Row = {
  cycle_type: string;
  cycle_anchor: string;
  cycle_override_start: string | null;
  cycle_override_end: string | null;
};

function rowToSettings(r: Row): CycleSettings {
  return {
    type: r.cycle_type === "four-weekly" ? "four-weekly" : "monthly",
    anchor: r.cycle_anchor,
    override:
      r.cycle_override_start && r.cycle_override_end
        ? { startISO: r.cycle_override_start, endISO: r.cycle_override_end }
        : null,
  };
}

async function fetchRemote(): Promise<CycleSettings | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("user_settings")
    .select("cycle_type, cycle_anchor, cycle_override_start, cycle_override_end")
    .eq("user_id", uid)
    .maybeSingle();
  if (error || !data) return null;
  return rowToSettings(data as Row);
}

async function upsertRemote(s: CycleSettings): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;
  await supabase.from("user_settings").upsert(
    {
      user_id: uid,
      cycle_type: s.type,
      cycle_anchor: s.anchor,
      cycle_override_start: s.override?.startISO ?? null,
      cycle_override_end: s.override?.endISO ?? null,
    },
    { onConflict: "user_id" },
  );
}

// ---------- core calculation ----------

export interface ActiveCycle {
  startISO: string;
  endISO: string;
  start: Date;
  end: Date;
  isOverridden: boolean;
  type: CycleType;
}

function fmt(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function getActiveCycle(
  settings: CycleSettings,
  today: Date = new Date(),
): ActiveCycle {
  const t = startOfDay(today);

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
    const end = addDays(start, 27);
    return {
      startISO: fmt(start),
      endISO: fmt(end),
      start,
      end,
      isOverridden: false,
      type: settings.type,
    };
  }

  const anchorDom = anchor.getDate();
  const thisMonth = new Date(t.getFullYear(), t.getMonth(), 1);
  const clamp = (base: Date) =>
    setDate(base, Math.min(anchorDom, getDaysInMonth(base)));
  let start = clamp(thisMonth);
  if (t < start) {
    start = clamp(addMonths(thisMonth, -1));
  }
  const nextStart = clamp(addMonths(start, 1));
  const end = addDays(nextStart, -1);
  return {
    startISO: fmt(start),
    endISO: fmt(end),
    start,
    end,
    isOverridden: false,
    type: settings.type,
  };
}

export function isInCycle(dateISO: string, cycle: ActiveCycle): boolean {
  return dateISO >= cycle.startISO && dateISO <= cycle.endISO;
}

export function getCycleAt(
  settings: CycleSettings,
  dateISO: string,
): ActiveCycle {
  return getActiveCycle(settings, parseISO(dateISO));
}

export function listRecentCycles(
  settings: CycleSettings,
  count: number,
  today: Date = new Date(),
): ActiveCycle[] {
  const out: ActiveCycle[] = [];
  let cur = getActiveCycle(settings, today);
  out.push(cur);
  for (let i = 1; i < count; i++) {
    const prevDay = addDays(cur.start, -1);
    cur = getActiveCycle(settings, prevDay);
    out.push(cur);
  }
  return out;
}

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

export function advanceByCadence(
  dueISO: string,
  cadence: "weekly" | "fortnightly" | "four-weekly" | "monthly",
): string {
  const base = parseISO(dueISO);
  let next: Date;
  if (cadence === "weekly") next = addDays(base, 7);
  else if (cadence === "fortnightly") next = addDays(base, 14);
  else if (cadence === "four-weekly") next = addDays(base, 28);
  else next = addMonths(base, 1);
  return fmt(next);
}

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

// ---------- React hooks ----------

/**
 * Reactive access to the user's cycle settings.
 * - Initial state is hydrated from the localStorage cache (0-ms first paint).
 * - On mount, fetches the authoritative row from Supabase and reconciles.
 * - `update()` writes through to Supabase, updates the cache, and broadcasts.
 * - Auth changes (sign-in / sign-out) trigger a refetch.
 */
export function useCycleSettings() {
  const [settings, setSettings] = useState<CycleSettings>(() => readCache());

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const remote = await fetchRemote();
      if (cancelled) return;
      if (remote) {
        writeCache(remote);
        setSettings(remote);
        broadcast();
      } else {
        // No row yet — seed the remote with whatever we currently have so
        // future devices pick it up too. (No-op when signed out.)
        const cached = readCache();
        await upsertRemote(cached);
      }
    }

    refresh();

    const onCycleChanged = () => setSettings(readCache());
    window.addEventListener("ledgerly:cycle-changed", onCycleChanged);
    window.addEventListener("storage", onCycleChanged);

    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        refresh();
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener("ledgerly:cycle-changed", onCycleChanged);
      window.removeEventListener("storage", onCycleChanged);
      authSub.subscription.unsubscribe();
    };
  }, []);

  const update = (next: CycleSettings) => {
    writeCache(next);
    setSettings(next);
    broadcast();
    // Fire-and-forget; RLS + upsert guarantees single row per user.
    void upsertRemote(next);
  };

  return { settings, update };
}

export function useActiveCycle(): ActiveCycle {
  const { settings } = useCycleSettings();
  return getActiveCycle(settings);
}
