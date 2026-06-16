import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTransactions, useCategories } from "@/lib/store";
import { RECEIPT_TYPES, type Category, type LineItem, type ReceiptType } from "@/lib/types";
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
import { Combobox } from "@/components/ui/combobox";
import { ArrowLeft, ArrowRight, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/new")({
  head: () => ({ meta: [{ title: "Log Transaction — Ledgerly" }] }),
  component: NewTransactionPage,
});

interface DraftItem {
  id: string;
  item_name: string;
  price: string;
  category: Category;
  return_window_expiry: string;
  notes: string;
}

function emptyItem(defaultCat: Category = "Other"): DraftItem {
  return { id: crypto.randomUUID(), item_name: "", price: "", category: defaultCat, return_window_expiry: "", notes: "" };
}

function NewTransactionPage() {
  const navigate = useNavigate();
  const { add } = useTransactions();
  const { list: categories } = useCategories();

  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [retailer, setRetailer] = useState("");
  const [receiptAttached, setReceiptAttached] = useState(true);
  const [receiptType, setReceiptType] = useState<ReceiptType>("Digital");
  const [receiptLocation, setReceiptLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem(categories[0] ?? "Other")]);

  const total = useMemo(
    () => items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0),
    [items]
  );

  const canStep2 = retailer.trim().length > 0 && date.length > 0;

  function updateItem(id: string, patch: Partial<DraftItem>) {
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function removeItem(id: string) {
    setItems((arr) => (arr.length === 1 ? arr : arr.filter((it) => it.id !== id)));
  }

  function save() {
    const cleanItems: LineItem[] = items
      .filter((i) => i.item_name.trim() && !isNaN(parseFloat(i.price)))
      .map((i) => ({
        id: i.id,
        item_name: i.item_name.trim(),
        price: parseFloat(i.price),
        category: i.category,
        return_window_expiry: i.return_window_expiry || null,
        notes: i.notes.trim() || undefined,
      }));

    if (cleanItems.length === 0) {
      toast.error("Add at least one line item with a price.");
      return;
    }

    add({
      date,
      retailer: retailer.trim(),
      total_amount: cleanItems.reduce((s, i) => s + i.price, 0),
      receipt_attached: receiptAttached,
      receipt_type: receiptAttached ? receiptType : "None",
      receipt_location: receiptAttached ? receiptLocation.trim() : "",
      notes: notes.trim() || undefined,
      items: cleanItems,
    });
    toast.success("Transaction saved");
    navigate({ to: "/history" });
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Step {step} of 2</p>
        <h1 className="text-3xl md:text-4xl font-semibold">
          {step === 1 ? "Transaction details" : "Itemize your purchase"}
        </h1>
      </header>

      <div className="flex gap-2 mb-6">
        <StepDot active={step >= 1} done={step > 1} label="Receipt" onClick={() => setStep(1)} />
        <div className="flex-1 h-px bg-border self-center" />
        <StepDot active={step >= 2} done={false} label="Items" onClick={() => canStep2 && setStep(2)} />
      </div>

      {step === 1 && (
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Retailer / shop">
                <Input placeholder="e.g. Asda" value={retailer} onChange={(e) => setRetailer(e.target.value)} />
              </Field>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label className="text-sm">Receipt attached</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Track where the receipt lives for returns or warranty claims.</p>
                </div>
                <Switch checked={receiptAttached} onCheckedChange={setReceiptAttached} />
              </div>
              {receiptAttached && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Type">
                    <Select value={receiptType} onValueChange={(v) => setReceiptType(v as ReceiptType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RECEIPT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Stored at">
                    <Input
                      placeholder="e.g. Google Drive / Shoebox / Wallet"
                      value={receiptLocation}
                      onChange={(e) => setReceiptLocation(e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </div>

            <Field label="Notes (optional)">
              <Textarea rows={3} placeholder="Anything worth remembering…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>

            <div className="flex justify-end pt-2">
              <Button disabled={!canStep2} onClick={() => setStep(2)}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {items.map((item, idx) => (
            <Card key={item.id}>
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Item {idx + 1}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-[1fr_140px] gap-4">
                  <Field label="Item name">
                    <Input placeholder="e.g. Wool overshirt" value={item.item_name} onChange={(e) => updateItem(item.id, { item_name: e.target.value })} />
                  </Field>
                  <Field label="Price (£)">
                    <Input inputMode="decimal" placeholder="0.00" value={item.price} onChange={(e) => updateItem(item.id, { price: e.target.value })} />
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Category">
                    <Select value={item.category} onValueChange={(v) => updateItem(item.id, { category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[...categories].sort((a, b) => a.localeCompare(b)).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Return / warranty expiry (optional)">
                    <Input type="date" value={item.return_window_expiry} onChange={(e) => updateItem(item.id, { return_window_expiry: e.target.value })} />
                  </Field>
                </div>
                <Field label="Notes (optional)">
                  <Input placeholder="Serial #, color, size…" value={item.notes} onChange={(e) => updateItem(item.id, { notes: e.target.value })} />
                </Field>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" className="w-full" onClick={() => setItems((a) => [...a, emptyItem(categories[0] ?? "Other")])}>
            <Plus className="h-4 w-4" /> Add another item
          </Button>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Calculated total</p>
                <p className="text-2xl font-semibold tabular-nums mt-1">{fmt(total)}</p>
              </div>
              <p className="text-xs text-muted-foreground max-w-[180px] text-right">Auto-summed from your line items.</p>
            </CardContent>
          </Card>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={save}>
              <Check className="h-4 w-4" /> Save transaction
            </Button>
          </div>
        </div>
      )}
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

function StepDot({ active, done, label, onClick }: { active: boolean; done: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-sm">
      <span className={`h-7 w-7 rounded-full grid place-items-center text-xs font-semibold transition-colors ${
        done ? "bg-primary text-primary-foreground" : active ? "bg-primary/20 text-primary ring-1 ring-primary/40" : "bg-muted text-muted-foreground"
      }`}>
        {done ? <Check className="h-3.5 w-3.5" /> : label[0]}
      </span>
      <span className={active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </button>
  );
}