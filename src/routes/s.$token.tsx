import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { FileText, Link2Off } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RouteError } from "@/components/RouteError";
import { getSharedStatement } from "@/lib/api/loanShare.functions";
import { CADENCE_LABELS, buildLoanPlan, type LoanCadence } from "@/lib/loanPlan";
import { loanPaid, loanRemaining } from "@/lib/credit";
import { statementRows, printLoanStatement } from "@/lib/loanStatement";
import { formatMoney, type MoneyFormat } from "@/lib/money";
import type { Loan } from "@/lib/types";

export const Route = createFileRoute("/s/$token")({
  loader: ({ params }) => getSharedStatement({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: "Loan statement — Itemized Keeper" },
      {
        name: "description",
        content: "A shared, read-only statement of a personal loan and its repayments.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Loan statement — Itemized Keeper" },
      {
        property: "og:description",
        content: "A shared, read-only statement of a personal loan and its repayments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharedStatementPage,
  errorComponent: RouteError,
  notFoundComponent: Unavailable,
});

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

function Unavailable() {
  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="max-w-sm text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-xl bg-muted grid place-items-center">
          <Link2Off className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold">This statement link is no longer available</h1>
        <p className="text-sm text-muted-foreground">
          The link may have expired or been revoked by the person who sent it. Ask them for a fresh
          link.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/">Go to Itemized Keeper</Link>
        </Button>
      </div>
    </div>
  );
}

function SharedStatementPage() {
  const data = Route.useLoaderData();

  if (data.status !== "ok") return <Unavailable />;

  const { loan: raw, lenderName, note, money } = data;
  const loan = raw as unknown as Loan;
  const m = (n: number) => formatMoney(n, money as MoneyFormat);

  const paid = loanPaid(loan);
  const remaining = Math.max(0, loanRemaining(loan));
  const settled = remaining <= 0.005;
  const plan = buildLoanPlan(loan);
  const rows = statementRows(loan);
  const upcoming = plan?.schedule.filter((s) => s.status !== "paid") ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-12 space-y-6">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Shared loan statement
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold">{loan.person_name}</h1>
          <p className="text-sm text-muted-foreground">
            {lenderName ? `Lent by ${lenderName} · ` : ""}
            Updated {format(new Date(), "d MMM yyyy")}
          </p>
        </header>

        <section className="grid grid-cols-3 gap-3">
          {[
            { label: "Total lent", value: m(loan.total_amount) },
            { label: "Repaid", value: m(paid) },
            { label: settled ? "Settled" : "Outstanding", value: m(remaining) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border/60 bg-card p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <p className="text-lg md:text-xl font-semibold tabular-nums">{s.value}</p>
            </div>
          ))}
        </section>

        {plan?.nextDue && (
          <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div>
              <h2 className="font-semibold">Repayment plan</h2>
              <p className="text-sm text-muted-foreground">
                {m(Number(loan.plan_amount))}{" "}
                {(CADENCE_LABELS[loan.plan_cadence as LoanCadence] ?? "").toLowerCase()} · next
                payment {m(plan.nextDue.amount - plan.nextDue.covered)} on{" "}
                {fmtDate(plan.nextDue.dueDate)}
                {plan.projectedClearDate
                  ? ` · expected to be cleared by ${fmtDate(plan.projectedClearDate)}`
                  : ""}
              </p>
            </div>
            {upcoming.length > 0 && (
              <ul className="divide-y divide-border/60 text-sm">
                {upcoming.map((s) => (
                  <li key={s.index} className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">
                      #{s.index} · {fmtDate(s.dueDate)}
                    </span>
                    <span className="tabular-nums">
                      {m(s.amount - s.covered)}
                      {s.status === "part" && (
                        <span className="text-muted-foreground"> (part paid)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-semibold">Statement of account</h2>
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Date</th>
                  <th className="text-left font-medium px-3 py-2">Description</th>
                  <th className="text-right font-medium px-3 py-2">Amount</th>
                  <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2">{r.description}</td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        r.amount < 0 ? "text-primary" : ""
                      }`}
                    >
                      {r.amount < 0 ? "−" : "+"}
                      {m(Math.abs(r.amount))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">
                      {m(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {(loan.notes || note) && (
          <section className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm whitespace-pre-wrap">
            {[loan.notes, note].filter(Boolean).join("\n\n")}
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              printLoanStatement(loan, {
                lenderName: lenderName ?? undefined,
                note: note ?? undefined,
              })
            }
          >
            <FileText className="h-4 w-4" /> Save as PDF
          </Button>
        </div>

        <footer className="pt-4 border-t border-border/60 text-xs text-muted-foreground">
          {settled
            ? "This loan is fully repaid."
            : `Outstanding balance as at ${format(new Date(), "d MMM yyyy")}: ${m(remaining)}.`}{" "}
          This is a read-only personal record produced with Itemized Keeper.
        </footer>
      </div>
    </div>
  );
}
