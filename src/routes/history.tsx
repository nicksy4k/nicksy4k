import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useTransactions, useCategories, useSavings } from "@/lib/store";
import type { Category, LineItem, PaymentSplit, ReceiptType, Transaction } from "@/lib/types";
import { RECEIPT_TYPES } from "@/lib/types";
import { fmt } from "@/lib/format";
import { sortLabels } from "@/lib/utils";
import { colorForKey } from "@/lib/colors";
import { PaymentSplitEditor, emptySplit, type SplitDraft } from "@/components/PaymentSplitEditor";
import { RouteError } from "@/components/RouteError";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  FileText,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ReceiptUpload, isStoragePath } from "@/components/ReceiptUpload";
import { supabase } from "@/integrations/supabase/client";
import {
  ProtectionFields,
  emptyProtection,
  type ProtectionValue,
} from "@/components/ProtectionFields";
import { RefundDialog } from "@/components/RefundDialog";


export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Transaction history — Ledgerly" }] }),
  component: HistoryPage,
  errorComponent: RouteError,
});

function HighlightText({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={key++} className="bg-primary/25 text-foreground rounded px-0.5">
        {text.slice(idx, idx + needle.length)}
      </mark>,
    );
    i = idx + needle.length;
  }
  return <>{parts}</>;
}

function HistoryPage() {
  const { items, remove } = useTransactions();
  const { list: categories } = useCategories();
  const [q, setQ] = useState("");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [refunding, setRefunding] = useState<Transaction | null>(null);
  const [showRestIds, setShowRestIds] = useState<Set<string>>(new Set());


  const hasFilters =
    q.trim() !== "" || selectedCats.size > 0 || fromDate !== "" || toDate !== "";
  const needle = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (fromDate && t.date < fromDate) return false;
      if (toDate && t.date > toDate) return false;
      const matchesCat =
        selectedCats.size === 0 || t.items.some((i) => selectedCats.has(i.category));
      if (!matchesCat) return false;
      if (!needle) return true;
      return (
        t.retailer.toLowerCase().includes(needle) ||
        t.receipt_location.toLowerCase().includes(needle) ||
        t.notes?.toLowerCase().includes(needle) ||
        t.items.some((i) => i.item_name.toLowerCase().includes(needle))
      );
    });
  }, [items, needle, selectedCats, fromDate, toDate]);

  const matchedSummary = useMemo(() => {
    if (!needle) return null;
    let total = 0;
    let itemCount = 0;
    let txCount = 0;
    for (const t of filtered) {
      const hits = t.items.filter((i) => i.item_name.toLowerCase().includes(needle));
      if (hits.length > 0) {
        total += hits.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
        itemCount += hits.length;
        txCount += 1;
      }
    }
    return { total, itemCount, txCount };
  }, [filtered, needle]);

  const categorySummary = useMemo(() => {
    if (selectedCats.size === 0) return null;
    let total = 0;
    let itemCount = 0;
    let txCount = 0;
    for (const t of filtered) {
      const hits = t.items.filter((i) => selectedCats.has(i.category));
      if (hits.length > 0) {
        total += hits.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
        itemCount += hits.length;
        txCount += 1;
      }
    }
    return { total, itemCount, txCount, catCount: selectedCats.size };
  }, [filtered, selectedCats]);

  function toggleCat(c: string) {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  function toggleRest(id: string) {
    setShowRestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setQ("");
    setSelectedCats(new Set());
    setFromDate("");
    setToDate("");
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <header className="mb-8 flex items-end justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
            All transactions
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold">History</h1>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {hasFilters ? `${filtered.length} of ${items.length}` : `${items.length} total`}
        </p>
      </header>

      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search retailer, item, notes, location…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="sm:w-[220px] justify-between font-normal"
              >
                <span className="truncate">
                  {selectedCats.size === 0
                    ? "All categories"
                    : selectedCats.size === 1
                      ? Array.from(selectedCats)[0]
                      : `${selectedCats.size} categories`}
                </span>
                <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-2" align="end">
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {categories.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No categories yet — add one in Settings.
                  </div>
                ) : (
                  sortLabels(categories).map((c: string) => {
                    const checked = selectedCats.has(c);
                    return (
                      <label
                        key={c}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-sm"
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleCat(c)} />
                        <span className="truncate">{c}</span>
                      </label>
                    );
                  })
                )}
              </div>
              {selectedCats.size > 0 && (
                <div className="pt-2 mt-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8"
                    onClick={() => setSelectedCats(new Set())}
                  >
                    Clear categories
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex items-center gap-2 flex-1">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground shrink-0">
              From
            </Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="flex-1"
            />
            <Label className="text-xs uppercase tracking-wider text-muted-foreground shrink-0">
              To
            </Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="flex-1"
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {matchedSummary && matchedSummary.itemCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {matchedSummary.itemCount} matching item{matchedSummary.itemCount !== 1 ? "s" : ""}{" "}
            across {matchedSummary.txCount} transaction{matchedSummary.txCount !== 1 ? "s" : ""}
          </span>
          <span className="font-semibold tabular-nums">Total: {fmt(matchedSummary.total)}</span>
        </div>
      )}

      {categorySummary && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {categorySummary.itemCount} item{categorySummary.itemCount !== 1 ? "s" : ""} across{" "}
            {categorySummary.txCount} transaction{categorySummary.txCount !== 1 ? "s" : ""} in{" "}
            {categorySummary.catCount} categor{categorySummary.catCount !== 1 ? "ies" : "y"}
          </span>
          <span className="font-semibold tabular-nums">
            Total: {fmt(categorySummary.total)}
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            {hasFilters
              ? "No transactions match your filters — try clearing them."
              : "No transactions yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const matchingItems = needle
              ? t.items.filter((i) => i.item_name.toLowerCase().includes(needle))
              : [];
            const hasItemMatch = matchingItems.length > 0;
            const restItems = hasItemMatch
              ? t.items.filter((i) => !i.item_name.toLowerCase().includes(needle))
              : [];
            const showRest = showRestIds.has(t.id);
            const matchedSubtotal = matchingItems.reduce(
              (s, i) => s + i.price * (i.quantity ?? 1),
              0,
            );
            const refundedTotal = (t.refunds ?? []).reduce((s, r) => s + r.amount, 0);
            const refundedItemIds = new Set<string>();
            (t.refunds ?? []).forEach((r) => r.item_ids.forEach((id) => refundedItemIds.add(id)));
            const refundStatus =
              refundedTotal <= 0
                ? null
                : refundedTotal + 0.001 >= t.total_amount
                  ? "full"
                  : "partial";
            return (

              <Collapsible key={t.id} asChild>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger className="w-full text-left group">
                    <div className="flex items-center gap-4 p-4 md:p-5 hover:bg-muted/30 transition-colors">
                      <div className="hidden sm:flex flex-col items-center justify-center w-14 shrink-0 rounded-md bg-muted/40 py-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {format(parseISO(t.date), "MMM")}
                        </span>
                        <span className="text-lg font-semibold tabular-nums">
                          {format(parseISO(t.date), "d")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{t.retailer}</p>
                          {t.is_pending && (
                            <Badge className="font-normal bg-amber-500/15 text-amber-600 border border-amber-500/30 hover:bg-amber-500/15">
                              Pending
                            </Badge>
                          )}
                          <Badge variant="secondary" className="font-normal">
                            {t.items.length} item{t.items.length !== 1 ? "s" : ""}
                          </Badge>
                          {t.receipt_attached && (
                            <Badge variant="outline" className="font-normal gap-1">
                              <FileText className="h-3 w-3" />
                              {t.receipt_type}
                            </Badge>
                          )}
                          {refundStatus === "full" && (
                            <Badge className="font-normal bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 hover:bg-emerald-500/15">
                              Refunded {fmt(refundedTotal)}
                            </Badge>
                          )}
                          {refundStatus === "partial" && (
                            <Badge className="font-normal bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 hover:bg-emerald-500/10">
                              Partial refund {fmt(refundedTotal)}
                            </Badge>
                          )}

                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">
                          {format(parseISO(t.date), "MMM d, yyyy")}
                        </p>
                        {!t.is_pending && t.payment_splits && t.payment_splits.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-x-2 flex-wrap">
                            <span className="uppercase tracking-wider text-[10px]">Paid with</span>
                            {t.payment_splits.map((sp, i) => {
                              const isPocket = sp.source.startsWith("pocket:");
                              const pocketName = isPocket ? sp.source.slice(7) : null;
                              const label =
                                sp.label ??
                                (sp.source === "main"
                                  ? "Main"
                                  : sp.source === "other"
                                    ? "Other"
                                    : isPocket
                                      ? pocketName!
                                      : sp.source.startsWith("bnpl:")
                                        ? "BNPL"
                                        : sp.source);
                              return (
                                <span key={i} className="inline-flex items-center gap-1">
                                  {pocketName && (
                                    <span
                                      className="h-2 w-2 rounded-sm"
                                      style={{ backgroundColor: colorForKey(pocketName) }}
                                    />
                                  )}
                                  <span>{label}</span>
                                  <span className="tabular-nums font-medium text-foreground">
                                    {fmt(sp.amount)}
                                  </span>
                                </span>
                              );
                            })}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-semibold tabular-nums ${t.is_pending ? "text-amber-600" : ""}`}
                        >
                          {t.is_pending ? "~" : ""}
                          {fmt(t.total_amount)}
                        </p>
                      </div>
                      {t.is_pending ? (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Settle transaction"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setEditing(t);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              e.preventDefault();
                              setEditing(t);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 h-8 rounded-md bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 text-xs font-medium transition-colors"
                        >
                          Settle
                        </span>
                      ) : (
                        <>
                          {refundStatus !== "full" && (
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label="Refund transaction"
                              title="Refund"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setRefunding(t);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setRefunding(t);
                                }
                              }}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-emerald-600 hover:bg-muted/50 transition-colors"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </span>
                          )}
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label="Edit transaction"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setEditing(t);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                e.preventDefault();
                                setEditing(t);
                              }
                            }}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </span>
                        </>
                      )}

                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  {hasItemMatch && (
                    <div className="border-t border-border px-4 md:px-5 py-3 bg-primary/[0.03]">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                        Matched {matchingItems.length} of {t.items.length} item
                        {t.items.length !== 1 ? "s" : ""} ·{" "}
                        <span className="tabular-nums text-foreground font-medium">
                          {fmt(matchedSubtotal)}
                        </span>
                      </p>
                      <ul className="space-y-1.5">
                        {matchingItems.map((i) => {
                          const qty = i.quantity ?? 1;
                          return (
                            <li key={i.id} className="flex items-center gap-2 text-sm">
                              <Badge variant="secondary" className="font-normal shrink-0">
                                {i.category}
                              </Badge>
                              <span className="flex-1 min-w-0 truncate">
                                <HighlightText text={i.item_name} needle={needle} />
                                {qty > 1 && <span className="text-muted-foreground"> × {qty}</span>}
                              </span>
                              <span className="tabular-nums text-muted-foreground text-xs shrink-0">
                                {fmt(i.price)}
                              </span>
                              <span className="tabular-nums font-medium shrink-0 w-20 text-right">
                                {fmt(i.price * qty)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {restItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleRest(t.id)}
                          className="mt-2 text-xs text-primary hover:underline"
                        >
                          {showRest
                            ? "Hide rest"
                            : `View rest of transaction (${restItems.length} item${restItems.length !== 1 ? "s" : ""})`}
                        </button>
                      )}
                      {showRest && restItems.length > 0 && (
                        <ul className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
                          {restItems.map((i) => {
                            const qty = i.quantity ?? 1;
                            return (
                              <li
                                key={i.id}
                                className="flex items-center gap-2 text-sm text-muted-foreground"
                              >
                                <Badge variant="outline" className="font-normal shrink-0">
                                  {i.category}
                                </Badge>
                                <span className="flex-1 min-w-0 truncate">
                                  {i.item_name}
                                  {qty > 1 && <span> × {qty}</span>}
                                </span>
                                <span className="tabular-nums text-xs shrink-0">
                                  {fmt(i.price)}
                                </span>
                                <span className="tabular-nums shrink-0 w-20 text-right">
                                  {fmt(i.price * qty)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}

                  <CollapsibleContent>
                    <div className="border-t border-border px-4 md:px-5 py-4 space-y-4 bg-muted/15">
                      {t.payment_splits && t.payment_splits.length > 0 && (
                        <div className="text-sm rounded-md bg-card/60 p-3 border border-border/60">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                            Paid with
                          </p>
                          <p className="text-sm">
                            {t.payment_splits.map((sp, i) => {
                              const label =
                                sp.label ??
                                (sp.source === "main"
                                  ? "Main balance"
                                  : sp.source === "other"
                                    ? "Other"
                                    : sp.source.startsWith("pocket:")
                                      ? `Pocket · ${sp.source.slice(7)}`
                                      : sp.source.startsWith("bnpl:")
                                        ? "BNPL"
                                        : sp.source);
                              return (
                                <span key={i}>
                                  {i > 0 && <span className="text-muted-foreground"> · </span>}
                                  {label}{" "}
                                  <span className="tabular-nums font-medium">{fmt(sp.amount)}</span>
                                </span>
                              );
                            })}
                          </p>
                        </div>
                      )}
                      {t.receipt_attached && (
                        <div className="flex items-start gap-2 text-sm rounded-md bg-card/60 p-3 border border-border/60">
                          <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">
                              Receipt
                            </p>
                            {isStoragePath(t.receipt_location) ? (
                              <button
                                type="button"
                                className="text-primary hover:underline truncate inline-flex items-center gap-1"
                                onClick={async () => {
                                  const { data, error } = await supabase.storage
                                    .from("receipts")
                                    .createSignedUrl(t.receipt_location, 3600);
                                  if (error || !data) {
                                    toast.error("Could not open receipt");
                                    return;
                                  }
                                  window.open(data.signedUrl, "_blank", "noopener");
                                }}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                {t.receipt_location.split("/").pop()}
                              </button>
                            ) : (
                              <p>
                                {t.receipt_location || (
                                  <span className="text-muted-foreground italic">
                                    No location noted
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {t.protection_type && t.expiration_date && (
                        <div className="flex items-start gap-2 text-sm rounded-md bg-card/60 p-3 border border-border/60">
                          <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">
                              {t.protection_type}
                            </p>
                            <p>
                              Expires {format(parseISO(t.expiration_date), "MMM d, yyyy")}
                              {t.protection_duration && t.protection_duration !== "Custom Date" && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {t.protection_duration}
                                </span>
                              )}
                              {t.dismissed_at && (
                                <span className="ml-2 text-xs text-muted-foreground italic">
                                  (handled)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs uppercase tracking-wider text-muted-foreground text-left">
                              <th className="font-medium py-2 pr-3">Item</th>
                              <th className="font-medium py-2 pr-3">Category</th>
                              <th className="font-medium py-2 pr-3 text-right">Qty</th>
                              <th className="font-medium py-2 pr-3 text-right">Unit</th>
                              <th className="font-medium py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {t.items.map((i) => {
                              const qty = i.quantity ?? 1;
                              const isRefunded = refundedItemIds.has(i.id);
                              return (
                                <tr key={i.id} className={isRefunded ? "opacity-60" : ""}>
                                  <td className="py-2.5 pr-3">
                                    <p className={isRefunded ? "line-through" : ""}>
                                      {i.item_name}
                                    </p>
                                    {isRefunded && (
                                      <Badge
                                        variant="outline"
                                        className="font-normal mt-1 text-emerald-700 border-emerald-500/40"
                                      >
                                        Refunded
                                      </Badge>
                                    )}
                                    {i.notes && (
                                      <p className="text-xs text-muted-foreground">{i.notes}</p>
                                    )}
                                  </td>
                                  <td className="py-2.5 pr-3">
                                    <Badge variant="secondary" className="font-normal">
                                      {i.category}
                                    </Badge>
                                  </td>
                                  <td className="py-2.5 pr-3 text-right tabular-nums">{qty}</td>
                                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                                    {fmt(i.price)}
                                  </td>
                                  <td className="py-2.5 text-right tabular-nums">
                                    {fmt(i.price * qty)}
                                  </td>
                                </tr>
                              );
                            })}

                          </tbody>
                        </table>
                      </div>

                      {t.notes && (
                        <p className="text-sm text-muted-foreground italic">"{t.notes}"</p>
                      )}

                      {(t.refunds ?? []).length > 0 && (
                        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.04] p-3">
                          <p className="text-xs uppercase tracking-wider text-emerald-700 mb-2">
                            Refund history
                          </p>
                          <ul className="space-y-1.5 text-sm">
                            {(t.refunds ?? []).map((r) => {
                              const destLabel = r.destination.startsWith("pocket:")
                                ? `Pocket · ${r.destination.slice(7)}`
                                : "Main balance";
                              return (
                                <li key={r.id} className="flex items-center gap-2 flex-wrap">
                                  <span className="tabular-nums font-medium">{fmt(r.amount)}</span>
                                  <span className="text-muted-foreground">→ {destLabel}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {format(parseISO(r.refunded_at.slice(0, 10)), "MMM d, yyyy")}
                                  </span>
                                  {r.reason && (
                                    <span className="text-xs italic text-muted-foreground">
                                      "{r.reason}"
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        {!t.is_pending && refundStatus !== "full" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRefunding(t)}
                            className="text-emerald-700 hover:text-emerald-700"
                          >
                            <RotateCcw className="h-4 w-4" /> Refund
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes {t.retailer} and all {t.items.length} line item
                                {t.items.length !== 1 ? "s" : ""}. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  remove(t.id);
                                  toast.success("Transaction deleted");
                                }}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      <EditTransactionDialog
        transaction={editing}
        categories={categories}
        onClose={() => setEditing(null)}
      />
      <RefundDialog transaction={refunding} onClose={() => setRefunding(null)} />

    </div>
  );
}

interface DraftRow {
  id: string;
  item_name: string;
  price: string;
  quantity: string;
  category: Category;
  notes: string;
}

function toDraft(i: LineItem): DraftRow {
  return {
    id: i.id,
    item_name: i.item_name,
    price: String(i.price ?? ""),
    quantity: String(i.quantity ?? 1),
    category: i.category,
    notes: i.notes ?? "",
  };
}

function EditTransactionDialog({
  transaction,
  categories,
  onClose,
}: {
  transaction: Transaction | null;
  categories: string[];
  onClose: () => void;
}) {
  const { update } = useTransactions();
  const { add: addSaving } = useSavings();
  const open = transaction !== null;

  const [date, setDate] = useState("");
  const [retailer, setRetailer] = useState("");
  const [receiptAttached, setReceiptAttached] = useState(true);
  const [receiptType, setReceiptType] = useState<ReceiptType>("Digital");
  const [receiptLocation, setReceiptLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [protection, setProtection] = useState<ProtectionValue>(emptyProtection());
  const [isPending, setIsPending] = useState(false);
  const [pendingHoldAmount, setPendingHoldAmount] = useState<number | null>(null);
  const [splits, setSplits] = useState<SplitDraft[]>([emptySplit("main")]);
  const [initialized, setInitialized] = useState<string | null>(null);

  if (transaction && initialized !== transaction.id) {
    setInitialized(transaction.id);
    setDate(transaction.date);
    setRetailer(transaction.retailer);
    setReceiptAttached(transaction.receipt_attached);
    setReceiptType(transaction.receipt_type === "None" ? "Digital" : transaction.receipt_type);
    setReceiptLocation(transaction.receipt_location ?? "");
    setNotes(transaction.notes ?? "");
    // When settling a pending hold, start with one fresh empty row so the
    // synthetic "Pending estimate" placeholder doesn't pollute itemization.
    if (transaction.is_pending) {
      setRows([
        {
          id: crypto.randomUUID(),
          item_name: "",
          price: "",
          quantity: "1",
          category: categories[0] ?? "Other",
          notes: "",
        },
      ]);
    } else {
      setRows(transaction.items.map(toDraft));
    }
    setIsPending(transaction.is_pending ?? false);
    setPendingHoldAmount(transaction.is_pending ? transaction.total_amount : null);
    // Restore existing splits if any, else start with a single "main" split
    // sized to the current total (or empty for pending holds — user fills in
    // on settle).
    const existing = transaction.payment_splits ?? [];
    if (existing.length > 0) {
      setSplits(
        existing.map((s) => ({
          id: crypto.randomUUID(),
          source: s.source,
          amount: String(s.amount),
        })),
      );
    } else {
      setSplits([
        {
          ...emptySplit("main"),
          amount: transaction.is_pending ? "" : String(transaction.total_amount),
        },
      ]);
    }
    setProtection(
      transaction.protection_type && transaction.expiration_date
        ? {
            enabled: true,
            type: transaction.protection_type as ProtectionValue["type"],
            duration:
              (transaction.protection_duration as ProtectionValue["duration"]) ?? "Custom Date",
            expiration: transaction.expiration_date,
          }
        : emptyProtection(),
    );
  }
  if (!transaction && initialized !== null) {
    setInitialized(null);
  }

  const total = rows.reduce(
    (s, r) => s + (parseFloat(r.price) || 0) * (parseFloat(r.quantity) || 0),
    0,
  );

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setRows((arr) => arr.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setRows((arr) => (arr.length === 1 ? arr : arr.filter((r) => r.id !== id)));
  }
  function addRow() {
    setRows((arr) => [
      ...arr,
      {
        id: crypto.randomUUID(),
        item_name: "",
        price: "",
        quantity: "1",
        category: categories[0] ?? "Other",
        notes: "",
      },
    ]);
  }

  async function save() {
    if (!transaction) return;
    if (!retailer.trim()) {
      toast.error("Retailer is required");
      return;
    }
    const cleanItems: LineItem[] = rows
      .filter((r) => r.item_name.trim() && !isNaN(parseFloat(r.price)))
      .map((r) => ({
        id: r.id,
        item_name: r.item_name.trim(),
        price: parseFloat(r.price),
        quantity: Math.max(1, parseInt(r.quantity, 10) || 1),
        category: r.category,
        notes: r.notes.trim() || undefined,
      }));

    // When settling (was pending, now unchecked), require real items.
    if (!isPending && cleanItems.length === 0) {
      toast.error("Add at least one line item with a price.");
      return;
    }

    // Still-pending: require an estimated total via the first row price.
    let finalItems: LineItem[];
    let finalTotal: number;
    if (isPending) {
      const estimate = parseFloat(rows[0]?.price ?? "");
      if (!(estimate > 0)) {
        toast.error("Enter an estimated total greater than zero.");
        return;
      }
      finalItems = [
        {
          id: rows[0]?.id ?? crypto.randomUUID(),
          item_name: "Pending estimate",
          price: +estimate.toFixed(2),
          quantity: 1,
          category: rows[0]?.category ?? "Other",
        },
      ];
      finalTotal = +estimate.toFixed(2);
    } else {
      finalItems = cleanItems;
      finalTotal = cleanItems.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
    }

    if (protection.enabled) {
      if (!protection.expiration) {
        toast.error("Pick an expiration date for the protection.");
        return;
      }
      if (protection.expiration < date) {
        toast.error("Protection expiration must be on or after the transaction date.");
        return;
      }
    }

    // Validate + apply payment splits when this is a real (non-pending)
    // transaction. Splits are ignored while a hold is still pending.
    const wasPending = transaction.is_pending ?? false;
    const isSettling = wasPending && !isPending;
    const activeSplits = !isPending
      ? splits
          .map((s) => ({ source: s.source, amount: parseFloat(s.amount) || 0 }))
          .filter((s) => s.amount > 0)
      : [];
    const priorSplits = transaction.payment_splits ?? [];

    if (!isPending && activeSplits.length > 0) {
      const sum = +activeSplits.reduce((a, b) => a + b.amount, 0).toFixed(2);
      if (Math.abs(sum - finalTotal) > 0.01) {
        toast.error(`Splits (${fmt(sum)}) don't match the total ${fmt(finalTotal)}.`);
        return;
      }
    }

    try {
      // On settle: apply pocket withdrawals for any new pocket splits so
      // the pocket balance moves in step with the settled amount. Prior
      // splits (already saved on a non-pending edit) are left alone —
      // withdrawals from earlier saves are not double-applied.
      if (isSettling) {
        for (const s of activeSplits) {
          if (s.source.startsWith("pocket:")) {
            const account = s.source.slice(7);
            await addSaving({
              date,
              kind: "withdrawal",
              amount: s.amount,
              account,
              notes: `Settled: ${retailer.trim() || "Transaction"}`,
            });
          }
        }
      }

      const finalPaymentSplits: PaymentSplit[] = isPending
        ? priorSplits
        : activeSplits.length > 0
          ? activeSplits.map((s) => ({
              source: s.source,
              amount: +s.amount.toFixed(2),
              label:
                s.source === "main"
                  ? "Main balance"
                  : s.source.startsWith("pocket:")
                    ? `Pocket · ${s.source.slice(7)}`
                    : s.source === "other"
                      ? "Other"
                      : undefined,
            }))
          : [];

      await update(transaction.id, {
        date,
        retailer: retailer.trim(),
        total_amount: finalTotal,
        receipt_attached: receiptAttached,
        receipt_type: receiptAttached ? receiptType : "None",
        receipt_location: receiptAttached ? receiptLocation.trim() : "",
        notes: notes.trim() || undefined,
        items: finalItems,
        protection_type: protection.enabled ? protection.type : null,
        protection_duration: protection.enabled ? protection.duration : null,
        expiration_date: protection.enabled ? protection.expiration : null,
        // Re-enabling protection on a previously-handled transaction clears the dismissal.
        dismissed_at: protection.enabled ? null : (transaction.dismissed_at ?? null),
        is_pending: isPending,
        payment_splits: finalPaymentSplits,
      });
      toast.success(isPending ? "Pending hold updated" : "Transaction settled");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transaction?.is_pending ? "Settle pending hold" : "Edit transaction"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {transaction?.is_pending && isPending && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              This transaction is a pending hold. When your receipt arrives, turn off{" "}
              <span className="font-medium">Still pending</span> below and enter the final itemized
              amount.
            </div>
          )}

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm">Still pending</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Turn off to settle: add real line items and the final amount.
              </p>
            </div>
            <Switch checked={isPending} onCheckedChange={setIsPending} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Retailer / shop">
              <Input value={retailer} onChange={(e) => setRetailer(e.target.value)} />
            </Field>
          </div>

          {isPending ? (
            <>
              <Field label="Estimated total (£)">
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={rows[0]?.price ?? ""}
                  onChange={(e) => updateRow(rows[0]?.id ?? "", { price: e.target.value })}
                />
              </Field>
              <Field label="Notes (optional)">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Receipt attached</Label>
                  <Switch checked={receiptAttached} onCheckedChange={setReceiptAttached} />
                </div>
                {receiptAttached && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Type">
                      <Select
                        value={receiptType}
                        onValueChange={(v) => setReceiptType(v as ReceiptType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RECEIPT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={receiptType === "Physical" ? "Stored at" : "Receipt file"}>
                      {receiptType === "Physical" ? (
                        <Input
                          value={receiptLocation}
                          onChange={(e) => setReceiptLocation(e.target.value)}
                        />
                      ) : (
                        <ReceiptUpload value={receiptLocation} onChange={setReceiptLocation} />
                      )}
                    </Field>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Line items</p>
                {rows.map((r, idx) => (
                  <div key={r.id} className="rounded-lg border border-border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Item {idx + 1}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(r.id)}
                        disabled={rows.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid sm:grid-cols-[1fr_100px_80px] gap-3">
                      <Field label="Name">
                        <Input
                          autoFocus={idx === 0 && transaction?.is_pending === true}
                          value={r.item_name}
                          onChange={(e) => updateRow(r.id, { item_name: e.target.value })}
                        />
                      </Field>
                      <Field label="Price (£)">
                        <Input
                          inputMode="decimal"
                          value={r.price}
                          onChange={(e) => updateRow(r.id, { price: e.target.value })}
                        />
                      </Field>
                      <Field label="Qty">
                        <Input
                          inputMode="numeric"
                          value={r.quantity}
                          onChange={(e) =>
                            updateRow(r.id, { quantity: e.target.value.replace(/[^0-9]/g, "") })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Category">
                      <Select
                        value={r.category}
                        onValueChange={(v) => updateRow(r.id, { category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...categories]
                            .sort((a, b) => a.localeCompare(b))
                            .map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Notes">
                      <Input
                        value={r.notes}
                        onChange={(e) => updateRow(r.id, { notes: e.target.value })}
                      />
                    </Field>
                    <p className="text-xs text-muted-foreground text-right">
                      Line total:{" "}
                      <span className="tabular-nums font-medium text-foreground">
                        {fmt((parseFloat(r.price) || 0) * (parseFloat(r.quantity) || 0))}
                      </span>
                    </p>
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={addRow}>
                  <Plus className="h-4 w-4" /> Add item
                </Button>
              </div>

              <ProtectionFields
                transactionDate={date}
                value={protection}
                onChange={setProtection}
              />

              <Field label="Notes (optional)">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Payment split
                </p>
                <PaymentSplitEditor
                  total={total}
                  retailer={retailer}
                  transactionDate={date}
                  splits={splits}
                  onChange={setSplits}
                  allowBnpl={false}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    New total
                  </p>
                  {transaction?.is_pending && pendingHoldAmount !== null && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Estimated hold was {fmt(pendingHoldAmount)}. Enter the final receipt amount.
                    </p>
                  )}
                </div>
                <p className="text-xl font-semibold tabular-nums">{fmt(total)}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>
            {transaction?.is_pending && !isPending ? "Settle transaction" : "Save changes"}
          </Button>
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
