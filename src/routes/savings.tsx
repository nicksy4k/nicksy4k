import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSavings } from "@/lib/store";
import type { SavingsKind } from "@/lib/types";
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
import { ArrowDownCircle, ArrowUpCircle, PiggyBank, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/savings")({
  head: () => ({ meta: [{ title: "Savings — Ledgerly" }] }),
  component: SavingsPage,
});

function SavingsPage() {
  const { items, add, remove } = useSavings();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [kind, setKind] = useState<SavingsKind>("deposit");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState("");
  const [notes, setNotes] = useState("");

  const { balance, deposits, withdrawals, byAccount } = useMemo(() => {
    let d = 0, w = 0;
    const acc = new Map<string, number>();
    items.forEach((s) => {
      const delta = s.kind === "deposit" ? s.amount : -s.amount;
      if (s.kind === "deposit") d += s.amount; else w += s.amount;
      acc.set(s.account, (acc.get(s.account) ?? 0) + delta);
    });
    return {
      balance: d - w,
      deposits: d,
      withdrawals: w,
      byAccount: Array.from(acc.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [items]);

  function save() {
    const amt = parseFloat(amount);
    if (!account.trim() || !(amt > 0)) {
      toast.error("Enter an account and a positive amount.");
      return;
    }
    add({
      date,
      kind,
      amount: amt,
      account: account.trim(),
      notes: notes.trim() || undefined,
    });
    setAmount(""); setNotes("");
    toast.success(kind === "deposit" ? "Deposit recorded" : "Withdrawal recorded");
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Track your reserves</p>
        <h1 className="text-3xl md:text-4xl font-semibold">Savings</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs uppercase tracking-wider">Current balance</span>
              <PiggyBank className="h-4 w-4 text-primary" />
            </div>
            <p className={`text-2xl font-semibold tabular-nums ${balance < 0 ? "text-destructive" : ""}`}>{fmt(balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs uppercase tracking-wider">Total deposits</span>
              <ArrowUpCircle className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{fmt(deposits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs uppercase tracking-wider">Total withdrawals</span>
              <ArrowDownCircle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{fmt(withdrawals)}</p>
          </CardContent>
        </Card>
      </div>

      {byAccount.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>By account</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {byAccount.map(([name, bal]) => (
                <li key={name} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium">{name}</span>
                  <span className={`text-sm tabular-nums ${bal < 0 ? "text-destructive" : ""}`}>{fmt(bal)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle>Record a deposit or withdrawal</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Type">
              <Select value={kind} onValueChange={(v) => setKind(v as SavingsKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Amount (£)"><Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Account"><Input placeholder="e.g. Monzo Pot, ISA" value={account} onChange={(e) => setAccount(e.target.value)} /></Field>
          </div>
          <Field label="Notes (optional)"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <div className="flex justify-end">
            <Button onClick={save}><Plus className="h-4 w-4" /> Record</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No savings activity yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{s.account}</p>
                      <Badge variant={s.kind === "deposit" ? "default" : "secondary"} className="font-normal capitalize">{s.kind}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(s.date), "MMM d, yyyy")}{s.notes ? ` · ${s.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold tabular-nums ${s.kind === "deposit" ? "text-primary" : "text-destructive"}`}>
                      {s.kind === "deposit" ? "+" : "−"}{fmt(s.amount)}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => { remove(s.id); toast.success("Removed"); }}>
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
