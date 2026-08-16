
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
import { ShortcutsHelp } from "@/components/KeyboardShortcutsDialog";

export { EditTransactionDialog };

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
