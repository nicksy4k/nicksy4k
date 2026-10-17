import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSavings } from "@/lib/store";
import { fmt, todayLocalISO } from "@/lib/format";

const MAIN = "__main__";

interface Props {
  pockets: [string, number][];
  mainBalance: number;
  disabled?: boolean;
}

/** Quick From → To → Amount transfer between Main and pockets. */
export function TransferDialog({ pockets, mainBalance, disabled }: Props) {
  const { add } = useSavings();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(MAIN);
  const [to, setTo] = useState(pockets[0]?.[0] ?? "");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const balanceOf = (k: string) =>
    k === MAIN ? mainBalance : (pockets.find(([n]) => n === k)?.[1] ?? 0);
  const label = (k: string) => (k === MAIN ? "Main balance" : k);
  const options = [MAIN, ...pockets.map(([n]) => n)];

  async function submit() {
    const amt = Math.round(parseFloat(amount) * 100) / 100;
    if (!(amt > 0)) return toast.error("Enter an amount.");
    if (!from || !to || from === to) return toast.error("Pick two different places.");
    setBusy(true);
    try {
      const date = todayLocalISO();
      const notes = `Transfer: ${label(from)} → ${label(to)}`;
      if (from !== MAIN) await add({ date, kind: "withdrawal", amount: amt, account: from, notes });
      if (to !== MAIN) await add({ date, kind: "deposit", amount: amt, account: to, notes });
      toast.success(`Moved ${fmt(amt)} to ${label(to)}`);
      setAmount("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label="Transfer money"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        Transfer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Move money</DialogTitle>
            <DialogDescription>Shift money between Main and your pockets.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(["from", "to"] as const).map((side) => (
              <div key={side} className="space-y-1.5">
                <Label>{side === "from" ? "From" : "To"}</Label>
                <Select
                  value={side === "from" ? from : to}
                  onValueChange={side === "from" ? setFrom : setTo}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {options
                      .filter((o) => o !== (side === "from" ? to : from))
                      .map((o) => (
                        <SelectItem key={o} value={o}>
                          {label(o)} ({fmt(balanceOf(o))})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="transfer-amount">Amount</Label>
              <Input
                id="transfer-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[10, 20, 50].map((v) => (
                  <Button key={v} type="button" size="sm" variant="secondary" onClick={() => setAmount(String(v))}>
                    £{v}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setAmount(Math.max(0, balanceOf(from)).toFixed(2))}
                >
                  All
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={busy} className="w-full">
              {busy ? "Moving…" : `Transfer${parseFloat(amount) > 0 ? ` ${fmt(parseFloat(amount))}` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
