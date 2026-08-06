import type { IncomeEntry, SavingsEntry, Transaction } from "@/lib/types";

// Use TODAY (local ISO) so every demo row lands inside the active cycle no
// matter which cycle preset the user has. Dates are computed at read-time so
// the overlay stays fresh across long-lived sessions.
function today(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nowIso(): string {
  return new Date().toISOString();
}

export const DEMO_ALERT_TXN_ID = "demo-txn-3";
export const DEMO_EXPAND_TXN_ID = "demo-txn-1";
export const DEMO_FILTER_CATEGORY = "Groceries";

export function buildDemoTransactions(): Transaction[] {
  return [
    {
      id: "demo-txn-1",
      date: today(-1),
      retailer: "Sainsbury's",
      total_amount: 42.6,
      receipt_attached: true,
      receipt_type: "Digital",
      receipt_location: "",
      items: [
        {
          id: "d1-i1",
          item_name: "Weekly veg box",
          price: 12.5,
          quantity: 1,
          category: "Groceries",
        },
        {
          id: "d1-i2",
          item_name: "Chicken thighs",
          price: 6.4,
          quantity: 2,
          category: "Groceries",
        },
        { id: "d1-i3", item_name: "Sourdough", price: 3.2, quantity: 1, category: "Groceries" },
        {
          id: "d1-i4",
          item_name: "Cleaning spray",
          price: 4.1,
          quantity: 1,
          category: "Household",
        },
        {
          id: "d1-i5",
          item_name: "Ground coffee",
          price: 10.0,
          quantity: 1,
          category: "Groceries",
        },
      ],
      created_at: nowIso(),
    },
    {
      id: "demo-txn-2",
      date: today(-2),
      retailer: "Spotify",
      total_amount: 11.99,
      receipt_attached: false,
      receipt_type: "None",
      receipt_location: "",
      items: [
        {
          id: "d2-i1",
          item_name: "Family plan",
          price: 11.99,
          quantity: 1,
          category: "Subscriptions",
        },
      ],
      created_at: nowIso(),
    },
    {
      id: DEMO_ALERT_TXN_ID,
      date: today(-5),
      retailer: "Currys",
      total_amount: 249.0,
      receipt_attached: true,
      receipt_type: "Physical",
      receipt_location: "",
      items: [
        {
          id: "d3-i1",
          item_name: "Wireless headphones",
          price: 249.0,
          quantity: 1,
          category: "Tech",
        },
      ],
      protection_type: "Return Window",
      protection_duration: "30 days",
      expiration_date: today(9), // ~9 days from now → amber warning band
      created_at: nowIso(),
    },
    {
      id: "demo-txn-4",
      date: today(-3),
      retailer: "Uniqlo",
      total_amount: 58.0,
      receipt_attached: false,
      receipt_type: "None",
      receipt_location: "",
      items: [
        { id: "d4-i1", item_name: "Merino jumper", price: 39.9, quantity: 1, category: "Clothing" },
        { id: "d4-i2", item_name: "Socks 3-pack", price: 18.1, quantity: 1, category: "Clothing" },
      ],
      created_at: nowIso(),
    },
    {
      id: "demo-txn-5",
      date: today(0),
      retailer: "Odeon",
      total_amount: 24.0,
      receipt_attached: false,
      receipt_type: "None",
      receipt_location: "",
      items: [
        {
          id: "d5-i1",
          item_name: "Cinema tickets",
          price: 12.0,
          quantity: 2,
          category: "Entertainment",
        },
      ],
      created_at: nowIso(),
    },
  ];
}

export function buildDemoIncomes(): IncomeEntry[] {
  return [
    {
      id: "demo-inc-1",
      date: today(-14),
      source: "Monthly salary",
      amount: 2400,
      category: "Salary",
      created_at: nowIso(),
    },
    {
      id: "demo-inc-2",
      date: today(-7),
      source: "Freelance invoice",
      amount: 320,
      category: "Freelance",
      created_at: nowIso(),
    },
  ];
}

export function buildDemoSavings(): SavingsEntry[] {
  return [
    {
      id: "demo-sav-1",
      date: today(-10),
      kind: "deposit",
      amount: 200,
      account: "Emergency fund",
      created_at: nowIso(),
    },
    {
      id: "demo-sav-2",
      date: today(-4),
      kind: "deposit",
      amount: 75,
      account: "Holiday",
      created_at: nowIso(),
    },
  ];
}
