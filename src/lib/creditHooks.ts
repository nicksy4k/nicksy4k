import { useMemo } from "react";
import { format } from "date-fns";

import { useIncomes, useSavings, useTransactions } from "./store";
import { planCredit, planDebit } from "./ledgerSync";
import type { SourceChoice } from "./credit";

export function usePockets(): string[] {
  const { items } = useSavings();
  return useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((s) => {
      const d = s.kind === "deposit" ? s.amount : -s.amount;
      map.set(s.account, (map.get(s.account) ?? 0) + d);
    });
    return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  }, [items]);
}

// ============ Ledger sync helpers ============

export function useLedgerSync() {
  const { add: addTransaction } = useTransactions();
  const { add: addIncome } = useIncomes();
  const { add: addSaving } = useSavings();

  /**
   * Money leaves the user's funds.
   *
   * Pocket-funded outflows write BOTH rows (see `planDebit`): the pocket
   * withdrawal credits the main balance back, and the transaction (tagged
   * with a `pocket:` split) debits it again, so main nets out and the spend
   * still shows in history.
   */
  async function debit(
    source: SourceChoice,
    args: { amount: number; date: string; label: string; category?: string; notes?: string },
  ) {
    const plan = planDebit(source, args);
    if (plan.saving) await addSaving(plan.saving);
    if (plan.transaction) {
      const t = plan.transaction;
      await addTransaction({
        date: t.date,
        retailer: t.retailer,
        total_amount: t.total_amount,
        receipt_attached: false,
        receipt_type: "None",
        receipt_location: "",
        notes: t.notes,
        items: [
          {
            id: crypto.randomUUID(),
            item_name: t.retailer,
            price: t.total_amount,
            quantity: 1,
            category: t.category,
          },
        ],
        payment_splits: t.payment_splits,
      });
    }
  }

  /**
   * Money arrives in the user's funds. Into a pocket we write BOTH the pocket
   * deposit and the income row, so the deposit's drag on the main balance is
   * offset and main stays flat.
   */
  async function credit(
    source: SourceChoice,
    args: { amount: number; date: string; label: string; category?: string; notes?: string },
  ) {
    const plan = planCredit(source, args);
    if (plan.saving) await addSaving(plan.saving);
    if (plan.income) await addIncome(plan.income);
  }

  return { debit, credit };
}
