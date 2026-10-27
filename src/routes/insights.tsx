import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { Loader2, Lock, Pencil, Plus, Send, Sparkles } from "lucide-react";

import { RouteError } from "@/components/RouteError";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIncomes, useSavings, useTransactions } from "@/lib/store";
import { computeSplit, useSafeSplit } from "@/lib/safeSplit";
import { useSavedHabits, type ScratchRef } from "@/lib/useHabits";
import { isInCycle, useActiveCycle } from "@/lib/cycle";
import { fmt, mainExpensePortion, todayLocalISO } from "@/lib/format";
import {
  HABIT_PRESETS,
  budgetProgress,
  habitStats,
  mergeHabits,
  parseKeywords,
  playRunway,
  priceAlerts,
  priceChecks,
  pulse,
  smallSpends,
  takeawayBreakdown,
  topMerchants,
  type CustomHabit,
} from "@/lib/insights";
import { askLedgerly } from "@/lib/api/insights-ai.functions";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights & Trends — Ledgerly" },
      { name: "description", content: "Habit trackers, cycle pace, price checks and a read-only AI money assistant." },
      { property: "og:title", content: "Insights & Trends — Ledgerly" },
      { property: "og:description", content: "Habit trackers, cycle pace, price checks and a read-only AI money assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InsightsPage,
  errorComponent: RouteError,
});

const QUICK = [
  "🥤 How many energy drinks have I bought this cycle and what did they cost?",
  "🍔 How much have I spent on takeaways this cycle?",
  "🏷️ Which items have I paid different prices for, and where was cheapest?",
  "🧸 What's my average spend on plushies per cycle?",
  "🎯 What outgoings are still due before payday?",
];

type Msg = { role: "user" | "assistant"; text: string };

function AskLedgerly({ cycleStart, cycleEnd, cycleType }: { cycleStart: string; cycleEnd: string; cycleType: string }) {
  const ask = useServerFn(askLedgerly);
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setErr(null);
    setBusy(true);
    const history = msgs.slice(-6);
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setQ("");
    try {
      const res = await ask({ data: { question, cycleStart, cycleEnd, cycleType, history } });
      if (res.error) setErr(res.error);
      else setMsgs((m) => [...m, { role: "assistant", text: res.answer }]);
    } catch {
      setErr("Ask Ledgerly couldn't answer just now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Ask Ledgerly
        </CardTitle>
        <CardDescription>Ask anything about your spending, prices or this cycle.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {QUICK.map((s) => (
              <Button key={s} variant="outline" size="sm" className="h-auto whitespace-normal text-left text-xs" onClick={() => send(s)} disabled={busy}>
                {s}
              </Button>
            ))}
          </div>
        )}
        {msgs.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm"
                    : "max-w-[90%] rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
                }
              >
                {m.text}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </div>
            )}
          </div>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(q);
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What did I spend at Tesco this month?" maxLength={500} disabled={busy} />
          <Button type="submit" size="icon" disabled={busy || !q.trim()} aria-label="Ask">
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" /> Read-only: it can only look at your own records and can't change anything.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function HabitDialog({
  open,
  onOpenChange,
  initial,
  scratch,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: CustomHabit | null;
  scratch: ScratchRef[];
  onSave: (h: CustomHabit) => void;
  onDelete?: () => void;
}) {
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("");
  const [kw, setKw] = useState("");
  const [budget, setBudget] = useState("");
  const [scratchId, setScratchId] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const k = open ? (initial?.id ?? "new") : null;
  if (k !== key) {
    setKey(k);
    setLabel(initial?.label ?? "");
    setEmoji(initial?.emoji ?? "⭐");
    setKw(initial?.keywords.join(", ") ?? "");
    setBudget(initial?.budget ? String(initial.budget) : "");
    setScratchId(initial?.scratchId ?? "");
  }
  const keywords = parseKeywords(kw);
  const valid = label.trim() && keywords.length > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit habit" : "New habit"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="w-16">
              <Label>Emoji</Label>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
            </div>
            <div className="flex-1">
              <Label>Name</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="e.g. Coffee" />
            </div>
          </div>
          <div>
            <Label>Match words (comma separated)</Label>
            <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="coffee, latte, costa" maxLength={300} />
            <p className="mt-1 text-xs text-muted-foreground">Matched against item names, categories and shop names.</p>
          </div>
          <div>
            <Label>Budget per cycle (optional)</Label>
            <Input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" placeholder="e.g. 40" disabled={!!scratchId} />
          </div>
          {scratch.length > 0 && (
            <div>
              <Label>Or use a scratchpad item as the budget</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={scratchId}
                onChange={(e) => setScratchId(e.target.value)}
              >
                <option value="">None</option>
                {scratch.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({fmt(s.amount)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {onDelete && (
            <Button variant="ghost" className="text-destructive" onClick={onDelete}>
              {HABIT_PRESETS.some((p) => p.id === initial?.id) ? "Hide" : "Delete"}
            </Button>
          )}
          <Button
            disabled={!valid}
            onClick={() =>
              onSave({
                id: initial?.id ?? `h_${Date.now()}`,
                label: label.trim(),
                emoji: emoji.trim() || "⭐",
                keywords,
                budget: scratchId ? null : Number(budget) > 0 ? Math.round(Number(budget) * 100) / 100 : null,
                scratchId: scratchId || null,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InsightsPage() {
  const { items: txs } = useTransactions();
  const { items: incomes } = useIncomes();
  const { items: savings } = useSavings();
  const cycle = useActiveCycle();
  const safeSplit = useSafeSplit();
  const { saved, save, scratch } = useSavedHabits();
  const [editing, setEditing] = useState<CustomHabit | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const today = todayLocalISO();

  const len = differenceInCalendarDays(cycle.end, cycle.start) + 1;
  const prevStart = format(addDays(cycle.start, -len), "yyyy-MM-dd");
  const prevEnd = format(addDays(cycle.start, -1), "yyyy-MM-dd");
  // Same point in the previous cycle, for fair pace comparisons.
  const elapsed = Math.max(0, differenceInCalendarDays(parseISO(today), cycle.start));
  const prevSamePoint = format(addDays(parseISO(prevStart), Math.min(elapsed, len - 1)), "yyyy-MM-dd");

  const p = useMemo(() => pulse(txs, cycle.startISO, cycle.endISO, today), [txs, cycle.startISO, cycle.endISO, today]);
  const prevP = useMemo(() => pulse(txs, prevStart, prevEnd, prevSamePoint), [txs, prevStart, prevEnd, prevSamePoint]);

  // Play money, same maths as the dashboard: Left to spend minus Keep-Safe target and put-aside items.
  const play = useMemo(() => {
    const spent = txs.filter((t) => isInCycle(t.date, cycle)).reduce((s, t) => s + mainExpensePortion(t), 0);
    const inc = incomes.filter((i) => isInCycle(i.date, cycle)).reduce((s, i) => s + i.amount, 0);
    const sav = savings
      .filter((s) => isInCycle(s.date, cycle))
      .reduce((s, e) => s + (e.kind === "deposit" ? e.amount : -e.amount), 0);
    const left = inc - spent - sav;
    const target = safeSplit.targets[String(cycle.start)] ?? (Math.max(0, left) * safeSplit.keepPct) / 100;
    const reserved = scratch.filter((s) => (s as { reserved?: boolean }).reserved).reduce((s, x) => s + (x.amount || 0), 0);
    return Math.round((computeSplit(left, target).play - reserved) * 100) / 100;
  }, [txs, incomes, savings, cycle, safeSplit, scratch]);
  const runway = playRunway(play, p.burn, p.daysLeft);

  const habitList = useMemo(() => mergeHabits(saved), [saved]);
  const habits = useMemo(
    () =>
      habitList.map((h) => {
        const linked = h.scratchId ? scratch.find((s) => s.id === h.scratchId) : null;
        const budget = linked ? linked.amount : (h.budget ?? 0);
        const now = habitStats(txs, h.keywords, cycle.startISO, cycle.endISO);
        return {
          h,
          now,
          prev: habitStats(txs, h.keywords, prevStart, prevSamePoint),
          budget,
          linkedName: linked?.name,
          progress: budgetProgress(now.total, budget),
        };
      }),
    [habitList, scratch, txs, cycle.startISO, cycle.endISO, prevStart, prevSamePoint],
  );
  const merchants = useMemo(() => topMerchants(txs, cycle.startISO, cycle.endISO), [txs, cycle.startISO, cycle.endISO]);
  const prices = useMemo(() => priceChecks(txs, 10), [txs]);
  const alerts = useMemo(() => priceAlerts(prices), [prices]);
  const small = useMemo(() => smallSpends(txs, cycle.startISO, cycle.endISO), [txs, cycle.startISO, cycle.endISO]);
  const takeawayKw = habitList.find((h) => h.id === "takeaway")?.keywords ?? HABIT_PRESETS[1].keywords;
  const takeaways = useMemo(
    () => takeawayBreakdown(txs, takeawayKw, cycle.startISO, cycle.endISO),
    [txs, takeawayKw, cycle.startISO, cycle.endISO],
  );
  const maxDay = Math.max(1, ...takeaways.days.map((d) => d.orders));
  const paceDiff = Math.round((p.spent - prevP.spent) * 100) / 100;

  const upsert = (h: CustomHabit) => {
    const rest = saved.filter((x) => x.id !== h.id);
    void save([...rest, h]);
    setDialogOpen(false);
  };
  const removeHabit = (h: CustomHabit) => {
    const isPreset = HABIT_PRESETS.some((x) => x.id === h.id);
    const rest = saved.filter((x) => x.id !== h.id);
    void save(isPreset ? [...rest, { ...h, hidden: true }] : rest);
    setDialogOpen(false);
  };
  const hiddenPresets = saved.filter((h) => h.hidden);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-sm text-muted-foreground">
          This cycle: {format(cycle.start, "d MMM")} – {format(cycle.end, "d MMM")}
        </p>
      </div>

      <AskLedgerly cycleStart={cycle.startISO} cycleEnd={cycle.endISO} cycleType={cycle.type} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cycle pulse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Spent so far" value={fmt(p.spent)} sub={`${p.daysElapsed} days in · ${p.daysLeft} to go`} />
            <Stat label="Daily burn" value={fmt(p.burn)} sub="average per day" />
            <Stat label="No-spend days" value={String(p.noSpend)} sub={p.streak > 0 ? `${p.streak}-day streak now` : "this cycle"} />
            <Stat
              label="vs last cycle"
              value={`${paceDiff > 0 ? "+" : paceDiff < 0 ? "−" : ""}${fmt(Math.abs(paceDiff))}`}
              sub={paceDiff > 0 ? "more at this point" : paceDiff < 0 ? "less at this point" : "same pace"}
            />
          </div>
          {safeSplit.enabled && (
            <div
              className={`rounded-lg border p-3 ${runway.reachesPayday ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}
            >
              <p className="text-sm font-medium">
                {runway.reachesPayday ? "✅ Play money should last to payday" : "⚠️ Play money may run out before payday"}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmt(Math.max(0, play))} guilt-free play left ·{" "}
                {runway.days === Infinity
                  ? "no spending yet to measure"
                  : `lasts about ${runway.days} day${runway.days === 1 ? "" : "s"} at ${fmt(p.burn)}/day`}{" "}
                · {p.daysLeft} days to payday · stay under {fmt(runway.safeDaily)}/day to make it
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">Habit spotlights</CardTitle>
            <CardDescription>Tap a habit to edit its words or budget.</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {habits.map(({ h, now, prev, progress, budget, linkedName }) => {
              const diff = Math.round((now.total - prev.total) * 100) / 100;
              const unitDiff = now.count - prev.count;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setEditing(h);
                    setDialogOpen(true);
                  }}
                  className="rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <p className="flex items-center justify-between text-sm font-medium">
                    <span>
                      {h.emoji} {h.label}
                    </span>
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {fmt(now.total)}
                    {progress && <span className="text-sm font-normal text-muted-foreground"> of {fmt(budget)}</span>}
                  </p>
                  {progress && (
                    <div className="my-1.5">
                      <Progress value={Math.min(100, progress.pct)} className={progress.over ? "[&>div]:bg-destructive" : ""} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {progress.over ? `Over by ${fmt(now.total - budget)}` : `${fmt(progress.left)} left`} · {progress.pct}%
                        {linkedName && ` · from "${linkedName}"`}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {now.count} item{now.count === 1 ? "" : "s"} · {now.orders} purchase{now.orders === 1 ? "" : "s"}
                    {now.count > 0 && ` · avg ${fmt(now.avgUnit)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {diff === 0 && unitDiff === 0
                      ? "Same as last cycle so far"
                      : `${diff > 0 ? "Up" : "Down"} ${fmt(Math.abs(diff))} · ${unitDiff >= 0 ? "+" : "−"}${Math.abs(unitDiff)} items vs last cycle so far`}
                  </p>
                </button>
              );
            })}
          </div>
          {hiddenPresets.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Hidden:
              {hiddenPresets.map((h) => (
                <Button key={h.id} size="sm" variant="ghost" className="h-7 text-xs" onClick={() => upsert({ ...h, hidden: false })}>
                  {h.emoji} {h.label} · show
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">£5 &amp; under club</CardTitle>
            <CardDescription>Little buys add up.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold tabular-nums">{fmt(small.total)}</p>
            <p className="text-xs text-muted-foreground">
              {small.count} small item{small.count === 1 ? "" : "s"} this cycle
            </p>
            {small.top.map((t) => (
              <div key={t.name} className="flex justify-between text-sm">
                <span className="truncate">{t.name}</span>
                <span className="tabular-nums text-muted-foreground">{fmt(t.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Takeaways breakdown</CardTitle>
            <CardDescription>Where and when you order this cycle.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {takeaways.platforms.length === 0 && <p className="text-sm text-muted-foreground">No takeaways yet this cycle. 🎉</p>}
            {takeaways.platforms.map((pl) => (
              <div key={pl.name} className="flex justify-between text-sm">
                <span>{pl.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {pl.orders}× · <span className="font-medium text-foreground">{fmt(pl.total)}</span>
                </span>
              </div>
            ))}
            {takeaways.platforms.length > 0 && (
              <div className="flex items-end justify-between gap-1 pt-2">
                {takeaways.days.map((d) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-12 w-full items-end">
                      <div className="w-full rounded-sm bg-primary/70" style={{ height: `${(d.orders / maxDay) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d.day}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top places this cycle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {merchants.length === 0 && <p className="text-sm text-muted-foreground">No spending yet this cycle.</p>}
            {merchants.map((m) => (
              <div key={m.name} className="flex items-center justify-between text-sm">
                <span className="truncate">{m.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {m.visits}× · avg {fmt(m.avg)} · <span className="text-foreground font-medium">{fmt(m.total)}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Price check</CardTitle>
            <CardDescription>Things you buy again and again.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.slice(0, 3).map((a) => (
              <div key={`alert-${a.item}`} className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                <p className="font-medium text-foreground">⚠️ {a.item}</p>
                <p className="text-muted-foreground">
                  Last paid {fmt(a.last.price)}
                  {a.last.retailer && ` at ${a.last.retailer}`} — {fmt(a.extra)} more than your best {fmt(a.low.price)}
                  {a.low.retailer && ` at ${a.low.retailer}`}
                </p>
              </div>
            ))}
            {prices.length === 0 && <p className="text-sm text-muted-foreground">Buy something twice and it'll show here.</p>}
            {prices.slice(0, 6).map((pc) => (
              <div key={pc.item} className="text-sm">
                <p className="font-medium">
                  {pc.item} <span className="text-xs text-muted-foreground">· {pc.buys} buys</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Best {fmt(pc.low.price)} at {pc.low.retailer || "?"} · Highest {fmt(pc.high.price)} at {pc.high.retailer || "?"} · Last{" "}
                  {fmt(pc.last.price)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <HabitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        scratch={scratch}
        onSave={upsert}
        onDelete={editing ? () => removeHabit(editing) : undefined}
      />
    </div>
  );
}
