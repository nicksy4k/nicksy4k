import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useTransactions, useIncomes, useSavings,
  useCategories, useIncomeCategories, clearAllData,
} from "@/lib/store";
import { Database, Trash2, Download, Plus, X, RotateCcw, Tag } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Ledgerly" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { items: transactions } = useTransactions();
  const { items: incomes } = useIncomes();
  const { items: savings } = useSavings();
  const itemCats = useCategories();
  const incomeCats = useIncomeCategories();

  function exportJson() {
    const payload = { transactions, incomes, savings, categories: itemCats.list, income_categories: incomeCats.list };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledgerly-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Preferences</p>
        <h1 className="text-3xl md:text-4xl font-semibold">Settings</h1>
      </header>

      <div className="space-y-6">
        <CategoryManager
          title="Expense categories"
          description="Used when itemizing a transaction."
          list={itemCats.list}
          onAdd={itemCats.add}
          onRemove={itemCats.remove}
          onReset={itemCats.reset}
        />

        <CategoryManager
          title="Income categories"
          description="Used when logging income."
          list={incomeCats.list}
          onAdd={incomeCats.add}
          onRemove={incomeCats.remove}
          onReset={incomeCats.reset}
        />

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center"><Database className="h-5 w-5 text-primary" /></div>
              <div>
                <CardTitle>Storage</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">Currently using local browser storage</p>
              </div>
            </div>
            <Badge variant="secondary">localStorage</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
              <p className="font-medium">Connecting to Supabase</p>
              <p className="text-muted-foreground">
                Your data is stored on this device only. To sync across devices, connect a Supabase project. The shapes in <code className="text-xs bg-background px-1.5 py-0.5 rounded">src/lib/types.ts</code> mirror what you'll need:
              </p>
              <ul className="text-muted-foreground text-xs list-disc list-inside space-y-1 ml-1">
                <li><code className="text-xs">transactions</code> + <code className="text-xs">line_items</code> (parent/child)</li>
                <li><code className="text-xs">incomes</code> — id, date, source, amount, category, notes</li>
                <li><code className="text-xs">savings_entries</code> — id, date, kind (deposit/withdrawal), amount, account, notes</li>
                <li><code className="text-xs">categories</code> / <code className="text-xs">income_categories</code> — id, name, user_id</li>
              </ul>
              <p className="text-muted-foreground pt-1">
                Then swap the hooks in <code className="text-xs bg-background px-1.5 py-0.5 rounded">src/lib/store.ts</code> to read/write through your Supabase client — the UI doesn't change.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportJson}>
                <Download className="h-4 w-4" /> Export JSON
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" /> Clear all data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This deletes every transaction, income entry, and savings record from this browser. Export first if you want a backup.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { clearAllData(); toast.success("All data cleared"); }}>Clear everything</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>About</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Ledgerly tracks expenses, income, and savings — all itemized, all in £.</p>
            <p>{transactions.length} transactions · {incomes.length} income entries · {savings.length} savings entries.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CategoryManager({
  title, description, list, onAdd, onRemove, onReset,
}: {
  title: string;
  description: string;
  list: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onReset: () => void;
}) {
  const [name, setName] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (list.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("That category already exists.");
      return;
    }
    onAdd(trimmed);
    setName("");
    toast.success(`Added "${trimmed}"`);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center"><Tag className="h-5 w-5 text-primary" /></div>
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="New category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          />
          <Button onClick={submit}><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((c) => (
              <Badge key={c} variant="secondary" className="gap-1.5 pr-1 py-1 font-normal">
                {c}
                <button
                  onClick={() => { onRemove(c); toast.success(`Removed "${c}"`); }}
                  className="rounded-sm hover:bg-destructive/20 hover:text-destructive p-0.5 transition-colors"
                  aria-label={`Remove ${c}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div>
          <Button variant="ghost" size="sm" onClick={() => { onReset(); toast.success("Reset to defaults"); }}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
