import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
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
  const txs = (txRes.data ?? []) as unknown as TxRow[];
  const incs = (incRes.data ?? []) as unknown as IncomeRow[];
  const savs = (savRes.data ?? []) as unknown as SavingsRow[];

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
  const savingsDelta = savs.reduce(
    (s, e) => s + (e.kind === "deposit" ? e.amount : -e.amount),
    0,
  );
  return +(income - expenses - savingsDelta).toFixed(2);
}

async function runCarryover(settings: CycleSettings): Promise<{ inserted: boolean; amount: number } | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const uid = u.user.id;

  const prev = previousCycleWindow(settings);
  const key = prev.startISO;

  // Already carried this cycle over on any device.
  if (settings.lastCarryoverCycleKey === key) return null;

  // Cross-device idempotency: check for an existing tagged income row.
  const tag = carryoverTag(key);
  const { data: existing } = await supabase
    .from("incomes")
    .select("id,notes")
    .eq("user_id", uid)
    .eq("source", CARRYOVER_SOURCE)
    .like("notes", `%${tag}%`)
    .limit(1);
  if (existing && existing.length > 0) {
    return { inserted: false, amount: 0 };
  }

  const leftover = await computePrevLeftover(uid, prev);
  if (Math.abs(leftover) < 0.005) {
    return { inserted: false, amount: 0 };
  }

  // Post to the first day of the CURRENT cycle so it counts toward the new window.
  // Compute current cycle start via the same helper by importing lazily.
  const { getActiveCycle } = await import("@/lib/cycle");
  const current = getActiveCycle(settings);

  const { error } = await supabase.from("incomes").insert({
    user_id: uid,
    date: current.startISO,
    source: CARRYOVER_SOURCE,
    amount: leftover,
    category: "Other",
    notes: `Auto-generated ${tag} · from ${prev.startISO} → ${prev.endISO}`,
  });
  if (error) throw error;

  return { inserted: true, amount: leftover };
}

/**
 * Mount ONCE at app root. Runs on cycle advance to carry the previous cycle's
 * leftover (positive or negative) into the current cycle as an income row.
 */
export function useCycleCarryover() {
  const { settings, update } = useCycleSettings();
  const qc = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    if (!settings.carryoverEnabled) return;
    const prev = previousCycleWindow(settings);
    if (settings.lastCarryoverCycleKey === prev.startISO) return;
    if (running.current) return;
    running.current = true;
    void runCarryover(settings)
      .then((res) => {
        // Advance the key regardless of insert so we don't re-check every mount.
        update({ ...settings, lastCarryoverCycleKey: prev.startISO });
        if (res?.inserted) {
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
  }, [settings.carryoverEnabled, settings.lastCarryoverCycleKey, settings.anchor, settings.type]);
}

export const CARRYOVER_SOURCE_LABEL = CARRYOVER_SOURCE;
export function isCarryoverIncome(i: { source: string; notes?: string | null }): boolean {
  return i.source === CARRYOVER_SOURCE && !!i.notes && i.notes.includes("carryover:");
}
