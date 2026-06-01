import { useEffect, useState, useCallback } from "react";
import type { Transaction } from "./types";

const KEY = "iet_transactions_v1";

function read(): Transaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    return JSON.parse(raw) as Transaction[];
  } catch {
    return [];
  }
}

function write(items: Transaction[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("iet:update"));
}

function seed(): Transaction[] {
  const today = new Date();
  const d = (offset: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString().slice(0, 10);
  };
  const seeded: Transaction[] = [
    {
      id: crypto.randomUUID(),
      date: d(-2),
      retailer: "Apple Store",
      total_amount: 1398,
      receipt_attached: true,
      receipt_type: "Digital",
      receipt_location: "Google Drive / Receipts / 2026",
      notes: "Work upgrade",
      items: [
        { id: crypto.randomUUID(), item_name: 'MacBook Air 13"', price: 1299, category: "Tech", return_window_expiry: d(12) },
        { id: crypto.randomUUID(), item_name: "USB-C Hub", price: 49, category: "Tech", return_window_expiry: d(28) },
        { id: crypto.randomUUID(), item_name: "AppleCare+", price: 50, category: "Tech" },
      ],
      created_at: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      date: d(-5),
      retailer: "Whole Foods",
      total_amount: 86.42,
      receipt_attached: true,
      receipt_type: "Physical",
      receipt_location: "Kitchen drawer shoebox",
      items: [
        { id: crypto.randomUUID(), item_name: "Weekly groceries", price: 72.4, category: "Groceries" },
        { id: crypto.randomUUID(), item_name: "Cleaning supplies", price: 14.02, category: "Household" },
      ],
      created_at: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      date: d(-10),
      retailer: "Uniqlo",
      total_amount: 134,
      receipt_attached: true,
      receipt_type: "Physical",
      receipt_location: "Wallet",
      items: [
        { id: crypto.randomUUID(), item_name: "Wool overshirt", price: 89, category: "Clothing", return_window_expiry: d(4) },
        { id: crypto.randomUUID(), item_name: "Crewneck tee 2-pack", price: 45, category: "Clothing", return_window_expiry: d(4) },
      ],
      created_at: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      date: d(-1),
      retailer: "Netflix",
      total_amount: 22.99,
      receipt_attached: false,
      receipt_type: "None",
      receipt_location: "",
      items: [
        { id: crypto.randomUUID(), item_name: "Premium plan — monthly", price: 22.99, category: "Subscriptions" },
      ],
      created_at: new Date().toISOString(),
    },
  ];
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

export function useTransactions() {
  const [items, setItems] = useState<Transaction[]>([]);

  useEffect(() => {
    setItems(read());
    const handler = () => setItems(read());
    window.addEventListener("iet:update", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("iet:update", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const add = useCallback((t: Omit<Transaction, "id" | "created_at">) => {
    const next: Transaction = { ...t, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    write([next, ...read()]);
    return next;
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("iet:update"));
  }, []);

  return { items, add, remove, clear };
}
