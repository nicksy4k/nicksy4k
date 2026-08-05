// Server-only helper: wipes and re-seeds the shared demo account's data.
// Every statement is scoped to the demo user's id — no other account is touched.
import type { SupabaseClient } from "@supabase/supabase-js";

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * A date `offsetDays` from today, clamped to never fall before the 1st of the
 * current month. The demo cycle is monthly anchored to the 1st, so clamping
 * guarantees every seeded row lands inside the active cycle whatever day the
 * demo is opened on.
 */
function iso(offsetDays = 0): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return fmt(d < first ? first : d);
}

/** A future date, clamped to stay inside the current month. */
function isoAhead(offsetDays: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return fmt(d > lastDay ? lastDay : d);
}

function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function id() {
  return crypto.randomUUID();
}


/** Tables the demo account owns, cleared before every demo session. */
const OWNED_TABLES = [
  "transactions",
  "commitments",
  "debt_items",
  "debts",
  "loans",
  "incomes",
  "recurring_incomes",
  "savings",
  "categories",
  "receipt_scans",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export async function wipeAndSeedDemo(admin: AnyClient, userId: string): Promise<void> {
  // 1. Wipe (children before parents)
  for (const table of OWNED_TABLES) {
    await admin.from(table).delete().eq("user_id", userId);
  }

  // 2. Cycle settings — monthly, anchored to the 1st, no manual override. The
  // derived active window is therefore "1st of this month → end of month",
  // which always contains today and every clamped seeded date below.
  const { error: settingsError } = await admin.from("user_settings").upsert(
    {
      user_id: userId,
      cycle_type: "monthly",
      cycle_anchor: startOfMonth(),
      cycle_override_start: null,
      cycle_override_end: null,


      carryover_enabled: true,
      last_carryover_cycle_key: null,
      onboarding_completed: true,
      tutorial_completed: false,
      hidden_retailers: [],
      hidden_items: [],
      joy_categories: [],
      blur_amounts: false,
      hide_category_chart: false,
    },
    { onConflict: "user_id" },
  );
  if (settingsError) console.error("[demo-seed] user_settings", settingsError);


  await admin
    .from("profiles")
    .update({
      full_name: "Demo User",
      display_name: "Demo",
      country: "United Kingdom",
      currency: "GBP",
      symbol_position: "before",
    })
    .eq("id", userId);

  // 3. Pockets (savings accounts) — opening deposits
  const pockets = [
    { account: "Savings", amount: 450 },
    { account: "Bills", amount: 320 },
    { account: "Groceries", amount: 180 },
    { account: "Hobbies", amount: 60 },
  ];
  await admin.from("savings").insert(
    pockets.map((p) => ({
      id: id(),
      user_id: userId,
      date: startOfMonth(),
      kind: "deposit",
      amount: p.amount,
      account: p.account,
      notes: "Opening balance",
    })),

  );

  // 4. Categories
  const expenseCats = ["Groceries", "Subscriptions", "Eating out", "Entertainment", "Household", "Transport"];
  const incomeCats = ["Salary", "Freelance"];
  await admin.from("categories").insert([
    ...expenseCats.map((name) => ({ id: id(), user_id: userId, kind: "expense", name })),
    ...incomeCats.map((name) => ({ id: id(), user_id: userId, kind: "income", name })),
  ]);

  // 5. Income — £1,500 salary routed into the pockets, remainder to main balance
  await admin.from("incomes").insert({
    id: id(),
    user_id: userId,
    date: iso(-14),
    source: "Monthly salary",
    amount: 1500,
    category: "Salary",
    notes: "Demo salary — routed across pockets",
  });

  // 6. Transactions inside the current cycle
  await admin.from("transactions").insert([
    {
      id: id(),
      user_id: userId,
      date: iso(-5),
      retailer: "Asda",
      total_amount: 68.42,
      receipt_attached: false,
      receipt_type: "None",
      receipt_location: "",
      notes: "Weekly big shop",
      is_pending: false,
      items: [
        { id: id(), item_name: "Chicken breast 1kg", price: 7.5, quantity: 1, category: "Groceries" },
        { id: id(), item_name: "Milk 4pt", price: 1.65, quantity: 2, category: "Groceries" },
        { id: id(), item_name: "Pasta 500g", price: 1.1, quantity: 3, category: "Groceries" },
        { id: id(), item_name: "Washing powder", price: 8.0, quantity: 1, category: "Household" },
        { id: id(), item_name: "Mixed veg box", price: 12.0, quantity: 1, category: "Groceries" },
        { id: id(), item_name: "Coffee beans", price: 6.75, quantity: 1, category: "Groceries" },
        { id: id(), item_name: "Cheddar block", price: 4.2, quantity: 1, category: "Groceries" },
        { id: id(), item_name: "Household sundries", price: 20.47, quantity: 1, category: "Household" },
      ],
      payment_splits: [],
      refunds: [],
    },
    {
      id: id(),
      user_id: userId,
      date: iso(-3),
      retailer: "Netflix",
      total_amount: 10.99,
      receipt_attached: false,
      receipt_type: "None",
      receipt_location: "",
      is_pending: false,
      items: [{ id: id(), item_name: "Standard plan", price: 10.99, quantity: 1, category: "Subscriptions" }],
      payment_splits: [],
      refunds: [],
    },
    {
      id: id(),
      user_id: userId,
      date: iso(-2),
      retailer: "Steam",
      total_amount: 24.99,
      receipt_attached: false,
      receipt_type: "Digital",
      receipt_location: "",
      is_pending: false,
      items: [{ id: id(), item_name: "Indie game bundle", price: 24.99, quantity: 1, category: "Entertainment" }],
      payment_splits: [],
      refunds: [],
    },
    {
      id: id(),
      user_id: userId,
      date: iso(-1),
      retailer: "Costa Coffee",
      total_amount: 8.6,
      receipt_attached: false,
      receipt_type: "None",
      receipt_location: "",
      is_pending: false,
      items: [
        { id: id(), item_name: "Flat white", price: 3.5, quantity: 2, category: "Eating out" },
        { id: id(), item_name: "Almond croissant", price: 1.6, quantity: 1, category: "Eating out" },
      ],
      payment_splits: [],
      refunds: [],
    },
    {
      id: id(),
      user_id: userId,
      date: iso(0),
      retailer: "Currys",
      total_amount: 149.0,
      receipt_attached: false,
      receipt_type: "Digital",
      receipt_location: "",
      notes: "Return window open",
      is_pending: false,
      items: [{ id: id(), item_name: "Wireless headphones", price: 149.0, quantity: 1, category: "Entertainment" }],
      protection_type: "Return Window",
      protection_duration: "30 days",
      expiration_date: iso(9),
      payment_splits: [],
      refunds: [],
    },
  ]);

  // 7. Commitments in the current cycle — one paid, one upcoming
  await admin.from("commitments").insert([
    {
      id: id(),
      user_id: userId,
      item_name: "Rent",
      store: "Landlord",
      payment_method: "Bank transfer",
      amount: 750,
      category: "Housing",
      paid: true,
      last_paid_date: iso(-2),
      prev_due_date: iso(-2),
      next_due_date: iso(28),
      notes: "Paid this cycle",
    },
    {
      id: id(),
      user_id: userId,
      item_name: "Mobile phone",
      store: "Vodafone",
      payment_method: "Direct debit",
      amount: 22.5,
      category: "Utilities",
      paid: false,
      next_due_date: isoAhead(2),
      notes: "Due soon",
    },
  ]);
}
