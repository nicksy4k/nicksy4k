import { useEffect, useState } from "react";
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
import type { Commitment } from "@/lib/types";
import { advanceDueDate, advanceForCommitment, useActiveCycle } from "@/lib/cycle";
import { todayISO } from "./shared";

type Cycle = ReturnType<typeof useActiveCycle>;

/**
 * The roll-forward choices shown when marking an outgoing paid.
 * Shared so the Outgoings details dialog and the dashboard alerts card
 * offer exactly the same options and date maths.
 */
export function ResetOptions({
  item,
  cycle,
  onConfirm,
}: {
  item: Commitment;
  cycle: Cycle;
  onConfirm: (c: Commitment, newDue: string) => void | Promise<void>;
}) {
  const [pickerDate, setPickerDate] = useState(item.next_due_date ?? todayISO());
  const isSub = !!item.is_subscription;
  const base = item.next_due_date ?? todayISO();

  useEffect(() => {
    setPickerDate(item.next_due_date ?? todayISO());
  }, [item.id, item.next_due_date]);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground break-words">
        Marking <span className="font-medium text-foreground">{item.item_name}</span> as paid will
        advance its next {isSub ? "renewal" : "due"} date. Choose how to roll it forward:
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="flex-col h-auto py-2"
          onClick={() => void onConfirm(item, advanceDueDate(base, "monthly"))}
        >
          <span className="text-sm">+1 month</span>
          <span className="text-xs text-muted-foreground">
            {format(parseISO(advanceDueDate(base, "monthly")), "d MMM yyyy")}
          </span>
        </Button>
        <Button
          variant="outline"
          className="flex-col h-auto py-2"
          onClick={() => void onConfirm(item, advanceDueDate(base, "four-weekly"))}
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
          onClick={() => void onConfirm(item, advanceForCommitment(base, "annual", cycle))}
        >
          <span className="text-sm">+1 year (annual plan)</span>
          <span className="text-xs text-muted-foreground">
            {format(parseISO(advanceForCommitment(base, "annual", cycle)), "d MMM yyyy")}
          </span>
        </Button>
      )}
      <p className="text-xs text-muted-foreground text-center">
        Global cycle: {cycle.type === "four-weekly" ? "4-weekly" : "monthly"} — pick the cadence that
        matches this row.
      </p>
      <div className="rounded-md border border-border p-3 space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Or pick a date
        </Label>
        <div className="flex gap-2">
          <Input
            type="date"
            value={pickerDate}
            onChange={(e) => setPickerDate(e.target.value)}
          />
          <Button onClick={() => pickerDate && void onConfirm(item, pickerDate)}>Set</Button>
        </div>
      </div>
    </div>
  );
}

/** Standalone confirm dialog wrapping `ResetOptions` (used by the dashboard). */
export function ConfirmResetDialog({
  item,
  cycle,
  onClose,
  onConfirm,
}: {
  item: Commitment | null;
  cycle: Cycle;
  onClose: () => void;
  onConfirm: (c: Commitment, newDue: string) => void | Promise<void>;
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
            <ResetOptions item={item} cycle={cycle} onConfirm={onConfirm} />
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
