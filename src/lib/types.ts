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
  return_window_expiry?: string | null;
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
  last_paid_date?: string | null;
  next_due_date?: string | null;
  prev_due_date?: string | null;
  notes?: string;
  paid: boolean;
  created_at: string;
}

