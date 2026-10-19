import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Check, ListChecks, Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { fmt } from "@/lib/format";
import { previewPurchase } from "@/lib/safeSplit";
import { evalSpend, reservedTotal, scratchTotal, type ScratchItem } from "@/lib/spendMath";

const KEY = "ledgerly.scratchpad.v1";

export function SpendScratchpad({
  balance,
  target,
  onReservedChange,
  open,
  onOpenChange,
}: {
  balance: number;
  target: number;
  onReservedChange?: (total: number, count: number) => void;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [items, setItems] = useState<ScratchItem[]>([]);
  useEffect(() => {
    onReservedChange?.(reservedTotal(items), items.filter((x) => x.reserved).length);
  }, [items, onReservedChange]);
  const [name, setName] = useState("");
  const [amt, setAmt] = useState("");

  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data, error } = await supabase
        .from("user_settings")
        .select("scratchpad")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (error) return;
      loaded.current = true;
      const remote = data?.scratchpad;
      if (Array.isArray(remote)) {
        setItems(remote as unknown as ScratchItem[]);
        try {
          localStorage.setItem(KEY, JSON.stringify(remote));
        } catch {
          /* ignore */
        }
      } else if (data) {
        const local = localStorage.getItem(KEY);
        if (local) pushRemote(JSON.parse(local));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushRemote = (next: ScratchItem[]) => {
    if (!loaded.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase
        .from("user_settings")
        .update({ scratchpad: next as unknown as Json })
        .eq("user_id", u.user.id);
    }, 400);
  };

  const save = (next: ScratchItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    pushRemote(next);
  };

  const parsed = evalSpend(amt);
  const add = () => {
    if (!parsed || parsed <= 0) return;
    save([...items, { id: crypto.randomUUID(), name: name.trim() || "Item", amount: parsed, on: true }]);
    setName("");
    setAmt("");
  };

  const total = scratchTotal(items);
  const pv = previewPurchase(balance, target, total);
  const playUsed = Math.min(total, pv.before.play);
  const left = Math.max(0, balance);
  const pct = (n: number) => (left > 0 ? Math.min(100, (n / left) * 100) : 0);
  const status = pv.overBalance ? "over" : pv.intoBuffer > 0 ? "buffer" : "ok";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
          <ListChecks className="h-3.5 w-3.5 mr-1" /> Plan items
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Spending scratchpad</DialogTitle>
          <DialogDescription>
            Tick items to test what-ifs. Tap the lock to put money aside — it comes off your play money until you buy it or remove it. Nothing is logged.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input placeholder="Takeaway" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-0" />
          <Input
            placeholder="£ e.g. 12+6"
            inputMode="decimal"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            className="w-28"
          />
          <Button type="submit" size="icon" disabled={!parsed || parsed <= 0} aria-label="Add item">
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <ul className="space-y-1 max-h-60 overflow-y-auto">
          {items.length === 0 && <li className="text-sm text-muted-foreground">No items yet.</li>}
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5">
              <Checkbox
                checked={it.on}
                onCheckedChange={(v) => save(items.map((x) => (x.id === it.id ? { ...x, on: !!v } : x)))}
                aria-label={`Include ${it.name}`}
              />
              <span className={`flex-1 min-w-0 truncate text-sm ${it.on ? "" : "text-muted-foreground line-through"}`}>
                {it.name}
              </span>
              <span className="text-sm tabular-nums">{fmt(it.amount)}</span>
              <Button
                size="icon"
                variant={it.reserved ? "secondary" : "ghost"}
                className="h-7 w-7"
                onClick={() => save(items.map((x) => (x.id === it.id ? { ...x, reserved: !x.reserved } : x)))}
                aria-label={it.reserved ? `Release ${it.name}` : `Put aside ${it.name}`}
                title={it.reserved ? "Put aside — tap to release" : "Put this money aside"}
              >
                {it.reserved ? <Lock className="h-3.5 w-3.5 text-primary" /> : <LockOpen className="h-3.5 w-3.5" />}
              </Button>
              {it.reserved && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    if (confirm(`Bought ${it.name}? This clears it from put-aside money — remember to log the real spend.`))
                      save(items.filter((x) => x.id !== it.id));
                  }}
                  aria-label={`Bought ${it.name}`}
                  title="Bought it"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => save(items.filter((x) => x.id !== it.id))}
                aria-label={`Remove ${it.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>

        <div className="space-y-2 rounded-md border border-border/60 p-3">
          {reservedTotal(items) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Put aside</span>
              <span className="tabular-nums">{fmt(reservedTotal(items))}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-medium">
            <span>Ticked total</span>
            <span className="tabular-nums">{fmt(total)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted flex">
            <div className="h-full bg-primary" style={{ width: `${pct(playUsed)}%` }} />
            <div className="h-full bg-destructive" style={{ width: `${pct(Math.min(pv.intoBuffer, pv.before.keepSafe))}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Play left: <span className="text-foreground">{fmt(pv.after.play)}</span></span>
            <span>Keep safe left: <span className="text-foreground">{fmt(pv.after.keepSafe)}</span></span>
          </div>
          <p className={`text-sm ${status === "ok" ? "text-muted-foreground" : "text-destructive"}`}>
            {total === 0
              ? "Add something to see how it fits."
              : status === "over"
                ? "That's more than you have left to spend."
                : status === "buffer"
                  ? `Dips ${fmt(pv.intoBuffer)} into your safety net. Try unticking something.`
                  : "All fits within play money."}
          </p>
          {items.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => save([])}>
              Clear all
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
