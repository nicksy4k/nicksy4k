import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTutorial } from "@/components/tutorial/TutorialProvider";
import { useTutorialStatus, consumeTutorialPending } from "@/lib/tutorial";
import { dashboardTourSteps } from "@/lib/dashboardTourSteps";
import { useTransactions, useIncomes, useSavings, useCommitments } from "@/lib/store";
import { dueSoonOutgoings } from "@/lib/outgoings";
import { markOutgoingPaid, unmarkOutgoingPaid } from "@/lib/markOutgoingPaid";
import { ConfirmResetDialog } from "@/components/outgoings/ConfirmResetOptions";
import { useQueryClient } from "@tanstack/react-query";
import type { Commitment } from "@/lib/types";
import { fmt, mainExpensePortion } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ArrowUpRight,
  PiggyBank,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { useActiveCycle, isInCycle } from "@/lib/cycle";
import { countAwaitingDelivery } from "@/lib/delivery";
import { useDemoMode } from "@/lib/demoMode";
import { usePreferences } from "@/lib/preferences";
import { encouragementFor } from "@/lib/encouragement";
import { perCycleTotal } from "@/lib/outgoings";
import { promoAlerts } from "@/lib/subscriptions";
import { AttentionCard, urgentProtections } from "@/components/dashboard/AttentionCard";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Ledgerly Expense Tracker" },
      {
        name: "description",
        content: "Track itemized purchases, receipts, warranties, income and savings.",
      },
      { property: "og:title", content: "Dashboard — Ledgerly Expense Tracker" },
      {
        property: "og:description",
        content: "Track itemized purchases, receipts, warranties, income and savings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
  errorComponent: RouteError,
});

import { colorForKey } from "@/lib/colors";
import { rollUpJoy, sliceColor } from "@/lib/joy";

function DashboardPage() {
  const {
    items: realItems,
    dismiss,
    add: addTransaction,
    remove: removeTransaction,
  } = useTransactions();
  const { items: realIncomes } = useIncomes();
  const { items: realSavings, add: addSaving } = useSavings();
  const { items: commitments, update: updateCommitment } = useCommitments();
  const qc = useQueryClient();
  const [payTarget, setPayTarget] = useState<Commitment | null>(null);

  // Toast actions (e.g. Undo after marking an outgoing paid) fire long after
  // the render that created them, so they must read the freshest transaction
  // list — otherwise the just-auto-logged row is invisible and never removed.
  const itemsRef = useRef(realItems);
  itemsRef.current = realItems;

  const demo = useDemoMode();
  // While the tour is active we swap the whole dataset for a curated demo
  // slice so users can safely try filtering / expanding / logging without
  // touching their real ledger. Nothing here writes back to Supabase.
  const items = demo.active ? demo.transactions : realItems;
  const incomes = demo.active ? demo.incomes : realIncomes;
  const savings = demo.active ? demo.savings : realSavings;
  const cycle = useActiveCycle();
  const { prefs } = usePreferences();
  const blur = prefs.blurAmounts ? "amount-blur" : "";

  const { openWelcome } = useTutorial();
  const { completed: tutorialCompleted } = useTutorialStatus();

  // Auto-launch tour once after setup wizard finishes, or on first dashboard
  // visit if the user has never seen it. Consume the session flag either way.
  useEffect(() => {
    const pending = consumeTutorialPending();
    if (tutorialCompleted === null) return; // still loading
    if (pending || tutorialCompleted === false) {
      openWelcome(dashboardTourSteps);
    }
    // Runs once per mount; status hook re-renders when it resolves.
  }, [tutorialCompleted, openWelcome]);

  // Cycle-scoped slices — drive every summary, chart, and alert below.
  const dueSoon = useMemo(
    () => dueSoonOutgoings(demo.active ? [] : commitments, realSavings),
    [commitments, realSavings, demo.active],
  );

  const cycleItems = useMemo(() => items.filter((t) => isInCycle(t.date, cycle)), [items, cycle]);
  const cycleIncomes = useMemo(
    () => incomes.filter((i) => isInCycle(i.date, cycle)),
    [incomes, cycle],
  );
  const cycleSavings = useMemo(
    () => savings.filter((s) => isInCycle(s.date, cycle)),
    [savings, cycle],
  );

  const stats = useMemo(() => {
    const totalExpenses =
      cycleItems.reduce((s, t) => s + mainExpensePortion(t), 0) + demo.extraSpend;
    const totalIncome = cycleIncomes.reduce((s, i) => s + i.amount, 0);
    const savingsBalance = cycleSavings.reduce(
      (s, e) => s + (e.kind === "deposit" ? e.amount : -e.amount),
      0,
    );
    const itemCount = cycleItems.reduce((s, t) => s + t.items.length, 0);
    const receiptsAttached = cycleItems.filter((t) => t.receipt_attached).length;
    const leftToSpend = totalIncome - totalExpenses - savingsBalance;
    return {
      totalExpenses,
      totalIncome,
      savingsBalance,
      itemCount,
      receiptsAttached,
      leftToSpend,
      count: cycleItems.length,
    };
  }, [cycleItems, cycleIncomes, cycleSavings, demo.extraSpend]);

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
  const analyticsItems = useMemo(() => cycleItems.filter((t) => !t.is_pending), [cycleItems]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    analyticsItems.forEach((t) =>
      t.items.forEach((it) => {
        if (demo.filterCategory && it.category !== demo.filterCategory) return;
        const qty = it.quantity ?? 1;
        map.set(it.category, (map.get(it.category) ?? 0) + it.price * qty);
      }),
    );
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [analyticsItems, demo.filterCategory]);

  // "Planned fun" roll-up: categories the user has flagged as joy spending are
  // summarised as one friendly line instead of being singled out in the chart.
  const joySpend = useMemo(() => {
    const joy = new Set(prefs.joyCategories.map((c) => c.trim().toLowerCase()));
    if (joy.size === 0) return 0;
    return byCategory
      .filter((c) => joy.has(c.name.trim().toLowerCase()))
      .reduce((s, c) => s + c.value, 0);
  }, [byCategory, prefs.joyCategories]);

  /** What the pie chart and legend actually render: joy categories collapsed. */
  const chartCategories = useMemo(
    () => rollUpJoy(byCategory, prefs.joyCategories),
    [byCategory, prefs.joyCategories],
  );

  const encouragement = useMemo(
    () =>
      encouragementFor({
        leftToSpend: stats.leftToSpend,
        totalIncome: stats.totalIncome,
        totalExpenses: stats.totalExpenses,
        savingsBalance: stats.savingsBalance,
        itemCount: stats.itemCount,
        receiptsAttached: stats.receiptsAttached,
        transactionCount: stats.count,
        cycleEnd: cycle.end,
      }),
    [stats, cycle.end],
  );

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

  // Only protections that actually need action soon (or just expired) surface
  // in the unified "Needs your attention" card.
  const alerts = useMemo(() => urgentProtections(items), [items]);


  const awaitingDeliveryCount = useMemo(() => countAwaitingDelivery(items), [items]);

  const subsPromoAlerts = useMemo(() => promoAlerts(commitments), [commitments]);

  // Outgoings due inside the current cycle (bills + subscriptions share the pocket).
  const outgoings = useMemo(() => {
    const resetDate = format(addDays(cycle.end, 1), "yyyy-MM-dd");
    const due = commitments.filter((c) => c.next_due_date && c.next_due_date < resetDate);
    const total = due.reduce((s, c) => s + c.amount, 0);
    const unpaid = due.filter((c) => !c.paid).reduce((s, c) => s + c.amount, 0);
    const subs = due.filter((c) => c.is_subscription).reduce((s, c) => s + c.amount, 0);
    const everyCycle = perCycleTotal(commitments, cycle.type);
    return { total, unpaid, subs, bills: total - subs, everyCycle: everyCycle.total };
  }, [commitments, cycle]);

  const recent = items.slice(0, 5);

  return (
    <div className="p-0 md:p-4 max-w-7xl mx-auto">
      <AnnouncementBanner className="mb-6" />
      <header className="flex flex-wrap items-end justify-between gap-4 mb-5 md:mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
            Overview · {format(cycle.start, "d MMM")} – {format(cycle.end, "d MMM yyyy")}
            {cycle.isOverridden && <span className="ml-1 text-amber-500">· override</span>}
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold">Dashboard</h1>
          {encouragement && <p className="mt-2 text-sm text-muted-foreground">{encouragement}</p>}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card
          data-tour="left-to-spend"
          className="lg:col-span-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5"
        >
          <CardContent className="p-4 md:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="min-w-0">

              <p className="text-sm uppercase tracking-wider text-muted-foreground mb-1">
                Left to spend
              </p>
              <p
                className={`text-4xl md:text-5xl font-bold tabular-nums tracking-tight ${blur} ${stats.leftToSpend >= 0 ? "text-foreground" : "text-destructive"}`}
              >
                {fmt(stats.leftToSpend)}
              </p>
              <p className={`text-sm text-muted-foreground mt-2 ${blur}`}>
                {fmt(stats.totalExpenses)} spent · {fmt(stats.totalIncome)} income ·{" "}
                {fmt(stats.savingsBalance)} saved
              </p>
              {joySpend > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Including{" "}
                  <span className={`font-medium text-foreground ${blur}`}>{fmt(joySpend)}</span> of
                  planned fun — budgeted for, guilt-free.
                </p>
              )}
            </div>
            <Button asChild size="lg" className="shrink-0 w-full sm:w-auto">
              <Link to="/new">
                <Plus className="h-4 w-4" />
                Log transaction
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs uppercase tracking-wider">Savings & Pockets</span>
              <PiggyBank className="h-4 w-4" />
            </div>
            {pocketBalances.length > 0 ? (
              <ul className="mt-1 space-y-1 overflow-auto pr-1">
                {pocketBalances.map(([name, bal]) => (
                  <li
                    key={name}
                    className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: colorForKey(name) }}
                      />
                      <span className="font-medium text-foreground text-sm truncate">{name}</span>
                    </span>
                    <span
                      className={`text-sm font-semibold tabular-nums bg-secondary/40 px-2.5 py-1 rounded-md ${bal < 0 ? "text-destructive" : "text-foreground"}`}
                    >
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

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 mb-6">
        <StatCard
          label="Total expenses"
          value={fmt(stats.totalExpenses)}
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <StatCard
          label="Total income"
          value={fmt(stats.totalIncome)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Items tracked"
          value={String(stats.itemCount)}
          icon={<Receipt className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3 mb-6">
        <Card data-tour="category-chart" className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Where your money went</CardTitle>
            <span className="text-xs text-muted-foreground">This cycle</span>
          </CardHeader>
          <CardContent>
            {prefs.hideCategoryChart ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Chart hidden — you can turn it back on in Settings → Personalise.
              </p>
            ) : chartCategories.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="grid md:grid-cols-2 gap-4 items-center">
                <div className="h-[240px]">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={chartCategories}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={95}
                        strokeWidth={0}
                      >
                        {chartCategories.map((c) => (
                          <Cell key={c.name} fill={sliceColor(c.name, colorForKey)} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipStyle} formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2.5">
                  {chartCategories.map((c) => (
                    <li key={c.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: sliceColor(c.name, colorForKey) }}
                        />
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
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Outgoings this cycle
                </p>
                <p className="text-2xl font-semibold tabular-nums mt-1">{fmt(outgoings.total)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  bills {fmt(outgoings.bills)} + subs {fmt(outgoings.subs)} ·{" "}
                  {fmt(outgoings.unpaid)} still to pay
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {fmt(outgoings.everyCycle)} typical per cycle across all tracked
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link to="/commitments">View</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <AttentionCard
          protections={alerts}
          promos={subsPromoAlerts}
          deliveryCount={awaitingDeliveryCount}
          onDismiss={dismiss}
          highlightedId={demo.openAlertId}
          dueSoon={dueSoon.rows}
          pocketBalance={dueSoon.pocketBalance}
          dueSoonTotal={dueSoon.totalDue}
          onMarkPaid={demo.active ? undefined : setPayTarget}
        />

        <ConfirmResetDialog
          item={payTarget}
          cycle={cycle}
          onClose={() => setPayTarget(null)}
          onConfirm={async (c, newDue) => {
            setPayTarget(null);
            await markOutgoingPaid(
              {
                transactions: itemsRef.current,
                updateCommitment,
                addTransaction,
                removeTransaction,
                addSaving,
                onDebtsChanged: () => qc.invalidateQueries({ queryKey: ["debts"] }),
              },
              c,
              newDue,
            );
            toast.success("Paid · logged & deducted from Bill Money", {
              action: {
                label: "Undo",
                onClick: () => {
                  void (async () => {
                    // Pull the freshest list so the row auto-logged a moment ago
                    // is included and actually gets removed.
                    await qc.refetchQueries({ queryKey: ["transactions"] });
                    const latest =
                      qc.getQueryData<Transaction[]>(["transactions"]) ?? itemsRef.current;
                    await unmarkOutgoingPaid(
                      {
                        transactions: latest,
                        updateCommitment,
                        addTransaction,
                        removeTransaction,
                        addSaving,
                        onDebtsChanged: () => qc.invalidateQueries({ queryKey: ["debts"] }),
                      },
                      { ...c, paid: true, prev_due_date: c.next_due_date ?? null },
                    );
                  })();
                },
              },
            });
          }}
        />

      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top retailers</CardTitle>
          </CardHeader>
          <CardContent>
            {byRetailer.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer>
                  <BarChart data={byRetailer} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: number) => fmt(v)}
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    />
                    <Bar dataKey="total" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-tour="recent">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent</CardTitle>
            <Link to="/history" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No transactions yet.</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((t) => {
                  const expanded = demo.expandedTxnId === t.id;
                  return (
                    <li
                      key={t.id}
                      className={`rounded-lg ${expanded ? "border border-primary/40 bg-primary/5 p-2.5" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.retailer}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(t.date), "MMM d")} · {t.items.length} item
                            {t.items.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <span className="text-sm font-medium tabular-nums">
                          {fmt(t.total_amount)}
                        </span>
                      </div>
                      {expanded && (
                        <ul className="mt-2 space-y-1 border-t border-border/40 pt-2">
                          {t.items.map((it) => (
                            <li
                              key={it.id}
                              className="flex items-center justify-between text-xs text-muted-foreground"
                            >
                              <span className="truncate">
                                {it.item_name}
                                <span className="ml-1.5 text-[10px] uppercase tracking-wide opacity-70">
                                  {it.category}
                                </span>
                              </span>
                              <span className="tabular-nums">
                                {fmt(it.price * (it.quantity ?? 1))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
  tone,
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
    <Card className={accent ? "border-primary/30 bg-primary/5" : "bg-card/70"}>
      <CardContent className="p-3.5 md:p-5">
        <div className="flex items-center justify-between gap-2 text-muted-foreground mb-1.5">
          <span className="text-[10px] md:text-xs uppercase tracking-wider min-w-0 truncate">
            {label}
          </span>
          <span className={`shrink-0 ${accent ? toneClass || "text-primary" : ""}`}>{icon}</span>
        </div>
        <p
          className={`text-xl md:text-2xl font-bold tabular-nums ${tone === "negative" ? "text-destructive" : ""}`}
        >
          {value}
        </p>

      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="h-[240px] grid place-items-center text-sm text-muted-foreground">
      Add a transaction to see analytics.
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
  },
  itemStyle: { color: "var(--popover-foreground)" },
  labelStyle: { color: "var(--popover-foreground)" },
};
