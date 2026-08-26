import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { sortLabels } from "@/lib/utils";
import type { Commitment, Debt } from "@/lib/types";
import { debtRemaining } from "@/lib/credit";
import { fmt } from "@/lib/format";
import { PROMO_WARNING_DAYS } from "@/lib/subscriptions";
import { Field } from "./shared";

const NO_DEBT = "__none__";

export function OutgoingDialog({
  open,
  onOpenChange,
  editing,
  categories,
  debts = [],
  defaultSubscription,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Commitment | null;
  categories: string[];
  /** Standard (non-BNPL) debts this outgoing can be linked to. */
  debts?: Debt[];
  defaultSubscription: boolean;
  onSave: (data: Omit<Commitment, "id" | "created_at">) => void | Promise<void>;
}) {
  const [itemName, setItemName] = useState("");
  const [store, setStore] = useState("");
  const [payment, setPayment] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Subscriptions");
  const [lastPaid, setLastPaid] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [notes, setNotes] = useState("");
  const [paid, setPaid] = useState(false);
  const [isSub, setIsSub] = useState(false);
  const [cadence, setCadence] = useState("monthly");
  const [onOffer, setOnOffer] = useState(false);
  const [promoEnds, setPromoEnds] = useState("");
  const [standardPrice, setStandardPrice] = useState("");
  const [debtId, setDebtId] = useState<string>(NO_DEBT);

  const standardDebts = debts.filter((d) => d.kind !== "bnpl");
  const bnplLocked = !!editing?.debt_id && !standardDebts.some((d) => d.id === editing.debt_id);


  useEffect(() => {
    if (!open) return;
    setItemName(editing?.item_name ?? "");
    setStore(editing?.store ?? "");
    setPayment(editing?.payment_method ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setCategory(
      editing?.category ??
        (categories.includes("Subscriptions")
          ? "Subscriptions"
          : (categories[0] ?? "Subscriptions")),
    );
    setLastPaid(editing?.last_paid_date ?? "");
    setNextDue(editing?.next_due_date ?? "");
    setNotes(editing?.notes ?? "");
    setPaid(editing?.paid ?? false);
    setIsSub(editing ? !!editing.is_subscription : defaultSubscription);
    setCadence(editing?.cadence === "annual" ? "annual" : "monthly");
    setOnOffer(!!editing?.promo_ends_on);
    setPromoEnds(editing?.promo_ends_on ?? "");
    setStandardPrice(
      typeof editing?.standard_price === "number" ? String(editing.standard_price) : "",
    );
  }, [open, editing, categories, defaultSubscription]);

  async function submit() {
    const amt = parseFloat(amount);
    if (!itemName.trim() || !(amt >= 0)) {
      toast.error("Name and a valid amount are required.");
      return;
    }
    if (isSub && onOffer && !promoEnds) {
      toast.error("Add the date the offer ends.");
      return;
    }
    const std = parseFloat(standardPrice);
    const usePromo = isSub && onOffer;
    await onSave({
      item_name: itemName.trim(),
      store: store.trim(),
      payment_method: payment.trim(),
      amount: amt,
      category: category || "Subscriptions",
      last_paid_date: lastPaid || null,
      next_due_date: nextDue || null,
      notes: notes.trim() || undefined,
      paid,
      is_subscription: isSub,
      cadence: isSub ? cadence : "monthly",
      promo_price: usePromo ? amt : null,
      promo_ends_on: usePromo ? promoEnds : null,
      standard_price: usePromo && std > 0 ? std : null,
      promo_alert_snoozed_until: null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit outgoing" : "Add outgoing"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor="is-sub" className="text-sm">
                This is a subscription
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5 break-words">
                Adds billing cadence and offer tracking. Money still comes from Bill Money.
              </p>
            </div>
            <Switch id="is-sub" checked={isSub} onCheckedChange={setIsSub} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name">
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Netflix"
              />
            </Field>
            <Field label="Store / provider">
              <Input
                value={store}
                onChange={(e) => setStore(e.target.value)}
                placeholder="Netflix Inc."
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No categories yet — add one in Settings.
                    </div>
                  ) : (
                    sortLabels(categories).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
            {isSub ? (
              <Field label="Billing cycle">
                <Select value={cadence} onValueChange={setCadence}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <Field label="Payment method">
                <Input
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                  placeholder="Direct Debit"
                />
              </Field>
            )}
          </div>

          {isSub && (
            <Field label="Payment method">
              <Input
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                placeholder="Direct Debit"
              />
            </Field>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={isSub ? "Price you pay now (£)" : "Amount (£)"}>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label={isSub ? "Next renewal date" : "Next due date"}>
              <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Last paid date">
              <Input type="date" value={lastPaid} onChange={(e) => setLastPaid(e.target.value)} />
            </Field>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <Switch checked={paid} onCheckedChange={setPaid} id="paid" />
                <Label htmlFor="paid">Marked as paid</Label>
              </div>
            </div>
          </div>

          {isSub && (
            <div className="rounded-md border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="on-offer" className="text-sm">
                  On a discounted offer
                </Label>
                <Switch id="on-offer" checked={onOffer} onCheckedChange={setOnOffer} />
              </div>
              {onOffer && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Offer ends on">
                      <Input
                        type="date"
                        value={promoEnds}
                        onChange={(e) => setPromoEnds(e.target.value)}
                      />
                    </Field>
                    <Field label="Price after offer">
                      <Input
                        inputMode="decimal"
                        value={standardPrice}
                        onChange={(e) => setStandardPrice(e.target.value)}
                        placeholder="0.00"
                      />
                    </Field>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You'll be reminded {PROMO_WARNING_DAYS} days before the offer ends. If you do
                    nothing, the price switches to the full price on that date.
                  </p>
                </>
              )}
            </div>
          )}

          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
