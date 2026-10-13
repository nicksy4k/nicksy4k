import { useEffect, useState } from "react";
import { ShieldCheck, Gamepad2, AlertTriangle, Calculator, RefreshCw } from "lucide-react";
import { toast } from "sonner";
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

const round2 = (n: number) => Math.round(n * 100) / 100;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmt } from "@/lib/format";
import {
  computeSplit,
  isSafeSplitLoaded,
  previewPurchase,
  setCycleTarget,
  useSafeSplit,
} from "@/lib/safeSplit";

export function SafeSplitPanel({
  balance,
  cycleKey,
  blur = "",
}: {
  balance: number;
  cycleKey: string;
  blur?: string;
}) {
  const s = useSafeSplit();
  const [whatIf, setWhatIf] = useState("");
  const stored = s.targets[cycleKey];

  // Lock a target the first time we see this cycle — only after the account's
  // saved split has loaded, so a stale device copy never overwrites it.
  const loaded = isSafeSplitLoaded();
  useEffect(() => {
    if (loaded && s.enabled && stored === undefined && balance > 0) {
      setCycleTarget(cycleKey, (balance * s.keepPct) / 100);
    }
  }, [loaded, s, s.enabled, stored, balance, cycleKey, s.keepPct]);

  if (!s.enabled) return null;
  const target = stored ?? (Math.max(0, balance) * s.keepPct) / 100;
  const split = computeSplit(balance, target);
  const amt = parseFloat(whatIf);
  const pv = amt > 0 ? previewPurchase(balance, target, amt) : null;

  const newTarget = round2((Math.max(0, balance) * s.keepPct) / 100);
  const newSplit = computeSplit(balance, newTarget);

  return (
    <div className="mt-4 rounded-lg border border-border/60 bg-background/40 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Keep safe
          </p>
          <p className={`text-lg font-semibold tabular-nums ${blur}`}>{fmt(split.keepSafe)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Gamepad2 className="h-3.5 w-3.5" /> Guilt-free play
          </p>
          <p className={`text-lg font-semibold tabular-nums text-primary ${blur}`}>{fmt(split.play)}</p>
        </div>
      </div>

      {balance > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> Re-split ({s.keepPct}/{100 - s.keepPct})
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Recalculate Keep-Safe split?</AlertDialogTitle>
              <AlertDialogDescription>
                Based on your current <span className={blur}>{fmt(balance)}</span> left to spend.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid grid-cols-3 gap-2 text-sm tabular-nums">
              <span />
              <span className="text-xs text-muted-foreground">Current</span>
              <span className="text-xs text-muted-foreground">
                New ({s.keepPct}% / {100 - s.keepPct}%)
              </span>
              <span className="text-muted-foreground">Keep safe</span>
              <span className={blur}>{fmt(split.keepSafe)}</span>
              <span className={`font-semibold ${blur}`}>{fmt(newSplit.keepSafe)}</span>
              <span className="text-muted-foreground">Play money</span>
              <span className={blur}>{fmt(split.play)}</span>
              <span className={`font-semibold text-primary ${blur}`}>{fmt(newSplit.play)}</span>
            </div>
            <p className="text-xs text-muted-foreground rounded-md border border-border/60 p-2">
              Best used when new income arrives. Avoid re-splitting just to top up play money after
              spending — it shrinks your safety net.
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setCycleTarget(cycleKey, newTarget);
                  toast.success(`Keep-Safe target updated to ${fmt(newTarget)}`);
                }}
              >
                Confirm recalculation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {split.breached && balance > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm space-y-2">
          <p className="flex items-start gap-1.5">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
            <span>
              Inside your safety net — <span className={blur}>{fmt(split.dippedBy)}</span> used. Everything
              left is guarded for surprises.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setCycleTarget(cycleKey, balance)}>
              Keep as safety net
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCycleTarget(cycleKey, (balance * s.keepPct) / 100)}
            >
              Recalculate split ({s.keepPct}/{100 - s.keepPct})
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground flex items-center gap-1" htmlFor="whatif">
          <Calculator className="h-3.5 w-3.5" /> What if I buy something for…
        </label>
        <Input
          id="whatif"
          inputMode="decimal"
          placeholder="e.g. 35"
          value={whatIf}
          onChange={(e) => setWhatIf(e.target.value)}
          className="h-8"
        />
        {pv && (
          <p className={`text-sm ${pv.intoBuffer > 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {pv.overBalance
              ? `That's more than you have left to spend.`
              : pv.intoBuffer > 0
                ? `Dips ${fmt(pv.intoBuffer)} into Keep safe — ${fmt(pv.after.keepSafe)} left for surprises. Bills & food stay covered.`
                : `Fine — within play money. ${fmt(pv.after.play)} play left after.`}
          </p>
        )}
      </div>
    </div>
  );
}
