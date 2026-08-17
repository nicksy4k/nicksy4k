import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTransactions, useCategories, useSavings } from "@/lib/store";
import type { Category, LineItem, PaymentSplit, ReceiptType, Transaction } from "@/lib/types";
import { RECEIPT_TYPES } from "@/lib/types";
import { fmt } from "@/lib/format";
import { sortLabels } from "@/lib/utils";
import { colorForKey } from "@/lib/colors";
import { PaymentSplitEditor, emptySplit, type SplitDraft } from "@/components/PaymentSplitEditor";
import { RouteError } from "@/components/RouteError";
import { Combobox } from "@/components/ui/combobox";
import { AddCategoryDialog, ADD_CATEGORY_SENTINEL } from "@/components/AddCategoryDialog";
import { useHiddenSuggestions, filterHidden } from "@/lib/hiddenSuggestions";
import {
  buildPriceHistory,
  buildCategoryHistory,
  suggestPrice as lookupPrice,
  suggestCategory as lookupCategory,
} from "@/lib/suggestions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DELIVERY_STATUSES, deliveryMeta, isAwaitingDelivery } from "@/lib/delivery";
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
  Check,
  ChevronDown,
  FileText,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  ScanLine,
} from "lucide-react";

import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ReceiptScanDialog, type ScanApplyPayload } from "@/components/ReceiptScanDialog";
import { useCanScanReceipts } from "@/lib/features";
import { ReceiptUpload, isStoragePath } from "@/components/ReceiptUpload";
import { supabase } from "@/integrations/supabase/client";
import {
  ProtectionFields,
  emptyProtection,
  type ProtectionValue,
} from "@/components/ProtectionFields";
import { RefundDialog } from "@/components/RefundDialog";
import { FieldError, invalidCls, focusByAriaLabel } from "@/components/FieldError";
import { EditTransactionDialog } from "@/components/history/EditTransactionDialog";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Transaction history — Ledgerly" },
      { name: "description", content: "Search, filter, and settle your past transactions." },
      { property: "og:title", content: "Transaction history — Ledgerly" },
      { property: "og:description", content: "Search, filter, and settle your past transactions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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

const PAGE_SIZE = 50;

function HistoryPage() {
  const { items, remove, update: updateTransaction } = useTransactions();
  const { list: categories } = useCategories();
  const [q, setQ] = useState("");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [refunding, setRefunding] = useState<Transaction | null>(null);
  const [showRestIds, setShowRestIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const hasFilters = q.trim() !== "" || selectedCats.size > 0 || fromDate !== "" || toDate !== "";
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

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [needle, selectedCats, fromDate, toDate]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

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
    <div className="p-0 md:p-4 max-w-6xl mx-auto">
      <header className="mb-5 md:mb-8 flex items-end justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
            All transactions
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold">History</h1>
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
              <Button variant="outline" className="sm:w-[220px] justify-between font-normal">
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
          <span className="font-semibold tabular-nums">Total: {fmt(categorySummary.total)}</span>
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
          {visible.map((t) => {
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
                    <div className="flex items-center gap-2.5 md:gap-4 p-3.5 md:p-5 hover:bg-muted/30 transition-colors">
                      <div className="hidden sm:flex flex-col items-center justify-center w-14 shrink-0 rounded-md bg-muted/40 py-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {format(parseISO(t.date), "MMM")}
                        </span>
                        <span className="text-lg font-semibold tabular-nums">
                          {format(parseISO(t.date), "d")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                          <p className="font-medium truncate">{t.retailer}</p>
                          {t.is_pending && (
                            <Badge className="font-normal bg-amber-500/15 text-amber-600 border border-amber-500/30 hover:bg-amber-500/15">
                              Pending
                            </Badge>
                          )}
                          {deliveryMeta(t.delivery_status) && (
                            <Badge
                              variant="outline"
                              className={`font-normal gap-1 ${deliveryMeta(t.delivery_status)!.className}`}
                            >
                              <span aria-hidden>{deliveryMeta(t.delivery_status)!.emoji}</span>
                              {deliveryMeta(t.delivery_status)!.label}
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
                        {isAwaitingDelivery(t) && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={async () => {
                              try {
                                await updateTransaction(t.id, { delivery_status: "delivered" });
                                toast.success("Marked as delivered");
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Failed to update");
                              }
                            }}
                          >
                            <Check className="h-4 w-4" /> Mark delivered
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
          {filtered.length > visible.length && (
            <div className="pt-4 flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground tabular-nums">
                Showing {visible.length} of {filtered.length}
              </p>
              <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                Load more
              </Button>
            </div>
          )}
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
