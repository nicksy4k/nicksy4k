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

/**
 * Convenience wrapper for one-off manual posts (e.g. "Post now" button)
 * that don't have a batch run's shared caches available. Loads fresh
 * commitment + pocket balance data, then applies allocations for a single
 * post date.
 */
export async function applyAllocationsOnce(
  userId: string,
  template: RecurringIncome,
  postDate: string,
  nextDate: string,
): Promise<string[]> {
  const { commitments, pocketBalances } = await loadRunCaches(userId);
  return applyAllocations({
    userId,
    template,
    postDate,
    nextDate,
    inFlight: new Map(),
    commitments,
    pocketBalances,
  });
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
  if (rows.length === 0) return { created, warnings };

  // Load commitments + pocket balances ONCE for the whole run; track
  // in-flight deposits per pocket across all templates/postDates.
  const { commitments, pocketBalances } = await loadRunCaches(uid);
  const inFlight = new Map<string, number>();

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
    const { data: inserted, error: insErr } = await supabase
      .from("incomes")
      .insert(payload)
      .select("id");
    if (insErr) {
      console.error("Recurring income insert failed for", r.id, insErr);
      continue;
    }
    const insertedIds = (inserted ?? []).map((row: { id: string }) => row.id);

    // Run pocket allocations for each post date.
    for (let i = 0; i < postDates.length; i++) {
      const postDate = postDates[i];
      const nextDate = i + 1 < postDates.length ? postDates[i + 1] : cursor;
      const w = await applyAllocations({
        userId: uid,
        template: r,
        postDate,
        nextDate,
        inFlight,
        commitments,
        pocketBalances,
      });
      warnings.push(...w);
    }

    const { error: upErr } = await supabase
      .from("recurring_incomes")
      .update({ next_date: cursor, last_generated_date: today })
      .eq("id", r.id);
    if (upErr) {
      // Advancing the template failed — roll back the incomes we just
      // inserted so the next run doesn't double-post them, then throw so
      // the outer daily guard is NOT set to today.
      console.error("Recurring income advance failed for", r.id, upErr);
      if (insertedIds.length > 0) {
        await supabase.from("incomes").delete().in("id", insertedIds);
      }
      throw upErr;
    }

    created += postDates.length;
  }

  return { created, warnings };
}


interface ApplyArgs {
  userId: string;
  template: RecurringIncome;
  postDate: string;
  nextDate: string;
  /**
   * Shared per-run cache of already-scheduled pocket deposits (across ALL
   * templates and postDates processed in this run). Keyed by pocket name.
   * `cover_commitments` subtracts these from the counted balance so a
   * second template funding the same pocket doesn't see stale data and
   * under-fund.
   */
  inFlight: Map<string, number>;
  /**
   * Shared per-run cache of unpaid commitments (fetched once). Filtered
   * per postDate window at call time.
   */
  commitments: Array<{ amount: number; next_due_date: string | null }>;
  /**
   * Shared per-run cache of persisted savings balances by pocket name.
   * Populated once at the start of the run and treated as immutable —
   * in-flight deposits from THIS run are tracked separately in `inFlight`.
   */
  pocketBalances: Map<string, number>;
}

/**
 * Apply a template's pocket allocations to a single posted income.
 * Deposits into `savings` under each pocket name in configured order,
 * stopping when the income is depleted. Returns warning strings.
 */
export async function applyAllocations(args: ApplyArgs): Promise<string[]> {
  const { userId, template, postDate, nextDate, inFlight, commitments, pocketBalances } = args;
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
      want = computeCoverAmount(a.pocket, postDate, nextDate, commitments, pocketBalances, inFlight);
    } else {
      want = a.amount;
    }
    if (!(want > 0)) continue;
    const give = Math.min(want, remaining);
    if (give < want - 0.0001) clipped = true;
    if (give > 0) {
      deposits.push({ pocket: a.pocket, amount: +give.toFixed(2) });
      inFlight.set(a.pocket, (inFlight.get(a.pocket) ?? 0) + give);
    }
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

export function computeCoverAmount(
  pocket: string,
  from: string,
  to: string,
  commitments: Array<{ amount: number; next_due_date: string | null }>,
  pocketBalances: Map<string, number>,
  inFlight: Map<string, number>,
): number {
  const need = commitments.reduce((s, c) => {
    const d = c.next_due_date;
    if (!d) return s;
    if (d >= from && d < to) return s + Number(c.amount ?? 0);
    return s;
  }, 0);
  const bal = (pocketBalances.get(pocket) ?? 0) + (inFlight.get(pocket) ?? 0);
  return Math.max(0, +(need - bal).toFixed(2));
}

/**
 * Fetch commitments + pocket balances once for the whole generation run.
 */
async function loadRunCaches(userId: string) {
  const [{ data: commits }, { data: sv }] = await Promise.all([
    supabase
      .from("commitments")
      .select("amount,next_due_date,paid")
      .eq("user_id", userId)
      .eq("paid", false),
    supabase
      .from("savings")
      .select("kind,amount,account")
      .eq("user_id", userId),
  ]);
  const commitments = (commits ?? []).map((c) => ({
    amount: Number(c.amount ?? 0),
    next_due_date: c.next_due_date as string | null,
  }));
  const pocketBalances = new Map<string, number>();
  for (const r of sv ?? []) {
    const amt = Number(r.amount ?? 0);
    const delta = r.kind === "deposit" ? amt : -amt;
    pocketBalances.set(r.account, (pocketBalances.get(r.account) ?? 0) + delta);
  }
  return { commitments, pocketBalances };
}
