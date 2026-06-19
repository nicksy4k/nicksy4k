import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Plus, Trash2, HandCoins, CreditCard as CreditIcon, Wallet,
  ChevronRight, ArrowUpRight, History,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
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
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

import {
  useCommitments, useDebts, useIncomes, useLoans, useSavings, useTransactions,
} from "@/lib/store";
import type { Debt, LedgerPayment, Loan } from "@/lib/types";
import { fmt } from "@/lib/format";
import { addMonths } from "date-fns";


export const Route = createFileRoute("/credit")({
  head: () => ({ meta: [{ title: "Credit & Debt — Ledgerly" }] }),
  component: CreditPage,
});

function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

function loanPaid(l: Loan) {
  return (l.payments ?? [])
    .filter((p) => p.type !== "topup")
    .reduce((s, p) => s + p.amount, 0);
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

// ============ Funding-source helper ============

type SourceChoice = { kind: "main" } | { kind: "pocket"; name: string } | { kind: "other" };

function sourceLabel(source?: string): string {
  if (!source || source === "main") return "Main balance";
  if (source === "other") return "Other (not deducted)";
  if (source.startsWith("pocket:")) return `Pocket · ${source.slice(7)}`;
  return source;
}
function encodeSource(c: SourceChoice): string {
  if (c.kind === "main") return "main";
  if (c.kind === "other") return "other";
  return `pocket:${c.name}`;
}

function usePockets(): string[] {
  const { items } = useSavings();
  return useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((s) => {
      const d = s.kind === "deposit" ? s.amount : -s.amount;
      map.set(s.account, (map.get(s.account) ?? 0) + d);
    });
    return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  }, [items]);
}

function FundingSourceDialog({
  open, onOpenChange, title, description, direction, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  /** "out" = money leaving (expense / loan-out), "in" = money arriving (repayment) */
  direction: "in" | "out";
  onConfirm: (choice: SourceChoice) => void | Promise<void>;
}) {
  const pockets = usePockets();
  const [value, setValue] = useState<string>("main");

  useEffect(() => {
    if (open) setValue("main");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {description ??
              (direction === "out"
                ? "Where should this money come from?"
                : "Where should this money go?")}
          </p>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="main">Main balance</SelectItem>
              {pockets.map((p) => (
                <SelectItem key={p} value={`pocket:${p}`}>Pocket · {p}</SelectItem>
              ))}
              <SelectItem value="other">Other / Do not deduct</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            "Other" only updates this module — your balances won't change.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const choice: SourceChoice =
                value === "main" ? { kind: "main" }
                : value === "other" ? { kind: "other" }
                : { kind: "pocket", name: value.slice(7) };
              onConfirm(choice);
            }}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Ledger sync helpers ============

function useLedgerSync() {
  const { add: addTransaction } = useTransactions();
  const { add: addIncome } = useIncomes();
  const { add: addSaving } = useSavings();

  /** Money leaves the user's funds. */
  async function debit(
    source: SourceChoice,
    args: { amount: number; date: string; label: string; category?: string; notes?: string },
  ) {
    if (source.kind === "other") return;
    if (source.kind === "pocket") {
      await addSaving({
        date: args.date,
        kind: "withdrawal",
        amount: args.amount,
        account: source.name,
        notes: args.notes ?? args.label,
      });
      return;
    }
    await addTransaction({
      date: args.date,
      retailer: args.label,
      total_amount: args.amount,
      receipt_attached: false,
      receipt_type: "None",
      receipt_location: "",
      notes: args.notes,
      items: [{
        id: crypto.randomUUID(),
        item_name: args.label,
        price: args.amount,
        quantity: 1,
        category: args.category ?? "Debt",
      }],
    });
  }

  /** Money arrives in the user's funds. */
  async function credit(
    source: SourceChoice,
    args: { amount: number; date: string; label: string; category?: string; notes?: string },
  ) {
    if (source.kind === "other") return;
    if (source.kind === "pocket") {
      await addSaving({
        date: args.date,
        kind: "deposit",
        amount: args.amount,
        account: source.name,
        notes: args.notes ?? args.label,
      });
      return;
    }
    await addIncome({
      date: args.date,
      source: args.label,
      amount: args.amount,
      category: args.category ?? "Loan repayment",
      notes: args.notes,
    });
  }

  return { debit, credit };
}

// ============ Page ============

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

// ============ History list (shared) ============

function HistoryList({ payments }: { payments: LedgerPayment[] }) {
  if (!payments || payments.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No activity yet.</p>;
  }
  const sorted = [...payments].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <ul className="divide-y divide-border/60">
      {sorted.map((p) => (
        <li key={p.id} className="py-2 flex items-start justify-between gap-3 text-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {p.type === "topup" && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  Top-up
                </span>
              )}
              <span className="font-medium tabular-nums">
                {p.type === "topup" ? "+" : "−"}{fmt(p.amount)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {format(new Date(p.date), "d MMM yyyy")} · {sourceLabel(p.source)}
            </p>
            {p.notes && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.notes}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ============ OWED TO ME ============

function OwedToMeTab() {
  const { items, add, update, remove } = useLoans();
  const ledger = useLedgerSync();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);

  // Pending action awaiting a funding-source choice.
  const [pending, setPending] = useState<
    | { kind: "create"; draft: Omit<Loan, "id" | "created_at" | "payments"> }
    | { kind: "topup"; loan: Loan; amount: number; date: string; notes?: string }
    | { kind: "repay"; loan: Loan; amount: number; date: string; notes?: string }
    | null
  >(null);

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
                        {l.start_date && <> · {format(new Date(l.start_date), "d MMM yyyy")}</>}
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

                  <RepaymentLauncher
                    disabled={settled}
                    label={`Log repayment from ${l.person_name}`}
                    max={remaining}
                    onSubmit={({ amount, date, notes }) =>
                      setPending({ kind: "repay", loan: l, amount, date, notes })
                    }
                  />

                  <TopUpLauncher
                    label={`Top up ${l.person_name}'s loan`}
                    onSubmit={({ amount, date, notes }) =>
                      setPending({ kind: "topup", loan: l, amount, date, notes })
                    }
                  />

                  <Accordion type="single" collapsible>
                    <AccordionItem value="hist" className="border-none">
                      <AccordionTrigger className="text-xs py-1.5 hover:no-underline">
                        <span className="flex items-center gap-1.5">
                          <History className="h-3.5 w-3.5" /> View history ({(l.payments ?? []).length})
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <HistoryList payments={l.payments ?? []} />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div className="flex justify-end">
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
        onSave={async (draft) => {
          if (editing) {
            await update(editing.id, draft);
            toast.success("Loan updated");
            setOpen(false);
          } else {
            // New loan = money going OUT — ask for funding source.
            setOpen(false);
            setPending({ kind: "create", draft });
          }
        }}
      />

      <FundingSourceDialog
        open={!!pending}
        onOpenChange={(v) => { if (!v) setPending(null); }}
        title={
          pending?.kind === "create" ? "Loan funded from"
          : pending?.kind === "topup" ? "Top-up funded from"
          : pending?.kind === "repay" ? "Repayment goes to"
          : ""
        }
        direction={pending?.kind === "repay" ? "in" : "out"}
        onConfirm={async (choice) => {
          if (!pending) return;
          try {
            if (pending.kind === "create") {
              const date = pending.draft.start_date ?? todayISO();
              await add({ ...pending.draft, payments: [] });
              await ledger.debit(choice, {
                amount: pending.draft.total_amount,
                date,
                label: `Loan to ${pending.draft.person_name}`,
                category: "Loans",
              });
              toast.success("Loan added");
            } else if (pending.kind === "topup") {
              const next: LedgerPayment[] = [
                ...(pending.loan.payments ?? []),
                {
                  id: crypto.randomUUID(),
                  date: pending.date,
                  amount: pending.amount,
                  notes: pending.notes,
                  type: "topup",
                  source: encodeSource(choice),
                },
              ];
              await update(pending.loan.id, {
                total_amount: pending.loan.total_amount + pending.amount,
                payments: next,
              });
              await ledger.debit(choice, {
                amount: pending.amount,
                date: pending.date,
                label: `Top-up loan · ${pending.loan.person_name}`,
                category: "Loans",
                notes: pending.notes,
              });
              toast.success("Top-up logged");
            } else if (pending.kind === "repay") {
              const next: LedgerPayment[] = [
                ...(pending.loan.payments ?? []),
                {
                  id: crypto.randomUUID(),
                  date: pending.date,
                  amount: pending.amount,
                  notes: pending.notes,
                  type: "payment",
                  source: encodeSource(choice),
                },
              ];
              await update(pending.loan.id, { payments: next });
              await ledger.credit(choice, {
                amount: pending.amount,
                date: pending.date,
                label: `Repayment · ${pending.loan.person_name}`,
                category: "Loan repayment",
                notes: pending.notes,
              });
              toast.success("Repayment logged");
            }
          } catch (e) {
            console.error(e);
            toast.error("Something went wrong");
          } finally {
            setPending(null);
          }
        }}
      />
    </div>
  );
}

function RepaymentLauncher({
  disabled, label, max, onSubmit,
}: {
  disabled: boolean;
  label: string;
  max: number;
  onSubmit: (v: { amount: number; date: string; notes?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
        <Wallet className="h-4 w-4" /> Log Repayment
      </Button>
      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        max={max}
        onSave={(v) => { setOpen(false); onSubmit(v); }}
      />
    </>
  );
}

function TopUpLauncher({
  label, onSubmit,
}: {
  label: string;
  onSubmit: (v: { amount: number; date: string; notes?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <ArrowUpRight className="h-4 w-4" /> Top Up Loan
      </Button>
      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        max={Number.POSITIVE_INFINITY}
        hideRemaining
        onSave={(v) => { setOpen(false); onSubmit(v); }}
      />
    </>
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
  const [startDate, setStartDate] = useState(todayISO());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setName(editing?.person_name ?? "");
      setAmount(editing ? String(editing.total_amount) : "");
      setStartDate(editing?.start_date ?? todayISO());
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {editing ? "Total (£)" : "Starting amount (£)"}
              </Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Loan date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
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
              onSave({
                person_name: name.trim(),
                total_amount: amt,
                start_date: startDate || null,
                notes: notes.trim() || undefined,
              });
            }}
          >
            {editing ? "Save" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ DEBTS & BNPL ============

function DebtsTab() {
  const { items, add, update, remove } = useDebts();
  const ledger = useLedgerSync();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [pending, setPending] = useState<
    | { debt: Debt; amount: number; date: string; notes?: string }
    | null
  >(null);

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

                    <DebtPaymentLauncher
                      disabled={settled}
                      label={`Add payment — ${d.name}`}
                      max={remaining}
                      onSubmit={(v) => setPending({ debt: d, ...v })}
                    />

                    <Accordion type="single" collapsible>
                      <AccordionItem value="hist" className="border-none">
                        <AccordionTrigger className="text-xs py-1.5 hover:no-underline">
                          <span className="flex items-center gap-1.5">
                            <History className="h-3.5 w-3.5" /> View history ({(d.payments ?? []).length})
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <HistoryList payments={d.payments ?? []} />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="flex justify-end">
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
              const defaultAmount = d.total_amount / totalInstallments;
              const paidCount = Math.min(totalInstallments, (d.payments ?? []).length);
              const remaining = debtRemaining(d);
              const pct = (paidCount / totalInstallments) * 100;
              const settled = paidCount >= totalInstallments;
              const dates = d.installment_dates ?? [];
              const nextDate = dates[paidCount] ?? todayISO();
              return (
                <Card key={d.id} className={settled ? "border-primary/30 bg-primary/5" : ""}>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                          {fmt(defaultAmount)} × {totalInstallments}
                          {dates[paidCount] && (
                            <> · next {format(new Date(dates[paidCount]), "d MMM")}</>
                          )}
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

                    <DebtPaymentLauncher
                      disabled={settled}
                      label={`Pay installment — ${d.name}`}
                      defaultAmount={defaultAmount}
                      defaultDate={nextDate}
                      max={remaining}
                      buttonIcon={<ChevronRight className="h-4 w-4" />}
                      buttonLabel="Pay Next Installment"
                      onSubmit={(v) => setPending({ debt: d, ...v })}
                    />

                    <Accordion type="single" collapsible>
                      <AccordionItem value="hist" className="border-none">
                        <AccordionTrigger className="text-xs py-1.5 hover:no-underline">
                          <span className="flex items-center gap-1.5">
                            <History className="h-3.5 w-3.5" /> View history ({(d.payments ?? []).length})
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <HistoryList payments={d.payments ?? []} />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="flex justify-end">
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

      <FundingSourceDialog
        open={!!pending}
        onOpenChange={(v) => { if (!v) setPending(null); }}
        title={pending ? `Payment funded from` : ""}
        direction="out"
        onConfirm={async (choice) => {
          if (!pending) return;
          try {
            const next: LedgerPayment[] = [
              ...(pending.debt.payments ?? []),
              {
                id: crypto.randomUUID(),
                date: pending.date,
                amount: pending.amount,
                notes: pending.notes,
                type: "payment",
                source: encodeSource(choice),
              },
            ];
            await update(pending.debt.id, { payments: next });
            await ledger.debit(choice, {
              amount: pending.amount,
              date: pending.date,
              label: pending.debt.kind === "bnpl"
                ? `BNPL · ${pending.debt.name}`
                : `Debt · ${pending.debt.name}`,
              category: "Debt",
              notes: pending.notes,
            });
            toast.success("Payment logged");
          } catch (e) {
            console.error(e);
            toast.error("Something went wrong");
          } finally {
            setPending(null);
          }
        }}
      />
    </div>
  );
}

function DebtPaymentLauncher({
  disabled, label, defaultAmount, defaultDate, max, onSubmit,
  buttonIcon, buttonLabel,
}: {
  disabled?: boolean;
  label: string;
  defaultAmount?: number;
  defaultDate?: string;
  max: number;
  onSubmit: (v: { amount: number; date: string; notes?: string }) => void;
  buttonIcon?: React.ReactNode;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
        {buttonIcon ?? <Plus className="h-4 w-4" />} {buttonLabel ?? "Add Payment"}
      </Button>
      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        defaultAmount={defaultAmount}
        defaultDate={defaultDate}
        max={max}
        onSave={(v) => { setOpen(false); onSubmit(v); }}
      />
    </>
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
  const [startDate, setStartDate] = useState(todayISO());
  const [dates, setDates] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setKind(editing?.kind ?? "standard");
      setAmount(editing ? String(editing.total_amount) : "");
      setInstallments(editing?.installments_total ? String(editing.installments_total) : "4");
      setStartDate(editing?.start_date ?? todayISO());
      setDates(editing?.installment_dates ?? []);
      setNotes(editing?.notes ?? "");
    }
  }, [open, editing]);

  // Keep date array length aligned with installments count.
  const n = parseInt(installments, 10) || 4;
  useEffect(() => {
    if (kind !== "bnpl") return;
    setDates((prev) => {
      const out = [...prev];
      while (out.length < n) {
        // Default each missing slot to monthly cadence from start date.
        const base = new Date(startDate || todayISO());
        base.setMonth(base.getMonth() + out.length);
        out.push(format(base, "yyyy-MM-dd"));
      }
      return out.slice(0, n);
    });
  }, [kind, n, startDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
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
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          {kind === "bnpl" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Installments</Label>
                <Select value={installments} onValueChange={setInstallments}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 6, 8, 12].map((nn) => (
                      <SelectItem key={nn} value={String(nn)}>{nn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Scheduled due dates</Label>
                <div className="space-y-2">
                  {dates.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-12">#{i + 1}</span>
                      <Input
                        type="date"
                        value={d}
                        onChange={(e) => {
                          const next = [...dates];
                          next[i] = e.target.value;
                          setDates(next);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
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
                installments_total: kind === "bnpl" ? n : null,
                installment_dates: kind === "bnpl" ? dates.slice(0, n) : [],
                start_date: startDate || null,
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
  open, onOpenChange, title, defaultAmount, defaultDate, max, hideRemaining, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  defaultAmount?: number;
  defaultDate?: string;
  max: number;
  hideRemaining?: boolean;
  onSave: (data: { amount: number; date: string; notes?: string }) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount != null ? defaultAmount.toFixed(2) : "");
      setDate(defaultDate ?? todayISO());
      setNotes("");
    }
  }, [open, defaultAmount, defaultDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (£)</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            {!hideRemaining && Number.isFinite(max) && (
              <p className="text-[11px] text-muted-foreground">Remaining: {fmt(max)}</p>
            )}
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
