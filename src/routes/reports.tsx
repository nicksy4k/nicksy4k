import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, subDays } from "date-fns";
import { CalendarIcon, Check, ChevronDown } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/lib/store";
import type { Transaction } from "@/lib/types";
import { fmt, mainExpensePortion, todayLocalISO } from "@/lib/format";
import { colorForKey } from "@/lib/colors";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports & Analytics — Ledgerly" }] }),
  component: ReportsPage,
});

function DateField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const date = value ? parseISO(value) : undefined;
  return (
    <div className="flex-1 min-w-[160px]">
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <CalendarIcon className="h-4 w-4 mr-2" />
            {date ? format(date, "PPP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => d && onChange(format(d, "yyyy-MM-dd"))}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CategoryMultiSelect({
  all,
  selected,
  onChange,
}: {
  all: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const label =
    selected.size === 0 || selected.size === all.length
      ? "All categories"
      : selected.size === 1
        ? Array.from(selected)[0]
        : `${selected.size} selected`;
  return (
    <div className="flex-1 min-w-[200px]">
      <Label className="text-xs text-muted-foreground mb-1.5 block">Categories</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between font-normal">
            <span className="truncate">{label}</span>
            <ChevronDown className="h-4 w-4 opacity-60 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Filter</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange(new Set(all))}>All</Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange(new Set())}>Clear</Button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {all.map((c) => {
              const checked = selected.has(c);
              return (
                <label key={c} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      const next = new Set(selected);
                      if (v) next.add(c);
                      else next.delete(c);
                      onChange(next);
                    }}
                  />
                  <span className="text-sm flex-1">{c}</span>
                  {checked && <Check className="h-3.5 w-3.5 text-primary" />}
                </label>
              );
            })}
            {all.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-3">No categories yet.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ReportsPage() {
  const { list: categories } = useCategories();
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => todayLocalISO());
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["reports-transactions", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .eq("is_pending", false)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Transaction[];
    },
  });

  const catFilterActive = selectedCats.size > 0 && selectedCats.size < categories.length;

  const filtered = useMemo(() => {
    if (!catFilterActive) return txs;
    return txs.filter((t) => t.items.some((i) => selectedCats.has(i.category)));
  }, [txs, selectedCats, catFilterActive]);

  const totalSpent = useMemo(
    () => filtered.reduce((sum, t) => sum + mainExpensePortion(t), 0),
    [filtered],
  );
  const avg = filtered.length ? totalSpent / filtered.length : 0;

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of filtered) {
      const main = mainExpensePortion(t);
      const itemsSum = t.items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0) || 1;
      for (const i of t.items) {
        if (catFilterActive && !selectedCats.has(i.category)) continue;
        const share = (i.price * (i.quantity ?? 1)) / itemsSum;
        totals.set(i.category, (totals.get(i.category) ?? 0) + share * main);
      }
    }
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value: Math.max(0, value) }))
      .filter((d) => d.value > 0.005)
      .sort((a, b) => b.value - a.value);
  }, [filtered, selectedCats, catFilterActive]);

  const breakdownTotal = categoryBreakdown.reduce((s, d) => s + d.value, 0);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Analytics</p>
        <h1 className="text-3xl md:text-4xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Query your spending across any date range — independent of the active 28-day cycle.
        </p>
      </header>

      <Card className="mb-6">
        <CardContent className="p-5 flex flex-col sm:flex-row gap-4">
          <DateField label="Start date" value={startDate} onChange={setStartDate} />
          <DateField label="End date" value={endDate} onChange={setEndDate} />
          <CategoryMultiSelect all={categories} selected={selectedCats} onChange={setSelectedCats} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="sm:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Total spent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{fmt(totalSpent)}</p>
            <p className="text-xs text-muted-foreground mt-1">Excludes BNPL-deferred amounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Average</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{fmt(avg)}</p>
            <p className="text-xs text-muted-foreground mt-1">per transaction</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Spend by category</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {isLoading ? "Loading…" : "No spending in the selected range."}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {categoryBreakdown.map((d) => (
                        <Cell key={d.name} fill={colorForKey(d.name)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => fmt(v)}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ display: "none" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {categoryBreakdown.map((d) => {
                  const pct = breakdownTotal ? (d.value / breakdownTotal) * 100 : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-3 text-sm">
                      <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: colorForKey(d.name) }} />
                      <span className="flex-1 truncate">{d.name}</span>
                      <span className="tabular-nums text-muted-foreground text-xs w-12 text-right">{pct.toFixed(1)}%</span>
                      <span className="tabular-nums font-medium w-20 text-right">{fmt(d.value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No transactions in this range.</p>
          ) : (
            <div className="divide-y">
              {filtered.map((t) => {
                const cats = Array.from(new Set(t.items.map((i) => i.category)));
                return (
                  <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {format(parseISO(t.date), "MMM d, yyyy")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{t.retailer}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {cats.map((c) => (
                          <Badge
                            key={c}
                            variant="outline"
                            className="font-normal text-[10px] py-0"
                            style={{ borderColor: colorForKey(c), color: colorForKey(c) }}
                          >
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right tabular-nums font-medium">{fmt(mainExpensePortion(t))}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
