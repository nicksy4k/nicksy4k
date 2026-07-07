import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useIncomes, useIncomeCategories, useSavings, useRecurringIncomes } from "@/lib/store";
import { fmt, todayLocalISO } from "@/lib/format";
import { useActiveCycle, isInCycle, advanceByCadence } from "@/lib/cycle";
import { generateDueRecurringIncomes } from "@/lib/recurringIncome";
import { useQueryClient } from "@tanstack/react-query";
import type { IncomeCadence, RecurringIncome } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, TrendingUp, Split, PlusCircle, Repeat, Pause, Play, Pencil, Zap } from "lucide-react";
import { colorForKey } from "@/lib/colors";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/income")({
  head: () => ({ meta: [{ title: "Income — Ledgerly" }] }),
  component: IncomePage,
});

function IncomePage() {
  const { items, add, remove } = useIncomes();
  const { items: savingsItems, add: addSaving } = useSavings();
  const { list: categories } = useIncomeCategories();
  const cycle = useActiveCycle();

  const [date, setDate] = useState(todayLocalISO());
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(categories[0] ?? "Other");
  const [notes, setNotes] = useState("");

  // Split income state — each line routes money into a pocket (savings account).
  type Split = { id: string; pocket: string; amount: string };
  const [splits, setSplits] = useState<Split[]>([]);
  const [newPocketOpenFor, setNewPocketOpenFor] = useState<string | null>(null);
  const [newPocketName, setNewPocketName] = useState("");
  // Locally-created pockets that don't yet have any savings row.
  const [draftPockets, setDraftPockets] = useState<string[]>([]);

  const pocketNames = useMemo(() => {
    const set = new Set<string>(draftPockets);
    savingsItems.forEach((s) => set.add(s.account));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [savingsItems, draftPockets]);

  const total = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);
  const thisCycle = useMemo(() => {
    return items
      .filter((i) => isInCycle(i.date, cycle))
      .reduce((s, i) => s + i.amount, 0);
  }, [items, cycle]);

  const totalAmt = parseFloat(amount) || 0;
  const splitSum = splits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const remainder = +(totalAmt - splitSum).toFixed(2);
  const overAllocated = splitSum > totalAmt + 0.0001;

  function addSplitRow() {
    setSplits((s) => [...s, { id: crypto.randomUUID(), pocket: "", amount: "" }]);
  }
  function updateSplit(id: string, patch: Partial<Split>) {
    setSplits((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeSplit(id: string) {
    setSplits((s) => s.filter((x) => x.id !== id));
  }
  function confirmNewPocket() {
    const name = newPocketName.trim();
    if (!name) return;
    if (!draftPockets.includes(name) && !pocketNames.includes(name)) {
      setDraftPockets((d) => [...d, name]);
    }
    if (newPocketOpenFor) updateSplit(newPocketOpenFor, { pocket: name });
    setNewPocketName("");
    setNewPocketOpenFor(null);
  }

  async function save() {
    const amt = parseFloat(amount);
    if (!source.trim() || !(amt > 0)) {
      toast.error("Enter a source and a positive amount.");
      return;
    }
    const validSplits = splits.filter((s) => s.pocket && (parseFloat(s.amount) || 0) > 0);
    const sum = validSplits.reduce((s, x) => s + parseFloat(x.amount), 0);
    if (sum > amt + 0.0001) {
      toast.error("Split total exceeds the income amount.");
      return;
    }

    try {
      const trimmedSource = source.trim();
      await add({
        date,
        source: trimmedSource,
        amount: amt,
        category: category || "Other",
        notes: notes.trim() || undefined,
      });

      for (const s of validSplits) {
        await addSaving({
          date,
          kind: "deposit",
          amount: parseFloat(s.amount),
          account: s.pocket,
          notes: `Routed from income: ${trimmedSource}`,
        });
      }

      setSource(""); setAmount(""); setNotes("");
      setSplits([]); setDraftPockets([]);
      if (validSplits.length > 0) {
        toast.success(`Income added · ${fmt(sum)} routed to ${validSplits.length} pocket${validSplits.length === 1 ? "" : "s"}, ${fmt(amt - sum)} to main`);
      } else {
        toast.success("Income added");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save income");
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Earnings</p>
        <h1 className="text-3xl md:text-4xl font-semibold">Income</h1>
      </header>

      {/* Add income — at the very top for quick mobile entry */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Add income</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Source"><Input placeholder="e.g. Employer Ltd." value={source} onChange={(e) => setSource(e.target.value)} /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Amount (£)"><Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[...categories].sort((a, b) => a.localeCompare(b)).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notes (optional)"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

          {/* Split income */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <Split className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Route to pockets</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Any unallocated amount stays in your main balance.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addSplitRow}>
                <Plus className="h-4 w-4" /> Add split
              </Button>
            </div>

            {splits.length > 0 && (
              <div className="space-y-2">
                {splits.map((s) => (
                  <div key={s.id} className="grid grid-cols-[1fr_120px_auto] gap-2 items-start">
                    <Select
                      value={s.pocket || undefined}
                      onValueChange={(v) => {
                        if (v === "__new__") {
                          setNewPocketName("");
                          setNewPocketOpenFor(s.id);
                          return;
                        }
                        updateSplit(s.id, { pocket: v });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Destination pocket" />
                      </SelectTrigger>
                      <SelectContent>
                        {pocketNames.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">No pockets yet</div>
                        ) : (
                          pocketNames.map((p) => (
                            <SelectItem key={p} value={p}>
                              <span className="inline-flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorForKey(p) }} />
                                {p}
                              </span>
                            </SelectItem>
                          ))
                        )}
                        <SelectSeparator />
                        <SelectItem value="__new__">
                          <span className="inline-flex items-center gap-2 text-primary">
                            <PlusCircle className="h-3.5 w-3.5" />
                            Create new pocket…
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      inputMode="decimal"
                      placeholder="0.00"
                      value={s.amount}
                      onChange={(e) => updateSplit(s.id, { amount: e.target.value })}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSplit(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground">Allocated</span>
                  <span className="tabular-nums font-medium">{fmt(splitSum)} / {fmt(totalAmt)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Remainder to main balance</span>
                  <span className={`tabular-nums font-semibold ${overAllocated ? "text-destructive" : remainder === 0 ? "text-muted-foreground" : "text-primary"}`}>
                    {fmt(Math.max(0, remainder))}
                  </span>
                </div>
                {overAllocated && (
                  <p className="text-xs text-destructive">Splits exceed the income amount by {fmt(splitSum - totalAmt)}.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={overAllocated}><Plus className="h-4 w-4" /> Add income</Button>
          </div>
        </CardContent>
      </Card>

      {/* Inline new pocket dialog */}
      <Dialog open={newPocketOpenFor !== null} onOpenChange={(o) => { if (!o) { setNewPocketOpenFor(null); setNewPocketName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new pocket</DialogTitle>
            <DialogDescription>
              Pockets are savings buckets. The split amount is deposited here when you save the income.
            </DialogDescription>
          </DialogHeader>
          <Field label="Pocket name">
            <Input
              autoFocus
              placeholder="e.g. Amazon Credit"
              value={newPocketName}
              onChange={(e) => setNewPocketName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmNewPocket(); } }}
            />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setNewPocketOpenFor(null); setNewPocketName(""); }}>Cancel</Button>
            <Button onClick={confirmNewPocket} disabled={!newPocketName.trim()}>Create & select</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Cycle + all-time summary */}
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs uppercase tracking-wider">This cycle</span>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {format(cycle.start, "MMM d")} – {format(cycle.end, "MMM d, yyyy")}
                  {cycle.isOverridden && <span className="ml-1 text-amber-600">· override</span>}
                  <span className="ml-1">· {cycle.type === "monthly" ? "monthly" : "4-weekly"}</span>
                </p>
              </div>
            </div>
            <p className="text-2xl font-semibold tabular-nums">{fmt(thisCycle)}</p>
            <p className="text-[11px] text-muted-foreground mt-2">
              Change cycle rhythm in <span className="font-medium">Settings</span>.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs uppercase tracking-wider">All time</span>
            </div>
            <p className="text-2xl font-semibold tabular-nums">{fmt(total)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Income history</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No income recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{i.source}</p>
                      <Badge variant="secondary" className="font-normal">{i.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(i.date), "MMM d, yyyy")}{i.notes ? ` · ${i.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-primary">{fmt(i.amount)}</span>
                    <Button variant="ghost" size="icon" onClick={() => { remove(i.id); toast.success("Removed"); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
