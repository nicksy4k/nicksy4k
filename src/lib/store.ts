import { useEffect, useState, useCallback } from "react";
import type {
  Commitment,
  IncomeEntry,
  SavingsEntry,
  Transaction,
} from "./types";
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "./types";

const TX_KEY = "iet_transactions_v1";
const INCOME_KEY = "iet_incomes_v1";
const SAVINGS_KEY = "iet_savings_v1";
const COMMITMENTS_KEY = "iet_commitments_v1";
const CATS_KEY = "iet_categories_v1";
const INCOME_CATS_KEY = "iet_income_categories_v1";
const SEED_CLEANUP_KEY = "iet_seed_cleared_v2";
const COMMITMENTS_SEED_KEY = "iet_commitments_seeded_v1";

const SEED_RETAILERS = new Set(["Apple Store", "Whole Foods", "Uniqlo", "Netflix"]);

const TX_EVENT = "iet:tx";
const INCOME_EVENT = "iet:income";
const SAVINGS_EVENT = "iet:savings";
const COMMITMENTS_EVENT = "iet:commitments";
const CATS_EVENT = "iet:cats";
const INCOME_CATS_EVENT = "iet:incomecats";


function isBrowser() {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T, event: string) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(event));
}

// One-time cleanup: remove originally-seeded demo transactions.
function cleanupSeedsOnce() {
  if (!isBrowser()) return;
  if (localStorage.getItem(SEED_CLEANUP_KEY)) return;
  try {
    const raw = localStorage.getItem(TX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Transaction[];
      const kept = parsed.filter((t) => !SEED_RETAILERS.has(t.retailer));
      localStorage.setItem(TX_KEY, JSON.stringify(kept));
    }
  } catch {
    /* ignore */
  }
  localStorage.setItem(SEED_CLEANUP_KEY, "1");
}

function useLocalCollection<T>(key: string, event: string) {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    cleanupSeedsOnce();
    setItems(readJson<T[]>(key, []));
    const handler = () => setItems(readJson<T[]>(key, []));
    window.addEventListener(event, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(event, handler);
      window.removeEventListener("storage", handler);
    };
  }, [key, event]);

  const write = useCallback(
    (next: T[]) => {
      writeJson(key, next, event);
    },
    [key, event],
  );

  return [items, write] as const;
}

// ===== Transactions =====
export function useTransactions() {
  const [items, write] = useLocalCollection<Transaction>(TX_KEY, TX_EVENT);

  const add = useCallback(
    (t: Omit<Transaction, "id" | "created_at">) => {
      const next: Transaction = {
        ...t,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      write([next, ...readJson<Transaction[]>(TX_KEY, [])]);
      return next;
    },
    [write],
  );

  const remove = useCallback(
    (id: string) => {
      write(readJson<Transaction[]>(TX_KEY, []).filter((t) => t.id !== id));
    },
    [write],
  );

  const clear = useCallback(() => {
    write([]);
  }, [write]);

  return { items, add, remove, clear };
}

// ===== Incomes =====
export function useIncomes() {
  const [items, write] = useLocalCollection<IncomeEntry>(INCOME_KEY, INCOME_EVENT);

  const add = useCallback(
    (i: Omit<IncomeEntry, "id" | "created_at">) => {
      const next: IncomeEntry = {
        ...i,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      write([next, ...readJson<IncomeEntry[]>(INCOME_KEY, [])]);
      return next;
    },
    [write],
  );

  const remove = useCallback(
    (id: string) => {
      write(readJson<IncomeEntry[]>(INCOME_KEY, []).filter((i) => i.id !== id));
    },
    [write],
  );

  return { items, add, remove };
}

// ===== Savings =====
export function useSavings() {
  const [items, write] = useLocalCollection<SavingsEntry>(SAVINGS_KEY, SAVINGS_EVENT);

  const add = useCallback(
    (s: Omit<SavingsEntry, "id" | "created_at">) => {
      const next: SavingsEntry = {
        ...s,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      write([next, ...readJson<SavingsEntry[]>(SAVINGS_KEY, [])]);
      return next;
    },
    [write],
  );

  const remove = useCallback(
    (id: string) => {
      write(readJson<SavingsEntry[]>(SAVINGS_KEY, []).filter((s) => s.id !== id));
    },
    [write],
  );

  return { items, add, remove };
}

// ===== Categories (item categories) =====
function useStringList(key: string, event: string, defaults: string[]) {
  const [list, setList] = useState<string[]>(defaults);

  useEffect(() => {
    const existing = readJson<string[] | null>(key, null);
    if (!existing) {
      writeJson(key, defaults, event);
      setList(defaults);
    } else {
      setList(existing);
    }
    const handler = () => setList(readJson<string[]>(key, defaults));
    window.addEventListener(event, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(event, handler);
      window.removeEventListener("storage", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, event]);

  const add = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const current = readJson<string[]>(key, defaults);
      if (current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;
      writeJson(key, [...current, trimmed], event);
    },
    [key, event, defaults],
  );

  const remove = useCallback(
    (name: string) => {
      const current = readJson<string[]>(key, defaults);
      writeJson(key, current.filter((c) => c !== name), event);
    },
    [key, event, defaults],
  );

  const reset = useCallback(() => {
    writeJson(key, defaults, event);
  }, [key, event, defaults]);

  return { list, add, remove, reset };
}

export function useCategories() {
  return useStringList(CATS_KEY, CATS_EVENT, DEFAULT_CATEGORIES);
}

export function useIncomeCategories() {
  return useStringList(INCOME_CATS_KEY, INCOME_CATS_EVENT, DEFAULT_INCOME_CATEGORIES);
}

// ===== Global clear =====
export function clearAllData() {
  if (!isBrowser()) return;
  [TX_KEY, INCOME_KEY, SAVINGS_KEY].forEach((k) => localStorage.removeItem(k));
  window.dispatchEvent(new Event(TX_EVENT));
  window.dispatchEvent(new Event(INCOME_EVENT));
  window.dispatchEvent(new Event(SAVINGS_EVENT));
}
