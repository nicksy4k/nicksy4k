export type ReceiptType = "Physical" | "Digital" | "None";

// Categories are now user-managed via the categories store.
// These defaults seed first-run state.
export const DEFAULT_CATEGORIES: string[] = [
  "Tech",
  "Clothing",
  "Groceries",
  "Subscriptions",
  "Household",
  "Entertainment",
  "Other",
];

export const DEFAULT_INCOME_CATEGORIES: string[] = [
  "Salary",
  "Freelance",
  "Investment",
  "Gift",
  "Refund",
  "Other",
];

// Kept as `string` so user-added categories work everywhere.
export type Category = string;

export const RECEIPT_TYPES: ReceiptType[] = ["Physical", "Digital", "None"];

export interface LineItem {
  id: string;
  item_name: string;
  price: number;
  quantity?: number;
  category: Category;
  notes?: string;
}

/** Source encoding: "main" | "pocket:<name>" | "bnpl:<debtId>" | "other" */
export interface PaymentSplit {
  source: string;
  amount: number;
  label?: string;
}

export interface Refund {
  id: string;
  refunded_at: string;
  amount: number;
  /** "main" | "pocket:<name>" */
  destination: string;
  reason?: string;
  item_ids: string[];
  income_id?: string;
  savings_id?: string;
}

export interface Transaction {
  id: string;
  date: string;
  retailer: string;
  total_amount: number;
  receipt_attached: boolean;
  receipt_type: ReceiptType;
  receipt_location: string;
  notes?: string;
  items: LineItem[];
  commitment_id?: string | null;
  /** "Return Window" | "Warranty" | null */
  protection_type?: string | null;
  /** Duration preset label (or "Custom Date") */
  protection_duration?: string | null;
  /** ISO date (yyyy-mm-dd) */
  expiration_date?: string | null;
  /** ISO timestamp — set when user marks the alert handled */
  dismissed_at?: string | null;
  /** How this transaction was paid — may be empty for older records. */
  payment_splits?: PaymentSplit[];
  /** True for fast-entry pre-authorization holds awaiting itemization/settling. */
  is_pending?: boolean;
  /** Log of refunds against this transaction — does not mutate items/total. */
  refunds?: Refund[];
  created_at: string;
}



export interface IncomeEntry {
  id: string;
  date: string;
  source: string;
  amount: number;
  category: string;
  notes?: string;
  created_at: string;
}

export type IncomeCadence = "weekly" | "fortnightly" | "four-weekly" | "monthly";

export type RecurringAllocationKind = "fixed" | "cover_commitments";

export interface RecurringIncomeAllocation {
  id: string;
  pocket: string;
  kind: RecurringAllocationKind;
  /** Ignored when kind === "cover_commitments". */
  amount: number;
  order: number;
}

export interface RecurringIncome {
  id: string;
  source: string;
  amount: number;
  category: string;
  notes?: string | null;
  cadence: IncomeCadence;
  next_date: string;
  last_generated_date?: string | null;
  active: boolean;
  allocations?: RecurringIncomeAllocation[];
  created_at: string;
  updated_at?: string;
}

export type SavingsKind = "deposit" | "withdrawal";

export interface SavingsEntry {
  id: string;
  date: string;
  kind: SavingsKind;
  amount: number;
  account: string;
  notes?: string;
  created_at: string;
}

export interface Commitment {
  id: string;
  item_name: string;
  store: string;
  payment_method: string;
  amount: number;
  category: string;
  last_paid_date?: string | null;
  next_due_date?: string | null;
  prev_due_date?: string | null;
  notes?: string;
  paid: boolean;
  /** When set, this commitment is auto-managed by a BNPL debt plan. */
  debt_id?: string | null;
  created_at: string;
}


export interface LedgerPayment {
  id: string;
  date: string;
  amount: number;
  notes?: string;
  /** "payment" (default) or "topup" — top-ups increase a loan's total */
  type?: "payment" | "topup";
  /** "main", "pocket:<name>", or "other" — money source/destination */
  source?: string;
}

export interface Loan {
  id: string;
  person_name: string;
  total_amount: number;
  start_date?: string | null;
  notes?: string;
  payments: LedgerPayment[];
  created_at: string;
}

export type DebtKind = "standard" | "bnpl";

export interface DebtItem {
  id: string;
  debt_id: string;
  item_name: string;
  price: number;
  quantity: number;
  created_at: string;
}

export interface Debt {
  id: string;
  name: string;
  kind: DebtKind;
  total_amount: number;
  installments_total?: number | null;
  installment_dates?: string[];
  start_date?: string | null;
  notes?: string;
  payments: LedgerPayment[];
  created_at: string;
}

