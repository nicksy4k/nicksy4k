import { format, parseISO } from "date-fns";
import { fmt, mainExpensePortion } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { computeExpiration, normalizeProtectionDuration } from "@/lib/protection";

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

/** Receipt-style printout for a single transaction. Hidden on screen; shown by window.print(). */
export function PrintableReceipt({ transaction: t }: { transaction: Transaction }) {
  const paid = mainExpensePortion(t);
  const refunded = (t.refunds ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
  const expiration =
    t.expiration_date ??
    (t.protection_type
      ? computeExpiration(t.date, normalizeProtectionDuration(t.protection_duration))
      : null);

  return (
    <div className="print-only">
      <header className="print-header">
        <h1>Ledgerly Receipt</h1>
        <p>
          {t.retailer} — {fmtDate(t.date)}
        </p>
        <p className="print-muted">Generated {format(new Date(), "dd-MMM-yyyy HH:mm")}</p>
      </header>

      <section className="print-summary">
        <div>
          <span>Total</span>
          <strong>{fmt(t.total_amount)}</strong>
        </div>
        <div>
          <span>Paid (Main)</span>
          <strong>{fmt(paid)}</strong>
        </div>
        <div>
          <span>Refunded</span>
          <strong>{fmt(refunded)}</strong>
        </div>
      </section>

      <section>
        <h2>Items</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th className="right">Qty</th>
              <th className="right">Price</th>
              <th className="right">Amount</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {t.items.map((it) => {
              const qty = it.quantity ?? 1;
              return (
                <tr key={it.id}>
                  <td>{it.item_name}</td>
                  <td>{it.category}</td>
                  <td className="right">{qty}</td>
                  <td className="right">{fmt(it.price)}</td>
                  <td className="right">{fmt(it.price * qty)}</td>
                  <td>{it.notes || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Details</h2>
        <table className="print-table">
          <tbody>
            <tr>
              <td>Payment</td>
              <td className="right">{paymentMethodLabel(t)}</td>
            </tr>
            {t.is_pending && (
              <tr>
                <td>Status</td>
                <td className="right">Pending (pre-authorization)</td>
              </tr>
            )}
            {t.receipt_attached && t.receipt_location && (
              <tr>
                <td>Receipt</td>
                <td className="right">
                  {t.receipt_location.includes("/")
                    ? `Attached file (${t.receipt_type === "pdf" ? "PDF" : "image"})`
                    : t.receipt_location}
                </td>
              </tr>
            )}
            {t.protection_type && (
              <tr>
                <td>{t.protection_type}</td>
                <td className="right">
                  {expiration ? `Until ${fmtDate(expiration)}` : "Recorded"}
                </td>
              </tr>
            )}
            {t.notes && (
              <tr>
                <td>Notes</td>
                <td className="right">{t.notes}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
