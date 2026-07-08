import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { RecurringIncome, RecurringIncomeAllocation } from "@/lib/types";
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
      .then(({ created, warnings }) => {
        localStorage.setItem(STORAGE_KEY, today);
        if (created > 0) {
          qc.invalidateQueries({ queryKey: ["incomes"] });
          qc.invalidateQueries({ queryKey: ["savings"] });
          qc.invalidateQueries({ queryKey: ["recurring_incomes"] });
        }
        warnings.forEach((w) => toast.warning(w));
      })
      .catch((err) => {
        console.error("Recurring income generation failed", err);
      })
      .finally(() => {
        running.current = false;
      });
  }, [qc]);
}

export interface GenerateResult {
  created: number;
  warnings: string[];
}

/** Back-compat: also returns just the count via .then when destructured. */
export async function generateDueRecurringIncomes(today: string): Promise<GenerateResult> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { created: 0, warnings: [] };
  const uid = u.user.id;

  const { data, error } = await supabase
    .from("recurring_incomes")
    .select("*")
    .eq("user_id", uid)
    .eq("active", true)
    .lte("next_date", today);
  if (error) throw error;

  const rows = (data ?? []) as unknown as RecurringIncome[];
  let created = 0;
  const warnings: string[] = [];

  for (const r of rows) {
    let cursor = r.next_date;
    const postDates: string[] = [];
    let guard = 0;
    while (cursor <= today && guard < 240) {
      postDates.push(cursor);
      cursor = advanceByCadence(cursor, r.cadence);
      guard++;
    }
    if (postDates.length === 0) continue;

    // Insert income rows.
    const payload = postDates.map((d) => ({
      user_id: uid,
      date: d,
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

    // Run pocket allocations for each post date.
    for (let i = 0; i < postDates.length; i++) {
      const postDate = postDates[i];
      const nextDate = i + 1 < postDates.length ? postDates[i + 1] : cursor;
      const w = await applyAllocations({
        userId: uid,
        template: r,
        postDate,
        nextDate,
      });
      warnings.push(...w);
    }

    const { error: upErr } = await supabase
      .from("recurring_incomes")
      .update({ next_date: cursor, last_generated_date: today })
      .eq("id", r.id);
    if (upErr) console.error("Recurring income advance failed for", r.id, upErr);

    created += postDates.length;
  }

  return { created, warnings };
}

interface ApplyArgs {
  userId: string;
  template: RecurringIncome;
  postDate: string;
  nextDate: string;
}

/**
 * Apply a template's pocket allocations to a single posted income.
 * Deposits into `savings` under each pocket name in configured order,
 * stopping when the income is depleted. Returns warning strings.
 */
export async function applyAllocations(args: ApplyArgs): Promise<string[]> {
  const { userId, template, postDate, nextDate } = args;
  const allocations = (template.allocations ?? []).slice().sort((a, b) => a.order - b.order);
  if (allocations.length === 0) return [];

  let remaining = template.amount;
  const deposits: Array<{ pocket: string; amount: number }> = [];
  let clipped = false;

  for (const a of allocations) {
    if (remaining <= 0.0001) {
      clipped = true;
      break;
    }
    let want = 0;
    if (a.kind === "cover_commitments") {
      want = await computeCoverAmount(userId, a.pocket, postDate, nextDate);
    } else {
      want = a.amount;
    }
    if (!(want > 0)) continue;
    const give = Math.min(want, remaining);
    if (give < want - 0.0001) clipped = true;
    if (give > 0) deposits.push({ pocket: a.pocket, amount: +give.toFixed(2) });
    remaining = +(remaining - give).toFixed(2);
  }

  if (deposits.length > 0) {
    const rows = deposits.map((d) => ({
      user_id: userId,
      date: postDate,
      kind: "deposit" as const,
      amount: d.amount,
      account: d.pocket,
      notes: `Auto-routed from ${template.source}`,
    }));
    const { error } = await supabase.from("savings").insert(rows);
    if (error) console.error("Allocation deposit failed", error);
  }

  const warnings: string[] = [];
  if (clipped) {
    warnings.push(`${template.source}: income wasn't enough to fully fund every pocket allocation.`);
  }
  return warnings;
}

async function computeCoverAmount(
  userId: string,
  pocket: string,
  from: string,
  to: string,
): Promise<number> {
  // Sum of unpaid commitments due in [from, to).
  const { data: commits, error } = await supabase
    .from("commitments")
    .select("amount,next_due_date,paid")
    .eq("user_id", userId)
    .eq("paid", false)
    .gte("next_due_date", from)
    .lt("next_due_date", to);
  if (error) {
    console.error("cover_commitments query failed", error);
    return 0;
  }
  const need = (commits ?? []).reduce((s, c) => s + Number(c.amount ?? 0), 0);

  // Current pocket balance (sum of savings rows for that account).
  const { data: sv } = await supabase
    .from("savings")
    .select("kind,amount")
    .eq("user_id", userId)
    .eq("account", pocket);
  const bal = (sv ?? []).reduce((s, r) => {
    const amt = Number(r.amount ?? 0);
    return s + (r.kind === "deposit" ? amt : -amt);
  }, 0);

  return Math.max(0, +(need - bal).toFixed(2));
}
