import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { FileUp, Undo2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, useIncomes, useTransactions } from "@/lib/store";
import { fmt, mainExpensePortion } from "@/lib/format";
import { findDuplicate, parseStatement, type ParsedRow } from "@/lib/csvImport";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Batch {
  id: string;
  file_name: string | null;
  transaction_count: number;
  income_count: number;
  total_out: number;
  total_in: number;
  undone_at: string | null;
  created_at: string;
}

type RowState = { include: boolean; category: string; status: "new" | "duplicate" | "pending" | "internal" };

export function StatementImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const { items: txs } = useTransactions();
  const { items: incomes } = useIncomes();
  const { list: catList } = useCategories();
  const defaultCat = catList.includes("Other") ? "Other" : (catList[0] ?? "Other");

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [state, setState] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);
  const [undoTarget, setUndoTarget] = useState<Batch | null>(null);

  const batches = useQuery({
    queryKey: ["import_batches"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Batch[];
    },
  });

  async function onFile(f: File) {
    try {
      const parsed = parseStatement(await f.text());
      if (!parsed.length) {
        toast.error("No transactions found in that file.");
        return;
      }
      const exOut = (txs ?? []).map((t) => ({
        date: t.date,
        amount: Number(t.total_amount),
        label: t.retailer,
      }));
      exOut.push(
        ...(txs ?? []).map((t) => ({ date: t.date, amount: mainExpensePortion(t), label: t.retailer })),
      );
      const exIn = (incomes ?? []).map((i) => ({ date: i.date, amount: Number(i.amount), label: i.source }));
      const st: Record<string, RowState> = {};
      for (const r of parsed) {
        let status: RowState["status"] = "new";
        if (r.kind === "internal") status = "internal";
        else if (findDuplicate(r, r.kind === "income" ? exIn : exOut)) status = "duplicate";
        else if (r.state !== "COMPLETED") status = "pending";
        st[r.key] = { include: status === "new", category: defaultCat, status };
      }
      setFileName(f.name);
      setRows(parsed.sort((a, b) => b.date.localeCompare(a.date)));
      setState(st);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that file");
    }
  }

  const chosen = useMemo(() => rows.filter((r) => state[r.key]?.include && r.kind !== "internal"), [rows, state]);
  const totalOut = chosen.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);
  const totalIn = chosen.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);

  function reset() {
    setRows([]);
    setState({});
    setFileName(null);
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["incomes"] });
    qc.invalidateQueries({ queryKey: ["import_batches"] });
  }

  async function undoBatch(id: string) {
    const [a, b] = await Promise.all([
      supabase.from("transactions").delete().eq("import_batch_id", id),
      supabase.from("incomes").delete().eq("import_batch_id", id),
    ]);
    if (a.error || b.error) {
      toast.error("Undo failed — nothing else was changed. Please try again.");
      return;
    }
    await supabase.from("import_batches").update({ undone_at: new Date().toISOString() }).eq("id", id);
    refresh();
    toast.success("Import undone — everything it added has been removed.");
  }

  async function confirmImport() {
    if (!chosen.length) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const expenses = chosen.filter((r) => r.kind === "expense");
      const ins = chosen.filter((r) => r.kind === "income");
      const { data: batch, error: bErr } = await supabase
        .from("import_batches")
        .insert({
          user_id: u.user.id,
          file_name: fileName,
          transaction_count: expenses.length,
          income_count: ins.length,
          total_out: Math.round(totalOut * 100) / 100,
          total_in: Math.round(totalIn * 100) / 100,
        })
        .select("id")
        .single();
      if (bErr || !batch) throw bErr ?? new Error("Couldn't start import");
      const batchId = batch.id as string;
      const note = `Imported from ${fileName ?? "statement"}`;
      try {
        if (expenses.length) {
          const { error } = await supabase.from("transactions").insert(
            expenses.map((r) => ({
              user_id: u.user!.id,
              date: r.date,
              retailer: r.description,
              total_amount: r.amount,
              receipt_attached: false,
              receipt_type: "None",
              receipt_location: "",
              notes: note,
              items: [
                {
                  id: crypto.randomUUID(),
                  item_name: r.description,
                  price: r.amount,
                  quantity: 1,
                  category: state[r.key].category,
                },
              ] as never,
              payment_splits: [] as never,
              is_pending: false,
              import_batch_id: batchId,
            })),
          );
          if (error) throw error;
        }
        if (ins.length) {
          const { error } = await supabase.from("incomes").insert(
            ins.map((r) => ({
              user_id: u.user!.id,
              date: r.date,
              source: r.description,
              amount: r.amount,
              category: "Other",
              notes: note,
              import_batch_id: batchId,
            })),
          );
          if (error) throw error;
        }
      } catch (e) {
        // Roll back anything partially written so the ledger is untouched.
        await undoBatch(batchId);
        throw e;
      }
      refresh();
      reset();
      onOpenChange(false);
      toast.success(`Imported ${chosen.length} item${chosen.length === 1 ? "" : "s"}`, {
        duration: 15000,
        action: { label: "Undo", onClick: () => void undoBatch(batchId) },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSaving(false);
    }
  }

  const statusBadge: Record<RowState["status"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    new: { label: "New", variant: "default" },
    duplicate: { label: "Already logged?", variant: "secondary" },
    pending: { label: "Pending", variant: "outline" },
    internal: { label: "Pocket transfer — skipped", variant: "outline" },
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) reset();
          onOpenChange(o);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import bank statement</DialogTitle>
            <DialogDescription>
              In Revolut: Home → ⋯ → Statement → Excel/CSV. Nothing is saved until you confirm, and
              every import can be undone.
            </DialogDescription>
          </DialogHeader>

          {rows.length === 0 ? (
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 cursor-pointer hover:bg-muted/40">
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Choose a CSV file</span>
              <span className="text-xs text-muted-foreground">Revolut and most UK bank CSVs work</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                aria-label="Statement CSV file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {fileName} · {rows.length} rows. Items that look already logged, pending, or pocket
                transfers are unticked. Imported spending comes off your Main balance.
              </p>
              <div className="divide-y divide-border rounded-md border border-border">
                {rows.map((r) => {
                  const s = state[r.key];
                  const disabled = s.status === "internal";
                  return (
                    <div key={r.key} className="flex items-center gap-3 p-2 text-sm">
                      <Checkbox
                        checked={s.include}
                        disabled={disabled}
                        aria-label={`Include ${r.description}`}
                        onCheckedChange={(v) =>
                          setState((p) => ({ ...p, [r.key]: { ...s, include: !!v } }))
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{r.description}</div>
                        <div className="text-xs text-muted-foreground flex gap-2 items-center flex-wrap">
                          {format(parseISO(r.date), "d MMM yyyy")}
                          <Badge variant={statusBadge[s.status].variant} className="text-[10px]">
                            {statusBadge[s.status].label}
                          </Badge>
                        </div>
                      </div>
                      {r.kind === "expense" && !disabled && (
                        <Select
                          value={s.category}
                          onValueChange={(v) =>
                            setState((p) => ({ ...p, [r.key]: { ...s, category: v } }))
                          }
                        >
                          <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[...new Set([defaultCat, ...catList])].map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <span
                        className={`tabular-nums w-20 text-right ${r.kind === "income" ? "text-primary" : ""}`}
                      >
                        {r.kind === "income" ? "+" : "−"}
                        {fmt(r.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {rows.length === 0 && (batches.data?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Past imports</h3>
              <div className="divide-y divide-border rounded-md border border-border">
                {batches.data!.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{b.file_name ?? "Statement"}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(b.created_at), "d MMM yyyy, HH:mm")} ·{" "}
                        {b.transaction_count + b.income_count} items · −{fmt(Number(b.total_out))} / +
                        {fmt(Number(b.total_in))}
                      </div>
                    </div>
                    {b.undone_at ? (
                      <Badge variant="outline">Undone</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setUndoTarget(b)}>
                        <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <DialogFooter className="gap-2 sm:items-center">
              <span className="text-xs text-muted-foreground mr-auto tabular-nums">
                {chosen.length} selected · −{fmt(totalOut)} · +{fmt(totalIn)}
              </span>
              <Button variant="ghost" onClick={reset}>
                Choose another file
              </Button>
              <Button onClick={confirmImport} disabled={saving || chosen.length === 0}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Import {chosen.length}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!undoTarget} onOpenChange={(o) => !o && setUndoTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this import?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the {undoTarget ? undoTarget.transaction_count + undoTarget.income_count : 0} items
              added from {undoTarget?.file_name ?? "this statement"}. Anything you logged yourself
              stays as it is.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (undoTarget) void undoBatch(undoTarget.id);
                setUndoTarget(null);
              }}
            >
              Undo import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
