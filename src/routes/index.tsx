import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTransactions, useIncomes, useSavings } from "@/lib/store";
import type { Transaction } from "@/lib/types";
import { fmt, mainExpensePortion } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { AlertTriangle, ArrowUpRight, Check, FileText, PiggyBank, Plus, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { useActiveCycle, isInCycle } from "@/lib/cycle";
import { protectionStatus, type ProtectionType } from "@/lib/protection";
import { isStoragePath } from "@/components/ReceiptUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Ledgerly Expense Tracker" },
      { name: "description", content: "Track itemized purchases, receipts, warranties, income and savings." },
    ],
  }),
  component: DashboardPage,
});

import { colorForKey } from "@/lib/colors";

function DashboardPage() {
  const { items, dismiss } = useTransactions();
  const { items: incomes } = useIncomes();
  const { items: savings } = useSavings();
  const cycle = useActiveCycle();


  // Cycle-scoped slices — drive every summary, chart, and alert below.
  const cycleItems = useMemo(() => items.filter((t) => isInCycle(t.date, cycle)), [items, cycle]);
  const cycleIncomes = useMemo(() => incomes.filter((i) => isInCycle(i.date, cycle)), [incomes, cycle]);
  const cycleSavings = useMemo(() => savings.filter((s) => isInCycle(s.date, cycle)), [savings, cycle]);

  const stats = useMemo(() => {
    const totalExpenses = cycleItems.reduce((s, t) => s + mainExpensePortion(t), 0);
    const totalIncome = cycleIncomes.reduce((s, i) => s + i.amount, 0);
    const savingsBalance = cycleSavings.reduce(
      (s, e) => s + (e.kind === "deposit" ? e.amount : -e.amount),
      0,
    );
    const itemCount = cycleItems.reduce((s, t) => s + t.items.length, 0);
    const leftToSpend = totalIncome - totalExpenses - savingsBalance;
    return { totalExpenses, totalIncome, savingsBalance, itemCount, leftToSpend, count: cycleItems.length };
  }, [cycleItems, cycleIncomes, cycleSavings]);

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

  // Exclude pending pre-auth holds from analytics — they're estimates,
  // not real spend, and would double-count once settled.
  const analyticsItems = useMemo(
    () => cycleItems.filter((t) => !t.is_pending),
    [cycleItems],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    analyticsItems.forEach((t) =>
      t.items.forEach((it) => {
        const qty = it.quantity ?? 1;
        map.set(it.category, (map.get(it.category) ?? 0) + it.price * qty);
      }),
    );
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [analyticsItems]);

  const byRetailer = useMemo(() => {
    const map = new Map<string, number>();
    analyticsItems.forEach((t) =>
      map.set(t.retailer, (map.get(t.retailer) ?? 0) + mainExpensePortion(t)),
    );
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [analyticsItems]);

  const alerts = useMemo(() => {
    const now = new Date();
    return items
      .filter((t) => {
        if (!t.protection_type || !t.expiration_date) return false;
        if (t.dismissed_at) return false;
        const days = differenceInCalendarDays(parseISO(t.expiration_date), now);
        return days >= -1; // keep visible 1 day past expiry
      })
      .sort((a, b) =>
        parseISO(a.expiration_date!).getTime() - parseISO(b.expiration_date!).getTime(),
      );
  }, [items]);


  const recent = items.slice(0, 5);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
            Overview · {format(cycle.start, "d MMM")} – {format(cycle.end, "d MMM yyyy")}
            {cycle.isOverridden && <span className="ml-1 text-amber-600">· override</span>}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold">Dashboard</h1>
        </div>
        <Button asChild>
          <Link to="/new"><Plus className="h-4 w-4" />Log transaction</Link>
        </Button>
      </header>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          label="Left to spend"
          value={fmt(stats.leftToSpend)}
          icon={stats.leftToSpend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          accent
          tone={stats.leftToSpend >= 0 ? "positive" : "negative"}
        />
        <StatCard label="Total expenses" value={fmt(stats.totalExpenses)} icon={<ArrowUpRight className="h-4 w-4" />} />
        <Card className="col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs uppercase tracking-wider">Savings & Pockets</span>
              <PiggyBank className="h-4 w-4" />
            </div>
            {pocketBalances.length > 0 ? (
              <ul className="mt-1 space-y-1 overflow-auto pr-1">
                {pocketBalances.map(([name, bal]) => (
                  <li key={name} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: colorForKey(name) }} />
                      <span className="font-medium text-foreground text-sm truncate">{name}</span>
                    </span>
                    <span className={`text-sm font-semibold tabular-nums bg-secondary/40 px-2.5 py-1 rounded-md ${bal < 0 ? "text-destructive" : "text-foreground"}`}>
                      {fmt(bal)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No pockets yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Total income" value={fmt(stats.totalIncome)} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Items tracked" value={String(stats.itemCount)} icon={<Receipt className="h-4 w-4" />} />
      </div>


      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Spending by category</CardTitle>
            <span className="text-xs text-muted-foreground">This cycle</span>
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
                        {byCategory.map((c) => (
                          <Cell key={c.name} fill={colorForKey(c.name)} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2.5">
                  {byCategory.map((c) => (
                    <li key={c.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorForKey(c.name) }} />
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
              <div className="py-8 text-center space-y-2">
                <p className="text-sm text-muted-foreground">No active protections.</p>
                <p className="text-xs text-muted-foreground">
                  Toggle "Add protection" when logging a transaction.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {alerts.slice(0, 6).map((t) => (
                  <AlertRow key={t.id} txn={t} onDismiss={() => dismiss(t.id)} />
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

function AlertRow({ txn, onDismiss }: { txn: Transaction; onDismiss: () => void }) {
  const type = (txn.protection_type as ProtectionType) ?? "Return Window";
  const { status, daysLeft } = protectionStatus(type, txn.expiration_date!);

  const itemSummary =
    txn.items.length === 1
      ? txn.items[0].item_name
      : `${txn.items.length} items`;

  const chipClass =
    status === "expired"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : status === "warn"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";

  const chipLabel =
    status === "expired"
      ? "Expired"
      : daysLeft === 0
      ? "Today"
      : `${daysLeft}d`;

  const canOpenReceipt = txn.receipt_attached && isStoragePath(txn.receipt_location);

  async function openReceipt() {
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(txn.receipt_location, 3600);
    if (error || !data) { toast.error("Could not open receipt"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <li className="flex items-start gap-2 rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate">{txn.retailer}</p>
          <Badge variant="outline" className="font-normal text-[10px] h-4 px-1.5">{type}</Badge>
          {status === "expired" && (
            <Badge variant="destructive" className="font-normal text-[10px] h-4 px-1.5">Expired</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {itemSummary} · {fmt(txn.total_amount)} · expires {format(parseISO(txn.expiration_date!), "MMM d")}
        </p>
      </div>
      <span className={`shrink-0 text-xs font-medium tabular-nums rounded-md border px-2 py-0.5 ${chipClass}`}>
        {chipLabel}
      </span>
      {canOpenReceipt && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          title="Open receipt"
          onClick={openReceipt}
        >
          <FileText className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        title="Mark handled"
        onClick={onDismiss}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
    </li>
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
