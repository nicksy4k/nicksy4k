import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup, RadioGroupItem,
} from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  CalendarClock, Wallet, Layers, Repeat, CheckCircle2, X, Plus, ChevronLeft, ChevronRight, Sparkles,
} from "lucide-react";
import {
  useCycleSettings, getActiveCycle, type CycleType, type CycleSettings,
} from "@/lib/cycle";
import {
  useCategories, useCommitments, useIncomes, useRecurringIncomes, useSavings,
} from "@/lib/store";
import { useOnboardingStatus } from "@/lib/onboarding";
import { markTutorialPending, useTutorialStatus } from "@/lib/tutorial";
import { todayLocalISO } from "@/lib/format";
import type { IncomeCadence } from "@/lib/types";

type Mode = "keep" | "replace";

interface PocketDraft { id: string; name: string; startingAmount: string }
interface CommitmentDraft { id: string; name: string; amount: string; dueDate: string; category: string }
interface RecurringDraft { id: string; source: string; amount: string; cadence: IncomeCadence; nextDate: string }

const uid = () => Math.random().toString(36).slice(2, 10);

export function SetupWizard() {
  const navigate = useNavigate();
  const { settings, update: updateCycle } = useCycleSettings();
  const { list: expenseCategories, reset: resetExpenseCats, add: addExpenseCat } = useCategories();
  const savings = useSavings();
  const incomes = useIncomes();
  const commitments = useCommitments();
  const recurring = useRecurringIncomes();
  const { markComplete } = useOnboardingStatus();
  const { reset: resetTutorial } = useTutorialStatus();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Cycle (always in-place)
  const [cycleType, setCycleType] = useState<CycleType>(settings.type);
  const [cycleAnchor, setCycleAnchor] = useState(settings.anchor);
  const [carryover, setCarryover] = useState(settings.carryoverEnabled);

  // Step 2 — Balance & pockets
  const [balMode, setBalMode] = useState<Mode>("keep");
  const [startingBalance, setStartingBalance] = useState("");
  const [pockets, setPockets] = useState<PocketDraft[]>([
    { id: uid(), name: "Savings", startingAmount: "" },
  ]);

  // Step 3 — Categories
  const [catMode, setCatMode] = useState<Mode>("keep");
  const [catDraft, setCatDraft] = useState<string[]>(expenseCategories.length ? expenseCategories : []);
  const [newCat, setNewCat] = useState("");

  // Step 4 — Income & commitments
  const [incMode, setIncMode] = useState<Mode>("keep");
  const [recurringDrafts, setRecurringDrafts] = useState<RecurringDraft[]>([
    { id: uid(), source: "Salary", amount: "", cadence: "monthly", nextDate: todayLocalISO() },
  ]);
  const [commitmentDrafts, setCommitmentDrafts] = useState<CommitmentDraft[]>([
    { id: uid(), name: "Rent", amount: "", dueDate: todayLocalISO(), category: "Household" },
  ]);

  const previewCycle = useMemo(
    () => getActiveCycle({
      ...settings, type: cycleType,
      anchor: cycleAnchor || settings.anchor,
      override: null, carryoverEnabled: carryover,
    } as CycleSettings),
    [settings, cycleType, cycleAnchor, carryover],
  );

  const totalSteps = 4;
  const progressPct = ((step + 1) / totalSteps) * 100;

  async function handleFinish() {
    setSubmitting(true);
    try {
      // Step 1 — cycle (always apply)
      updateCycle({ ...settings, type: cycleType, anchor: cycleAnchor, carryoverEnabled: carryover });

      // Step 2 — balance & pockets
      if (balMode === "replace") {
        const bal = parseFloat(startingBalance);
        if (!Number.isNaN(bal) && bal > 0) {
          await incomes.add({
            date: todayLocalISO(),
            source: "Starting balance",
            amount: bal,
            category: "Other",
          });
        }
        for (const p of pockets) {
          const name = p.name.trim();
          if (!name) continue;
          const amt = parseFloat(p.startingAmount);
          await savings.add({
            date: todayLocalISO(),
            kind: "deposit",
            account: name,
            amount: Number.isFinite(amt) && amt > 0 ? amt : 0,
            notes: "Setup wizard",
          });
        }
      }

      // Step 3 — categories
      if (catMode === "replace") {
        await resetExpenseCats();
        // Then add any user-typed additions on top of defaults
        const defaults = new Set(catDraft.map((c) => c.toLowerCase()));
        for (const name of catDraft) {
          if (!defaults.has(name.toLowerCase())) await addExpenseCat(name);
        }
      }

      // Step 4 — income & commitments
      if (incMode === "replace") {
        for (const r of recurringDrafts) {
          const amt = parseFloat(r.amount);
          if (!r.source.trim() || !Number.isFinite(amt) || amt <= 0) continue;
          await recurring.add({
            source: r.source.trim(),
            amount: amt,
            category: "Salary",
            cadence: r.cadence,
            next_date: r.nextDate,
            last_generated_date: null,
            active: true,
            allocations: [],
          });
        }
        for (const c of commitmentDrafts) {
          const amt = parseFloat(c.amount);
          if (!c.name.trim() || !Number.isFinite(amt) || amt <= 0) continue;
          await commitments.add({
            item_name: c.name.trim(),
            store: "",
            payment_method: "Direct Debit",
            amount: amt,
            category: c.category || "Household",
            next_due_date: c.dueDate,
            prev_due_date: c.dueDate,
            last_paid_date: null,
            paid: false,
            debt_id: null,
          });
        }
      }

      await markComplete();
      // Force the guided tour to run on the dashboard even if this user has
      // completed it before (re-runs of the wizard should offer it again).
      await resetTutorial();
      markTutorialPending();
      toast.success("Setup complete — welcome to Ledgerly!");
      navigate({ to: "/" });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setSubmitting(false);
    }
  }

  const stepMeta = [
    { title: "Cycle settings", icon: CalendarClock, desc: "How Ledgerly slices your month." },
    { title: "Balance & pockets", icon: Wallet, desc: "Your starting money and any savings buckets." },
    { title: "Categories", icon: Layers, desc: "How expenses are labelled." },
    { title: "Income & commitments", icon: Repeat, desc: "Recurring payslips and bills." },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/15 grid place-items-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display tracking-tight">Setup wizard</h1>
            <p className="text-sm text-muted-foreground">
              Step {step + 1} of {totalSteps} · {stepMeta[step].title}
            </p>
          </div>
        </div>
        <Progress value={progressPct} className="h-1.5" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">
              {(() => { const Icon = stepMeta[step].icon; return <Icon className="h-5 w-5 text-primary" />; })()}
            </div>
            <div>
              <CardTitle>{stepMeta[step].title}</CardTitle>
              <CardDescription>{stepMeta[step].desc}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Cycle type">
                  <Select value={cycleType} onValueChange={(v) => setCycleType(v as CycleType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly (calendar)</SelectItem>
                      <SelectItem value="four-weekly">4-Weekly (rolling 28 days)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Anchor date">
                  <Input type="date" value={cycleAnchor} onChange={(e) => setCycleAnchor(e.target.value)} />
                </Field>
              </div>
              <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <Label htmlFor="wiz-carry" className="text-sm">Carry unspent balance forward</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    At the end of each cycle, any leftover "Left to spend" becomes a Carryover income entry.
                  </p>
                </div>
                <Switch id="wiz-carry" checked={carryover} onCheckedChange={setCarryover} />
              </div>
              <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Active window preview: </span>
                <span className="font-medium tabular-nums">
                  {format(parseISO(previewCycle.startISO), "d MMM yyyy")} – {format(parseISO(previewCycle.endISO), "d MMM yyyy")}
                </span>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <ModeToggle mode={balMode} onChange={setBalMode}
                keepLabel="Skip — keep my current balance & pockets"
                replaceLabel="Add starting balance and pockets now" />
              {balMode === "replace" && (
                <div className="space-y-4">
                  <Field label="Starting main balance (optional)">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                      <Input type="number" inputMode="decimal" step="0.01" min="0" className="pl-7"
                        placeholder="0.00" value={startingBalance}
                        onChange={(e) => setStartingBalance(e.target.value)} />
                    </div>
                  </Field>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pockets</Label>
                    <div className="space-y-2">
                      {pockets.map((p, i) => (
                        <div key={p.id} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                          <Input placeholder="Pocket name (e.g. Bills, Savings)"
                            value={p.name}
                            onChange={(e) => setPockets((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                            <Input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" className="pl-7"
                              value={p.startingAmount}
                              onChange={(e) => setPockets((prev) => prev.map((x, j) => j === i ? { ...x, startingAmount: e.target.value } : x))} />
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setPockets((prev) => prev.filter((_, j) => j !== i))}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setPockets((prev) => [...prev, { id: uid(), name: "", startingAmount: "" }])}>
                      <Plus className="h-4 w-4" /> Add pocket
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <ModeToggle mode={catMode} onChange={setCatMode}
                keepLabel="Skip — keep my current categories"
                replaceLabel="Reset to defaults + customise below" />
              {catMode === "replace" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {catDraft.map((c) => (
                      <Badge key={c} variant="secondary" className="gap-1 pr-1">
                        {c}
                        <button className="rounded-full hover:bg-background/40 p-0.5"
                          onClick={() => setCatDraft((prev) => prev.filter((x) => x !== c))}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {catDraft.length === 0 && (
                      <span className="text-xs text-muted-foreground">Defaults will be seeded on finish.</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Add a category…" value={newCat}
                      onChange={(e) => setNewCat(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCat.trim()) {
                          e.preventDefault();
                          if (!catDraft.includes(newCat.trim())) setCatDraft((p) => [...p, newCat.trim()]);
                          setNewCat("");
                        }
                      }} />
                    <Button variant="outline" onClick={() => {
                      if (newCat.trim() && !catDraft.includes(newCat.trim())) {
                        setCatDraft((p) => [...p, newCat.trim()]); setNewCat("");
                      }
                    }}><Plus className="h-4 w-4" /> Add</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    On finish, categories reset to defaults then your custom additions are appended.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <ModeToggle mode={incMode} onChange={setIncMode}
                keepLabel="Skip — I'll add these later"
                replaceLabel="Add recurring income & commitments now" />
              {incMode === "replace" && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Recurring income</Label>
                    {recurringDrafts.map((r, i) => (
                      <div key={r.id} className="grid grid-cols-[1fr_120px_140px_140px_auto] gap-2 items-center">
                        <Input placeholder="Source (e.g. Salary)" value={r.source}
                          onChange={(e) => setRecurringDrafts((p) => p.map((x, j) => j === i ? { ...x, source: e.target.value } : x))} />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                          <Input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" className="pl-7"
                            value={r.amount}
                            onChange={(e) => setRecurringDrafts((p) => p.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                        </div>
                        <Select value={r.cadence} onValueChange={(v) => setRecurringDrafts((p) => p.map((x, j) => j === i ? { ...x, cadence: v as IncomeCadence } : x))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="fortnightly">Fortnightly</SelectItem>
                            <SelectItem value="four-weekly">4-Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input type="date" value={r.nextDate}
                          onChange={(e) => setRecurringDrafts((p) => p.map((x, j) => j === i ? { ...x, nextDate: e.target.value } : x))} />
                        <Button variant="ghost" size="icon" onClick={() => setRecurringDrafts((p) => p.filter((_, j) => j !== i))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() =>
                      setRecurringDrafts((p) => [...p, { id: uid(), source: "", amount: "", cadence: "monthly", nextDate: todayLocalISO() }])}>
                      <Plus className="h-4 w-4" /> Add income
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Commitments (bills)</Label>
                    {commitmentDrafts.map((c, i) => (
                      <div key={c.id} className="grid grid-cols-[1fr_120px_140px_140px_auto] gap-2 items-center">
                        <Input placeholder="Bill name" value={c.name}
                          onChange={(e) => setCommitmentDrafts((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                          <Input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" className="pl-7"
                            value={c.amount}
                            onChange={(e) => setCommitmentDrafts((p) => p.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                        </div>
                        <Input type="date" value={c.dueDate}
                          onChange={(e) => setCommitmentDrafts((p) => p.map((x, j) => j === i ? { ...x, dueDate: e.target.value } : x))} />
                        <Input placeholder="Category" value={c.category}
                          onChange={(e) => setCommitmentDrafts((p) => p.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} />
                        <Button variant="ghost" size="icon" onClick={() => setCommitmentDrafts((p) => p.filter((_, j) => j !== i))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() =>
                      setCommitmentDrafts((p) => [...p, { id: uid(), name: "", amount: "", dueDate: todayLocalISO(), category: "Household" }])}>
                      <Plus className="h-4 w-4" /> Add commitment
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            {step < totalSteps - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={submitting}>
                <CheckCircle2 className="h-4 w-4" /> {submitting ? "Saving…" : "Finish setup"}
              </Button>
            )}
          </div>
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

function ModeToggle({
  mode, onChange, keepLabel, replaceLabel,
}: {
  mode: Mode; onChange: (m: Mode) => void; keepLabel: string; replaceLabel: string;
}) {
  return (
    <RadioGroup value={mode} onValueChange={(v) => onChange(v as Mode)} className="grid sm:grid-cols-2 gap-3">
      <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${mode === "keep" ? "border-primary bg-primary/5" : "border-border"}`}>
        <RadioGroupItem value="keep" id="mode-keep" className="mt-0.5" />
        <div>
          <div className="text-sm font-medium">Keep current</div>
          <div className="text-xs text-muted-foreground">{keepLabel}</div>
        </div>
      </label>
      <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${mode === "replace" ? "border-primary bg-primary/5" : "border-border"}`}>
        <RadioGroupItem value="replace" id="mode-replace" className="mt-0.5" />
        <div>
          <div className="text-sm font-medium">Update</div>
          <div className="text-xs text-muted-foreground">{replaceLabel}</div>
        </div>
      </label>
    </RadioGroup>
  );
}
