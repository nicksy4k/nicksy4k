import { format } from "date-fns";
import { toast } from "sonner";
import { BILL_POCKET } from "@/components/outgoings/shared";
import { syncDebtAfterCommitmentPayment, undoDebtPaymentForCommitment } from "@/lib/bnplSync";
import type { Commitment, SavingsEntry, Transaction } from "@/lib/types";

/**
 * Everything marking an outgoing paid needs to touch. Passed in by the caller
 * so the Outgoings page and the dashboard alerts card run identical logic.
 */
export interface OutgoingPaidCtx {
  transactions: Transaction[];
  updateCommitment: (
    id: string,
    patch: Partial<Omit<Commitment, "id" | "created_at">>,
  ) => Promise<void>;
  addTransaction: (t: Omit<Transaction, "id" | "created_at">) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  addSaving: (s: Omit<SavingsEntry, "id" | "created_at">) => Promise<void>;
  onDebtsChanged?: () => void;
  /** Called when the linked (non-BNPL) debt hits zero after this payment. */
  onDebtSettled?: (info: { commitment: Commitment; debtName: string }) => void;
}

function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Mark a recurring outgoing paid: roll the due date forward, auto-log the
 * spend and deduct it from the Bill Money pocket, then sync any linked BNPL.
 */
export async function markOutgoingPaid(ctx: OutgoingPaidCtx, c: Commitment, newDue: string) {
  const paidDate = todayISO();
  await ctx.updateCommitment(c.id, {
    paid: true,
    last_paid_date: paidDate,
    prev_due_date: c.next_due_date ?? null,
    next_due_date: newDue,
  });
  try {
    await ctx.addTransaction({
      date: paidDate,
      retailer: c.item_name,
      total_amount: c.amount,
      receipt_attached: false,
      receipt_type: "None",
      receipt_location: "",
      notes: `Auto-logged from ${c.is_subscription ? "subscription" : "commitment"}: ${c.item_name}`,
      commitment_id: c.id,
      items: [
        {
          id: crypto.randomUUID(),
          item_name: c.item_name,
          price: c.amount,
          category: c.category || "Subscriptions",
        },
      ],
    });
    await ctx.addSaving({
      date: paidDate,
      kind: "withdrawal",
      amount: c.amount,
      account: BILL_POCKET,
      notes: `Auto-deducted for ${c.item_name}`,
    });
  } catch (err) {
    console.error("Failed to auto-log paid outgoing", err);
    toast.error("Marked paid, but auto-logging failed.");
  }
  if (c.debt_id) {
    try {
      await syncDebtAfterCommitmentPayment(c, paidDate, `pocket:${BILL_POCKET}`);
      ctx.onDebtsChanged?.();
    } catch (err) {
      console.error("Debt sync failed", err);
    }
  }
}

/** Reverse `markOutgoingPaid`: delete the logged spend, refund the pocket, restore the due date. */
export async function unmarkOutgoingPaid(ctx: OutgoingPaidCtx, c: Commitment) {
  try {
    const linked = ctx.transactions.filter((t) => t.commitment_id === c.id);
    for (const t of linked) await ctx.removeTransaction(t.id);
    const refundAmount = linked.reduce((s, t) => s + t.total_amount, 0) || c.amount;
    await ctx.addSaving({
      date: todayISO(),
      kind: "deposit",
      amount: refundAmount,
      account: BILL_POCKET,
      notes: `Refund — unmarked ${c.item_name}`,
    });
    await ctx.updateCommitment(c.id, {
      paid: false,
      last_paid_date: null,
      next_due_date: c.prev_due_date ?? c.next_due_date ?? null,
      prev_due_date: null,
    });
    if (c.debt_id) {
      try {
        await undoDebtPaymentForCommitment(c);
        ctx.onDebtsChanged?.();
      } catch (err) {
        console.error("Debt undo failed", err);
      }
    }
    toast.success("Reversed · transaction removed & Bill Money refunded");
  } catch (err) {
    console.error("Failed to undo paid outgoing", err);
    toast.error("Could not fully undo. Check transactions & pocket.");
  }
}
