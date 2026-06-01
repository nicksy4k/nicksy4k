export type ReceiptType = "Physical" | "Digital" | "None";

export type Category =
  | "Tech"
  | "Clothing"
  | "Groceries"
  | "Subscriptions"
  | "Household"
  | "Entertainment"
  | "Other";

export const CATEGORIES: Category[] = [
  "Tech",
  "Clothing",
  "Groceries",
  "Subscriptions",
  "Household",
  "Entertainment",
  "Other",
];

export const RECEIPT_TYPES: ReceiptType[] = ["Physical", "Digital", "None"];

export interface LineItem {
  id: string;
  item_name: string;
  price: number;
  category: Category;
  return_window_expiry?: string | null; // ISO date
  notes?: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO date
  retailer: string;
  total_amount: number;
  receipt_attached: boolean;
  receipt_type: ReceiptType;
  receipt_location: string;
  notes?: string;
  items: LineItem[];
  created_at: string;
}
