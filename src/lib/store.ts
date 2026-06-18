import { useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Commitment,
  Debt,
  IncomeEntry,
  LedgerPayment,
  Loan,
  SavingsEntry,
  Transaction,
} from "./types";
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "./types";

// ===== Transactions =====
export function useTransactions() {
  const qc = useQueryClient();
  const { data } = useQuery({
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

  const clear = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("transactions").delete().eq("user_id", u.user.id);
    await invalidate();
  }, [qc]);

  return { items: data ?? [], add, update, remove, clear };
}

// ===== Incomes =====
export function useIncomes() {
  const qc = useQueryClient();
  const { data } = useQuery({
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

// ===== Savings =====
export function useSavings() {
  const qc = useQueryClient();
  const { data } = useQuery({
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

  const add = useCallback(async (d: Omit<Debt, "id" | "created_at">) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    const { error } = await supabase.from("debts").insert({
      user_id: u.user.id,
      name: d.name,
      kind: d.kind,
      total_amount: d.total_amount,
      installments_total: d.installments_total ?? null,
      installment_dates: (d.installment_dates ?? []) as never,
      start_date: d.start_date ?? null,
      notes: d.notes,
      payments: (d.payments ?? []) as never,
    } as never);
    if (error) throw error;
    await invalidate();
  }, [qc]);

  const update = useCallback(async (id: string, patch: Partial<Omit<Debt, "id" | "created_at">>) => {
    const clean: Record<string, unknown> = { ...patch };
    if (patch.payments) clean.payments = patch.payments as never;
    if (patch.installment_dates) clean.installment_dates = patch.installment_dates as never;
    await supabase.from("debts").update(clean as never).eq("id", id);
    await invalidate();
  }, [qc]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("debts").delete().eq("id", id);
    await invalidate();
  }, [qc]);

  const addPayment = useCallback(async (debt: Debt, p: Omit<LedgerPayment, "id">) => {
    const next = [...(debt.payments ?? []), { id: crypto.randomUUID(), ...p }];
    await supabase.from("debts").update({ payments: next as never } as never).eq("id", debt.id);
    await invalidate();
  }, [qc]);

  return { items: data ?? [], add, update, remove, addPayment };
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
    supabase.from("debts").delete().eq("user_id", uid),
  ]);
}
