import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, Trash2, HandCoins, CreditCard as CreditIcon, Wallet, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

import { useDebts, useLoans } from "@/lib/store";
import type { Debt, Loan } from "@/lib/types";
import { fmt } from "@/lib/format";

export const Route = createFileRoute("/credit")({
  head: () => ({ meta: [{ title: "Credit & Debt — Ledgerly" }] }),
  component: CreditPage,
});

function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

function loanPaid(l: Loan) {
  return (l.payments ?? []).reduce((s, p) => s + p.amount, 0);
}
function loanRemaining(l: Loan) {
  return Math.max(0, l.total_amount - loanPaid(l));
}
function debtPaid(d: Debt) {
  return (d.payments ?? []).reduce((s, p) => s + p.amount, 0);
}
function debtRemaining(d: Debt) {
  return Math.max(0, d.total_amount - debtPaid(d));
}

function CreditPage() {
  const { items: loans } = useLoans();
  const { items: debts } = useDebts();

  const owedToMe = useMemo(() => loans.reduce((s, l) => s + loanRemaining(l), 0), [loans]);
  const iOwe = useMemo(() => debts.reduce((s, d) => s + debtRemaining(d), 0), [debts]);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Loans &amp; liabilities</p>
        <h1 className="text-3xl md:text-4xl font-semibold">Credit &amp; Debt</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/15 grid place-items-center">
              <HandCoins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Owed to me</p>
              <p className="text-2xl font-semibold tabular-nums">{fmt(owedToMe)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-destructive/15 grid place-items-center">
              <CreditIcon className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">I owe</p>
              <p className="text-2xl font-semibold tabular-nums">{fmt(iOwe)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="owed">
        <TabsList className="mb-6">
          <TabsTrigger value="owed">Owed to Me</TabsTrigger>
          <TabsTrigger value="debts">My Debts &amp; BNPL</TabsTrigger>
        </TabsList>

        <TabsContent value="owed">
          <OwedToMeTab />
        </TabsContent>
        <TabsContent value="debts">
          <DebtsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ OWED TO ME ============

function OwedToMeTab() {
  const { items, add, update, remove, addPayment } = useLoans();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [payFor, setPayFor] = useState<Loan | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> New loan
        </Button>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          No loans tracked yet. Log money you've lent out to keep tabs on repayments.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((l) => {
            const remaining = loanRemaining(l);
            const paid = loanPaid(l);
            const pct = l.total_amount > 0 ? Math.min(100, (paid / l.total_amount) * 100) : 0;
            const settled = remaining <= 0.001;
            return (
              <Card key={l.id} className={settled ? "border-primary/30 bg-primary/5" : ""}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{l.person_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Loan: <span className="tabular-nums">{fmt(l.total_amount)}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setEditing(l); setOpen(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Remaining</span>
                      <span className="text-xl font-semibold tabular-nums">{fmt(remaining)}</span>
                    </div>
                    <Progress value={pct} className="mt-2" />
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {fmt(paid)} of {fmt(l.total_amount)} repaid
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={settled}
                      onClick={() => setPayFor(l)}
                    >
                      <Wallet className="h-4 w-4" /> Log Repayment
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete loan to ${l.person_name}?`)) {
                          remove(l.id);
                          toast.success("Loan removed");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <LoanDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSave={async (data) => {
          if (editing) {
            await update(editing.id, data);
            toast.success("Updated");
          } else {
            await add({ ...data, payments: [] });
            toast.success("Loan added");
          }
          setOpen(false);
        }}
      />

      <PaymentDialog
        open={!!payFor}
        onOpenChange={(v) => { if (!v) setPayFor(null); }}
        title={payFor ? `Log repayment from ${payFor.person_name}` : ""}
        max={payFor ? loanRemaining(payFor) : 0}
        onSave={async ({ amount, date, notes }) => {
          if (!payFor) return;
          await addPayment(payFor, { amount, date, notes });
          toast.success("Repayment logged");
          setPayFor(null);
        }}
      />
    </div>
  );
}

function LoanDialog({
  open, onOpenChange, editing, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Loan | null;
  onSave: (data: Omit<Loan, "id" | "created_at" | "payments">) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  // reset on open
  useMemo(() => {
    if (open) {
      setName(editing?.person_name ?? "");
      setAmount(editing ? String(editing.total_amount) : "");
      setNotes(editing?.notes ?? "");
    }
  }, [open, editing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit loan" : "New loan"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Person</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Total loan (£)</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const amt = parseFloat(amount);
              if (!name.trim() || !(amt >= 0)) {
                toast.error("Name and a valid amount are required.");
                return;
              }
              onSave({ person_name: name.trim(), total_amount: amt, notes: notes.trim() || undefined });
            }}
          >
            {editing ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ DEBTS & BNPL ============

function DebtsTab() {
  const { items, add, update, remove, addPayment } = useDebts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [payFor, setPayFor] = useState<{ debt: Debt; amount?: number } | null>(null);

  const standard = items.filter((d) => d.kind === "standard");
  const bnpl = items.filter((d) => d.kind === "bnpl");

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> New debt
        </Button>
      </div>

      {/* Standard debts */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Standard debts</h2>
          <span className="text-xs text-muted-foreground">Open-ended balances (rent arrears, IOUs, etc.)</span>
        </div>
        {standard.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            No standard debts. Add one to track its running balance.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {standard.map((d) => {
              const paid = debtPaid(d);
              const remaining = debtRemaining(d);
              const settled = remaining <= 0.001;
              return (
                <Card key={d.id} className={settled ? "border-primary/30 bg-primary/5" : ""}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Total: <span className="tabular-nums">{fmt(d.total_amount)}</span> · Paid: <span className="tabular-nums">{fmt(paid)}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setEditing(d); setOpen(true); }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="rounded-lg bg-secondary/40 p-3">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Running balance</p>
                      <p className="text-2xl font-semibold tabular-nums">{fmt(remaining)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={settled}
                        onClick={() => setPayFor({ debt: d })}
                      >
                        <Plus className="h-4 w-4" /> Add Payment
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete debt "${d.name}"?`)) {
                            remove(d.id);
                            toast.success("Removed");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* BNPL */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">BNPL plans</h2>
          <span className="text-xs text-muted-foreground">Clearpay, PayPal Pay in 4, Klarna…</span>
        </div>
        {bnpl.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            No installment plans. Add one to track each scheduled payment.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {bnpl.map((d) => {
              const totalInstallments = Math.max(1, d.installments_total ?? 4);
              const installmentAmount = d.total_amount / totalInstallments;
              const paidCount = Math.min(totalInstallments, (d.payments ?? []).length);
              const remaining = debtRemaining(d);
              const pct = (paidCount / totalInstallments) * 100;
              const settled = paidCount >= totalInstallments;
              return (
                <Card key={d.id} className={settled ? "border-primary/30 bg-primary/5" : ""}>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                          {fmt(installmentAmount)} × {totalInstallments}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setEditing(d); setOpen(true); }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Edit
                      </button>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">
                          {paidCount} of {totalInstallments} Paid
                        </span>
                        <span className="text-sm font-semibold tabular-nums">{fmt(remaining)} left</span>
                      </div>
                      <Progress value={pct} />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={settled}
                        onClick={() => setPayFor({ debt: d, amount: installmentAmount })}
                      >
                        <ChevronRight className="h-4 w-4" /> Pay Next Installment
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete plan "${d.name}"?`)) {
                            remove(d.id);
                            toast.success("Removed");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <DebtDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSave={async (data) => {
          if (editing) {
            await update(editing.id, data);
            toast.success("Updated");
          } else {
            await add({ ...data, payments: [] });
            toast.success("Added");
          }
          setOpen(false);
        }}
      />

      <PaymentDialog
        open={!!payFor}
        onOpenChange={(v) => { if (!v) setPayFor(null); }}
        title={payFor ? `Add payment — ${payFor.debt.name}` : ""}
        defaultAmount={payFor?.amount}
        max={payFor ? debtRemaining(payFor.debt) : 0}
        onSave={async ({ amount, date, notes }) => {
          if (!payFor) return;
          await addPayment(payFor.debt, { amount, date, notes });
          toast.success("Payment logged");
          setPayFor(null);
        }}
      />
    </div>
  );
}

function DebtDialog({
  open, onOpenChange, editing, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Debt | null;
  onSave: (data: Omit<Debt, "id" | "created_at" | "payments">) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"standard" | "bnpl">("standard");
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("4");
  const [notes, setNotes] = useState("");

  useMemo(() => {
    if (open) {
      setName(editing?.name ?? "");
      setKind(editing?.kind ?? "standard");
      setAmount(editing ? String(editing.total_amount) : "");
      setInstallments(editing?.installments_total ? String(editing.installments_total) : "4");
      setNotes(editing?.notes ?? "");
    }
  }, [open, editing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit debt" : "New debt"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rent arrears, Clearpay – Nike" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as "standard" | "bnpl")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard debt</SelectItem>
                  <SelectItem value="bnpl">BNPL plan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Total (£)</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          {kind === "bnpl" && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Installments</Label>
              <Select value={installments} onValueChange={setInstallments}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 6, 8, 12].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const amt = parseFloat(amount);
              if (!name.trim() || !(amt >= 0)) {
                toast.error("Name and a valid amount are required.");
                return;
              }
              onSave({
                name: name.trim(),
                kind,
                total_amount: amt,
                installments_total: kind === "bnpl" ? parseInt(installments, 10) || 4 : null,
                notes: notes.trim() || undefined,
              });
            }}
          >
            {editing ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Shared payment dialog ============

function PaymentDialog({
  open, onOpenChange, title, defaultAmount, max, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  defaultAmount?: number;
  max: number;
  onSave: (data: { amount: number; date: string; notes?: string }) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");

  useMemo(() => {
    if (open) {
      setAmount(defaultAmount != null ? defaultAmount.toFixed(2) : "");
      setDate(todayISO());
      setNotes("");
    }
  }, [open, defaultAmount]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (£)</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            <p className="text-[11px] text-muted-foreground">Remaining: {fmt(max)}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const amt = parseFloat(amount);
              if (!(amt > 0)) {
                toast.error("Enter an amount greater than 0.");
                return;
              }
              onSave({ amount: amt, date, notes: notes.trim() || undefined });
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
