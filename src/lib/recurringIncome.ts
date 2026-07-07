import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RecurringIncome } from "@/lib/types";
import { advanceByCadence } from "@/lib/cycle";
import { todayLocalISO } from "@/lib/format";

const STORAGE_KEY = "ledgerly.recurringIncome.lastRunISO";

/**
 * MASTER recurring-income generator. Mount ONCE at the app root.
 *
 * For every active template whose `next_date <= today`, inserts an income
 * row on that date and advances `next_date` in cadence-sized steps until
 * it lands strictly after today. Runs at most once per calendar day per
 * device.
 */
export function useRecurringIncomeGenerator() {
  const qc = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const today = todayLocalISO();
    const last = localStorage.getItem(STORAGE_KEY);
    if (last === today) return;
    if (running.current) return;
    running.current = true;

    void generateDueRecurringIncomes(today)
      .then((created) => {
        localStorage.setItem(STORAGE_KEY, today);
        if (created > 0) {
          qc.invalidateQueries({ queryKey: ["incomes"] });
          qc.invalidateQueries({ queryKey: ["recurring_incomes"] });
        }
      })
      .catch((err) => {
        console.error("Recurring income generation failed", err);
      })
      .finally(() => {
        running.current = false;
      });
  }, [qc]);
}

export async function generateDueRecurringIncomes(today: string): Promise<number> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 0;

  const { data, error } = await supabase
    .from("recurring_incomes")
    .select("*")
    .eq("user_id", u.user.id)
    .eq("active", true)
    .lte("next_date", today);
  if (error) throw error;

  const rows = (data ?? []) as unknown as RecurringIncome[];
  let created = 0;

  for (const r of rows) {
    let cursor = r.next_date;
    const inserts: Array<{ date: string }> = [];
    let guard = 0;
    while (cursor <= today && guard < 240) {
      inserts.push({ date: cursor });
      cursor = advanceByCadence(cursor, r.cadence);
      guard++;
    }
    if (inserts.length === 0) continue;

    const payload = inserts.map((i) => ({
      user_id: u.user!.id,
      date: i.date,
      source: r.source,
      amount: r.amount,
      category: r.category || "Other",
      notes: r.notes ?? null,
    }));
    const { error: insErr } = await supabase.from("incomes").insert(payload);
    if (insErr) {
      console.error("Recurring income insert failed for", r.id, insErr);
      continue;
    }

    const { error: upErr } = await supabase
      .from("recurring_incomes")
      .update({ next_date: cursor, last_generated_date: today })
      .eq("id", r.id);
    if (upErr) console.error("Recurring income advance failed for", r.id, upErr);

    created += inserts.length;
  }

  return created;
}
