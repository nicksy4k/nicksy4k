import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useIncomes, useIncomeCategories } from "@/lib/store";
import { fmt } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, TrendingUp, Settings2 } from "lucide-react";
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/income")({
  head: () => ({ meta: [{ title: "Income — Ledgerly" }] }),
  component: IncomePage,
});

// ===== Cycle settings (persisted in localStorage) =====
const CYCLE_KEY = "ledgerly.incomeCycle.v1";
type CycleSettings = {
  baseStart: string;         // ISO date — anchor for the 28-day rhythm
  lengthDays: number;        // currently fixed at 28
  overrides: Record<string, string>; // cycleStartISO -> overridden end ISO (exclusive end = override date)
};

function loadCycle(): CycleSettings {
  if (typeof window === "undefined") {
    return { baseStart: new Date().toISOString().slice(0, 10), lengthDays: 28, overrides: {} };
  }
  try {
    const raw = localStorage.getItem(CYCLE_KEY);
    if (raw) return { lengthDays: 28, overrides: {}, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return { baseStart: new Date().toISOString().slice(0, 10), lengthDays: 28, overrides: {} };
}

function saveCycle(c: CycleSettings) {
  localStorage.setItem(CYCLE_KEY, JSON.stringify(c));
}

/** Returns the current cycle [start, end) where end is exclusive. Honours per-cycle overrides. */
function currentCycle(c: CycleSettings, today = new Date()) {
  const base = startOfDay(parseISO(c.baseStart));
  const t = startOfDay(today);
  const len = c.lengthDays || 28;
  const days = differenceInCalendarDays(t, base);
  const n = Math.floor(days / len);
  const start = addDays(base, n * len);
  const naturalEnd = addDays(start, len);
  const startISO = format(start, "yyyy-MM-dd");
  const override = c.overrides[startISO];
  const end = override ? parseISO(override) : naturalEnd;
  return { start, end, startISO, naturalEnd, isOverridden: Boolean(override) };
}

function IncomePage() {
  const { items, add, remove } = useIncomes();
  const { list: categories } = useIncomeCategories();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(categories[0] ?? "Other");
  const [notes, setNotes] = useState("");

  const [cycle, setCycle] = useState<CycleSettings>(() => loadCycle());
  const [cycleOpen, setCycleOpen] = useState(false);

  useEffect(() => { saveCycle(cycle); }, [cycle]);

  const { start: cStart, end: cEnd, startISO: cStartISO, naturalEnd, isOverridden } = useMemo(
    () => currentCycle(cycle),
    [cycle],
  );

  const total = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);
  const thisCycle = useMemo(() => {
    return items
      .filter((i) => {
        const d = parseISO(i.date);
        return d >= cStart && d < cEnd;
      })
      .reduce((s, i) => s + i.amount, 0);
  }, [items, cStart, cEnd]);

  function save() {
    const amt = parseFloat(amount);
    if (!source.trim() || !(amt > 0)) {
      toast.error("Enter a source and a positive amount.");
      return;
    }
    add({
      date,
      source: source.trim(),
      amount: amt,
      category: category || "Other",
      notes: notes.trim() || undefined,
    });
    setSource(""); setAmount(""); setNotes("");
    toast.success("Income added");
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
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notes (optional)"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <div className="flex justify-end">
            <Button onClick={save}><Plus className="h-4 w-4" /> Add income</Button>
          </div>
        </CardContent>
      </Card>

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
                  {format(cStart, "MMM d")} – {format(addDays(cEnd, -1), "MMM d, yyyy")}
                  {isOverridden && <span className="ml-1 text-amber-600">· override</span>}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setCycleOpen(true)}>
                <Settings2 className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Cycle</span>
              </Button>
            </div>
            <p className="text-2xl font-semibold tabular-nums">{fmt(thisCycle)}</p>
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

      <CycleSettingsDialog
        open={cycleOpen}
        onOpenChange={setCycleOpen}
        cycle={cycle}
        currentStartISO={cStartISO}
        naturalEndISO={format(naturalEnd, "yyyy-MM-dd")}
        onSave={(next) => { setCycle(next); toast.success("Cycle updated"); }}
      />
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

function CycleSettingsDialog({
  open, onOpenChange, cycle, currentStartISO, naturalEndISO, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cycle: CycleSettings;
  currentStartISO: string;
  naturalEndISO: string;
  onSave: (next: CycleSettings) => void;
}) {
  const [baseStart, setBaseStart] = useState(cycle.baseStart);
  const [lengthDays, setLengthDays] = useState<string>(String(cycle.lengthDays || 28));
  const [overrideEnd, setOverrideEnd] = useState<string>(
    cycle.overrides[currentStartISO] ?? naturalEndISO,
  );

  useEffect(() => {
    if (open) {
      setBaseStart(cycle.baseStart);
      setLengthDays(String(cycle.lengthDays || 28));
      setOverrideEnd(cycle.overrides[currentStartISO] ?? naturalEndISO);
    }
  }, [open, cycle, currentStartISO, naturalEndISO]);

  function handleSave() {
    const len = parseInt(lengthDays, 10) || 28;
    const overrides = { ...cycle.overrides };
    if (overrideEnd && overrideEnd !== naturalEndISO) {
      overrides[currentStartISO] = overrideEnd;
    } else {
      delete overrides[currentStartISO];
    }
    onSave({ baseStart, lengthDays: len, overrides });
    onOpenChange(false);
  }

  function clearOverride() {
    setOverrideEnd(naturalEndISO);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cycle settings</DialogTitle>
          <DialogDescription>
            Track income on a recurring rhythm instead of the calendar month.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Base start date">
            <Input type="date" value={baseStart} onChange={(e) => setBaseStart(e.target.value)} />
          </Field>
          <Field label="Cycle frequency">
            <Select value={lengthDays} onValueChange={setLengthDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="28">Every 28 days</SelectItem>
                <SelectItem value="14">Every 14 days</SelectItem>
                <SelectItem value="7">Every 7 days</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="rounded-md border border-border p-3 space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Manual override · this cycle only
            </p>
            <p className="text-[11px] text-muted-foreground">
              Adjust the reset date if you were paid early (weekend / bank holiday).
              Future cycles keep the 28-day rhythm.
            </p>
            <Field label="Next reset date">
              <Input type="date" value={overrideEnd} onChange={(e) => setOverrideEnd(e.target.value)} />
            </Field>
            {overrideEnd !== naturalEndISO && (
              <Button variant="ghost" size="sm" onClick={clearOverride} className="h-7 px-2 text-xs">
                Reset to natural date ({format(parseISO(naturalEndISO), "MMM d")})
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
