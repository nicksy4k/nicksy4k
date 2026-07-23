import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";
import { useEffect, useMemo, useState } from "react";
import { useTransactions, useCategories, useSavings, useDebts, useCommitments } from "@/lib/store";
import { RECEIPT_TYPES, type Category, type LineItem, type PaymentSplit, type ReceiptType } from "@/lib/types";
import { fmt, todayLocalISO } from "@/lib/format";
import { sortLabels } from "@/lib/utils";
import { useHiddenSuggestions, filterHidden } from "@/lib/hiddenSuggestions";
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
import { ReceiptUpload } from "@/components/ReceiptUpload";
import { ProtectionFields, emptyProtection, type ProtectionValue } from "@/components/ProtectionFields";
import {
  PaymentSplitEditor,
  emptySplit,
  generateInstallmentDates,
  type SplitDraft,
} from "@/components/PaymentSplitEditor";
import { AddCategoryDialog, ADD_CATEGORY_SENTINEL } from "@/components/AddCategoryDialog";
import {
  buildPriceHistory,
  buildCategoryHistory,
  suggestPrice as lookupPrice,
  suggestCategory as lookupCategory,
} from "@/lib/suggestions";


export const Route = createFileRoute("/new")({
  head: () => ({ meta: [{ title: "Log Transaction — Ledgerly" }] }),
  component: NewTransactionPage,
  errorComponent: RouteError,
});

interface DraftItem {
  id: string;
  item_name: string;
  price: string;
  quantity: string;
  category: Category;
  notes: string;
}

function emptyItem(defaultCat: Category = ""): DraftItem {
  return { id: crypto.randomUUID(), item_name: "", price: "", quantity: "1", category: defaultCat, notes: "" };
}


function NewTransactionPage() {
  const navigate = useNavigate();
  const { add, items: pastTransactions } = useTransactions();
  const { list: categories } = useCategories();
  const { add: addSaving } = useSavings();
  const { add: addDebt } = useDebts();
  const { add: addCommitment } = useCommitments();
  const { hidden } = useHiddenSuggestions();

  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(todayLocalISO());
  const [retailer, setRetailer] = useState("");
  const [receiptAttached, setReceiptAttached] = useState(true);
  const [receiptType, setReceiptType] = useState<ReceiptType>("Digital");
  const [receiptLocation, setReceiptLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [protection, setProtection] = useState<ProtectionValue>(emptyProtection());
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [splits, setSplits] = useState<SplitDraft[]>([emptySplit("main")]);
  const [saving, setSaving] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [pendingEstimate, setPendingEstimate] = useState("");
  const [addCategoryForItemId, setAddCategoryForItemId] = useState<string | null>(null);

  const lineTotal = (i: DraftItem) => (parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 0);

  const total = useMemo(
    () => items.reduce((s, i) => s + lineTotal(i), 0),
    [items]
  );

  const retailerSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const t of pastTransactions) {
      if (t.retailer?.trim()) set.add(t.retailer.trim());
    }
    return filterHidden(sortLabels(set), hidden.retailers);
  }, [pastTransactions, hidden.retailers]);

  const itemNameSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const t of pastTransactions) {
      for (const it of t.items ?? []) {
        if (it.item_name?.trim()) set.add(it.item_name.trim());
      }
    }
    return filterHidden(sortLabels(set), hidden.items);
  }, [pastTransactions, hidden.items]);

  const priceHistory = useMemo(() => buildPriceHistory(pastTransactions), [pastTransactions]);
  const categoryHistory = useMemo(() => buildCategoryHistory(pastTransactions), [pastTransactions]);

  function suggestPrice(itemName: string, retailerName: string): number | null {
    return lookupPrice(priceHistory, itemName, retailerName);
  }

  function suggestCategory(itemName: string): string | null {
    return lookupCategory(categoryHistory, itemName);
  }


  const canStep2 = retailer.trim().length > 0 && date.length > 0;

  // When the retailer changes, refill empty prices for known items so switching
  // shop between "Asda" and "Tesco" updates suggestions. Manual prices stay.
  useEffect(() => {
    setItems((arr) =>
      arr.map((it) => {
        if (it.price.trim() || !it.item_name.trim()) return it;
        const guess = suggestPrice(it.item_name, retailer);
        return guess != null ? { ...it, price: String(guess) } : it;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retailer, priceHistory]);


  function updateItem(id: string, patch: Partial<DraftItem>) {
    setItems((arr) =>
      arr.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        // Retailer-aware price autofill: only when item_name changes and the
        // user hasn't typed a price yet. Never overwrites manual edits.
        if (patch.item_name !== undefined && !next.price.trim()) {
          const guess = suggestPrice(next.item_name, retailer);
          if (guess != null) next.price = String(guess);
        }
        // Category autofill: most recent category for this item name. Never
        // overwrites a category the user has already picked.
        if (patch.item_name !== undefined && !next.category.trim()) {
          const cat = suggestCategory(next.item_name);
          if (cat) next.category = cat;
        }
        return next;
      }),
    );
  }
  function removeItem(id: string) {
    setItems((arr) => (arr.length === 1 ? arr : arr.filter((it) => it.id !== id)));
  }

  async function save() {
    if (saving) return;

    // Fast-path: pending pre-authorization hold.
    if (isPending) {
      const estimate = parseFloat(pendingEstimate);
      if (!retailer.trim()) {
        toast.error("Retailer is required");
        return;
      }
      if (!(estimate > 0)) {
        toast.error("Enter an estimated total greater than zero.");
        return;
      }
      setSaving(true);
      try {
        const placeholder: LineItem = {
          id: crypto.randomUUID(),
          item_name: "Pending estimate",
          price: +estimate.toFixed(2),
          quantity: 1,
          category: categories[0] ?? "Other",
        };
        await add({
          date,
          retailer: retailer.trim(),
          total_amount: +estimate.toFixed(2),
          receipt_attached: false,
          receipt_type: "None",
          receipt_location: "",
          notes: notes.trim() || undefined,
          items: [placeholder],
          protection_type: null,
          protection_duration: null,
          expiration_date: null,
          payment_splits: [],
          is_pending: true,
        } as never);
        toast.success("Pending hold logged");
        navigate({ to: "/history" });
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setSaving(false);
      }
      return;
    }

    const qualifyingItems = items.filter((i) => i.item_name.trim() && !isNaN(parseFloat(i.price)));

    if (qualifyingItems.length === 0) {
      toast.error("Add at least one line item with a price.");
      return;
    }

    if (qualifyingItems.some((i) => !i.category.trim())) {
      toast.error("Pick a category for every item.");
      return;
    }

    const cleanItems: LineItem[] = qualifyingItems.map((i) => {
      const qty = Math.max(1, parseInt(i.quantity, 10) || 1);
      return {
        id: i.id,
        item_name: i.item_name.trim(),
        price: parseFloat(i.price),
        quantity: qty,
        category: i.category,
        notes: i.notes.trim() || undefined,
      };
    });

    const totalAmt = cleanItems.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);

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

    // Validate splits
    const allocated = splits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    const remainder = +(totalAmt - allocated).toFixed(2);
    if (remainder < 0) {
      toast.error("Split amounts exceed the transaction total.");
      return;
    }
    for (const s of splits) {
      if (s.source === "bnpl:new" && s.bnpl) {
        const n = parseInt(s.bnpl.installments, 10);
        if (!s.bnpl.name.trim() || !(n > 0) || !s.bnpl.firstDate) {
          toast.error("Complete the BNPL plan details (name, installments, first date).");
          return;
        }
      }
    }

    setSaving(true);
    try {
      // Build effective splits: drop empty rows, add remainder→main if needed.
      const effective = splits
        .map((s) => ({ ...s, amt: parseFloat(s.amount) || 0 }))
        .filter((s) => s.amt > 0);
      if (remainder > 0) {
        const mainIdx = effective.findIndex((s) => s.source === "main");
        if (mainIdx >= 0) effective[mainIdx].amt += remainder;
        else effective.push({ id: crypto.randomUUID(), source: "main", amount: "", amt: remainder });
      }

      const retailerName = retailer.trim();
      const finalSplits: PaymentSplit[] = [];

      for (const s of effective) {
        if (s.source.startsWith("pocket:")) {
          const account = s.source.slice(7);
          await addSaving({
            date,
            kind: "withdrawal",
            amount: s.amt,
            account,
            notes: `Auto: ${retailerName || "Transaction"}`,
          });
          finalSplits.push({ source: s.source, amount: s.amt, label: account });
        } else if (s.source === "bnpl:new" && s.bnpl) {
          const installments = Math.max(1, parseInt(s.bnpl.installments, 10) || 1);
          const planName = s.bnpl.name.trim();

          // "First payment due today" — peel installment #1 off the debt
          // and record it as its own split deducted now.
          if (s.bnpl.firstPaymentToday && installments > 1) {
            const firstAmt = +(s.amt / installments).toFixed(2);
            const remainingAmt = +(s.amt - firstAmt).toFixed(2);
            const remainingCount = installments - 1;

            // Today's installment as a normal split (main or pocket).
            const firstSource = s.bnpl.firstSource || "main";
            if (firstSource.startsWith("pocket:")) {
              const account = firstSource.slice(7);
              await addSaving({
                date,
                kind: "withdrawal",
                amount: firstAmt,
                account,
                notes: `Auto: ${retailerName || "Transaction"} · ${planName} installment 1/${installments}`,
              });
              finalSplits.push({ source: firstSource, amount: firstAmt, label: `${account} · ${planName} 1/${installments}` });
            } else {
              finalSplits.push({ source: "main", amount: firstAmt, label: `${planName} 1/${installments} (today)` });
            }

            // Remaining installments live in the BNPL debt. Drop the first
            // date (today) and keep the rest at the cadence.
            const allDates = generateInstallmentDates(s.bnpl.firstDate, installments, s.bnpl.cadence);
            const remainingDates = allDates.slice(1);
            const newId = await addDebt({
              name: planName,
              kind: "bnpl",
              total_amount: remainingAmt,
              installments_total: remainingCount,
              installment_dates: remainingDates,
              start_date: remainingDates[0] ?? date,
              notes: `Auto-created from ${retailerName || "transaction"} · 1/${installments} paid today`,
              payments: [],
            });
            if (remainingCount > 0 && remainingDates[0]) {
              const perInstallment = +(remainingAmt / remainingCount).toFixed(2);
              await addCommitment({
                item_name: `${planName} Installment`,
                store: planName,
                payment_method: "BNPL",
                amount: perInstallment,
                category: "Debt",
                next_due_date: remainingDates[0],
                last_paid_date: date,
                prev_due_date: null,
                notes: `Auto-linked to BNPL plan (${remainingCount} of ${installments} remaining).`,
                paid: false,
                debt_id: newId,
              } as never);
            }
            finalSplits.push({ source: `bnpl:${newId}`, amount: remainingAmt, label: planName });
          } else {
            const dates = generateInstallmentDates(s.bnpl.firstDate, installments, s.bnpl.cadence);
            const newId = await addDebt({
              name: planName,
              kind: "bnpl",
              total_amount: s.amt,
              installments_total: installments,
              installment_dates: dates,
              start_date: date,
              notes: `Auto-created from ${retailerName || "transaction"}`,
              payments: [],
            });
            if (installments > 0 && dates[0]) {
              const perInstallment = +(s.amt / installments).toFixed(2);
              await addCommitment({
                item_name: `${planName} Installment`,
                store: planName,
                payment_method: "BNPL",
                amount: perInstallment,
                category: "Debt",
                next_due_date: dates[0],
                last_paid_date: null,
                prev_due_date: null,
                notes: `Auto-linked to BNPL plan (${installments} of ${installments} remaining).`,
                paid: false,
                debt_id: newId,
              } as never);
            }
            finalSplits.push({ source: `bnpl:${newId}`, amount: s.amt, label: planName });
          }
        } else {
          finalSplits.push({
            source: s.source,
            amount: s.amt,
            label: s.source === "main" ? "Main balance" : s.source === "other" ? "Other" : undefined,
          });
        }
      }

      await add({
        date,
        retailer: retailerName,
        total_amount: totalAmt,
        receipt_attached: receiptAttached,
        receipt_type: receiptAttached ? receiptType : "None",
        receipt_location: receiptAttached ? receiptLocation.trim() : "",
        notes: notes.trim() || undefined,
        items: cleanItems,
        protection_type: protection.enabled ? protection.type : null,
        protection_duration: protection.enabled ? protection.duration : null,
        expiration_date: protection.enabled ? protection.expiration : null,
        payment_splits: finalSplits,
      });
      toast.success("Transaction saved");
      navigate({ to: "/history" });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to save transaction");
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
          {isPending ? "Quick pending hold" : `Step ${step} of 2`}
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold">
          {isPending
            ? "Reserve a pending amount"
            : step === 1 ? "Transaction details" : "Itemize your purchase"}
        </h1>
      </header>

      {!isPending && (
        <div className="flex gap-2 mb-6">
          <StepDot active={step >= 1} done={step > 1} label="Receipt" onClick={() => setStep(1)} />
          <div className="flex-1 h-px bg-border self-center" />
          <StepDot active={step >= 2} done={false} label="Items" onClick={() => canStep2 && setStep(2)} />
        </div>
      )}

      {step === 1 && (
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm">Mark as Pending Hold</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    For supermarket pre-auths and other estimates. Reserves the money now; settle the exact amount later.
                  </p>
                </div>
                <Switch checked={isPending} onCheckedChange={setIsPending} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Retailer / shop">
                <Combobox
                  value={retailer}
                  onChange={setRetailer}
                  options={retailerSuggestions}
                  placeholder="e.g. Asda"
                />
              </Field>
            </div>

            {isPending ? (
              <>
                <Field label="Estimated total (£)">
                  <Input
                    inputMode="decimal"
                    placeholder="0.00"
                    value={pendingEstimate}
                    onChange={(e) => setPendingEstimate(e.target.value)}
                  />
                </Field>
                <Field label="Notes (optional)">
                  <Textarea
                    rows={2}
                    placeholder="e.g. Asda grocery slot, pre-auth"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Field>
                <div className="flex justify-end pt-2">
                  <Button onClick={save} disabled={saving}>
                    <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save pending hold"}
                  </Button>
                </div>
              </>
            ) : (
              <>
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
                      <Field label={receiptType === "Physical" ? "Stored at" : "Receipt file"}>
                        {receiptType === "Physical" ? (
                          <Input
                            placeholder="e.g. Shoebox / Filing cabinet"
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

                <ProtectionFields transactionDate={date} value={protection} onChange={setProtection} />

                <Field label="Notes (optional)">
                  <Textarea rows={3} placeholder="Anything worth remembering…" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>

                <div className="flex justify-end pt-2">
                  <Button disabled={!canStep2} onClick={() => setStep(2)}>
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
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
                <Field label="Item name">
                  <Combobox
                    value={item.item_name}
                    onChange={(v) => updateItem(item.id, { item_name: v })}
                    options={itemNameSuggestions}
                    placeholder="e.g. Wool overshirt"
                    autoFocus={item.id === lastAddedId}
                  />
                </Field>
                <div className="grid grid-cols-[1fr_90px] gap-4">
                  <Field label="Price (£)">
                    <Input inputMode="decimal" placeholder="0.00" value={item.price} onChange={(e) => updateItem(item.id, { price: e.target.value })} />
                  </Field>
                  <Field label="Qty">
                    <Select value={item.quantity} onValueChange={(v) => updateItem(item.id, { quantity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 20 }, (_, i) => String(i + 1)).map((n) => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                {(parseFloat(item.quantity) || 1) > 1 && (
                  <p className="text-xs text-muted-foreground -mt-2">
                    Line total: <span className="tabular-nums font-medium text-foreground">{fmt(lineTotal(item))}</span>
                    {" "}({item.price || "0"} × {item.quantity || "1"})
                  </p>
                )}
                <Field label="Category">
                  <Select
                    value={item.category || undefined}
                    onValueChange={(v) => {
                      if (v === ADD_CATEGORY_SENTINEL) {
                        setAddCategoryForItemId(item.id);
                        return;
                      }
                      updateItem(item.id, { category: v });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                    <SelectContent>
                      {sortLabels(categories).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      <SelectItem value={ADD_CATEGORY_SENTINEL} className="text-primary">
                        <Plus className="h-3.5 w-3.5 inline mr-1" /> New category…
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Notes (optional)">
                  <Input placeholder="Serial #, color, size…" value={item.notes} onChange={(e) => updateItem(item.id, { notes: e.target.value })} />
                </Field>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" className="w-full" onClick={() => {
            const newItem = emptyItem();
            setItems((a) => [...a, newItem]);
            setLastAddedId(newItem.id);
          }}>
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentSplitEditor
                total={total}
                retailer={retailer}
                transactionDate={date}
                splits={splits}
                onChange={setSplits}
              />
              <p className="text-xs text-muted-foreground mt-3">
                Pocket splits auto-record a withdrawal. BNPL splits create a new debt plan. Any
                unallocated remainder defaults to your main balance.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={save} disabled={saving}>
              <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save transaction"}
            </Button>
          </div>
        </div>
      )}
      <AddCategoryDialog
        open={addCategoryForItemId !== null}
        onOpenChange={(o) => { if (!o) setAddCategoryForItemId(null); }}
        onCreated={(name) => {
          if (addCategoryForItemId) updateItem(addCategoryForItemId, { category: name });
          setAddCategoryForItemId(null);
        }}
      />
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