import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
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
import { ShortcutsHelp } from "@/components/KeyboardShortcutsDialog";

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
  const { update, items: pastTransactions } = useTransactions();
  const { add: addSaving } = useSavings();
  const { hidden } = useHiddenSuggestions();
  const canScan = useCanScanReceipts();
  const [scanOpen, setScanOpen] = useState(false);
  const open = transaction !== null;

  const itemNameSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const t of pastTransactions) {
      if (t.is_pending) continue;
      for (const it of t.items ?? []) {
        if (it.item_name?.trim()) set.add(it.item_name.trim());
      }
    }
    return filterHidden(sortLabels(set), hidden.items);
  }, [pastTransactions, hidden.items]);
  const priceHistory = useMemo(() => buildPriceHistory(pastTransactions), [pastTransactions]);
  const categoryHistory = useMemo(() => buildCategoryHistory(pastTransactions), [pastTransactions]);

  const frequentItems = useMemo(() => {
    const map = new Map<
      string,
      { display: string; count: number; lastDate: string; retailers: Set<string> }
    >();
    for (const t of pastTransactions) {
      if (t.is_pending) continue;
      for (const it of t.items ?? []) {
        const name = (it.item_name ?? "").trim();
        if (!name) continue;
        const key = name.toLowerCase();
        const r = (t.retailer ?? "").trim().toLowerCase();
        const entry = map.get(key);
        if (entry) {
          entry.count += 1;
          if (t.date > entry.lastDate) {
            entry.lastDate = t.date;
            entry.display = name;
          }
          if (r) entry.retailers.add(r);
        } else {
          map.set(key, {
            display: name,
            count: 1,
            lastDate: t.date,
            retailers: new Set(r ? [r] : []),
          });
        }
      }
    }
    const hiddenSet = new Set(hidden.items.map((h) => h.toLowerCase()));
    return Array.from(map.entries())
      .filter(([key]) => !hiddenSet.has(key))
      .map(([key, v]) => ({ key, ...v }));
  }, [pastTransactions, hidden.items]);

  const [addCategoryForRowId, setAddCategoryForRowId] = useState<string | null>(null);
  const [quickSelected, setQuickSelected] = useState<Set<string>>(new Set());
  const [quickShowMore, setQuickShowMore] = useState(false);

  const [date, setDate] = useState("");
  const [retailer, setRetailer] = useState("");
  const [receiptAttached, setReceiptAttached] = useState(true);
  const [receiptType, setReceiptType] = useState<ReceiptType>("Digital");
  const [receiptLocation, setReceiptLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [protection, setProtection] = useState<ProtectionValue>(emptyProtection());
  const [isPending, setIsPending] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [courier, setCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [pendingHoldAmount, setPendingHoldAmount] = useState<number | null>(null);
  const [splits, setSplits] = useState<SplitDraft[]>([emptySplit("main")]);
  const [initialized, setInitialized] = useState<string | null>(null);
  const [lastAddedRowId, setLastAddedRowId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const rowPriceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function clearError(key: string) {
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  const retailerOptionsForScan = useMemo(() => {
    const set = new Set<string>();
    for (const t of pastTransactions) {
      if (t.retailer?.trim()) set.add(t.retailer.trim());
    }
    return Array.from(set);
  }, [pastTransactions]);

  function applyScan(payload: ScanApplyPayload) {
    if (payload.retailer) {
      setRetailer(payload.retailer);
      clearError("retailer");
    }
    if (payload.date) setDate(payload.date);
    if (payload.storagePath) {
      setReceiptAttached(true);
      setReceiptType("Digital");
      setReceiptLocation(payload.storagePath);
    }
    if (payload.items.length > 0) {
      const scanned: DraftRow[] = payload.items.map((i) => ({
        id: crypto.randomUUID(),
        item_name: i.name,
        price: String(i.price),
        quantity: String(i.quantity),
        category: i.category && categories.includes(i.category) ? i.category : "",
        notes: "",
      }));
      setRows((cur) => {
        const kept = cur.filter((r) => r.item_name.trim() || r.price.trim());
        return [...kept, ...scanned];
      });
      setIsPending(false);
    }
    toast.success("Receipt applied — review the lines and save.");
  }

  if (transaction && initialized !== transaction.id) {
    setInitialized(transaction.id);
    setLastAddedRowId(null);
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
          category: "",
          notes: "",
        },
      ]);
    } else {
      setRows(transaction.items.map(toDraft));
    }
    setIsPending(transaction.is_pending ?? false);
    setDeliveryStatus(transaction.delivery_status ?? "");
    setCourier(transaction.courier ?? "");
    setTrackingNumber(transaction.tracking_number ?? "");
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
    setQuickSelected(new Set());
    setQuickShowMore(false);
  }

  if (!transaction && initialized !== null) {
    setInitialized(null);
  }

  const total = rows.reduce(
    (s, r) => s + (parseFloat(r.price) || 0) * (parseFloat(r.quantity) || 0),
    0,
  );

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setRows((arr) =>
      arr.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (patch.item_name !== undefined && !next.price.trim()) {
          const guess = lookupPrice(priceHistory, next.item_name, retailer);
          if (guess != null) next.price = String(guess);
        }
        if (patch.item_name !== undefined && !next.category.trim()) {
          const cat = lookupCategory(categoryHistory, next.item_name);
          if (cat) next.category = cat;
        }
        return next;
      }),
    );
  }
  function removeRow(id: string) {
    if (rows.length === 1) return;
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const removed = rows[idx];
    setRows((arr) => arr.filter((r) => r.id !== id));
    // Lossless undo — the row is re-inserted at its original position.
    toast(removed.item_name.trim() ? `Removed "${removed.item_name.trim()}"` : "Item removed", {
      action: {
        label: "Undo",
        onClick: () =>
          setRows((cur) => {
            if (cur.some((r) => r.id === removed.id)) return cur;
            const next = [...cur];
            next.splice(Math.min(idx, next.length), 0, removed);
            return next;
          }),
      },
    });
  }

  function addRow() {
    const id = crypto.randomUUID();
    setRows((arr) => [
      ...arr,
      {
        id,
        item_name: "",
        price: "",
        quantity: "1",
        category: "",
        notes: "",
      },
    ]);
    setLastAddedRowId(id);
  }

  function focusRowPrice(id: string) {
    rowPriceRefs.current[id]?.focus();
    rowPriceRefs.current[id]?.select();
  }

  const retailerKey = retailer.trim().toLowerCase();
  const rankedQuick = useMemo(() => {
    return [...frequentItems].sort((a, b) => {
      const am = retailerKey && a.retailers.has(retailerKey) ? 1 : 0;
      const bm = retailerKey && b.retailers.has(retailerKey) ? 1 : 0;
      if (am !== bm) return bm - am;
      if (b.count !== a.count) return b.count - a.count;
      return a.lastDate < b.lastDate ? 1 : -1;
    });
  }, [frequentItems, retailerKey]);
  const retailerMatchCount = useMemo(
    () => (retailerKey ? rankedQuick.filter((f) => f.retailers.has(retailerKey)).length : 0),
    [rankedQuick, retailerKey],
  );
  const visibleQuick = quickShowMore ? rankedQuick.slice(0, 30) : rankedQuick.slice(0, 12);

  function toggleQuick(key: string) {
    setQuickSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function addSelectedQuickItems() {
    if (quickSelected.size === 0) return;
    const picks = rankedQuick.filter((f) => quickSelected.has(f.key));
    const newRows: DraftRow[] = picks.map((f) => {
      const guess = lookupPrice(priceHistory, f.display, retailer);
      const cat = lookupCategory(categoryHistory, f.display);
      return {
        id: crypto.randomUUID(),
        item_name: f.display,
        price: guess != null ? guess.toFixed(2) : "",
        quantity: "1",
        category: cat ?? "",
        notes: "",
      };
    });
    setRows((arr) => {
      const onlyBlank = arr.length === 1 && !arr[0].item_name.trim() && !arr[0].price.trim();
      return onlyBlank ? newRows : [...arr, ...newRows];
    });
    toast.success(`Added ${newRows.length} item${newRows.length === 1 ? "" : "s"}`);
    setQuickSelected(new Set());
  }

  async function save() {
    if (!transaction) return;

    // Collect every problem first so the user sees all of them at once,
    // inline against the offending field.
    const errs: Record<string, string> = {};
    if (!retailer.trim()) errs.retailer = "Enter the retailer or shop name.";

    if (isPending) {
      const est = parseFloat(rows[0]?.price ?? "");
      if (!(est > 0)) errs.estimate = "Enter an estimated total greater than zero.";
    } else {
      let usable = 0;
      for (const r of rows) {
        const hasName = !!r.item_name.trim();
        const hasPrice = !isNaN(parseFloat(r.price));
        if (hasName && hasPrice) usable++;
        else if (hasName && !hasPrice) errs[`row-${r.id}-price`] = "Enter a price.";
        else if (!hasName && hasPrice) errs[`row-${r.id}-name`] = "Name this item.";
      }
      if (usable === 0 && rows[0]) {
        errs[`row-${rows[0].id}-name`] ||= "Name this item.";
        errs[`row-${rows[0].id}-price`] ||= "Enter a price.";
      }
    }

    if (protection.enabled) {
      if (!protection.expiration) errs.protection = "Pick an expiration date for the protection.";
      else if (protection.expiration < date)
        errs.protection = "Protection expiration must be on or after the transaction date.";
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const count = Object.keys(errs).length;
      toast.error(`Fix ${count} field${count === 1 ? "" : "s"} before saving.`);
      if (errs.retailer) focusByAriaLabel("Retailer");
      else if (errs.estimate) focusByAriaLabel("Estimated total");
      else {
        const firstRow = rows.findIndex(
          (r) => errs[`row-${r.id}-name`] || errs[`row-${r.id}-price`],
        );
        if (firstRow >= 0) {
          const r = rows[firstRow];
          focusByAriaLabel(
            errs[`row-${r.id}-name`] ? `Item ${firstRow + 1} name` : `Item ${firstRow + 1} price`,
          );
        }
      }
      return;
    }
    setErrors({});

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

    // Still-pending: the estimated total comes from the first row price.
    let finalItems: LineItem[];
    let finalTotal: number;
    if (isPending) {
      const estimate = parseFloat(rows[0]?.price ?? "");

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
        delivery_status: (deliveryStatus || null) as Transaction["delivery_status"],
        courier: deliveryStatus ? courier.trim() || null : null,
        tracking_number: deliveryStatus ? trackingNumber.trim() || null : null,
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
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void save();
          }
        }}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle>
              {transaction?.is_pending ? "Settle pending hold" : "Edit transaction"}
            </DialogTitle>
            <ShortcutsHelp className="-mt-1 mr-6 shrink-0" />
          </div>
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

          {canScan && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div>
                <Label className="text-sm">Scan a receipt</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload the receipt and let AI fill in the line items for you.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setScanOpen(true)}>
                <ScanLine className="h-4 w-4" /> Scan
              </Button>
            </div>
          )}
          {canScan && (
            <ReceiptScanDialog
              open={scanOpen}
              onOpenChange={setScanOpen}
              knownRetailers={retailerOptionsForScan}
              categories={categories}
              onApply={applyScan}
            />
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Retailer / shop">
              <Input
                value={retailer}
                aria-label="Retailer"
                aria-invalid={!!errors.retailer || undefined}
                className={errors.retailer ? invalidCls : undefined}
                onChange={(e) => {
                  setRetailer(e.target.value);
                  clearError("retailer");
                }}
              />
              <FieldError message={errors.retailer} />
            </Field>
          </div>

          {isPending ? (
            <>
              <Field label="Estimated total (£)">
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label="Estimated total"
                  aria-invalid={!!errors.estimate || undefined}
                  className={errors.estimate ? invalidCls : undefined}
                  value={rows[0]?.price ?? ""}
                  onChange={(e) => {
                    updateRow(rows[0]?.id ?? "", { price: e.target.value });
                    clearError("estimate");
                  }}
                />
                <FieldError message={errors.estimate} />
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

              {rankedQuick.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Quick add
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Tap items to add.{retailerMatchCount > 0 ? " Retailer's picks first." : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {visibleQuick.map((f, i) => {
                      const selected = quickSelected.has(f.key);
                      const isRetailerMatch = retailerKey && f.retailers.has(retailerKey);
                      const showDivider =
                        retailerMatchCount > 0 &&
                        i === retailerMatchCount &&
                        i < visibleQuick.length;
                      return (
                        <span key={f.key} className="contents">
                          {showDivider && (
                            <span
                              aria-hidden
                              className="w-full text-[10px] uppercase tracking-wider text-muted-foreground"
                            >
                              Other frequents
                            </span>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant={selected ? "default" : "outline"}
                            className="h-7 px-2.5 text-xs"
                            onClick={() => toggleQuick(f.key)}
                            title={
                              isRetailerMatch
                                ? `${f.count}× • last ${f.lastDate} • ${retailer}`
                                : `${f.count}× • last ${f.lastDate}`
                            }
                          >
                            {f.display}
                          </Button>
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={addSelectedQuickItems}
                        disabled={quickSelected.size === 0}
                      >
                        Add {quickSelected.size || ""} item{quickSelected.size === 1 ? "" : "s"}
                      </Button>
                      {quickSelected.size > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setQuickSelected(new Set())}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    {rankedQuick.length > 12 && (
                      <Button size="sm" variant="ghost" onClick={() => setQuickShowMore((v) => !v)}>
                        {quickShowMore ? "Show less" : `Show more (${rankedQuick.length - 12})`}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Line items</p>

                {rows.map((r, idx) => (
                  <div key={r.id} className="rounded-lg border border-border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Item {idx + 1}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove item ${idx + 1}`}
                        title="Remove item"
                        onClick={() => removeRow(r.id)}
                        disabled={rows.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid sm:grid-cols-[1fr_100px_80px] gap-3">
                      <Field label="Name">
                        <Combobox
                          autoFocus={
                            r.id === lastAddedRowId ||
                            (lastAddedRowId === null &&
                              idx === 0 &&
                              transaction?.is_pending === true)
                          }
                          value={r.item_name}
                          onChange={(v) => {
                            updateRow(r.id, { item_name: v });
                            clearError(`row-${r.id}-name`);
                          }}
                          options={itemNameSuggestions}
                          placeholder="Item name"
                          ariaLabel={`Item ${idx + 1} name`}
                          invalid={!!errors[`row-${r.id}-name`]}
                          onEnterCommit={() => focusRowPrice(r.id)}
                        />
                        <FieldError message={errors[`row-${r.id}-name`]} />
                      </Field>
                      <Field label="Price (£)">
                        <Input
                          ref={(el) => {
                            rowPriceRefs.current[r.id] = el;
                          }}
                          inputMode="decimal"
                          aria-label={`Item ${idx + 1} price`}
                          aria-invalid={!!errors[`row-${r.id}-price`] || undefined}
                          className={errors[`row-${r.id}-price`] ? invalidCls : undefined}
                          value={r.price}
                          onChange={(e) => {
                            updateRow(r.id, { price: e.target.value });
                            clearError(`row-${r.id}-price`);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            if (r.item_name.trim() && r.price.trim()) addRow();
                          }}
                        />
                        <FieldError message={errors[`row-${r.id}-price`]} />
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
                        value={r.category || undefined}
                        onValueChange={(v) => {
                          if (v === ADD_CATEGORY_SENTINEL) {
                            setAddCategoryForRowId(r.id);
                            return;
                          }
                          updateRow(r.id, { category: v });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose category" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortLabels(categories).map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                          <SelectItem value={ADD_CATEGORY_SENTINEL} className="text-primary">
                            + New category…
                          </SelectItem>
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

              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Delivery</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Field label="Status">
                    <Select
                      value={deliveryStatus || "none"}
                      onValueChange={(v) => setDeliveryStatus(v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not a delivery</SelectItem>
                        {DELIVERY_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {deliveryMeta(s)!.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Courier (optional)">
                    <Input
                      placeholder="e.g. DPD"
                      value={courier}
                      onChange={(e) => setCourier(e.target.value)}
                    />
                  </Field>
                  <Field label="Tracking number (optional)">
                    <Input
                      placeholder="e.g. JD00021234"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                    />
                  </Field>
                </div>
              </div>


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
      <AddCategoryDialog
        open={addCategoryForRowId !== null}
        onOpenChange={(o) => {
          if (!o) setAddCategoryForRowId(null);
        }}
        onCreated={(name) => {
          if (addCategoryForRowId) updateRow(addCategoryForRowId, { category: name });
          setAddCategoryForRowId(null);
        }}
      />
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
