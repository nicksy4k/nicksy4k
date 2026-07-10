import { createFileRoute } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { useEffect, useMemo, useState } from "react";
import { useCategories, useCommitments, useSavings, useTransactions } from "@/lib/store";
import type { Commitment } from "@/lib/types";
import { fmt } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CalendarClock, CheckCircle2, Pencil, Plus, Trash2, AlertTriangle, Check } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { toast } from "sonner";
import { useActiveCycle, advanceDueDate } from "@/lib/cycle";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/commitments")({
  head: () => ({ meta: [{ title: "Commitments — Ledgerly" }] }),
  component: CommitmentsPage,
  errorComponent: RouteError,
});

const BILL_POCKET = "Bill Money";

function todayISO() {
  // FIXED: Using date-fns format to prevent UTC timezone shift
  return format(new Date(), "yyyy-MM-dd");
}

function CommitmentsPage() {
  const { items, add, update, remove } = useCommitments();
  const { items: savings, add: addSaving } = useSavings();
  const { items: transactions, add: addTransaction, remove: removeTransaction } = useTransactions();
  const { list: categories } = useCategories();

  const cycle = useActiveCycle();
  // Reset date = day AFTER cycle end (exclusive). Bills due strictly before this count.
  const resetDate = format(addDays(cycle.end, 1), "yyyy-MM-dd");

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

  // Waterfall: order unpaid bills by due date, allocate Bill Money down the list.
  // funded[id] = true means the current pocket balance covers this bill in priority order.
  const fundedMap = useMemo(() => {
    const unpaidSorted = items
      .filter((i) => !i.paid)
      .slice()
      .sort((a, b) => (a.next_due_date ?? "9999").localeCompare(b.next_due_date ?? "9999"));
    let remaining = billPocketBalance;
    const map: Record<string, boolean> = {};
    for (const c of unpaidSorted) {
      if (remaining >= c.amount) {
        map[c.id] = true;
        remaining -= c.amount;
      } else {
        map[c.id] = false;
      }
    }
    return map;
  }, [items, billPocketBalance]);

  // NOTE: Page-level rollover logic intentionally removed.
  // The single master rollover engine lives in `useCommitmentRollover`,
  // mounted globally in <AppLayout/>. It advances next_due_date AND resets
  // paid → false across ALL commitment rows whenever the cycle advances.


  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Commitment | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsItem = useMemo(
    () => items.find((i) => i.id === detailsId) ?? null,
    [items, detailsId],
  );

  function openNew() {
    setEditing(null);
    setFormOpen(true);
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
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Active cycle</Label>
              <p className="text-sm mt-0.5">
                <span className="font-medium tabular-nums">
                  {format(cycle.start, "d MMM")} – {format(cycle.end, "d MMM yyyy")}
                </span>
                {cycle.isOverridden && <span className="ml-2 text-xs text-amber-600">· override</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bills due on or before {format(cycle.end, "d MMM")} count toward this cycle's shortfall.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">Change cycle</Link>
            </Button>
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
            <ul className="space-y-2">
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setDetailsId(c.id)}
                    className="w-full text-left rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors px-4 py-3 flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.item_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider">{c.category || "—"}</span>
                        <span>{c.next_due_date ? `Due ${format(parseISO(c.next_due_date), "d MMM yyyy")}` : "No due date"}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold tabular-nums">{fmt(c.amount)}</span>
                      {c.paid ? (
                        <span
                          title="Paid"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary"
                        >
                          <Check className="h-4 w-4" />
                        </span>
                      ) : (
                        <span
                          title={fundedMap[c.id] ? "Unpaid · funded" : "Unpaid · shortfall"}
                          className={`inline-flex h-2.5 w-2.5 rounded-full ${
                            fundedMap[c.id] ? "bg-yellow-400" : "bg-destructive"
                          }`}
                          aria-label={fundedMap[c.id] ? "Funded" : "Shortfall"}
                        />
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <CommitmentDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        categories={categories}
        onSave={(data) => {
          if (editing) {
            update(editing.id, data);
            toast.success("Updated");
          } else {
            add(data);
            toast.success("Added");
          }
          setFormOpen(false);
        }}
      />

      <DetailsDialog
        item={detailsItem}
        cycle={cycle}
        onClose={() => setDetailsId(null)}
        onEdit={(c) => {
          setDetailsId(null);
          setEditing(c);
          setFormOpen(true);
        }}
        onDelete={(id) => {
          remove(id);
          setDetailsId(null);
          toast.success("Removed");
        }}
        onConfirmReset={async (c, newDue) => {
          const paidDate = todayISO();
          await update(c.id, {
            paid: true,
            last_paid_date: paidDate,
            prev_due_date: c.next_due_date ?? null,
            next_due_date: newDue,
          });
          // Auto-log expense transaction in the main ledger
          try {
            await addTransaction({
              date: paidDate,
              retailer: c.item_name,
              total_amount: c.amount,
              receipt_attached: false,
              receipt_type: "None",
              receipt_location: "",
              notes: `Auto-logged from commitment: ${c.item_name}`,
              commitment_id: c.id,
              items: [{
                id: crypto.randomUUID(),
                item_name: c.item_name,
                price: c.amount,
                category: c.category || "Subscriptions",
              }],
            });
            // Auto-deduct from Bill Money pocket
            await addSaving({
              date: paidDate,
              kind: "withdrawal",
              amount: c.amount,
              account: BILL_POCKET,
              notes: `Auto-deducted for ${c.item_name}`,
            });
          } catch (err) {
            console.error("Failed to auto-log paid commitment", err);
            toast.error("Marked paid, but auto-logging failed.");
          }
          toast.success("Paid · logged & deducted from Bill Money");
          setDetailsId(null);
        }}
        onUnmarkPaid={async (c) => {
          try {
            // Delete the auto-logged expense transaction(s) linked to this commitment
            const linked = transactions.filter((t) => t.commitment_id === c.id);
            for (const t of linked) {
              await removeTransaction(t.id);
            }
            // Refund the Bill Money pocket
            const refundAmount = linked.reduce((s, t) => s + t.total_amount, 0) || c.amount;
            await addSaving({
              date: todayISO(),
              kind: "deposit",
              amount: refundAmount,
              account: BILL_POCKET,
              notes: `Refund — unmarked ${c.item_name}`,
            });
            await update(c.id, {
              paid: false,
              last_paid_date: null,
              next_due_date: c.prev_due_date ?? c.next_due_date ?? null,
              prev_due_date: null,
            });
            toast.success("Reversed · transaction removed & Bill Money refunded");
          } catch (err) {
            console.error("Failed to undo paid commitment", err);
            toast.error("Could not fully undo. Check transactions & pocket.");
          }
          setDetailsId(null);
        }}
      />
    </div>
  );
}

function DetailsDialog({
  item, cycle, onClose, onEdit, onDelete, onConfirmReset, onUnmarkPaid,
}: {
  item: Commitment | null;
  cycle: ReturnType<typeof useActiveCycle>;
  onClose: () => void;
  onEdit: (c: Commitment) => void;
  onDelete: (id: string) => void;
  onConfirmReset: (c: Commitment, newDue: string) => void | Promise<void>;
  onUnmarkPaid: (c: Commitment) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"details" | "confirm">("details");
  const [pickerDate, setPickerDate] = useState("");

  useEffect(() => {
    if (item) {
      setMode("details");
      setPickerDate(item.next_due_date ?? todayISO());
    }
  }, [item]);

  const open = !!item;

  function handlePaidToggle(checked: boolean) {
    if (!item) return;
    if (checked) {
      setMode("confirm");
    } else {
      onUnmarkPaid(item);
    }
  }

  function confirmWith(newDue: string) {
    if (!item) return;
    onConfirmReset(item, newDue);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        {item && mode === "details" && (
          <>
            <DialogHeader>
              <DialogTitle>{item.item_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <Row label="Amount" value={<span className="font-semibold tabular-nums">{fmt(item.amount)}</span>} />
              <Row label="Category" value={item.category || "—"} />
              <Row label="Store / provider" value={item.store || "—"} />
              <Row label="Payment method" value={item.payment_method || "—"} />
              <Row label="Next due" value={item.next_due_date ? format(parseISO(item.next_due_date), "d MMM yyyy") : "—"} />
              <Row label="Last paid" value={item.last_paid_date ? format(parseISO(item.last_paid_date), "d MMM yyyy") : "—"} />
              {item.notes && <Row label="Notes" value={<span className="italic text-muted-foreground">{item.notes}</span>} />}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <Label htmlFor="paid-toggle">Paid</Label>
                <Switch id="paid-toggle" checked={item.paid} onCheckedChange={handlePaidToggle} />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button size="sm" onClick={onClose}>Close</Button>
            </DialogFooter>
          </>
        )}

        {item && mode === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm payment reset?</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Marking <span className="font-medium text-foreground">{item.item_name}</span> as paid will advance its next due date.
                Choose how to roll it forward:
              </p>
              <div className="grid gap-2">
                {/* Frequency-aware manual advance — choose the cadence that matches this specific bill. */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="flex-col h-auto py-2"
                    onClick={() => {
                      const base = item.next_due_date ?? todayISO();
                      confirmWith(advanceDueDate(base, "monthly"));
                    }}
                  >
                    <span className="text-sm">Advance +1 month</span>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(advanceDueDate(item.next_due_date ?? todayISO(), "monthly")), "d MMM yyyy")}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-col h-auto py-2"
                    onClick={() => {
                      const base = item.next_due_date ?? todayISO();
                      confirmWith(advanceDueDate(base, "four-weekly"));
                    }}
                  >
                    <span className="text-sm">Advance +4 weeks</span>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(advanceDueDate(item.next_due_date ?? todayISO(), "four-weekly")), "d MMM yyyy")}
                    </span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Global cycle: {cycle.type === "four-weekly" ? "4-weekly" : "monthly"} — pick the cadence that matches this bill.
                </p>

                <div className="rounded-md border border-border p-3 space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Or pick a date</Label>
                  <div className="flex gap-2">
                    <Input type="date" value={pickerDate} onChange={(e) => setPickerDate(e.target.value)} />
                    <Button onClick={() => pickerDate && confirmWith(pickerDate)}>Set</Button>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setMode("details"); onClose(); }}>Cancel</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

function CommitmentDialog({
  open, onOpenChange, editing, categories, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Commitment | null;
  categories: string[];
  onSave: (data: Omit<Commitment, "id" | "created_at">) => void;
}) {
  const [itemName, setItemName] = useState("");
  const [store, setStore] = useState("");
  const [payment, setPayment] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Subscriptions");
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
    setCategory(editing?.category ?? (categories.includes("Subscriptions") ? "Subscriptions" : categories[0] ?? "Subscriptions"));
    setLastPaid(editing?.last_paid_date ?? "");
    setNextDue(editing?.next_due_date ?? "");
    setNotes(editing?.notes ?? "");
    setPaid(editing?.paid ?? false);
  }, [open, editing, categories]);

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
      category: category || "Subscriptions",
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
            <Field label="Category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Payment method"><Input value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="Direct Debit" /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Amount (£)"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
            <Field label="Last paid date"><Input type="date" value={lastPaid} onChange={(e) => setLastPaid(e.target.value)} /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Next due date"><Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></Field>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <Switch checked={paid} onCheckedChange={setPaid} id="paid" />
                <Label htmlFor="paid">Marked as paid</Label>
              </div>
            </div>
          </div>
          <Field label="Notes"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
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