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
 * The due date a linked outgoing should roll to after a payment lands on the
 * debt. Pay-later plans follow their stored instalment dates; every other
 * linked debt (arrears, loans repaid monthly…) rolls on by its own cadence,
 * so a standard debt never loses its due date.
 */
export function nextDueAfterDebtPayment(
  debt: Debt,
  currentDue: string | null,
  cadence?: string | null,
): string | null {
  const dates = (debt.installment_dates ?? []).slice().sort();
  if (dates.length > 0) {
    return dates.find((d) => currentDue == null || d > currentDue) ?? null;
  }
  if (!currentDue) return null;
  return advanceForCommitment(currentDue, cadence ?? undefined, "monthly");
}

/**
 * Advance a commitment to its next payment after a debt payment is logged.
 * Marks paid + rolls next_due_date forward. Runs for EVERY linked debt kind,
 * not just pay-later plans, so logging a repayment on the debts page ticks
 * the matching outgoing too.
 */
export async function syncCommitmentAfterDebtPayment(
  debt: Debt,
  paidDate: string,
): Promise<Commitment | null> {
  const { data: rows, error } = await supabase
    .from("commitments")
    .select("*")
    .eq("debt_id", debt.id);
  if (error) throw error;
  const commitment = (rows ?? [])[0] as unknown as Commitment | undefined;
  if (!commitment) return null;

  const currentDue = commitment.next_due_date ?? null;
  const nextDue = nextDueAfterDebtPayment(debt, currentDue, commitment.cadence);

  await supabase
    .from("commitments")
    .update({
      paid: true,
      last_paid_date: paidDate,
      prev_due_date: currentDue,
      next_due_date: nextDue,
    })
    .eq("id", commitment.id);
  return { ...commitment, paid: true, last_paid_date: paidDate, prev_due_date: currentDue, next_due_date: nextDue };
}

/**
 * Append a payment to the linked debt when a commitment is marked paid.
 * The payment is tagged with `commitment_id` + the paid date so recurring
 * outgoings log one payment per cycle (and re-marking the same cycle can't
 * double up). Returns the debt name and the balance left after the payment,
 * or null when there was nothing to sync.
 */
export async function syncDebtAfterCommitmentPayment(
  commitment: Commitment,
  paidDate: string,
  source: string,
): Promise<{ name: string; kind: Debt["kind"]; remaining: number } | null> {
  if (!commitment.debt_id) return null;
  const { data: row, error } = await supabase
    .from("debts")
    .select("*")
    .eq("id", commitment.debt_id)
    .maybeSingle();
  if (error) throw error;
  const debt = row as unknown as Debt | null;
  if (!debt) return null;

  const payments = debt.payments ?? [];
  // Idempotent per cycle: one auto payment per commitment per paid date.
  const existing = payments.find(
    (p) => p.commitment_id === commitment.id && p.date === paidDate,
  );
  if (existing) {
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    return { name: debt.name, kind: debt.kind, remaining: Math.max(0, debt.total_amount - paid) };
  }

  const payment: LedgerPayment = {
    id: crypto.randomUUID(),
    date: paidDate,
    amount: commitment.amount,
    type: "payment",
    source,
    commitment_id: commitment.id,
    notes: `Auto: commitment ${commitment.item_name}`,
  };
  const next = [...payments, payment];
  await supabase
    .from("debts")
    .update({ payments: next as never } as never)
    .eq("id", debt.id);
  const paid = next.reduce((s, p) => s + p.amount, 0);
  return { name: debt.name, kind: debt.kind, remaining: Math.max(0, debt.total_amount - paid) };
}

/**
 * Reverse the auto-logged payment for a commitment when the user hits "Undo".
 * Targets the payment for the cycle just undone (matched on the commitment's
 * `last_paid_date`), falling back to the most recent auto payment.
 */
export async function undoDebtPaymentForCommitment(commitment: Commitment): Promise<void> {
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
  const mine = (p: LedgerPayment) => p.commitment_id === commitment.id;
  const dated = (p: LedgerPayment) =>
    mine(p) && (!commitment.last_paid_date || p.date === commitment.last_paid_date);
  let removeAt = payments.map(dated).lastIndexOf(true);
  if (removeAt === -1) removeAt = payments.map(mine).lastIndexOf(true);
  if (removeAt === -1) return;
  const next = payments.slice(0, removeAt).concat(payments.slice(removeAt + 1));
  await supabase
    .from("debts")
    .update({ payments: next as never } as never)
    .eq("id", debt.id);
}

