import { createFileRoute } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { useMemo, useState } from "react";
import { useIncomes, useIncomeCategories, useSavings, useRecurringIncomes } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { fmt, todayLocalISO } from "@/lib/format";
import { useActiveCycle, isInCycle, advanceByCadence } from "@/lib/cycle";
import { generateDueRecurringIncomes, applyAllocationsOnce } from "@/lib/recurringIncome";
import { useQueryClient } from "@tanstack/react-query";
import type { IncomeCadence, RecurringIncome, RecurringIncomeAllocation } from "@/lib/types";
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
import { isCarryoverIncome } from "@/lib/carryover";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/income")({
  head: () => ({ meta: [{ title: "Income — Ledgerly" }] }),
  component: IncomePage,
  errorComponent: RouteError,
});

function IncomePage() {
  const { items, add, remove } = useIncomes();
  const { items: savingsItems, add: addSaving } = useSavings();
  const { list: categories } = useIncomeCategories();
  const { items: recurring, add: addRecurring, update: updateRecurring, remove: removeRecurring } = useRecurringIncomes();
  const cycle = useActiveCycle();
  const qc = useQueryClient();

  // Recurring template dialog state
  const [recOpen, setRecOpen] = useState(false);
  const [recEditing, setRecEditing] = useState<RecurringIncome | null>(null);
  const [recSource, setRecSource] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recCategory, setRecCategory] = useState<string>("Other");
  const [recCadence, setRecCadence] = useState<IncomeCadence>("monthly");
  const [recNextDate, setRecNextDate] = useState(todayLocalISO());
  const [recNotes, setRecNotes] = useState("");
  const [recActive, setRecActive] = useState(true);
  const [recAllocations, setRecAllocations] = useState<RecurringIncomeAllocation[]>([]);

  function openNewRecurring() {
    setRecEditing(null);
    setRecSource("");
    setRecAmount("");
    setRecCategory(categories[0] ?? "Other");
    setRecCadence("monthly");
    setRecNextDate(todayLocalISO());
    setRecNotes("");
    setRecActive(true);
    setRecAllocations([]);
    setRecOpen(true);
  }
  function openEditRecurring(r: RecurringIncome) {
    setRecEditing(r);
    setRecSource(r.source);
    setRecAmount(String(r.amount));
    setRecCategory(r.category);
    setRecCadence(r.cadence);
    setRecNextDate(r.next_date);
    setRecNotes(r.notes ?? "");
    setRecActive(r.active);
    setRecAllocations((r.allocations ?? []).slice().sort((a, b) => a.order - b.order));
    setRecOpen(true);
  }
  async function saveRecurring() {
    const amt = parseFloat(recAmount);
    if (!recSource.trim() || !(amt > 0)) {
      toast.error("Enter a source and a positive amount.");
      return;
    }
    if (!recNextDate) {
      toast.error("Pick a first date.");
      return;
    }
    try {
      const cleanAllocations: RecurringIncomeAllocation[] = recAllocations
        .filter((a) => a.pocket.trim().length > 0 && (a.kind === "cover_commitments" || a.amount > 0))
        .map((a, i) => ({ ...a, pocket: a.pocket.trim(), order: i }));
      const payload = {
        source: recSource.trim(),
        amount: amt,
        category: recCategory || "Other",
        notes: recNotes.trim() || null,
        cadence: recCadence,
        next_date: recNextDate,
        active: recActive,
        allocations: cleanAllocations,
      };
      if (recEditing) {
        await updateRecurring(recEditing.id, payload);
        toast.success("Recurring income updated");
      } else {
        await addRecurring({ ...payload, last_generated_date: null });
        toast.success("Recurring income added");
      }
      setRecOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }
  async function postRecurringNow(r: RecurringIncome) {
    try {
      const today = todayLocalISO();
      await add({
        date: today,
        source: r.source,
        amount: r.amount,
        category: r.category,
        notes: r.notes ?? undefined,
      });
      const nextDate = advanceByCadence(r.next_date > today ? r.next_date : today, r.cadence);
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const warns = await applyAllocationsOnce(u.user.id, r, today, nextDate);
        warns.forEach((w: string) => toast.warning(w));
        qc.invalidateQueries({ queryKey: ["savings"] });
      }
      await updateRecurring(r.id, {
        next_date: nextDate,
        last_generated_date: today,
      });
      toast.success(`${r.source} posted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
    }
  }
  async function runGenerationNow() {
    try {
      const { created, warnings } = await generateDueRecurringIncomes(todayLocalISO());
      warnings.forEach((w) => toast.warning(w));
      if (created > 0) {
        qc.invalidateQueries({ queryKey: ["incomes"] });
        qc.invalidateQueries({ queryKey: ["savings"] });
        qc.invalidateQueries({ queryKey: ["recurring_incomes"] });
        toast.success(`Generated ${created} income ${created === 1 ? "entry" : "entries"}`);
      } else {
        toast.info("Nothing due right now");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate");
    }
  }

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

  // Match savings deposits back to their originating income so the history
  // can surface pocket routing. Deposits are tagged in notes as either
  // "Routed from income: <source>" (one-off) or "Auto-routed from <source>"
  // (recurring). We bucket by (date|source) and consume each bucket once,
  // in income-creation order, to avoid double-counting when the same
  // date+source appears more than once.
  const routingByIncome = useMemo(() => {
    const buckets = new Map<string, { account: string; amount: number; created_at: string }[]>();
    for (const s of savingsItems) {
      if (s.kind !== "deposit") continue;
      const note = s.notes ?? "";
      let src: string | null = null;
      if (note.startsWith("Routed from income: ")) src = note.slice("Routed from income: ".length);
      else if (note.startsWith("Auto-routed from ")) src = note.slice("Auto-routed from ".length);
      if (!src) continue;
      const key = `${s.date}|${src}`;
      const arr = buckets.get(key) ?? [];
      arr.push({ account: s.account, amount: s.amount, created_at: s.created_at });
      buckets.set(key, arr);
    }
    // Sort each bucket by created_at so the chip order matches the save order.
    for (const arr of buckets.values()) {
      arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    const consumed = new Set<string>();
    const out = new Map<string, { account: string; amount: number }[]>();
    const sortedIncomes = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const i of sortedIncomes) {
      const key = `${i.date}|${i.source}`;
      if (consumed.has(key)) continue;
      const b = buckets.get(key);
      if (b && b.length > 0) {
        out.set(i.id, b.map((x) => ({ account: x.account, amount: x.amount })));
        consumed.add(key);
      }
    }
    return out;
  }, [items, savingsItems]);

  const totalAmt = parseFloat(amount) || 0;
  const splitSum = splits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const remainder = +(totalAmt - splitSum).toFixed(2);
  const overAllocated = splitSum > totalAmt + 0.0001;

  function addSplitRow() {
    setSplits((s) => {
      const used = s.reduce((n, x) => n + (parseFloat(x.amount) || 0), 0);
      const left = +(totalAmt - used).toFixed(2);
      return [
        ...s,
        { id: crypto.randomUUID(), pocket: "", amount: left > 0 ? String(left) : "" },
      ];
    });
  }
  function updateSplit(id: string, patch: Partial<Split>) {
    setSplits((s) =>
      s.map((x) => {
        if (x.id !== id) return x;
        const next = { ...x, ...patch };
        // Auto-fill amount with remainder when a pocket is picked and amount is blank.
        if (patch.pocket && !x.amount) {
          const usedByOthers = s.reduce(
            (n, y) => (y.id === id ? n : n + (parseFloat(y.amount) || 0)),
            0,
          );
          const left = +(totalAmt - usedByOthers).toFixed(2);
          if (left > 0) next.amount = String(left);
        }
        return next;
      }),
    );
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

      {/* Recurring income templates */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" />
            <CardTitle>Recurring income</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {recurring.length > 0 && (
              <Button variant="outline" size="sm" onClick={runGenerationNow} title="Post any templates due today">
                <Zap className="h-4 w-4" /> Run due
              </Button>
            )}
            <Button size="sm" onClick={openNewRecurring}>
              <Plus className="h-4 w-4" /> Add recurring
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recurring.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Set up a template and Ledgerly will post income entries automatically on their next date.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recurring.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{r.source}</p>
                      <Badge variant="secondary" className="font-normal">{r.category}</Badge>
                      <Badge variant="outline" className="font-normal capitalize">{cadenceLabel(r.cadence)}</Badge>
                      {!r.active && <Badge variant="outline" className="font-normal text-muted-foreground">Paused</Badge>}
                      {(r.allocations ?? []).length > 0 && (
                        <Badge variant="outline" className="font-normal">
                          <Split className="h-3 w-3 mr-1" />
                          {(r.allocations ?? []).length} pocket{(r.allocations ?? []).length === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Next: {format(parseISO(r.next_date), "MMM d, yyyy")}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </p>
                    {(r.allocations ?? []).length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {(r.allocations ?? []).slice().sort((a, b) => a.order - b.order).map((a) =>
                          a.kind === "cover_commitments"
                            ? `${a.pocket} (auto)`
                            : `${fmt(a.amount)} → ${a.pocket}`
                        ).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold tabular-nums text-primary mr-1">{fmt(r.amount)}</span>
                    <Button variant="ghost" size="icon" onClick={() => postRecurringNow(r)} title="Post now">
                      <Zap className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateRecurring(r.id, { active: !r.active }).then(() => toast.success(r.active ? "Paused" : "Resumed"))}
                      title={r.active ? "Pause" : "Resume"}
                    >
                      {r.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditRecurring(r)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { removeRecurring(r.id); toast.success("Removed"); }}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recurring income dialog */}
      <Dialog open={recOpen} onOpenChange={setRecOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{recEditing ? "Edit recurring income" : "New recurring income"}</DialogTitle>
            <DialogDescription>
              Ledgerly will auto-post an income entry on the next date and roll it forward by the chosen cadence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Source"><Input placeholder="e.g. Employer Ltd." value={recSource} onChange={(e) => setRecSource(e.target.value)} /></Field>
              <Field label="Amount (£)"><Input inputMode="decimal" placeholder="0.00" value={recAmount} onChange={(e) => setRecAmount(e.target.value)} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Category">
                <Select value={recCategory} onValueChange={setRecCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[...categories].sort((a, b) => a.localeCompare(b)).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cadence">
                <Select value={recCadence} onValueChange={(v) => setRecCadence(v as IncomeCadence)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly (every 2 weeks)</SelectItem>
                    <SelectItem value="four-weekly">4-weekly (every 28 days)</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label={recEditing ? "Next post date" : "First post date"}>
              <Input type="date" value={recNextDate} onChange={(e) => setRecNextDate(e.target.value)} />
            </Field>
            <Field label="Notes (optional)"><Textarea rows={2} value={recNotes} onChange={(e) => setRecNotes(e.target.value)} /></Field>

            <Separator />
            <RecurringAllocationsEditor
              amount={parseFloat(recAmount) || 0}
              allocations={recAllocations}
              onChange={setRecAllocations}
              pocketOptions={pocketNames}
            />

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Pause to stop auto-posting without deleting.</p>
              </div>
              <Switch checked={recActive} onCheckedChange={setRecActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecOpen(false)}>Cancel</Button>
            <Button onClick={saveRecurring}>{recEditing ? "Save changes" : "Add recurring"}</Button>
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
              {items.map((i) => {
                const routing = routingByIncome.get(i.id) ?? [];
                const routedSum = routing.reduce((s, r) => s + r.amount, 0);
                const mainRemainder = +(i.amount - routedSum).toFixed(2);
                return (
                <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{i.source}</p>
                      <Badge variant="secondary" className="font-normal">{i.category}</Badge>
                      {isCarryoverIncome(i) && (
                        <Badge variant="outline" className={i.amount < 0 ? "border-red-400 text-red-600" : "border-emerald-400 text-emerald-700"}>
                          {i.amount < 0 ? "Carryover · overspend" : "Carryover"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(i.date), "MMM d, yyyy")}{i.notes ? ` · ${i.notes}` : ""}
                    </p>
                    {routing.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-x-2 gap-y-1 flex-wrap">
                        <span className="uppercase tracking-wider text-[10px]">Routed to</span>
                        {routing.map((r, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: colorForKey(r.account) }} />
                            <span>{r.account}</span>
                            <span className="tabular-nums font-medium text-foreground">{fmt(r.amount)}</span>
                          </span>
                        ))}
                        {mainRemainder > 0.005 && (
                          <span className="inline-flex items-center gap-1">
                            <span>· Main</span>
                            <span className="tabular-nums font-medium text-foreground">{fmt(mainRemainder)}</span>
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={"text-sm font-semibold tabular-nums " + (i.amount < 0 ? "text-red-600" : "text-primary")}>{fmt(i.amount)}</span>
                    <Button variant="ghost" size="icon" onClick={() => { remove(i.id); toast.success("Removed"); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function cadenceLabel(c: IncomeCadence): string {
  if (c === "weekly") return "Weekly";
  if (c === "fortnightly") return "Fortnightly";
  if (c === "four-weekly") return "4-weekly";
  return "Monthly";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RecurringAllocationsEditor({
  amount,
  allocations,
  onChange,
  pocketOptions,
}: {
  amount: number;
  allocations: RecurringIncomeAllocation[];
  onChange: (next: RecurringIncomeAllocation[]) => void;
  pocketOptions: string[];
}) {
  const update = (id: string, patch: Partial<RecurringIncomeAllocation>) =>
    onChange(allocations.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const remove = (id: string) => onChange(allocations.filter((a) => a.id !== id));
  const add = () => {
    const usedFixed = allocations.reduce(
      (n, a) => (a.kind === "fixed" ? n + (a.amount || 0) : n),
      0,
    );
    const left = Math.max(0, +(amount - usedFixed).toFixed(2));
    onChange([
      ...allocations,
      { id: crypto.randomUUID(), pocket: "", kind: "fixed", amount: left, order: allocations.length },
    ]);
  };

  // Preview: fund in order, stop when depleted; cover_commitments shown as "auto".
  let remaining = amount;
  const previewParts: string[] = [];
  let clipped = false;
  for (const a of allocations) {
    if (!a.pocket.trim()) continue;
    if (a.kind === "cover_commitments") {
      previewParts.push(`${a.pocket} (auto)`);
      continue;
    }
    if (remaining <= 0.0001) { clipped = true; break; }
    const give = Math.min(a.amount, remaining);
    if (give < a.amount - 0.0001) clipped = true;
    if (give > 0) previewParts.push(`${fmt(give)} → ${a.pocket}`);
    remaining -= give;
  }
  const mainStr = amount > 0 ? `${fmt(Math.max(0, remaining))} left in main` : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Split className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Auto-allocate to pockets</p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deposits happen automatically each time this template posts. Any remainder stays in main.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4" /> Add allocation
        </Button>
      </div>

      {allocations.length > 0 && (
        <div className="space-y-2">
          {allocations.map((a) => {
            const isCover = a.kind === "cover_commitments";
            return (
              <div key={a.id} className="rounded-md border p-2 space-y-2">
                <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                  <Input
                    list="ledgerly-pocket-list"
                    placeholder="Pocket name"
                    value={a.pocket}
                    onChange={(e) => update(a.id, { pocket: e.target.value })}
                  />
                  <Input
                    inputMode="decimal"
                    placeholder={isCover ? "auto" : "0.00"}
                    disabled={isCover}
                    value={isCover ? "" : (a.amount ? String(a.amount) : "")}
                    onChange={(e) => update(a.id, { amount: parseFloat(e.target.value) || 0 })}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={isCover}
                    onChange={(e) => update(a.id, { kind: e.target.checked ? "cover_commitments" : "fixed" })}
                  />
                  Cover commitments due before next payday
                </label>
              </div>
            );
          })}
          <datalist id="ledgerly-pocket-list">
            {pocketOptions.map((p) => <option key={p} value={p} />)}
          </datalist>
          {amount > 0 && previewParts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Preview: {previewParts.join(" · ")}{mainStr ? ` · ${mainStr}` : ""}
            </p>
          )}
          {clipped && (
            <p className="text-xs text-amber-600">
              Income amount won't cover all fixed allocations — later pockets will be partially funded or skipped.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

