import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSavings, useIncomeCategories } from "@/lib/store";
import { fmt, todayLocalISO } from "@/lib/format";
import { colorForKey } from "@/lib/colors";
import type { Refund, Transaction } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
}

export function RefundDialog({ transaction, onClose }: Props) {
  const { items: savings } = useSavings();
  const { list: incomeCats, add: addIncomeCat } = useIncomeCategories();
  const qc = useQueryClient();
  const open = transaction !== null;

  const priorRefundedIds = useMemo(() => {
    const s = new Set<string>();
    (transaction?.refunds ?? []).forEach((r) => r.item_ids.forEach((id) => s.add(id)));
    return s;
  }, [transaction]);

  const priorRefundTotal = useMemo(
    () => (transaction?.refunds ?? []).reduce((s, r) => s + r.amount, 0),
    [transaction],
  );

  const remainingRefundable = transaction
    ? +(transaction.total_amount - priorRefundTotal).toFixed(2)
    : 0;

  const pockets = useMemo(() => {
    const map = new Map<string, number>();
    savings.forEach((s) => {
      const d = s.kind === "deposit" ? s.amount : -s.amount;
      map.set(s.account, (map.get(s.account) ?? 0) + d);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [savings]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [destination, setDestination] = useState("main");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (transaction) {
      setSelected(new Set());
      setAmount("");
      setAmountTouched(false);
      setDestination("main");
      setReason("");
      setSubmitting(false);
    }
  }, [transaction?.id]);

  const selectedTotal = useMemo(() => {
    if (!transaction) return 0;
    return transaction.items
      .filter((i) => selected.has(i.id))
      .reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
  }, [transaction, selected]);

  useEffect(() => {
    if (!amountTouched) {
      setAmount(selectedTotal > 0 ? selectedTotal.toFixed(2) : "");
    }
  }, [selectedTotal, amountTouched]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm() {
    if (!transaction) return;
    const amt = parseFloat(amount);
    if (!(amt > 0)) {
      toast.error("Enter a refund amount greater than zero.");
      return;
    }
    if (amt > remainingRefundable + 0.0001) {
      toast.error(`Refund exceeds remaining refundable balance (${fmt(remainingRefundable)}).`);
      return;
    }
    if (!destination) {
      toast.error("Choose where to deposit the refund.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const userId = u.user.id;
      const today = todayLocalISO();
      const isPocket = destination.startsWith("pocket:");
      const pocketName = isPocket ? destination.slice(7) : null;

      // Ensure "Refund" income category exists (async, don't block).
      if (!incomeCats.includes("Refund")) {
        addIncomeCat("Refund").catch(() => {});
      }

      const note = [
        reason.trim(),
        `Refund of transaction ${transaction.retailer} (${transaction.id.slice(0, 8)})`,
      ]
        .filter(Boolean)
        .join(" — ");

      const { data: inc, error: incErr } = await supabase
        .from("incomes")
        .insert({
          user_id: userId,
          date: today,
          source: `Refund · ${transaction.retailer}`,
          amount: amt,
          category: "Refund",
          notes: note,
        })
        .select("id")
        .single();
      if (incErr) throw incErr;
      const incomeId = (inc as { id: string }).id;

      let savingsId: string | undefined;
      if (pocketName) {
        const { data: sav, error: savErr } = await supabase
          .from("savings")
          .insert({
            user_id: userId,
            date: today,
            kind: "deposit",
            amount: amt,
            account: pocketName,
            notes: `Refund from ${transaction.retailer}`,
          })
          .select("id")
          .single();
        if (savErr) throw savErr;
        savingsId = (sav as { id: string }).id;
      }

      const newRefund: Refund = {
        id: crypto.randomUUID(),
        refunded_at: new Date().toISOString(),
        amount: +amt.toFixed(2),
        destination,
        reason: reason.trim() || undefined,
        item_ids: Array.from(selected),
        income_id: incomeId,
        savings_id: savingsId,
      };
      const nextRefunds = [...(transaction.refunds ?? []), newRefund];
      const { error: upErr } = await supabase
        .from("transactions")
        .update({ refunds: nextRefunds as never } as never)
        .eq("id", transaction.id);
      if (upErr) throw upErr;

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["transactions"] }),
        qc.invalidateQueries({ queryKey: ["incomes"] }),
        qc.invalidateQueries({ queryKey: ["savings"] }),
      ]);

      toast.success(
        pocketName
          ? `Refunded ${fmt(amt)} to pocket "${pocketName}"`
          : `Refunded ${fmt(amt)} to main balance`,
      );
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Refund failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {transaction && (
          <>
            <DialogHeader>
              <DialogTitle>Refund from {transaction.retailer}</DialogTitle>
              <DialogDescription>
                Refundable balance: {fmt(remainingRefundable)} of {fmt(transaction.total_amount)}
                {priorRefundTotal > 0 && ` (${fmt(priorRefundTotal)} already refunded)`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Items being refunded
                </Label>
                <ul className="mt-2 space-y-1.5 rounded-md border border-border divide-y divide-border">
                  {transaction.items.map((i) => {
                    const qty = i.quantity ?? 1;
                    const sub = i.price * qty;
                    const already = priorRefundedIds.has(i.id);
                    return (
                      <li
                        key={i.id}
                        className={`flex items-center gap-3 px-3 py-2 text-sm ${already ? "opacity-60" : ""}`}
                      >
                        <Checkbox
                          checked={selected.has(i.id)}
                          disabled={already}
                          onCheckedChange={() => toggle(i.id)}
                          id={`refund-${i.id}`}
                        />
                        <label
                          htmlFor={`refund-${i.id}`}
                          className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer"
                        >
                          <span className="truncate">{i.item_name}</span>
                          {qty > 1 && (
                            <span className="text-muted-foreground text-xs">× {qty}</span>
                          )}
                          {already && (
                            <Badge variant="outline" className="font-normal">
                              Already refunded
                            </Badge>
                          )}
                        </label>
                        <span className="tabular-nums text-muted-foreground text-xs">
                          {fmt(i.price)}
                        </span>
                        <span className="tabular-nums font-medium w-20 text-right">{fmt(sub)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="refund-amount">Refund amount</Label>
                  <Input
                    id="refund-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setAmountTouched(true);
                    }}
                    placeholder="0.00"
                    className="mt-1.5"
                  />
                  {amountTouched && (
                    <button
                      type="button"
                      onClick={() => setAmountTouched(false)}
                      className="mt-1 text-xs text-primary hover:underline"
                    >
                      Reset to selected total
                    </button>
                  )}
                </div>

                <div>
                  <Label>Deposit to</Label>
                  <Select value={destination} onValueChange={setDestination}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">Main balance</SelectItem>
                      {pockets.map(([name, bal]) => (
                        <SelectItem key={name} value={`pocket:${name}`}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-sm"
                              style={{ backgroundColor: colorForKey(name) }}
                            />
                            Pocket · {name}
                            <span className="text-muted-foreground text-xs">
                              ({fmt(bal)})
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="refund-reason">Reason (optional)</Label>
                <Textarea
                  id="refund-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Item returned — wrong size"
                  className="mt-1.5"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={confirm} disabled={submitting}>
                {submitting ? "Processing…" : `Refund ${amount ? fmt(parseFloat(amount) || 0) : ""}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
