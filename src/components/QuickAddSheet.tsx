import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCategories, useSavings, useTransactions } from "@/lib/store";
import { activeSymbol, usePreferences } from "@/lib/preferences";
import type { PaymentSplit } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Three-tap capture for phones: amount, shop, category, source.
 * Writes a single-item transaction that can be itemised later from History.
 */
export function QuickAddSheet({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { prefs } = usePreferences();
  const symbol = activeSymbol(prefs);
  const { add: addTransaction } = useTransactions();
  const { add: addSaving, items: savings } = useSavings();
  const { list: categories } = useCategories();

  const [amount, setAmount] = useState("");
  const [retailer, setRetailer] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("main");
  const [saving, setSaving] = useState(false);

  const pockets = useMemo(() => {
    const map = new Map<string, number>();
    savings.forEach((s) => {
      const delta = s.kind === "deposit" ? s.amount : -s.amount;
      map.set(s.account, (map.get(s.account) ?? 0) + delta);
    });
    return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  }, [savings]);

  const reset = () => {
    setAmount("");
    setRetailer("");
    setCategory("");
    setSource("main");
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const save = async () => {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter an amount first");
      return;
    }
    const shop = retailer.trim() || "Quick add";
    const cat = category || categories[0] || "Other";
    const date = todayISO();

    setSaving(true);
    try {
      const splits: PaymentSplit[] = source.startsWith("pocket:")
        ? [{ source, amount: value, label: source.slice(7) }]
        : [{ source: "main", amount: value }];

      if (source.startsWith("pocket:")) {
        await addSaving({
          date,
          kind: "withdrawal",
          amount: value,
          account: source.slice(7),
          notes: `Auto: ${shop}`,
        });
      }

      await addTransaction({
        date,
        retailer: shop,
        total_amount: value,
        receipt_attached: false,
        receipt_type: "None",
        receipt_location: "",
        notes: "",
        items: [
          {
            id: crypto.randomUUID(),
            item_name: shop,
            price: value,
            quantity: 1,
            category: cat,
          },
        ],
        payment_splits: splits,
      });

      toast.success(`Logged ${symbol}${value.toFixed(2)} at ${shop}`, {
        action: {
          label: "Itemise",
          onClick: () => navigate({ to: "/history" }),
        },
      });
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="bottom"
        className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Quick add</SheetTitle>
          <SheetDescription>Log the basics now — itemise it later from History.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="qa-amount">Amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                {symbol}
              </span>
              <Input
                id="qa-amount"
                inputMode="decimal"
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-14 pl-9 text-2xl font-semibold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qa-retailer">Shop</Label>
            <Input
              id="qa-retailer"
              placeholder="Where did you spend?"
              value={retailer}
              onChange={(e) => setRetailer(e.target.value)}
              className="h-12"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Pick one" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>Paid from</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Main balance</SelectItem>
                  {pockets.map((p) => (
                    <SelectItem key={p} value={`pocket:${p}`}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="h-12 w-full text-base" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save spend"}
          </Button>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              close();
              navigate({ to: "/new" });
            }}
          >
            Need the full form with items and receipts
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
