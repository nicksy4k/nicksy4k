/**
 * Pure builders for the Credit & Debt ledger sync.
 *
 * When a loan/debt movement is funded from (or paid into) a pocket, TWO rows
 * are required — the pocket movement AND the main-balance movement — exactly
 * like the split-payment flow in `./splits.ts`. Writing only the pocket row
 * leaves the main balance off by the amount, because a pocket withdrawal
 * credits main back and a pocket deposit debits it.
 *
 * Side-effect free so the netting rules can be unit-tested without React or
 * Supabase.
 */

export type LedgerSource = { kind: "main" } | { kind: "pocket"; name: string } | { kind: "other" };

export interface LedgerArgs {
  amount: number;
  date: string;
  label: string;
  category?: string;
  notes?: string;
}

export interface SavingsRow {
  date: string;
  kind: "deposit" | "withdrawal";
  amount: number;
  account: string;
  notes: string;
}

export interface TransactionRow {
  date: string;
  retailer: string;
  total_amount: number;
  notes?: string;
  category: string;
  payment_splits: { source: string; amount: number }[];
}

export interface IncomeRow {
  date: string;
  source: string;
  amount: number;
  category: string;
  notes?: string;
}

export interface DebitPlan {
  saving: SavingsRow | null;
  transaction: TransactionRow | null;
}

export interface CreditPlan {
  saving: SavingsRow | null;
  income: IncomeRow | null;
}

/** Money leaving the user's funds (new loan, top-up, debt payment). */
export function planDebit(source: LedgerSource, args: LedgerArgs): DebitPlan {
  if (source.kind === "other") return { saving: null, transaction: null };
  return {
    saving:
      source.kind === "pocket"
        ? {
            date: args.date,
            kind: "withdrawal",
            amount: args.amount,
            account: source.name,
            notes: args.notes ?? args.label,
          }
        : null,
    transaction: {
      date: args.date,
      retailer: args.label,
      total_amount: args.amount,
      notes: args.notes,
      category: args.category ?? "Debt",
      payment_splits:
        source.kind === "pocket" ? [{ source: `pocket:${source.name}`, amount: args.amount }] : [],
    },
  };
}

/** Money arriving into the user's funds (loan repayment received). */
export function planCredit(source: LedgerSource, args: LedgerArgs): CreditPlan {
  if (source.kind === "other") return { saving: null, income: null };
  return {
    saving:
      source.kind === "pocket"
        ? {
            date: args.date,
            kind: "deposit",
            amount: args.amount,
            account: source.name,
            notes: args.notes ?? args.label,
          }
        : null,
    income: {
      date: args.date,
      source: args.label,
      amount: args.amount,
      category: args.category ?? "Loan repayment",
      notes: args.notes,
    },
  };
}

/**
 * Net effect of a plan on the main balance, using the dashboard's formula:
 * leftToSpend = income − expenses − (deposits − withdrawals).
 */
export function netMainEffect(plan: DebitPlan | CreditPlan): number {
  const saving = plan.saving;
  const savingsDelta = saving ? (saving.kind === "deposit" ? saving.amount : -saving.amount) : 0;
  const expense = "transaction" in plan && plan.transaction ? plan.transaction.total_amount : 0;
  const income = "income" in plan && plan.income ? plan.income.amount : 0;
  return income - expense - savingsDelta;
}
