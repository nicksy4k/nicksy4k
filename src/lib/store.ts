import { useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Commitment,
  Debt,
  DebtItem,
  IncomeEntry,
  LedgerPayment,
  Loan,
  RecurringIncome,
  SavingsEntry,
  Transaction,
} from "./types";
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "./types";

// ===== Transactions =====
export function useTransactions() {
  const qc = useQueryClient();
  const { data } = useQuery({
    staleTime: 60_000,
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Transaction[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["transactions"] });

  const add = useCallback(
    async (t: Omit<Transaction, "id" | "created_at">) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("transactions").insert({
        user_id: u.user.id,
        date: t.date,
        retailer: t.retailer,
        total_amount: t.total_amount,
        receipt_attached: t.receipt_attached,
        receipt_type: t.receipt_type,
        receipt_location: t.receipt_location,
        notes: t.notes,
        items: t.items as never,
        commitment_id: t.commitment_id ?? null,
        protection_type: t.protection_type ?? null,
        protection_duration: t.protection_duration ?? null,
        expiration_date: t.expiration_date ?? null,
        dismissed_at: t.dismissed_at ?? null,
        payment_splits: (t.payment_splits ?? []) as never,
        is_pending: t.is_pending ?? false,
      } as never);
      if (error) throw error;
      await invalidate();
    },
    [qc],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<Transaction, "id" | "created_at">>) => {
      const clean: Record<string, unknown> = { ...patch };
      if (patch.items) clean.items = patch.items as never;
      const { error } = await supabase.from("transactions").update(clean as never).eq("id", id);
      if (error) throw error;
      await invalidate();
    },
    [qc],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("transactions").delete().eq("id", id);
      await invalidate();
    },
    [qc],
  );

  const dismiss = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("transactions")
        .update({ dismissed_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
      await invalidate();
    },
    [qc],
  );

  const clear = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("transactions").delete().eq("user_id", u.user.id);
    await invalidate();
  }, [qc]);

  return { items: data ?? [], add, update, remove, dismiss, clear };
}


// ===== Incomes =====
export function useIncomes() {
  const qc = useQueryClient();
  const { data } = useQuery({
    staleTime: 60_000,
    queryKey: ["incomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomes")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as IncomeEntry[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["incomes"] });

  const add = useCallback(async (i: Omit<IncomeEntry, "id" | "created_at">) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    const { error } = await supabase.from("incomes").insert({ ...i, user_id: u.user.id });
    if (error) throw error;
    await invalidate();
  }, [qc]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("incomes").delete().eq("id", id);
    await invalidate();
  }, [qc]);

  return { items: data ?? [], add, remove };
}

// ===== Recurring incomes =====
export function useRecurringIncomes() {
  const qc = useQueryClient();
  const { data } = useQuery({
    staleTime: 60_000,
    queryKey: ["recurring_incomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_incomes")
        .select("*")
        .order("next_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RecurringIncome[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["recurring_incomes"] });

  const add = useCallback(async (r: Omit<RecurringIncome, "id" | "created_at" | "updated_at">) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    const { error } = await supabase.from("recurring_incomes").insert({
      user_id: u.user.id,
      source: r.source,
      amount: r.amount,
      category: r.category,
      notes: r.notes ?? null,
      cadence: r.cadence,
      next_date: r.next_date,
      last_generated_date: r.last_generated_date ?? null,
      active: r.active,
      allocations: (r.allocations ?? []) as never,
    });
    if (error) throw error;
    await invalidate();
  }, [qc]);

  const update = useCallback(async (id: string, patch: Partial<Omit<RecurringIncome, "id" | "created_at" | "updated_at">>) => {
    const clean: Record<string, unknown> = { ...patch };
    if (patch.allocations !== undefined) clean.allocations = patch.allocations as never;
    const { error } = await supabase.from("recurring_incomes").update(clean as never).eq("id", id);
    if (error) throw error;
    await invalidate();
  }, [qc]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("recurring_incomes").delete().eq("id", id);
    await invalidate();
  }, [qc]);

  return { items: data ?? [], add, update, remove };
}

// ===== Savings =====
export function useSavings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    staleTime: 60_000,
    queryKey: ["savings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SavingsEntry[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["savings"] });

  const add = useCallback(async (s: Omit<SavingsEntry, "id" | "created_at">) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    const { error } = await supabase.from("savings").insert({ ...s, user_id: u.user.id });
    if (error) throw error;
    await invalidate();
  }, [qc]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("savings").delete().eq("id", id);
    await invalidate();
  }, [qc]);

  return { items: data ?? [], add, remove };
}

// ===== Categories =====
function useCategoryList(kind: "expense" | "income", defaults: string[]) {
  const qc = useQueryClient();
  const queryKey = ["categories", kind];

  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("name")
        .eq("kind", kind)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: { name: string }) => r.name);
    },
  });

  // Seed defaults the first time a user has none.
  useEffect(() => {
    if (data && data.length === 0) {
      (async () => {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const rows = defaults.map((name) => ({ user_id: u.user!.id, kind, name }));
        await supabase.from("categories").insert(rows);
        qc.invalidateQueries({ queryKey });
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const add = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("categories").insert({ user_id: u.user.id, kind, name: trimmed });
    await invalidate();
  }, [qc, kind]);

  const remove = useCallback(async (name: string) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase
      .from("categories")
      .delete()
      .eq("user_id", u.user.id)
      .eq("kind", kind)
      .eq("name", name);
    await invalidate();
  }, [qc, kind]);

  const reset = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("categories").delete().eq("user_id", u.user.id).eq("kind", kind);
    const rows = defaults.map((name) => ({ user_id: u.user!.id, kind, name }));
    await supabase.from("categories").insert(rows);
    await invalidate();
  }, [qc, kind, defaults]);

  return { list: data ?? [], add, remove, reset };
}

export function useCategories() {
  return useCategoryList("expense", DEFAULT_CATEGORIES);
}

export function useIncomeCategories() {
  return useCategoryList("income", DEFAULT_INCOME_CATEGORIES);
}

// ===== Commitments =====
export function useCommitments() {
  const qc = useQueryClient();
  const { data } = useQuery({
    staleTime: 60_000,
    queryKey: ["commitments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commitments")
        .select("*")
        .order("next_due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Commitment[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["commitments"] });

  const add = useCallback(async (c: Omit<Commitment, "id" | "created_at">) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    const { error } = await supabase.from("commitments").insert({ ...c, user_id: u.user.id });
    if (error) throw error;
    await invalidate();
  }, [qc]);

  const update = useCallback(async (id: string, patch: Partial<Omit<Commitment, "id" | "created_at">>) => {
    await supabase.from("commitments").update(patch).eq("id", id);
    await invalidate();
  }, [qc]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("commitments").delete().eq("id", id);
    await invalidate();
  }, [qc]);

  return { items: data ?? [], add, update, remove };
}

// ===== Loans (Owed to me) =====
export function useLoans() {
  const qc = useQueryClient();
  const { data } = useQuery({
    staleTime: 60_000,
    queryKey: ["loans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Loan[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["loans"] });

  const add = useCallback(async (l: Omit<Loan, "id" | "created_at">) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    const { error } = await supabase.from("loans").insert({
      user_id: u.user.id,
      person_name: l.person_name,
      total_amount: l.total_amount,
      start_date: l.start_date ?? null,
      notes: l.notes,
      payments: (l.payments ?? []) as never,
    } as never);
    if (error) throw error;
    await invalidate();
  }, [qc]);

  const update = useCallback(async (id: string, patch: Partial<Omit<Loan, "id" | "created_at">>) => {
    const clean: Record<string, unknown> = { ...patch };
    if (patch.payments) clean.payments = patch.payments as never;
    await supabase.from("loans").update(clean as never).eq("id", id);
    await invalidate();
  }, [qc]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("loans").delete().eq("id", id);
    await invalidate();
  }, [qc]);

  const addPayment = useCallback(async (loan: Loan, p: Omit<LedgerPayment, "id">) => {
    const next = [...(loan.payments ?? []), { id: crypto.randomUUID(), ...p }];
    await supabase.from("loans").update({ payments: next as never } as never).eq("id", loan.id);
    await invalidate();
  }, [qc]);

  return { items: data ?? [], add, update, remove, addPayment };
}

// ===== Debts (My debts & BNPL) =====
export function useDebts() {
  const qc = useQueryClient();
  const { data } = useQuery({
    staleTime: 60_000,
    queryKey: ["debts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Debt[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["debts"] });

  const add = useCallback(async (d: Omit<Debt, "id" | "created_at">): Promise<string> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    const { data: inserted, error } = await supabase.from("debts").insert({
      user_id: u.user.id,
      name: d.name,
      kind: d.kind,
      total_amount: d.total_amount,
      installments_total: d.installments_total ?? null,
      installment_dates: (d.installment_dates ?? []) as never,
      start_date: d.start_date ?? null,
      notes: d.notes,
      payments: (d.payments ?? []) as never,
    } as never).select("id").single();
    if (error) throw error;
    await invalidate();
    return (inserted as { id: string }).id;
  }, [qc]);

  const update = useCallback(async (id: string, patch: Partial<Omit<Debt, "id" | "created_at">>) => {
    const clean: Record<string, unknown> = { ...patch };
    if (patch.payments) clean.payments = patch.payments as never;
    if (patch.installment_dates) clean.installment_dates = patch.installment_dates as never;
    await supabase.from("debts").update(clean as never).eq("id", id);
    await invalidate();
  }, [qc]);

  const remove = useCallback(async (id: string) => {
    // Remove any commitment rows linked to this debt (BNPL installment
    // trackers) so we don't leave orphans rolling over forever.
    await supabase.from("commitments").delete().eq("debt_id", id);
    await supabase.from("debts").delete().eq("id", id);
    await invalidate();
    qc.invalidateQueries({ queryKey: ["commitments"] });
  }, [qc]);

  const addPayment = useCallback(async (debt: Debt, p: Omit<LedgerPayment, "id">) => {
    const next = [...(debt.payments ?? []), { id: crypto.randomUUID(), ...p }];
    await supabase.from("debts").update({ payments: next as never } as never).eq("id", debt.id);
    await invalidate();
  }, [qc]);

  return { items: data ?? [], add, update, remove, addPayment };
}

// ===== Debt items =====
export function useDebtItems() {
  const qc = useQueryClient();
  const { data } = useQuery({
    staleTime: 60_000,
    queryKey: ["debt_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debt_items")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DebtItem[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["debt_items"] });

  const addMany = useCallback(
    async (debt_id: string, rows: Array<Omit<DebtItem, "id" | "created_at" | "debt_id">>) => {
      const clean = rows.filter((r) => r.item_name.trim().length > 0);
      if (clean.length === 0) return;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = clean.map((r) => ({
        debt_id,
        user_id: u.user!.id,
        item_name: r.item_name.trim(),
        price: r.price,
        quantity: r.quantity,
      }));
      const { error } = await supabase.from("debt_items").insert(payload as never);
      if (error) throw error;
      await invalidate();
    },
    [qc],
  );

  const add = useCallback(
    async (debt_id: string, row: Omit<DebtItem, "id" | "created_at" | "debt_id">) => {
      await addMany(debt_id, [row]);
    },
    [addMany],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("debt_items").delete().eq("id", id);
      if (error) throw error;
      await invalidate();
    },
    [qc],
  );

  return { items: data ?? [], add, addMany, remove };
}

// ===== Global clear =====
export async function clearAllData() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const uid = u.user.id;
  await Promise.all([
    supabase.from("transactions").delete().eq("user_id", uid),
    supabase.from("incomes").delete().eq("user_id", uid),
    supabase.from("savings").delete().eq("user_id", uid),
    supabase.from("commitments").delete().eq("user_id", uid),
    supabase.from("loans").delete().eq("user_id", uid),
    supabase.from("debt_items").delete().eq("user_id", uid),
    supabase.from("debts").delete().eq("user_id", uid),
    supabase.from("recurring_incomes").delete().eq("user_id", uid),
    supabase.from("categories").delete().eq("user_id", uid),
  ]);
}
