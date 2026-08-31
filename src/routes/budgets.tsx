import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Target, ArrowRight, TrendingUp, Wallet } from "lucide-react";

import { RouteError } from "@/components/RouteError";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategories } from "@/lib/store";
import { useBudgets, useBudgetStatuses, type Budget, type BudgetStatus } from "@/lib/budgets";
import { useActiveCycle, type CycleType } from "@/lib/cycle";
import { fmt } from "@/lib/format";
import { usePreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { ListSkeleton } from "@/components/ListSkeleton";

export const Route = createFileRoute("/budgets")({
  head: () => ({
    meta: [
      { title: "Budgets — Ledgerly" },
      { name: "description", content: "Set category spending targets and track pace against your cycle." },
      { property: "og:title", content: "Budgets — Ledgerly" },
      { property: "og:description", content: "Set category spending targets and track pace against your cycle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BudgetsPage,
  errorComponent: RouteError,
});

function BudgetDialog({
  open,
  onClose,
  budget,
}: {
  open: boolean;
  onClose: () => void;
  budget?: Budget;
}) {
  const { add, update } = useBudgets();
  const { list: categories } = useCategories();
  const cycle = useActiveCycle();
  const [category, setCategory] = useState(budget?.category ?? "");
  const [amount, setAmount] = useState(budget ? String(budget.amount) : "");
  const [cycleType, setCycleType] = useState<CycleType>(budget?.cycle_type ?? cycle.type);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = parseFloat(amount);
    if (!category.trim()) return setError("Choose a category.");
    if (!Number.isFinite(value) || value <= 0) return setError("Enter a positive amount.");

    setBusy(true);
    try {
      if (budget) {
        await update(budget.id, { category, amount: value, cycle_type: cycleType });
      } else {
        await add({ category, amount: value, cycle_type: cycleType });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save budget.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{budget ? "Edit budget" : "New budget"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="budget-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="budget-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                {categories.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No expense categories yet.</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">Budget amount</Label>
            <Input
              id="budget-amount"
              type="number"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="budget-cycle">Cycle type</Label>
            <Select value={cycleType} onValueChange={(v) => setCycleType(v as CycleType)}>
              <SelectTrigger id="budget-cycle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="four-weekly">Four-weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {budget ? "Save changes" : "Create budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BudgetRow({ status }: { status: BudgetStatus }) {
  const { prefs } = usePreferences();
  const { remove } = useBudgets();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const percent = Math.min(100, Math.round(status.percent * 100));
  const pacePercent = Math.round(status.pace * 100);

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-medium text-base">{status.budget.category}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fmt(status.spent)} of {fmt(status.budget.amount)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(true)} aria-label="Edit budget">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setConfirmDelete(true)} aria-label="Delete budget">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "absolute left-0 top-0 h-full rounded-full transition-all",
                status.tone === "danger" && "bg-destructive",
                status.tone === "warning" && "bg-amber-500",
                status.tone === "ok" && "bg-emerald-500",
              )}
              style={{ width: `${percent}%` }}
            />
            <div
              className="absolute top-0 h-full w-0.5 bg-foreground/60"
              style={{ left: `${pacePercent}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{percent}% used</span>
            <span className="text-muted-foreground">Pace: {pacePercent}%</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={status.tone === "ok" ? "default" : status.tone === "warning" ? "secondary" : "destructive"}>
            {status.remaining >= 0 ? `${fmt(status.remaining)} left` : `${fmt(Math.abs(status.remaining))} over`}
          </Badge>
          {status.tone === "warning" && <span className="text-xs text-amber-500">Getting close</span>}
          {status.tone === "danger" && <span className="text-xs text-destructive">Over budget</span>}
        </div>
      </div>

      {editing && <BudgetDialog open={editing} onClose={() => setEditing(false)} budget={status.budget} />}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete budget?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the {status.budget.category} budget. Your transactions are not affected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await remove(status.budget.id);
                setConfirmDelete(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BudgetsPage() {
  const { statuses, unbudgeted, isLoading, totalBudgeted, totalSpent, totalRemaining } = useBudgetStatuses();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { prefs } = usePreferences();
  const cycle = useActiveCycle();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            {cycle.type === "monthly" ? "Monthly" : "Four-weekly"} targets for {cycle.startISO} → {cycle.endISO}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add budget
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Total budgeted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{fmt(totalBudgeted)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total spent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{fmt(totalSpent)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Remaining
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-semibold", totalRemaining < 0 && "text-destructive")}>
              {fmt(totalRemaining)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="font-medium text-lg mb-3">Your budgets</h2>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : statuses.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No budgets yet.</p>
            <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create your first budget
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {statuses.map((s) => (
              <BudgetRow key={s.budget.id} status={s} />
            ))}
          </div>
        )}
      </div>

      {unbudgeted.length > 0 && (
        <div className="mt-8">
          <h2 className="font-medium text-lg mb-3">Unbudgeted spending this cycle</h2>
          <Card>
            <CardContent className="divide-y divide-border/60 p-0">
              {unbudgeted.map((u) => (
                <div key={u.category} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium">{u.category}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {prefs?.currency || "£"}
                      {fmt(u.spent)}
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setDialogOpen(true)}>
                      Set budget
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          The dotted line on each bar shows where you should be based on today&apos;s date in the cycle. Go over 80% and the bar turns amber; over 100% turns red.
        </p>
      </div>

      <BudgetDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
