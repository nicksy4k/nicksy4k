import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getActiveCycle,
  previousCycleWindow,
  useCycleSettings,
  type ActiveCycle,
  type CycleSettings,
} from "@/lib/cycle";
import { mainExpensePortion } from "@/lib/format";

/**
 * Tag embedded in the notes column so we can positively identify a
 * carryover row and stay idempotent across devices.
 */
const CARRYOVER_SOURCE = "Carryover from previous cycle";
const AUTO_PREFIX = "Auto-generated carryover:";
function carryoverTag(prevStartISO: string): string {
  return `carryover:${prevStartISO}`;
}

interface TxRow {
  date: string;
  total_amount: number;
  payment_splits: { source: string; amount: number }[] | null;
  is_pending?: boolean | null;
}

interface IncomeRow {
  date: string;
  amount: number;
  notes: string | null;
}

interface SavingsRow {
  date: string;
  kind: "deposit" | "withdrawal";
  amount: number;
}

/**
 * Pure leftover maths for a cycle window: income − main-balance expenses −
 * net savings movement. Exported for tests.
 */
export function leftoverFromRows(
  txs: Pick<TxRow, "total_amount" | "payment_splits">[],
  incs: Pick<IncomeRow, "amount">[],
  savs: Pick<SavingsRow, "kind" | "amount">[],
): number {
  const expenses = txs.reduce(
    (s, t) =>
      s +
      mainExpensePortion({
        total_amount: t.total_amount,
        payment_splits: t.payment_splits ?? undefined,
      }),
    0,
  );
  const income = incs.reduce((s, i) => s + i.amount, 0);
  const savingsDelta = savs.reduce((s, e) => s + (e.kind === "deposit" ? e.amount : -e.amount), 0);
  return +(income - expenses - savingsDelta).toFixed(2);
}

/** True when an auto-generated carryover row has drifted from the truth. */
export function carryoverHasDrifted(current: number, recomputed: number): boolean {
  return Math.abs(current - recomputed) >= 0.005;
}

/** Only rows the app wrote itself may be silently corrected. */
export function isAutoCarryoverRow(row: { source?: string | null; notes?: string | null }): boolean {
  return row.source === CARRYOVER_SOURCE && !!row.notes && row.notes.startsWith(AUTO_PREFIX);
}

async function computePrevLeftover(uid: string, prev: ActiveCycle): Promise<number> {
  const [txRes, incRes, savRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("date,total_amount,payment_splits,is_pending")
      .eq("user_id", uid)
      .gte("date", prev.startISO)
      .lte("date", prev.endISO),
    supabase
      .from("incomes")
      .select("date,amount,notes")
      .eq("user_id", uid)
      .gte("date", prev.startISO)
      .lte("date", prev.endISO),
    supabase
      .from("savings")
      .select("date,kind,amount")
      .eq("user_id", uid)
      .gte("date", prev.startISO)
      .lte("date", prev.endISO),
  ]);
  return leftoverFromRows(
    (txRes.data ?? []) as unknown as TxRow[],
    (incRes.data ?? []) as unknown as IncomeRow[],
    (savRes.data ?? []) as unknown as SavingsRow[],
  );
}

export interface CarryoverResult {
  /** "inserted" — new row; "corrected" — stale amount fixed; "ok" — nothing to do. */
  action: "inserted" | "corrected" | "ok" | "skipped";
  amount: number;
  previous?: number;
  windowLabel?: string;
}

/**
 * Creates the current cycle's carryover row when missing, or reconciles an
 * existing auto-generated one whose amount has drifted (e.g. a past-cycle
 * purchase was later re-dated or its amount corrected).
 */
export async function syncCarryover(settings: CycleSettings): Promise<CarryoverResult> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { action: "skipped", amount: 0 };
  const uid = u.user.id;

  const prev = previousCycleWindow(settings);
  const current = getActiveCycle(settings);
  const windowLabel = `${prev.startISO} → ${prev.endISO}`;
  const notes = `Auto-generated ${carryoverTag(prev.startISO)} · from ${windowLabel}`;

  // Any auto-generated carryover already sitting inside the current window is
  // THE row for this cycle — one per cycle is the invariant.
  const { data: rows } = await supabase
    .from("incomes")
    .select("id,amount,notes,source")
    .eq("user_id", uid)
    .eq("source", CARRYOVER_SOURCE)
    .like("notes", `${AUTO_PREFIX}%`)
    .gte("date", current.startISO)
    .lte("date", current.endISO)
    .order("created_at", { ascending: true })
    .limit(1);

  const leftover = await computePrevLeftover(uid, prev);
  const existing = rows?.[0];

  if (existing) {
    if (!isAutoCarryoverRow(existing)) return { action: "skipped", amount: existing.amount };
    if (!carryoverHasDrifted(existing.amount, leftover)) {
      return { action: "ok", amount: existing.amount, windowLabel };
    }
    const { error } = await supabase
      .from("incomes")
      .update({ amount: leftover, notes })
      .eq("id", existing.id)
      .eq("user_id", uid);
    if (error) throw error;
    return { action: "corrected", amount: leftover, previous: existing.amount, windowLabel };
  }

  if (Math.abs(leftover) < 0.005) {
    return { action: "ok", amount: 0, windowLabel };
  }

  const { error } = await supabase.from("incomes").insert({
    user_id: uid,
    date: current.startISO,
    source: CARRYOVER_SOURCE,
    amount: leftover,
    category: "Other",
    notes,
  });
  if (error) throw error;

  return { action: "inserted", amount: leftover, windowLabel };
}

/**
 * Mount ONCE at app root. Creates the current cycle's carryover on advance and
 * keeps it in step with later edits to the previous cycle's entries.
 */
export function useCycleCarryover() {
  const { settings, update, isReady } = useCycleSettings();
  const qc = useQueryClient();
  const running = useRef(false);
  const ranForKey = useRef<string | null>(null);

  useEffect(() => {
    // Never mutate financial data from the local first-paint cache. Wait for
    // this account's authoritative settings so a stale anchor cannot create a
    // carryover for the wrong window after sign-in or an account switch.
    if (!isReady) return;
    if (!settings.carryoverEnabled) return;
    const prev = previousCycleWindow(settings);
    if (running.current) return;
    if (ranForKey.current === prev.startISO) return;
    running.current = true;
    ranForKey.current = prev.startISO;
    void syncCarryover(settings)
      .then((res) => {
        if (settings.lastCarryoverCycleKey !== prev.startISO) {
          update({ ...settings, lastCarryoverCycleKey: prev.startISO });
        }
        if (res.action === "inserted" || res.action === "corrected") {
          qc.invalidateQueries({ queryKey: ["incomes"] });
        }
      })
      .catch((err) => {
        console.error("Cycle carryover failed", err);
      })
      .finally(() => {
        running.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, settings.carryoverEnabled, settings.anchor, settings.type, settings.override]);
}

export const CARRYOVER_SOURCE_LABEL = CARRYOVER_SOURCE;
export function isCarryoverIncome(i: { source: string; notes?: string | null }): boolean {
  return i.source === CARRYOVER_SOURCE && !!i.notes && i.notes.includes("carryover:");
}
