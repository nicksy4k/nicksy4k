import { useCallback, useMemo } from "react";
import { differenceInCalendarDays } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCycle, isInCycle, type ActiveCycle, type CycleType } from "@/lib/cycle";
import { useTransactions } from "@/lib/store";
import { mainExpensePortion } from "@/lib/format";

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  cycle_type: CycleType;
  created_at: string;
  updated_at: string;
}

export interface BudgetStatus {
  budget: Budget;
  spent: number;
  remaining: number;
  percent: number;
  /** Fraction of the cycle that has elapsed (0-1). */
  pace: number;
  /** Under 80% pace = ok, 80-100% = warning, over 100% = danger. */
  tone: "ok" | "warning" | "danger";
}

export function useBudgets() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    staleTime: 60_000,
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("budgets")
        .select("*")
        .order("category", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Budget[];
    },
  });

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ["budgets"] }), [qc]);

  const add = useCallback(
    async (b: Omit<Budget, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await (supabase as any).from("budgets").insert({
        user_id: u.user.id,
        category: b.category,
        amount: b.amount,
        cycle_type: b.cycle_type,
      });
      if (error) throw error;
      await invalidate();
    },
    [invalidate],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<Budget, "category" | "amount" | "cycle_type">>) => {
      const { error } = await (supabase as any).from("budgets").update(patch).eq("id", id);
      if (error) throw error;
      await invalidate();
    },
    [invalidate],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await (supabase as any).from("budgets").delete().eq("id", id);
      if (error) throw error;
      await invalidate();
    },
    [invalidate],
  );

  return { items: data ?? [], isLoading, add, update, remove };
}

/**
 * Aggregate main-balance spending per category for the active cycle.
 * BNPL portions are excluded via mainExpensePortion; pending transactions are skipped.
 */
export function categorySpendingInCycle(
  transactions: {
    date: string;
    is_pending?: boolean;
    total_amount: number;
    payment_splits?: { source: string; amount: number }[];
    items: { category: string; price: number; quantity?: number }[];
  }[],
  cycle: ActiveCycle,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.is_pending) continue;
    if (!isInCycle(t.date, cycle)) continue;
    const main = mainExpensePortion(t);
    const itemsSum = t.items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0) || 1;
    for (const i of t.items) {
      const share = (i.price * (i.quantity ?? 1)) / itemsSum;
      map.set(i.category, (map.get(i.category) ?? 0) + share * main);
    }
  }
  return map;
}

/** Compute budget status for every budget, plus elapsed-cycle pace. */
export function computeBudgetStatuses(
  budgets: Budget[],
  spending: Map<string, number>,
  cycle: ActiveCycle,
): BudgetStatus[] {
  const totalDays = Math.max(1, differenceInCalendarDays(cycle.end, cycle.start) + 1);
  const elapsedDays = Math.max(0, differenceInCalendarDays(new Date(), cycle.start) + 1);
  const pace = Math.min(1, elapsedDays / totalDays);

  return budgets.map((b) => {
    const spent = +(spending.get(b.category) ?? 0).toFixed(2);
    const remaining = +(b.amount - spent).toFixed(2);
    const percent = b.amount > 0 ? spent / b.amount : 0;
    const tone: BudgetStatus["tone"] =
      percent >= 1 ? "danger" : percent >= 0.8 || percent > pace + 0.1 ? "warning" : "ok";
    return { budget: b, spent, remaining, percent, pace, tone };
  });
}

/**
 * Convenience hook that returns budget statuses for the active cycle,
 * plus the list of unbudgeted categories with spend this cycle.
 */
export function useBudgetStatuses() {
  const { items: budgets, isLoading: budgetsLoading } = useBudgets();
  const { items: transactions, isLoading: transactionsLoading } = useTransactions();
  const cycle = useActiveCycle();

  const spending = useMemo(
    () => categorySpendingInCycle(transactions, cycle),
    [transactions, cycle],
  );

  const statuses = useMemo(
    () => computeBudgetStatuses(budgets, spending, cycle),
    [budgets, spending, cycle],
  );

  const unbudgeted = useMemo(() => {
    const budgeted = new Set(budgets.map((b) => b.category));
    return Array.from(spending.entries())
      .filter(([cat]) => !budgeted.has(cat))
      .map(([category, spent]) => ({ category, spent }))
      .sort((a, b) => b.spent - a.spent);
  }, [budgets, spending]);

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = statuses.reduce((s, st) => s + st.spent, 0);

  return {
    statuses,
    unbudgeted,
    isLoading: budgetsLoading || transactionsLoading,
    totalBudgeted,
    totalSpent,
    totalRemaining: totalBudgeted - totalSpent,
  };
}
