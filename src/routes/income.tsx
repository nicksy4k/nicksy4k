import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/income")({
  head: () => ({ meta: [{ title: "Income — Ledgerly" }] }),
  component: IncomePage,
});

function IncomePage() {
  const { items, add, remove } = useIncomes();
  const { list: categories } = useIncomeCategories();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(categories[0] ?? "Other");
  const [notes, setNotes] = useState("");

  const total = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);
  const thisMonth = useMemo(() => {
    const now = new Date();
    return items
      .filter((i) => {
        const d = parseISO(i.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, i) => s + i.amount, 0);
  }, [items]);

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

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs uppercase tracking-wider">This month</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{fmt(thisMonth)}</p>
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

      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
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
