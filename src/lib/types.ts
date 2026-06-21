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

