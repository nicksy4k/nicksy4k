// Server-side cycle helpers for MCP tools. Mirrors the logic in
// src/lib/cycle.ts (getActiveCycle) without pulling in the React hooks or the
// browser Supabase client. Reads user_settings via the user-scoped MCP
// Supabase client so RLS applies.
import type { ToolContext } from "@lovable.dev/mcp-js";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  parseISO,
  setDate,
  startOfDay,
} from "date-fns";
import { supabaseForUser } from "./supabase";

export type CycleType = "four-weekly" | "monthly";

export interface CycleSettings {
  type: CycleType;
  anchor: string;
  override: { startISO: string; endISO: string } | null;
  carryoverEnabled: boolean;
}

export interface ActiveCycle {
  type: CycleType;
  startISO: string;
  endISO: string;
  isOverridden: boolean;
  anchor: string;
  carryoverEnabled: boolean;
}

function fmtDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export async function loadCycleSettings(ctx: ToolContext): Promise<CycleSettings> {
  const sb = supabaseForUser(ctx);
  const { data } = await sb
    .from("user_settings")
    .select("cycle_type, cycle_anchor, cycle_override_start, cycle_override_end, carryover_enabled")
    .eq("user_id", ctx.getUserId()!)
    .maybeSingle();
  const today = fmtDate(new Date());
  if (!data) {
    return { type: "monthly", anchor: today, override: null, carryoverEnabled: true };
  }
  return {
    type: data.cycle_type === "four-weekly" ? "four-weekly" : "monthly",
    anchor: data.cycle_anchor ?? today,
    override:
      data.cycle_override_start && data.cycle_override_end
        ? { startISO: data.cycle_override_start, endISO: data.cycle_override_end }
        : null,
    carryoverEnabled: data.carryover_enabled ?? true,
  };
}

export function computeActiveCycle(settings: CycleSettings, today: Date = new Date()): ActiveCycle {
  const t = startOfDay(today);

  if (settings.override) {
    const ovStart = startOfDay(parseISO(settings.override.startISO));
    const ovEnd = startOfDay(parseISO(settings.override.endISO));
    if (t >= ovStart && t <= ovEnd) {
      return {
        type: settings.type,
        startISO: settings.override.startISO,
        endISO: settings.override.endISO,
        isOverridden: true,
        anchor: settings.anchor,
        carryoverEnabled: settings.carryoverEnabled,
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
      type: settings.type,
      startISO: fmtDate(start),
      endISO: fmtDate(end),
      isOverridden: false,
      anchor: settings.anchor,
      carryoverEnabled: settings.carryoverEnabled,
    };
  }

  const anchorDom = anchor.getDate();
  const thisMonth = new Date(t.getFullYear(), t.getMonth(), 1);
  const clamp = (base: Date) => setDate(base, Math.min(anchorDom, getDaysInMonth(base)));
  let start = clamp(thisMonth);
  if (t < start) start = clamp(addMonths(thisMonth, -1));
  const nextStart = clamp(addMonths(start, 1));
  const end = addDays(nextStart, -1);
  return {
    type: settings.type,
    startISO: fmtDate(start),
    endISO: fmtDate(end),
    isOverridden: false,
    anchor: settings.anchor,
    carryoverEnabled: settings.carryoverEnabled,
  };
}
