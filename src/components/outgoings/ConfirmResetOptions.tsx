import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { colorForKey } from "@/lib/colors";
import { usePockets } from "@/lib/creditHooks";
import type { Commitment, Debt } from "@/lib/types";
import { advanceDueDate, advanceForCommitment, useActiveCycle } from "@/lib/cycle";
import { DEFAULT_OUTGOING_SOURCE } from "@/lib/markOutgoingPaid";
import { BILL_POCKET, todayISO } from "./shared";

type Cycle = ReturnType<typeof useActiveCycle>;

export type ResetConfirm = (
  c: Commitment,
  newDue: string,
  source: string,
) => void | Promise<void>;

/**
 * The roll-forward choices shown when marking an outgoing paid.
 * Shared so the Outgoings details dialog and the dashboard alerts card
 * offer exactly the same options and date maths.
 */
export function ResetOptions({
  item,
  cycle,
  linkedDebt = null,
  defaultSource = null,
  onConfirm,
}: {
  item: Commitment;
  cycle: Cycle;
  /** Debt this outgoing pays down, when linked. */
  linkedDebt?: Debt | null;
  /** Pre-select the source this row was last actually paid from. */
  defaultSource?: string | null;
  onConfirm: ResetConfirm;
}) {
  const [pickerDate, setPickerDate] = useState(item.next_due_date ?? todayISO());
  const [source, setSource] = useState<string>(defaultSource || DEFAULT_OUTGOING_SOURCE);
  const pockets = usePockets();
  const isSub = !!item.is_subscription;
  const base = item.next_due_date ?? todayISO();

  useEffect(() => {
    setPickerDate(item.next_due_date ?? todayISO());
    setSource(defaultSource || DEFAULT_OUTGOING_SOURCE);
  }, [item.id, item.next_due_date, defaultSource]);

  // A pay-later plan drives its own dates — offer the plan's remaining
  // instalments instead of a generic "+1 month / +4 weeks".
  const planDates = useMemo(() => {
    if (linkedDebt?.kind !== "bnpl") return [];
    return (linkedDebt.installment_dates ?? [])
      .slice()
      .sort()
      .filter((d) => d > base);
  }, [linkedDebt, base]);
  const onPlan = linkedDebt?.kind === "bnpl";

  const go = (newDue: string) => void onConfirm(item, newDue, source);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground break-words">
        Marking <span className="font-medium text-foreground">{item.item_name}</span> as paid will
        advance its next {isSub ? "renewal" : "due"} date. Choose how to roll it forward:
      </p>

      <div className="rounded-md border border-border p-3 space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Paid from</Label>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="main">Main balance</SelectItem>
            {(pockets.includes(BILL_POCKET) ? pockets : [BILL_POCKET, ...pockets]).map((p) => (
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
          </SelectContent>
        </Select>
      </div>

      {onPlan ? (
        <div className="space-y-2">
          {planDates.length > 0 ? (
            planDates.slice(0, 3).map((d, i) => (
              <Button
                key={d}
                variant={i === 0 ? "default" : "outline"}
                className="w-full flex-col h-auto py-2"
                onClick={() => go(d)}
              >
                <span className="text-sm">
                  {i === 0 ? "Next payment on the plan" : `Payment ${i + 2} on the plan`}
                </span>
                <span className="text-xs opacity-75">{format(parseISO(d), "d MMM yyyy")}</span>
              </Button>
            ))
          ) : (
            <Button variant="default" className="w-full flex-col h-auto py-2" onClick={() => go(base)}>
              <span className="text-sm">Final payment on this plan</span>
              <span className="text-xs opacity-75">Nothing left to schedule</span>
            </Button>
          )}
          <p className="text-xs text-muted-foreground text-center break-words">
            Dates come from the {linkedDebt?.name} plan on Credit &amp; Debt, so both stay in step.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="flex-col h-auto py-2"
              onClick={() => go(advanceDueDate(base, "monthly"))}
            >
              <span className="text-sm">+1 month</span>
              <span className="text-xs text-muted-foreground">
                {format(parseISO(advanceDueDate(base, "monthly")), "d MMM yyyy")}
              </span>
            </Button>
            <Button
              variant="outline"
              className="flex-col h-auto py-2"
              onClick={() => go(advanceDueDate(base, "four-weekly"))}
            >
              <span className="text-sm">+4 weeks</span>
              <span className="text-xs text-muted-foreground">
                {format(parseISO(advanceDueDate(base, "four-weekly")), "d MMM yyyy")}
              </span>
            </Button>
          </div>
          {item.cadence === "annual" && (
            <Button
              variant="outline"
              className="w-full flex-col h-auto py-2"
              onClick={() => go(advanceForCommitment(base, "annual", cycle))}
            >
              <span className="text-sm">+1 year (annual plan)</span>
              <span className="text-xs text-muted-foreground">
                {format(parseISO(advanceForCommitment(base, "annual", cycle)), "d MMM yyyy")}
              </span>
            </Button>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Global cycle: {cycle.type === "four-weekly" ? "4-weekly" : "monthly"} — pick the cadence
            that matches this row.
          </p>
        </>
      )}

      <div className="rounded-md border border-border p-3 space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Or pick a date
        </Label>
        <div className="flex gap-2">
          <Input type="date" value={pickerDate} onChange={(e) => setPickerDate(e.target.value)} />
          <Button onClick={() => pickerDate && go(pickerDate)}>Set</Button>
        </div>
      </div>
    </div>
  );
}

/** Standalone confirm dialog wrapping `ResetOptions` (used by the dashboard). */
export function ConfirmResetDialog({
  item,
  cycle,
  linkedDebt = null,
  onClose,
  onConfirm,
}: {
  item: Commitment | null;
  cycle: Cycle;
  linkedDebt?: Debt | null;
  onClose: () => void;
  onConfirm: ResetConfirm;
}) {
  return (
    <Dialog
      open={!!item}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent>
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="break-words">Confirm payment reset?</DialogTitle>
            </DialogHeader>
            <ResetOptions
              item={item}
              cycle={cycle}
              linkedDebt={linkedDebt}
              onConfirm={onConfirm}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
