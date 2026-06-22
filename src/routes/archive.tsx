import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import { Archive, FileText, Receipt, TrendingDown, TrendingUp } from "lucide-react";

import { useTransactions, useIncomes, useSavings, useCommitments } from "@/lib/store";
import { fmt } from "@/lib/format";
import { colorForKey } from "@/lib/colors";
import {
  useCycleSettings,
  listRecentCycles,
  isInCycle,
  type ActiveCycle,
} from "@/lib/cycle";
import { isStoragePath } from "@/components/ReceiptUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [
      { title: "Past Cycles — Ledgerly" },
      { name: "description", content: "Review previous cycle performance." },
    ],
  }),
  component: ArchivePage,
});

const PAGE = 12;

function ArchivePage() {
  const { settings } = useCycleSettings();
  const [count, setCount] = useState(PAGE);
  const cycles = useMemo(() => listRecentCycles(settings, count), [settings, count]);

  // Default to the cycle BEFORE the active one, if it exists.
  const [selectedISO, setSelectedISO] = useState<string>(() =>
    (cycles[1] ?? cycles[0])?.startISO ?? "",
  );
  const selected = useMemo(
    () => cycles.find((c) => c.startISO === selectedISO) ?? cycles[0],
    [cycles, selectedISO],
  );

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5 flex items-center gap-2">
          <Archive className="h-3.5 w-3.5" /> Historical lookup
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold">Past Cycles</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Read-only snapshot of a previous cycle. Use History to make edits.
        </p>
      </header>

      <Card className="mb-6">
        <CardContent className="p-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Cycle
            </label>
            <Select value={selectedISO} onValueChange={setSelectedISO}>
              <SelectTrigger><SelectValue placeholder="Pick a cycle" /></SelectTrigger>
              <SelectContent>
                {cycles.map((c, i) => (
                  <SelectItem key={c.startISO} value={c.startISO}>
                    {labelFor(c)}{i === 0 ? " · current" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={() => setCount((n) => n + PAGE)}
          >
            Load older
          </Button>
        </CardContent>
      </Card>

      {selected ? <CycleSnapshot cycle={selected} /> : (
        <p className="text-sm text-muted-foreground">No cycles to show.</p>
      )}
    </div>
  );
}

function labelFor(c: ActiveCycle): string {
  const sameYear = c.start.getFullYear() === c.end.getFullYear();
  const startFmt = sameYear ? "d MMM" : "d MMM yyyy";
  return `${format(c.start, startFmt)} – ${format(c.end, "d MMM yyyy")}`;
}

function CycleSnapshot({ cycle }: { cycle: ActiveCycle }) {
  const { items: txns } = useTransactions();
  const { items: incomes } = useIncomes();
  const { items: savings } = useSavings();
  const { items: commitments } = useCommitments();

  const cycleTxns = useMemo(
    () => txns.filter((t) => isInCycle(t.date, cycle)),
    [txns, cycle],
  );
  const cycleIncomes = useMemo(
    () => incomes.filter((i) => isInCycle(i.date, cycle)),
    [incomes, cycle],
  );
  const cycleSavings = useMemo(
    () => savings.filter((s) => isInCycle(s.date, cycle)),
    [savings, cycle],
  );
  const cycleCommitments = useMemo(
    () => commitments.filter((c) => c.next_due_date && isInCycle(c.next_due_date, cycle)),
    [commitments, cycle],
  );

  const stats = useMemo(() => {
    const totalExpenses = cycleTxns.reduce((s, t) => s + t.total_amount, 0);
    const totalIncome = cycleIncomes.reduce((s, i) => s + i.amount, 0);
    const savingsBalance = cycleSavings.reduce(
      (s, e) => s + (e.kind === "deposit" ? e.amount : -e.amount),
      0,
    );
    const itemCount = cycleTxns.reduce((s, t) => s + t.items.length, 0);
    const leftToSpend = totalIncome - totalExpenses - savingsBalance;
    return { totalExpenses, totalIncome, savingsBalance, itemCount, leftToSpend };
  }, [cycleTxns, cycleIncomes, cycleSavings]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    cycleTxns.forEach((t) =>
      t.items.forEach((it) =>
        map.set(it.category, (map.get(it.category) ?? 0) + it.price),
      ),
    );
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [cycleTxns]);

  const byRetailer = useMemo(() => {
    const map = new Map<string, number>();
    cycleTxns.forEach((t) => map.set(t.retailer, (map.get(t.retailer) ?? 0) + t.total_amount));
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [cycleTxns]);

  return (
    <>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
        {labelFor(cycle)}
        {cycle.isOverridden && <span className="ml-1 text-amber-600">· override</span>}
      </p>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mb-6">
        <Stat label="Spent" value={fmt(stats.totalExpenses)} icon={<TrendingDown className="h-4 w-4" />} />
        <Stat label="Income" value={fmt(stats.totalIncome)} icon={<TrendingUp className="h-4 w-4" />} />
        <Stat label="Saved (net)" value={fmt(stats.savingsBalance)} />
        <Stat label="Items" value={String(stats.itemCount)} icon={<Receipt className="h-4 w-4" />} />
        <Stat
          label="Left to spend"
          value={fmt(stats.leftToSpend)}
          accent
          tone={stats.leftToSpend >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Spending by category</CardTitle></CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No transactions in this cycle.</p>
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
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          color: "var(--popover-foreground)",
                          fontSize: 12,
                        }}
                        formatter={(v: number) => fmt(v)}
                      />
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
          <CardHeader><CardTitle>Top retailers</CardTitle></CardHeader>
          <CardContent>
            {byRetailer.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-2.5">
                {byRetailer.map((r) => (
                  <li key={r.name} className="flex items-center justify-between text-sm">
                    <span className="truncate">{r.name}</span>
                    <span className="text-muted-foreground tabular-nums">{fmt(r.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Transactions</CardTitle>
            <Link to="/history" className="text-xs text-primary hover:underline">Edit in History</Link>
          </CardHeader>
          <CardContent>
            {cycleTxns.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No transactions.</p>
            ) : (
              <ul className="divide-y divide-border">
                {cycleTxns.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.retailer}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(t.date), "d MMM")} · {t.items.length} item{t.items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-medium tabular-nums">{fmt(t.total_amount)}</span>
                      {t.receipt_attached && isStoragePath(t.receipt_location) && (
                        <ReceiptButton path={t.receipt_location} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Commitments due</CardTitle></CardHeader>
          <CardContent>
            {cycleCommitments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">None due in this cycle.</p>
            ) : (
              <ul className="divide-y divide-border">
                {cycleCommitments.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{c.item_name}</p>
                        <Badge variant="outline" className="font-normal text-[10px] h-4 px-1.5">
                          {c.category || "—"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Due {c.next_due_date ? format(parseISO(c.next_due_date), "d MMM") : "—"}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums">{fmt(c.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ReceiptButton({ path }: { path: string }) {
  async function open() {
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(path, 3600);
    if (error || !data) { toast.error("Could not open receipt"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      title="Open receipt"
      onClick={open}
    >
      <FileText className="h-3.5 w-3.5" />
    </Button>
  );
}

function Stat({
  label, value, icon, accent, tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
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
          {icon && <span className={accent ? toneClass || "text-primary" : ""}>{icon}</span>}
        </div>
        <p className={`text-2xl font-semibold tabular-nums ${tone === "negative" ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
