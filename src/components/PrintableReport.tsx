import { format, parseISO } from "date-fns";
import { fmt, mainExpensePortion } from "@/lib/format";
import type { IncomeEntry, Transaction } from "@/lib/types";
import { breakdownWithoutBills, computeTotals, type CategoryDatum } from "@/lib/reportExport";

interface Props {
  startDate: string;
  endDate: string;
  transactions: Transaction[];
  incomes: IncomeEntry[];
  matchedAmount: (t: Transaction) => number;
  categoryBreakdown: CategoryDatum[];
  mode?: "itemized" | "summary";
}

function fmtDate(d: string) {
  try {
    return format(parseISO(d), "dd-MMM-yyyy");
  } catch {
    return d;
  }
}

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

export function PrintableReport(props: Props) {
  const payload = { ...props };
  const totals = computeTotals(payload);
  const total = props.categoryBreakdown.reduce((s, d) => s + d.value, 0);
  const nonBills = breakdownWithoutBills(payload);
  const nonBillsTotal = nonBills.reduce((s, d) => s + d.value, 0);

  return (
    <div className="print-only">
      <header className="print-header">
        <h1>Ledgerly Report</h1>
        <p>
          {fmtDate(props.startDate)} — {fmtDate(props.endDate)}
        </p>
        <p className="print-muted">Generated {format(new Date(), "dd-MMM-yyyy HH:mm")}</p>
      </header>

      <section className="print-summary">
        <div>
          <span>Income</span>
          <strong>{fmt(totals.income)}</strong>
        </div>
        <div>
          <span>Spent</span>
          <strong>{fmt(totals.spent)}</strong>
        </div>
        <div>
          <span>Left</span>
          <strong>{fmt(totals.left)}</strong>
        </div>
      </section>

      <section>
        <h2>Transactions</h2>
        {props.mode === "summary" ? (
          <table className="print-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Retailer</th>
                <th>Category</th>
                <th>Payment</th>
                <th className="right">Amount</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {props.transactions.map((t) => {
                const cats = Array.from(new Set(t.items.map((i) => i.category))).join(", ");
                return (
                  <tr key={t.id}>
                    <td>{fmtDate(t.date)}</td>
                    <td>{t.retailer}</td>
                    <td>{cats}</td>
                    <td>{paymentMethodLabel(t)}</td>
                    <td className="right">{fmt(props.matchedAmount(t))}</td>
                    <td>{t.notes || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="print-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Place</th>
                <th>Category</th>
                <th>Payment</th>
                <th className="right">Amount</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {props.transactions.flatMap((t) => {
                const itemsSum = t.items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0) || 1;
                const main = mainExpensePortion(t);
                const method = paymentMethodLabel(t);
                return t.items.map((it) => {
                  const share = (it.price * (it.quantity ?? 1)) / itemsSum;
                  return (
                    <tr key={`${t.id}-${it.id}`}>
                      <td>{fmtDate(t.date)}</td>
                      <td>{it.item_name}</td>
                      <td>{t.retailer}</td>
                      <td>{it.category}</td>
                      <td>{method}</td>
                      <td className="right">{fmt(share * main)}</td>
                      <td>{it.notes || t.notes || ""}</td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Income</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Date</th>
              <th className="right">Amount</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {props.incomes.map((i) => (
              <tr key={i.id}>
                <td>{i.source}</td>
                <td>{fmtDate(i.date)}</td>
                <td className="right">{fmt(i.amount)}</td>
                <td>{i.notes || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-breakdowns">
        <div>
          <h2>Where my money goes</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="right">Amount</th>
                <th className="right">%</th>
              </tr>
            </thead>
            <tbody>
              {props.categoryBreakdown.map((d) => (
                <tr key={d.name}>
                  <td>{d.name}</td>
                  <td className="right">{fmt(d.value)}</td>
                  <td className="right">{total ? ((d.value / total) * 100).toFixed(1) : "0.0"}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>Expenses without Bills</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="right">Amount</th>
                <th className="right">%</th>
              </tr>
            </thead>
            <tbody>
              {nonBills.map((d) => (
                <tr key={d.name}>
                  <td>{d.name}</td>
                  <td className="right">{fmt(d.value)}</td>
                  <td className="right">
                    {nonBillsTotal ? ((d.value / nonBillsTotal) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
