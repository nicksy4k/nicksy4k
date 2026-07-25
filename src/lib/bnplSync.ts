/**
 * Two-way sync helpers between BNPL debts and their auto-linked commitments.
 *
 * Both surfaces (`/credit` and `/commitments`) are the sole writers for their
 * own tables, so we don't need a DB trigger — these helpers are called from
 * each side after its own mutation lands.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Commitment, Debt, LedgerPayment } from "@/lib/types";

/**
 * Advance a commitment to its next installment after a debt payment is
 * logged. Marks paid + rolls next_due_date forward to the next entry in
 * `debt.installment_dates` (or clears it if this was the final one).
 */
export async function syncCommitmentAfterDebtPayment(
  debt: Debt,
  paidDate: string,
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("commitments")
    .select("*")
    .eq("debt_id", debt.id);
  if (error) throw error;
  const commitment = (rows ?? [])[0] as unknown as Commitment | undefined;
  if (!commitment) return;

  const dates = (debt.installment_dates ?? []).slice().sort();
  const currentDue = commitment.next_due_date ?? null;
  const nextDue =
    dates.find((d) => currentDue == null || d > currentDue) ?? null;

  await supabase
    .from("commitments")
    .update({
      paid: true,
      last_paid_date: paidDate,
      prev_due_date: currentDue,
      next_due_date: nextDue,
    })
    .eq("id", commitment.id);
}

/**
 * Append a payment to the linked debt when a commitment is marked paid.
 * The payment is tagged with `commitment_id` so we can reverse it on undo.
 */
export async function syncDebtAfterCommitmentPayment(
  commitment: Commitment,
  paidDate: string,
  source: string,
): Promise<void> {
  if (!commitment.debt_id) return;
  const { data: row, error } = await supabase
    .from("debts")
    .select("*")
    .eq("id", commitment.debt_id)
    .maybeSingle();
  if (error) throw error;
  const debt = row as unknown as Debt | null;
  if (!debt) return;

  // Avoid double-logging if this commitment already has a payment on file.
  const existing = (debt.payments ?? []).find(
    (p) => p.commitment_id === commitment.id,
  );
  if (existing) return;

  const payment: LedgerPayment = {
    id: crypto.randomUUID(),
    date: paidDate,
    amount: commitment.amount,
    type: "payment",
    source,
    commitment_id: commitment.id,
    notes: `Auto: commitment ${commitment.item_name}`,
  };
  const next = [...(debt.payments ?? []), payment];
  await supabase
    .from("debts")
    .update({ payments: next as never } as never)
    .eq("id", debt.id);
}

/**
 * Reverse the most recent auto-logged payment for a commitment when the
 * user hits "Undo" on the Commitments tab.
 */
export async function undoDebtPaymentForCommitment(
  commitment: Commitment,
): Promise<void> {
  if (!commitment.debt_id) return;
  const { data: row, error } = await supabase
    .from("debts")
    .select("*")
    .eq("id", commitment.debt_id)
    .maybeSingle();
  if (error) throw error;
  const debt = row as unknown as Debt | null;
  if (!debt) return;

  const payments = debt.payments ?? [];
  const idx = [...payments]
    .reverse()
    .findIndex((p) => p.commitment_id === commitment.id);
  if (idx === -1) return;
  const removeAt = payments.length - 1 - idx;
  const next = payments.slice(0, removeAt).concat(payments.slice(removeAt + 1));
  await supabase
    .from("debts")
    .update({ payments: next as never } as never)
    .eq("id", debt.id);
}
