import { format, parseISO } from "date-fns";

import type { LedgerPayment, Loan } from "./types";
import { loanPaid, loanRemaining } from "./credit";
import { fmt } from "./format";
import { CADENCE_LABELS, buildLoanPlan, type LoanCadence } from "./loanPlan";

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

/** Chronological ledger of everything logged against the loan. */
export function statementRows(loan: Loan) {
  const opening = loan.start_date ?? loan.created_at?.slice(0, 10) ?? "";
  const payments = [...(loan.payments ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  const rows: Array<{ date: string; description: string; amount: number; balance: number }> = [];
  let balance = 0;

  const topups = payments.filter((p) => p.type === "topup");
  const opened =
    loan.total_amount - topups.reduce((s: number, p: LedgerPayment) => s + p.amount, 0);

  balance = opened;
  rows.push({
    date: opening,
    description: "Loan opened",
    amount: opened,
    balance,
  });

  for (const p of payments) {
    if (p.type === "topup") {
      balance += p.amount;
      rows.push({
        date: p.date,
        description: p.notes ? `Additional loan — ${p.notes}` : "Additional loan",
        amount: p.amount,
        balance,
      });
    } else {
      balance -= p.amount;
      rows.push({
        date: p.date,
        description: p.notes ? `Repayment received — ${p.notes}` : "Repayment received",
        amount: -p.amount,
        balance,
      });
    }
  }

  return rows;
}

export interface StatementOptions {
  /** Name shown as the lender, e.g. the account holder. */
  lenderName?: string;
  /** Optional free-text note printed at the foot of the statement. */
  note?: string;
}

export function buildLoanStatementHtml(loan: Loan, opts: StatementOptions = {}): string {
  const paid = loanPaid(loan);
  const remaining = loanRemaining(loan);
  const plan = buildLoanPlan(loan);
  const rows = statementRows(loan);
  const settled = remaining <= 0.005;

  const ledger = rows
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.date ? fmtDate(r.date) : "—")}</td>
        <td>${escapeHtml(r.description)}</td>
        <td class="right ${r.amount < 0 ? "credit" : ""}">${escapeHtml(
          `${r.amount < 0 ? "−" : "+"}${fmt(Math.abs(r.amount))}`,
        )}</td>
        <td class="right">${escapeHtml(fmt(r.balance))}</td>
      </tr>`,
    )
    .join("");

  const upcoming = plan
    ? plan.schedule
        .filter((s) => s.status !== "paid")
        .map(
          (s) => `<tr>
            <td>#${s.index}</td>
            <td>${escapeHtml(fmtDate(s.dueDate))}</td>
            <td class="right">${escapeHtml(fmt(s.amount - s.covered))}</td>
            <td>${escapeHtml(
              s.status === "part"
                ? `Part paid (${fmt(s.covered)})`
                : s.status === "due"
                  ? "Due now"
                  : "Upcoming",
            )}</td>
          </tr>`,
        )
        .join("")
    : "";

  const planBlock =
    plan && plan.nextDue
      ? `<section>
          <h2>Repayment plan</h2>
          <p class="lede">
            ${escapeHtml(fmt(Number(loan.plan_amount)))}
            ${escapeHtml(
              (CADENCE_LABELS[loan.plan_cadence as LoanCadence] ?? "").toLowerCase(),
            )} ·
            next payment ${escapeHtml(fmt(plan.nextDue.amount - plan.nextDue.covered))} on
            ${escapeHtml(fmtDate(plan.nextDue.dueDate))}
            ${
              plan.projectedClearDate
                ? ` · expected to be cleared by ${escapeHtml(fmtDate(plan.projectedClearDate))}`
                : ""
            }
          </p>
          <table>
            <thead><tr><th>No.</th><th>Due date</th><th class="right">Amount</th><th>Status</th></tr></thead>
            <tbody>${upcoming}</tbody>
          </table>
        </section>`
      : "";

  const title = `Loan statement — ${loan.person_name}`;

  return `<!doctype html><html><head><meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color:#111; font-size:11pt; }
      h1 { font-size: 18pt; margin: 0 0 2px; }
      h2 { font-size: 12pt; margin: 18px 0 6px; page-break-after: avoid; }
      header { border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 12px; }
      header p { margin: 2px 0; color: #444; font-size: 10pt; }
      .muted { color: #666; }
      .summary { display: flex; gap: 10px; margin: 12px 0 4px; }
      .summary div { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 8px 10px; }
      .summary span { display: block; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #666; }
      .summary strong { font-size: 14pt; }
      table { width: 100%; border-collapse: collapse; margin-top: 4px; }
      th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #eee; font-size: 10pt; vertical-align: top; }
      th { background: #f6f6f6; font-size: 9pt; text-transform: uppercase; letter-spacing: .05em; color: #555; }
      .right { text-align: right; font-variant-numeric: tabular-nums; }
      .credit { color: #15803d; }
      .lede { margin: 2px 0 6px; color: #333; }
      .note { margin-top: 14px; padding: 8px 10px; border: 1px solid #eee; border-radius: 6px; color: #333; font-size: 10pt; white-space: pre-wrap; }
      footer { margin-top: 18px; border-top: 1px solid #ddd; padding-top: 8px; color: #777; font-size: 9pt; }
      section { page-break-inside: avoid; }
    </style></head>
    <body>
      <header>
        <h1>Loan statement</h1>
        <p><strong>${escapeHtml(loan.person_name)}</strong>${
          opts.lenderName ? ` · lent by ${escapeHtml(opts.lenderName)}` : ""
        }</p>
        <p class="muted">Generated ${escapeHtml(format(new Date(), "d MMM yyyy 'at' HH:mm"))}</p>
      </header>

      <section class="summary">
        <div><span>Total lent</span><strong>${escapeHtml(fmt(loan.total_amount))}</strong></div>
        <div><span>Repaid</span><strong>${escapeHtml(fmt(paid))}</strong></div>
        <div><span>${settled ? "Settled" : "Outstanding"}</span><strong>${escapeHtml(
          fmt(Math.max(0, remaining)),
        )}</strong></div>
      </section>

      ${planBlock}

      <section>
        <h2>Statement of account</h2>
        <table>
          <thead><tr><th>Date</th><th>Description</th><th class="right">Amount</th><th class="right">Balance</th></tr></thead>
          <tbody>${ledger}</tbody>
        </table>
      </section>

      ${loan.notes ? `<div class="note">${escapeHtml(loan.notes)}</div>` : ""}
      ${opts.note ? `<div class="note">${escapeHtml(opts.note)}</div>` : ""}

      <footer>
        ${
          settled
            ? "This loan is fully repaid. Thank you."
            : `Outstanding balance as at ${escapeHtml(format(new Date(), "d MMM yyyy"))}: ${escapeHtml(fmt(Math.max(0, remaining)))}.`
        }
        This statement is a personal record produced with Itemized Keeper.
      </footer>
    </body></html>`;
}

/**
 * Renders the statement into a hidden iframe and opens the print dialog, so
 * the user can "Save as PDF" and share it with the borrower.
 */
export function printLoanStatement(loan: Loan, opts: StatementOptions = {}) {
  if (typeof window === "undefined") return;

  const html = buildLoanStatementHtml(loan, opts);

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  };
  if (frame.contentWindow?.document.readyState === "complete") run();
  else frame.onload = run;
}

/** Short plain-text summary, handy for messaging apps. */
export function loanStatementText(loan: Loan): string {
  const plan = buildLoanPlan(loan);
  const lines = [
    `Loan statement — ${loan.person_name}`,
    `Total lent: ${fmt(loan.total_amount)}`,
    `Repaid: ${fmt(loanPaid(loan))}`,
    `Outstanding: ${fmt(Math.max(0, loanRemaining(loan)))}`,
  ];
  if (plan?.nextDue) {
    lines.push(
      `Next payment: ${fmt(plan.nextDue.amount - plan.nextDue.covered)} on ${fmtDate(plan.nextDue.dueDate)}`,
    );
  }
  return lines.join("\n");
}
