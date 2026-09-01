/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateShareToken, isShareUsable, isValidTokenShape } from "@/lib/loanShare";
import { CUSTOM_CURRENCY, type MoneyFormat } from "@/lib/money";
import type { LedgerPayment, LoanRepaymentAdjustment } from "@/lib/types";

export type LoanShareSummary = {
  id: string;
  token: string;
  loan_id: string;
  note: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
};

const SHARE_COLUMNS =
  "id, token, loan_id, note, expires_at, revoked_at, view_count, last_viewed_at, created_at";

/** Links for one loan, newest first. */
export const listLoanShares = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ loanId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<LoanShareSummary[]> => {
    const db = context.supabase as any;
    const { data: rows, error } = await db
      .from("loan_shares")
      .select(SHARE_COLUMNS)
      .eq("loan_id", data.loanId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as LoanShareSummary[];
  });

/** Create a link (revoking any existing active links for the same loan). */
export const createLoanShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        loanId: z.string().uuid(),
        note: z.string().max(500).optional(),
        expiresAt: z.string().datetime().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<LoanShareSummary> => {
    const db = context.supabase as any;

    // The loan must belong to the caller — RLS enforces this too.
    const { data: loan, error: loanError } = await db
      .from("loans")
      .select("id")
      .eq("id", data.loanId)
      .maybeSingle();
    if (loanError) throw new Error(loanError.message);
    if (!loan) throw new Error("Loan not found");

    await db
      .from("loan_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("loan_id", data.loanId)
      .is("revoked_at", null);

    const { data: row, error } = await db
      .from("loan_shares")
      .insert({
        token: generateShareToken(),
        loan_id: data.loanId,
        user_id: context.userId,
        note: data.note?.trim() || null,
        expires_at: data.expiresAt ?? null,
      })
      .select(SHARE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row as LoanShareSummary;
  });

export const revokeLoanShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { error } = await db
      .from("loan_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type SharedStatement =
  | { status: "unavailable" }
  | {
      status: "ok";
      lenderName: string | null;
      note: string | null;
      money: MoneyFormat;
      loan: {
        id: string;
        person_name: string;
        total_amount: number;
        start_date: string | null;
        notes: string | null;
        payments: LedgerPayment[];
        repayment_adjustments: LoanRepaymentAdjustment[];
        created_at: string;
        plan_amount: number | null;
        plan_cadence: string | null;
        plan_start_date: string | null;
        plan_next_due: string | null;
        plan_created_at: string | null;
      };
    };

/**
 * Public, unauthenticated read of a shared statement.
 *
 * `anon` holds no grant on `loans`/`loan_shares`, so this validates the token
 * first and then reads with the privileged client, returning only the narrow
 * projection the statement page renders.
 */
export const getSharedStatement = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().max(80) }).parse(input))
  .handler(async ({ data }): Promise<SharedStatement> => {
    if (!isValidTokenShape(data.token)) return { status: "unavailable" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: share, error: shareError } = await db
      .from("loan_shares")
      .select("id, loan_id, user_id, note, expires_at, revoked_at, view_count")
      .eq("token", data.token)
      .maybeSingle();

    if (shareError || !share || !isShareUsable(share)) return { status: "unavailable" };

    const { data: loan, error: loanError } = await db
      .from("loans")
      .select(
        "id, person_name, total_amount, start_date, notes, payments, repayment_adjustments, created_at, plan_amount, plan_cadence, plan_start_date, plan_next_due, plan_created_at",
      )
      .eq("id", share.loan_id)
      .maybeSingle();

    if (loanError || !loan) return { status: "unavailable" };

    const { data: profile } = await db
      .from("profiles")
      .select("display_name, full_name, currency, currency_symbol, symbol_position")
      .eq("id", share.user_id)
      .maybeSingle();

    // Best-effort view counter; never block the page on it.
    try {
      await db
        .from("loan_shares")
        .update({
          view_count: (share.view_count ?? 0) + 1,
          last_viewed_at: new Date().toISOString(),
        })
        .eq("id", share.id);
    } catch {
      /* ignore */
    }

    const money: MoneyFormat = {
      currency: profile?.currency || "GBP",
      customSymbol: profile?.currency_symbol || "¤",
      symbolPosition: profile?.symbol_position === "after" ? "after" : "before",
    };
    if (profile?.currency === CUSTOM_CURRENCY && !profile?.currency_symbol) {
      money.customSymbol = "¤";
    }

    return {
      status: "ok",
      lenderName: profile?.display_name || profile?.full_name || null,
      note: share.note ?? null,
      money,
      loan: {
        id: loan.id,
        person_name: loan.person_name,
        total_amount: Number(loan.total_amount),
        start_date: loan.start_date ?? null,
        notes: loan.notes ?? null,
        payments: (loan.payments ?? []) as LedgerPayment[],
        repayment_adjustments: (loan.repayment_adjustments ?? []) as LoanRepaymentAdjustment[],
        created_at: loan.created_at,
        plan_amount: loan.plan_amount === null ? null : Number(loan.plan_amount),
        plan_cadence: loan.plan_cadence ?? null,
        plan_start_date: loan.plan_start_date ?? null,
        plan_next_due: loan.plan_next_due ?? null,
        plan_created_at: loan.plan_created_at ?? null,
      },
    };
  });
