import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCommitments, useSavings } from "@/lib/store";
import type { Commitment } from "@/lib/types";
import { fmt } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarClock, CheckCircle2, Pencil, Plus, Trash2, AlertTriangle } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/commitments")({
  head: () => ({ meta: [{ title: "Commitments — Ledgerly" }] }),
  component: CommitmentsPage,
});

const BILL_POCKET = "Bill Money";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function CommitmentsPage() {
  const { items, add, update, remove } = useCommitments();
  const { items: savings } = useSavings();

  const [resetDate, setResetDate] = useState(() => {
    if (typeof window === "undefined") return addDays(new Date(), 28).toISOString().slice(0, 10);
    return localStorage.getItem("iet_reset_date") || addDays(new Date(), 28).toISOString().slice(0, 10);
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("iet_reset_date", resetDate);
  }, [resetDate]);

  const billPocketBalance = useMemo(() => {
    return savings
      .filter((s) => s.account.trim().toLowerCase() === BILL_POCKET.toLowerCase())
      .reduce((sum, s) => sum + (s.kind === "deposit" ? s.amount : -s.amount), 0);
  }, [savings]);

  const totalCommitments = useMemo(
    () => items.reduce((s, i) => s + i.amount, 0),
    [items],
  );

  const leftToPay = useMemo(() => {
    return items
      .filter((i) => !i.paid && i.next_due_date && i.next_due_date < resetDate)
      .reduce((s, i) => s + i.amount, 0);
  }, [items, resetDate]);

  const shortfall = leftToPay - billPocketBalance;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Commitment | null>(null);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(c: Commitment) {
    setEditing(c);
    setOpen(true);
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Recurring bills</p>
          <h1 className="text-3xl md:text-4xl font-semibold">Commitments</h1>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Add Commitment</Button>
      </header>

      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <CalendarClock className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Next Payment Reset Date</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Bills due before this date count toward your shortfall.</p>
            </div>
            <Input
              type="date"
              value={resetDate}
              onChange={(e) => setResetDate(e.target.value)}
              className="w-auto"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Total commitments</p>
            <p className="text-2xl font-semibold tabular-nums">{fmt(totalCommitments)}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Left to pay before reset</p>
            <p className="text-2xl font-semibold tabular-nums">{fmt(leftToPay)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className={`mb-6 ${shortfall > 0.001 ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
        <CardContent className="p-5 flex items-start gap-3">
          {shortfall > 0.001 ? (
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            {shortfall > 0.001 ? (
              <p>
                <span className="font-semibold">Shortfall:</span> Transfer{" "}
                <span className="font-semibold tabular-nums">{fmt(shortfall)}</span> into your{" "}
                <span className="font-semibold">Bill Money</span> pocket to cover upcoming bills.
              </p>
            ) : (
              <p>
                <span className="font-semibold">Bill Money pocket is fully funded.</span>{" "}
                <span className="text-muted-foreground">Balance: {fmt(billPocketBalance)} · Needed: {fmt(leftToPay)}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All commitments</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No commitments yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((c) => {
                const dueBeforeReset = c.next_due_date && c.next_due_date < resetDate;
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{c.item_name}</p>
                        {c.paid ? (
                          <Badge variant="secondary" className="font-normal">Paid</Badge>
                        ) : dueBeforeReset ? (
                          <Badge variant="destructive" className="font-normal">Due before reset</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.store} · {c.payment_method}
                        {c.last_paid_date ? ` · Last paid ${format(parseISO(c.last_paid_date), "MMM d")}` : ""}
                        {c.next_due_date ? ` · Next ${format(parseISO(c.next_due_date), "MMM d")}` : ""}
                      </p>
                      {c.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{c.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums">{fmt(c.amount)}</span>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs text-muted-foreground">Paid</Label>
                        <Switch
                          checked={c.paid}
                          onCheckedChange={(v) => {
                            update(c.id, {
                              paid: v,
                              last_paid_date: v ? todayISO() : c.last_paid_date,
                            });
                          }}
                        />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { remove(c.id); toast.success("Removed"); }}>
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

      <CommitmentDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSave={(data) => {
          if (editing) {
            update(editing.id, data);
            toast.success("Updated");
          } else {
            add(data);
            toast.success("Added");
          }
          setOpen(false);
        }}
      />
    </div>
  );
}

function CommitmentDialog({
  open, onOpenChange, editing, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Commitment | null;
  onSave: (data: Omit<Commitment, "id" | "created_at">) => void;
}) {
  const [itemName, setItemName] = useState("");
  const [store, setStore] = useState("");
  const [payment, setPayment] = useState("");
  const [amount, setAmount] = useState("");
  const [lastPaid, setLastPaid] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [notes, setNotes] = useState("");
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItemName(editing?.item_name ?? "");
    setStore(editing?.store ?? "");
    setPayment(editing?.payment_method ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setLastPaid(editing?.last_paid_date ?? "");
    setNextDue(editing?.next_due_date ?? "");
    setNotes(editing?.notes ?? "");
    setPaid(editing?.paid ?? false);
  }, [open, editing]);

  function submit() {
    const amt = parseFloat(amount);
    if (!itemName.trim() || !(amt >= 0)) {
      toast.error("Item name and a valid amount are required.");
      return;
    }
    onSave({
      item_name: itemName.trim(),
      store: store.trim(),
      payment_method: payment.trim(),
      amount: amt,
      last_paid_date: lastPaid || null,
      next_due_date: nextDue || null,
      notes: notes.trim() || undefined,
      paid,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit commitment" : "Add commitment"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Item name"><Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Netflix" /></Field>
            <Field label="Store / provider"><Input value={store} onChange={(e) => setStore(e.target.value)} placeholder="Netflix Inc." /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Payment method"><Input value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="Direct Debit" /></Field>
            <Field label="Amount (£)"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Last paid date"><Input type="date" value={lastPaid} onChange={(e) => setLastPaid(e.target.value)} /></Field>
            <Field label="Next due date"><Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <div className="flex items-center gap-2">
            <Switch checked={paid} onCheckedChange={setPaid} id="paid" />
            <Label htmlFor="paid">Marked as paid</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{editing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
