import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

import { format } from "date-fns";
import { toast } from "sonner";
import { colorForKey } from "@/lib/colors";
import {
  Plus,
  Trash2,
  HandCoins,
  CreditCard as CreditIcon,
  Wallet,
  ChevronRight,
  ArrowUpRight,
  History,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  useCommitments,
  useDebts,
  useDebtItems,
  useIncomes,
  useLoans,
  useSavings,
  useTransactions,
} from "@/lib/store";
import type { Debt, LedgerPayment, Loan } from "@/lib/types";
import { fmt } from "@/lib/format";
import { addMonths } from "date-fns";
import { syncCommitmentAfterDebtPayment } from "@/lib/bnplSync";
import { planCredit, planDebit } from "@/lib/ledgerSync";
export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

export function loanPaid(l: Loan) {
  return (l.payments ?? []).filter((p) => p.type !== "topup").reduce((s, p) => s + p.amount, 0);
}
export function loanRemaining(l: Loan) {
  return Math.max(0, l.total_amount - loanPaid(l));
}
export function debtPaid(d: Debt) {
  return (d.payments ?? []).reduce((s, p) => s + p.amount, 0);
}
export function debtRemaining(d: Debt) {
  return Math.max(0, d.total_amount - debtPaid(d));
}

// ============ Funding-source helper ============

export type SourceChoice = { kind: "main" } | { kind: "pocket"; name: string } | { kind: "other" };

export function sourceLabel(source?: string): string {
  if (!source || source === "main") return "Main balance";
  if (source === "other") return "Other (not deducted)";
  if (source.startsWith("pocket:")) return `Pocket · ${source.slice(7)}`;
  return source;
}
export function encodeSource(c: SourceChoice): string {
  if (c.kind === "main") return "main";
  if (c.kind === "other") return "other";
  return `pocket:${c.name}`;
}

export function usePockets(): string[] {
  const { items } = useSavings();
  return useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((s) => {
      const d = s.kind === "deposit" ? s.amount : -s.amount;
      map.set(s.account, (map.get(s.account) ?? 0) + d);
    });
    return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  }, [items]);
}

export function FundingSourceDialog({
  open,
  onOpenChange,
  title,
  description,
  direction,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  /** "out" = money leaving (expense / loan-out), "in" = money arriving (repayment) */
  direction: "in" | "out";
  onConfirm: (choice: SourceChoice) => void | Promise<void>;
}) {
  const pockets = usePockets();
  const [value, setValue] = useState<string>("main");

  useEffect(() => {
    if (open) setValue("main");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {description ??
              (direction === "out"
                ? "Where should this money come from?"
                : "Where should this money go?")}
          </p>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">Main balance</SelectItem>
              {pockets.map((p) => (
                <SelectItem key={p} value={`pocket:${p}`}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: colorForKey(p) }}
                    />
                    Pocket · {p}
                  </span>
                </SelectItem>
              ))}
              <SelectItem value="other">Other / Do not deduct</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            "Other" only updates this module — your balances won't change.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const choice: SourceChoice =
                value === "main"
                  ? { kind: "main" }
                  : value === "other"
                    ? { kind: "other" }
                    : { kind: "pocket", name: value.slice(7) };
              onConfirm(choice);
            }}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Ledger sync helpers ============

export function useLedgerSync() {
  const { add: addTransaction } = useTransactions();
  const { add: addIncome } = useIncomes();
  const { add: addSaving } = useSavings();

  /**
   * Money leaves the user's funds.
   *
   * Pocket-funded outflows write BOTH rows (see `planDebit`): the pocket
   * withdrawal credits the main balance back, and the transaction (tagged
   * with a `pocket:` split) debits it again, so main nets out and the spend
   * still shows in history.
   */
  async function debit(
    source: SourceChoice,
    args: { amount: number; date: string; label: string; category?: string; notes?: string },
  ) {
    const plan = planDebit(source, args);
    if (plan.saving) await addSaving(plan.saving);
    if (plan.transaction) {
      const t = plan.transaction;
      await addTransaction({
        date: t.date,
        retailer: t.retailer,
        total_amount: t.total_amount,
        receipt_attached: false,
        receipt_type: "None",
        receipt_location: "",
        notes: t.notes,
        items: [
          {
            id: crypto.randomUUID(),
            item_name: t.retailer,
            price: t.total_amount,
            quantity: 1,
            category: t.category,
          },
        ],
        payment_splits: t.payment_splits,
      });
    }
  }

  /**
   * Money arrives in the user's funds. Into a pocket we write BOTH the pocket
   * deposit and the income row, so the deposit's drag on the main balance is
   * offset and main stays flat.
   */
  async function credit(
    source: SourceChoice,
    args: { amount: number; date: string; label: string; category?: string; notes?: string },
  ) {
    const plan = planCredit(source, args);
    if (plan.saving) await addSaving(plan.saving);
    if (plan.income) await addIncome(plan.income);
  }

  return { debit, credit };
}
// ============ History list (shared) ============

export function HistoryList({ payments }: { payments: LedgerPayment[] }) {
  if (!payments || payments.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No activity yet.</p>;
  }
  const sorted = [...payments].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <ul className="divide-y divide-border/60">
      {sorted.map((p) => (
        <li key={p.id} className="py-2 flex items-start justify-between gap-3 text-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {p.type === "topup" && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  Top-up
                </span>
              )}
              <span className="font-medium tabular-nums">
                {p.type === "topup" ? "+" : "−"}
                {fmt(p.amount)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {format(new Date(p.date), "d MMM yyyy")} · {sourceLabel(p.source)}
            </p>
            {p.notes && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.notes}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ============ OWED TO ME ============

// ============ Shared payment dialog ============

export function PaymentDialog({
  open,
  onOpenChange,
  title,
  defaultAmount,
  defaultDate,
  scheduledDate,
  max,
  hideRemaining,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  defaultAmount?: number;
  defaultDate?: string;
  /** Scheduled installment date, shown as a hint. The form still defaults to
   *  today so paying early lands in the cycle the money actually left. */
  scheduledDate?: string | null;
  max: number;
  hideRemaining?: boolean;
  onSave: (data: { amount: number; date: string; notes?: string }) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount != null ? defaultAmount.toFixed(2) : "");
      setDate(defaultDate ?? todayISO());
      setNotes("");
    }
  }, [open, defaultAmount, defaultDate]);

  const future = date > todayISO();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Amount (£)
            </Label>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            {!hideRemaining && Number.isFinite(max) && (
              <p className="text-[11px] text-muted-foreground">Remaining: {fmt(max)}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Date paid
            </Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            {scheduledDate && scheduledDate !== date && (
              <p className="text-[11px] text-muted-foreground break-words">
                Scheduled for {scheduledDate}.{" "}
                <button
                  type="button"
                  className="underline hover:text-foreground"
                  onClick={() => setDate(scheduledDate)}
                >
                  Use that date instead
                </button>
              </p>
            )}
            {future && (
              <p className="text-[11px] text-amber-500 break-words">
                This date is in the future — the payment won&apos;t reduce your Main Balance until
                that cycle. Use today&apos;s date if the money has already left your account.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const amt = parseFloat(amount);
              if (!(amt > 0)) {
                toast.error("Enter an amount greater than 0.");
                return;
              }
              onSave({ amount: amt, date, notes: notes.trim() || undefined });
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
