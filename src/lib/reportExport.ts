import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";
import type { IncomeEntry, Transaction } from "@/lib/types";
import { mainExpensePortion } from "@/lib/format";

export interface CategoryDatum {
  name: string;
  value: number;
}

export interface ReportPayload {
  startDate: string;
  endDate: string;
  transactions: Transaction[];
  incomes: IncomeEntry[];
  matchedAmount: (t: Transaction) => number;
  categoryBreakdown: CategoryDatum[];
}

const BILLS = new Set(["Bills", "Subscriptions", "Utilities", "Uitility"]);

function paymentMethodLabel(t: Transaction): string {
  if (!t.payment_splits || t.payment_splits.length === 0) return "Main";
  return t.payment_splits
    .map((s) => {
      if (s.label) return s.label;
      if (s.source === "main") return "Main";
      if (s.source.startsWith("pocket:")) return `Pocket: ${s.source.slice(7)}`;
      if (s.source.startsWith("bnpl:")) return "BNPL";
      return s.source;
    })
    .join(" + ");
}

function fmtDate(d: string): string {
  try {
    return format(parseISO(d), "dd-MMM-yyyy");
  } catch {
    return d;
  }
}

/** One row per line item, mirroring the user's Google Sheet layout. */
export function buildItemRows(payload: ReportPayload) {
  const rows: Array<Record<string, string | number>> = [];
  for (const t of payload.transactions) {
    const itemsSum =
      t.items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0) || 1;
    const main = mainExpensePortion(t);
    const method = paymentMethodLabel(t);
    for (const item of t.items) {
      const share = (item.price * (item.quantity ?? 1)) / itemsSum;
      rows.push({
        Date: fmtDate(t.date),
        Item: item.item_name,
        Place: t.retailer,
        Category: item.category,
        "Payment Method": method,
        Amount: Number((share * main).toFixed(2)),
        Notes: item.notes || t.notes || "",
      });
    }
  }
  return rows;
}

export function buildIncomeRows(payload: ReportPayload) {
  return payload.incomes.map((i) => ({
    Income: i.source,
    Date: fmtDate(i.date),
    Amount: Number(i.amount.toFixed(2)),
    Notes: i.notes || "",
  }));
}

export function computeTotals(payload: ReportPayload) {
  const income = payload.incomes.reduce((s, i) => s + i.amount, 0);
  const spent = payload.transactions.reduce(
    (s, t) => s + payload.matchedAmount(t),
    0,
  );
  return { income, spent, left: income - spent };
}

/** Category breakdown excluding bill-like categories. */
export function breakdownWithoutBills(payload: ReportPayload): CategoryDatum[] {
  return payload.categoryBreakdown.filter((d) => !BILLS.has(d.name));
}

export function downloadWorkbook(payload: ReportPayload, filename: string) {
  const wb = XLSX.utils.book_new();

  // Transactions sheet
  const itemRows = buildItemRows(payload);
  const wsItems = XLSX.utils.json_to_sheet(itemRows);
  applyCurrencyColumn(wsItems, itemRows.length, "F"); // Amount col
  XLSX.utils.book_append_sheet(wb, wsItems, "Transactions");

  // Income sheet
  const incomeRows = buildIncomeRows(payload);
  const wsIncome = XLSX.utils.json_to_sheet(incomeRows);
  applyCurrencyColumn(wsIncome, incomeRows.length, "C");
  XLSX.utils.book_append_sheet(wb, wsIncome, "Income");

  // Summary sheet
  const totals = computeTotals(payload);
  const total = payload.categoryBreakdown.reduce((s, d) => s + d.value, 0);
  const nonBills = breakdownWithoutBills(payload);
  const nonBillsTotal = nonBills.reduce((s, d) => s + d.value, 0);

  const summaryAoa: (string | number)[][] = [
    ["Ledgerly Report"],
    ["From", payload.startDate, "To", payload.endDate],
    [],
    ["Income", Number(totals.income.toFixed(2))],
    ["Spent", Number(totals.spent.toFixed(2))],
    ["Left", Number(totals.left.toFixed(2))],
    [],
    ["Where my money goes"],
    ["Category", "Amount", "%"],
    ...payload.categoryBreakdown.map((d) => [
      d.name,
      Number(d.value.toFixed(2)),
      total ? Number(((d.value / total) * 100).toFixed(1)) : 0,
    ]),
    [],
    ["Expenses without Bills"],
    ["Category", "Amount", "%"],
    ...nonBills.map((d) => [
      d.name,
      Number(d.value.toFixed(2)),
      nonBillsTotal ? Number(((d.value / nonBillsTotal) * 100).toFixed(1)) : 0,
    ]),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // Raw sheet
  const rawRows = payload.transactions.map((t) => ({
    id: t.id,
    date: t.date,
    retailer: t.retailer,
    total_amount: t.total_amount,
    matched_amount: Number(payload.matchedAmount(t).toFixed(2)),
    is_pending: t.is_pending ?? false,
    items: JSON.stringify(t.items),
    payment_splits: JSON.stringify(t.payment_splits ?? []),
    refunds: JSON.stringify(t.refunds ?? []),
    notes: t.notes ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rawRows), "Raw");

  XLSX.writeFile(wb, filename, { bookType: "xlsx" });
}

function applyCurrencyColumn(
  ws: XLSX.WorkSheet,
  rowCount: number,
  colLetter: string,
) {
  for (let i = 2; i <= rowCount + 1; i++) {
    const addr = `${colLetter}${i}`;
    const cell = ws[addr];
    if (cell) cell.z = '"£"#,##0.00';
  }
}

export function printReport() {
  window.print();
}
