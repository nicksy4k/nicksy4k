import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { Loader2, Lock, Send, Sparkles } from "lucide-react";

import { RouteError } from "@/components/RouteError";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTransactions } from "@/lib/store";
import { useActiveCycle } from "@/lib/cycle";
import { fmt, todayLocalISO } from "@/lib/format";
import { HABIT_PRESETS, habitStats, priceChecks, pulse, topMerchants } from "@/lib/insights";
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
  "🎯 What outgoings are still due before payday?",
];

type Msg = { role: "user" | "assistant"; text: string };

function AskLedgerly({ cycleStart, cycleEnd }: { cycleStart: string; cycleEnd: string }) {
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
      const res = await ask({ data: { question, cycleStart, cycleEnd, history } });
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

function InsightsPage() {
  const { list: txs = [] } = useTransactions() as unknown as { list: import("@/lib/types").Transaction[] };
  const cycle = useActiveCycle();
  const today = todayLocalISO();

  const len = differenceInCalendarDays(cycle.end, cycle.start) + 1;
  const prevStart = format(addDays(cycle.start, -len), "yyyy-MM-dd");
  const prevEnd = format(addDays(cycle.start, -1), "yyyy-MM-dd");
  // Same point in the previous cycle, for fair pace comparisons.
  const elapsed = Math.max(0, differenceInCalendarDays(parseISO(today), cycle.start));
  const prevSamePoint = format(addDays(parseISO(prevStart), Math.min(elapsed, len - 1)), "yyyy-MM-dd");

  const p = useMemo(() => pulse(txs, cycle.startISO, cycle.endISO, today), [txs, cycle.startISO, cycle.endISO, today]);
  const prevP = useMemo(() => pulse(txs, prevStart, prevEnd, prevSamePoint), [txs, prevStart, prevEnd, prevSamePoint]);
  const habits = useMemo(
    () =>
      HABIT_PRESETS.map((h) => ({
        ...h,
        now: habitStats(txs, h.keywords, cycle.startISO, cycle.endISO),
        prev: habitStats(txs, h.keywords, prevStart, prevSamePoint),
      })),
    [txs, cycle.startISO, cycle.endISO, prevStart, prevSamePoint],
  );
  const merchants = useMemo(() => topMerchants(txs, cycle.startISO, cycle.endISO), [txs, cycle.startISO, cycle.endISO]);
  const prices = useMemo(() => priceChecks(txs), [txs]);
  const paceDiff = Math.round((p.spent - prevP.spent) * 100) / 100;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-sm text-muted-foreground">
          This cycle: {format(cycle.start, "d MMM")} – {format(cycle.end, "d MMM")}
        </p>
      </div>

      <AskLedgerly cycleStart={cycle.startISO} cycleEnd={cycle.endISO} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cycle pulse</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Spent so far" value={fmt(p.spent)} sub={`${p.daysElapsed} days in · ${p.daysLeft} to go`} />
          <Stat label="Daily burn" value={fmt(p.burn)} sub="average per day" />
          <Stat label="No-spend days" value={String(p.noSpend)} sub={p.streak > 0 ? `${p.streak}-day streak now` : "this cycle"} />
          <Stat
            label="vs last cycle"
            value={`${paceDiff > 0 ? "+" : paceDiff < 0 ? "−" : ""}${fmt(Math.abs(paceDiff))}`}
            sub={paceDiff > 0 ? "more at this point" : paceDiff < 0 ? "less at this point" : "same pace"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Habit spotlights</CardTitle>
          <CardDescription>Matched from item names on your receipts this cycle.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {habits.map((h) => {
            const diff = h.now.total - h.prev.total;
            return (
              <div key={h.id} className="rounded-lg border border-border/60 p-3">
                <p className="text-sm font-medium">
                  {h.emoji} {h.label}
                </p>
                <p className="text-xl font-semibold tabular-nums">{fmt(h.now.total)}</p>
                <p className="text-xs text-muted-foreground">
                  {h.now.count} item{h.now.count === 1 ? "" : "s"} · {h.now.orders} purchase{h.now.orders === 1 ? "" : "s"}
                  {h.now.count > 0 && ` · avg ${fmt(h.now.avgUnit)}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {diff === 0 ? "Same as last cycle so far" : `${diff > 0 ? "Up" : "Down"} ${fmt(Math.abs(diff))} vs last cycle so far`}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

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
            {prices.length === 0 && <p className="text-sm text-muted-foreground">Buy something twice and it'll show here.</p>}
            {prices.map((pc) => (
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
    </div>
  );
}
