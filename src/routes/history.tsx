import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTransactions, useCategories } from "@/lib/store";
import type { Category } from "@/lib/types";
import { fmt } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChevronDown, FileText, MapPin, Search, Trash2 } from "lucide-react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Transaction history — Ledgerly" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const { items, remove } = useTransactions();
  const { list: categories } = useCategories();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((t) => {
      const matchesCat = cat === "all" || t.items.some((i) => i.category === cat);
      if (!matchesCat) return false;
      if (!needle) return true;
      return (
        t.retailer.toLowerCase().includes(needle) ||
        t.receipt_location.toLowerCase().includes(needle) ||
        t.notes?.toLowerCase().includes(needle) ||
        t.items.some((i) => i.item_name.toLowerCase().includes(needle))
      );
    });
  }, [items, q, cat]);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">All transactions</p>
        <h1 className="text-3xl md:text-4xl font-semibold">History</h1>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search retailer, item, location…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={cat} onValueChange={(v) => setCat(v as Category | "all")}>
          <SelectTrigger className="sm:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            No transactions match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Collapsible key={t.id} asChild>
              <Card className="overflow-hidden">
                <CollapsibleTrigger className="w-full text-left group">
                  <div className="flex items-center gap-4 p-4 md:p-5 hover:bg-muted/30 transition-colors">
                    <div className="hidden sm:flex flex-col items-center justify-center w-14 shrink-0 rounded-md bg-muted/40 py-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{format(parseISO(t.date), "MMM")}</span>
                      <span className="text-lg font-semibold tabular-nums">{format(parseISO(t.date), "d")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{t.retailer}</p>
                        <Badge variant="secondary" className="font-normal">{t.items.length} item{t.items.length !== 1 ? "s" : ""}</Badge>
                        {t.receipt_attached && <Badge variant="outline" className="font-normal gap-1"><FileText className="h-3 w-3" />{t.receipt_type}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">{format(parseISO(t.date), "MMM d, yyyy")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{fmt(t.total_amount)}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border px-4 md:px-5 py-4 space-y-4 bg-muted/15">
                    {t.receipt_attached && (
                      <div className="flex items-start gap-2 text-sm rounded-md bg-card/60 p-3 border border-border/60">
                        <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Receipt stored at</p>
                          <p>{t.receipt_location || <span className="text-muted-foreground italic">No location noted</span>}</p>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs uppercase tracking-wider text-muted-foreground text-left">
                            <th className="font-medium py-2 pr-3">Item</th>
                            <th className="font-medium py-2 pr-3">Category</th>
                            <th className="font-medium py-2 pr-3">Return by</th>
                            <th className="font-medium py-2 text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {t.items.map((i) => {
                            const days = i.return_window_expiry ? differenceInCalendarDays(parseISO(i.return_window_expiry), new Date()) : null;
                            return (
                              <tr key={i.id}>
                                <td className="py-2.5 pr-3">
                                  <p>{i.item_name}</p>
                                  {i.notes && <p className="text-xs text-muted-foreground">{i.notes}</p>}
                                </td>
                                <td className="py-2.5 pr-3"><Badge variant="secondary" className="font-normal">{i.category}</Badge></td>
                                <td className="py-2.5 pr-3 text-muted-foreground">
                                  {i.return_window_expiry ? (
                                    <span className={days !== null && days <= 7 ? (days < 0 ? "text-destructive" : "text-warning") : ""}>
                                      {format(parseISO(i.return_window_expiry), "MMM d, yyyy")}
                                      {days !== null && days >= 0 && days <= 30 && <span className="ml-1.5 text-xs">({days}d)</span>}
                                    </span>
                                  ) : "—"}
                                </td>
                                <td className="py-2.5 text-right tabular-nums">{fmt(i.price)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {t.notes && <p className="text-sm text-muted-foreground italic">"{t.notes}"</p>}

                    <div className="flex justify-end">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This removes {t.retailer} and all {t.items.length} line item{t.items.length !== 1 ? "s" : ""}. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => { remove(t.id); toast.success("Transaction deleted"); }}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
