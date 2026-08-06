import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { buildDemoIncomes, buildDemoSavings, buildDemoTransactions } from "@/lib/demoData";
import type { IncomeEntry, SavingsEntry, Transaction } from "@/lib/types";

interface DemoModeState {
  active: boolean;
  transactions: Transaction[];
  incomes: IncomeEntry[];
  savings: SavingsEntry[];
  filterCategory: string | null;
  extraSpend: number;
  expandedTxnId: string | null;
  openAlertId: string | null;
}

interface DemoModeControls {
  start: () => void;
  stop: () => void;
  setFilterCategory: (v: string | null) => void;
  addExtraSpend: (n: number) => void;
  resetExtraSpend: () => void;
  setExpandedTxnId: (id: string | null) => void;
  setOpenAlertId: (id: string | null) => void;
}

type DemoModeCtx = DemoModeState & DemoModeControls;

const Ctx = createContext<DemoModeCtx | null>(null);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [extraSpend, setExtraSpend] = useState(0);
  const [expandedTxnId, setExpandedTxnId] = useState<string | null>(null);
  const [openAlertId, setOpenAlertId] = useState<string | null>(null);

  // Freeze the fake dataset for the lifetime of a tour session so IDs remain
  // stable between actions (expand row, open alert) — rebuilt on each `start`.
  const [dataset, setDataset] = useState(() => ({
    transactions: buildDemoTransactions(),
    incomes: buildDemoIncomes(),
    savings: buildDemoSavings(),
  }));

  const start = useCallback(() => {
    setDataset({
      transactions: buildDemoTransactions(),
      incomes: buildDemoIncomes(),
      savings: buildDemoSavings(),
    });
    setFilterCategory(null);
    setExtraSpend(0);
    setExpandedTxnId(null);
    setOpenAlertId(null);
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    setFilterCategory(null);
    setExtraSpend(0);
    setExpandedTxnId(null);
    setOpenAlertId(null);
  }, []);

  const addExtraSpend = useCallback((n: number) => setExtraSpend((v) => v + n), []);
  const resetExtraSpend = useCallback(() => setExtraSpend(0), []);

  const value = useMemo<DemoModeCtx>(
    () => ({
      active,
      transactions: dataset.transactions,
      incomes: dataset.incomes,
      savings: dataset.savings,
      filterCategory,
      extraSpend,
      expandedTxnId,
      openAlertId,
      start,
      stop,
      setFilterCategory,
      addExtraSpend,
      resetExtraSpend,
      setExpandedTxnId,
      setOpenAlertId,
    }),
    [
      active,
      dataset,
      filterCategory,
      extraSpend,
      expandedTxnId,
      openAlertId,
      start,
      stop,
      addExtraSpend,
      resetExtraSpend,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemoMode(): DemoModeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDemoMode must be used within DemoModeProvider");
  return c;
}
