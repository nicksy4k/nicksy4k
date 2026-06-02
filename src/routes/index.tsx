import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTransactions, useIncomes, useSavings } from "@/lib/store";
import type { LineItem, Transaction } from "@/lib/types";
import { fmt } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { AlertTriangle, ArrowUpRight, PiggyBank, Plus, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Ledgerly Expense Tracker" },
      { name: "description", content: "Track itemized purchases, receipts, warranties, income and savings." },
    ],
  }),
  component: DashboardPage,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--muted-foreground)",
];

function DashboardPage() {
  const { items } = useTransactions();
  const { items: incomes } = useIncomes();
  const { items: savings } = useSavings();

  const stats = useMemo(() => {
    const totalExpenses = items.reduce((s, t) => s + t.total_amount, 0);
    const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
    const savingsBalance = savings.reduce(
      (s, e) => s + (e.kind === "deposit" ? e.amount : -e.amount),
      0,
    );
    const itemCount = items.reduce((s, t) => s + t.items.length, 0);
    const leftToSpend = totalIncome - totalExpenses - savingsBalance;
    return { totalExpenses, totalIncome, savingsBalance, itemCount, leftToSpend, count: items.length };
  }, [items, incomes, savings]);

  const pocketBalances = useMemo(() => {
    const map = new Map<string, number>();
    savings.forEach((s) => {
      const delta = s.kind === "deposit" ? s.amount : -s.amount;
      map.set(s.account, (map.get(s.account) ?? 0) + delta);
    });
    return Array.from(map.entries())
      .filter(([, v]) => Math.abs(v) > 0.0001)
      .sort((a, b) => b[1] - a[1]);
  }, [savings]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((t) => t.items.forEach((it) => map.set(it.category, (map.get(it.category) ?? 0) + it.price)));
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [items]);

  const byRetailer = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((t) => map.set(t.retailer, (map.get(t.retailer) ?? 0) + t.total_amount));
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [items]);

  const alerts = useMemo(() => {
    const now = new Date();
    const rows: Array<{ txn: Transaction; item: LineItem; daysLeft: number }> = [];
    items.forEach((t) =>
      t.items.forEach((it) => {
        if (!it.return_window_expiry) return;
        const days = differenceInCalendarDays(parseISO(it.return_window_expiry), now);
        if (days >= -1 && days <= 30) rows.push({ txn: t, item: it, daysLeft: days });
      })
    );
    return rows.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [items]);

  const recent = items.slice(0, 5);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Overview</p>
          <h1 className="text-3xl md:text-4xl font-semibold">Dashboard</h1>
        </div>
        <Button asChild>
          <Link to="/new"><Plus className="h-4 w-4" />Log transaction</Link>
        </Button>
      </header>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          label="Net income"
          value={fmt(stats.netIncome)}
          icon={stats.netIncome >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          accent
          tone={stats.netIncome >= 0 ? "positive" : "negative"}
        />
        <StatCard label="Total expenses" value={fmt(stats.totalExpenses)} icon={<ArrowUpRight className="h-4 w-4" />} />
        <StatCard label="Savings balance" value={fmt(stats.savingsBalance)} icon={<PiggyBank className="h-4 w-4" />} />
        <StatCard label="Items tracked" value={String(stats.itemCount)} icon={<Receipt className="h-4 w-4" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Spending by category</CardTitle>
            <span className="text-xs text-muted-foreground">All time</span>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="grid md:grid-cols-2 gap-4 items-center">
                <div className="h-[240px]">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} strokeWidth={0}>
                        {byCategory.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2.5">
                  {byCategory.map((c, i) => (
                    <li key={c.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        {c.name}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{fmt(c.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <CardTitle>Return / warranty alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No upcoming return windows.</p>
            ) : (
              <ul className="space-y-3">
                {alerts.slice(0, 6).map(({ txn, item, daysLeft }) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.item_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{txn.retailer} · {fmt(item.price)}</p>
                    </div>
                    <Badge variant={daysLeft <= 3 ? "destructive" : daysLeft <= 7 ? "default" : "secondary"} className="shrink-0">
                      {daysLeft < 0 ? "Expired" : daysLeft === 0 ? "Today" : `${daysLeft}d`}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Top retailers</CardTitle></CardHeader>
          <CardContent>
            {byRetailer.length === 0 ? <EmptyChart /> : (
              <div className="h-[260px]">
                <ResponsiveContainer>
                  <BarChart data={byRetailer} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                    <Bar dataKey="total" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent</CardTitle>
            <Link to="/history" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No transactions yet.</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.retailer}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(t.date), "MMM d")} · {t.items.length} item{t.items.length !== 1 ? "s" : ""}</p>
                    </div>
                    <span className="text-sm font-medium tabular-nums">{fmt(t.total_amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon, accent, tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-primary" : tone === "negative" ? "text-destructive" : "";
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs uppercase tracking-wider">{label}</span>
          <span className={accent ? toneClass || "text-primary" : ""}>{icon}</span>
        </div>
        <p className={`text-2xl font-semibold tabular-nums ${tone === "negative" ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="h-[240px] grid place-items-center text-sm text-muted-foreground">Add a transaction to see analytics.</div>;
}

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};
