import { useEffect, useState } from "react";
import { ShieldCheck, Gamepad2, AlertTriangle, Calculator } from "lucide-react";
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
