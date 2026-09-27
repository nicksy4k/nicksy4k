import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

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
import { addDaysIso } from "@/lib/delivery";
import type { Transaction } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  onUpdate: (id: string, patch: Partial<Transaction>) => Promise<unknown>;
}

const WINDOW_PRESETS = [
  { label: "48 hours", days: 2 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
];

const todayIso = () => format(new Date(), "yyyy-MM-dd");

/**
 * Marks a parcel as delayed / possibly lost and captures the window in which
 * a claim can be raised (e.g. Vinted's "wait until the 16th, then 48 hours").
 */
export function DelayedClaimDialog({ open, onOpenChange, transaction: t, onUpdate }: Props) {
  const [claimDate, setClaimDate] = useState(t.claim_date ?? todayIso());
  const [claimDeadline, setClaimDeadline] = useState(t.claim_deadline ?? "");
  const [reference, setReference] = useState(t.claim_reference ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClaimDate(t.claim_date ?? todayIso());
    setClaimDeadline(t.claim_deadline ?? "");
    setReference(t.claim_reference ?? "");
  }, [open, t.claim_date, t.claim_deadline, t.claim_reference]);

  const applyPreset = (days: number) => {
    const base = claimDate || todayIso();
    setClaimDeadline(addDaysIso(base, days));
  };

  const save = async () => {
    if (!claimDate) {
      toast.error("Pick the date the claim can be raised");
      return;
    }
    if (claimDeadline && claimDeadline < claimDate) {
      toast.error("The deadline can't be before the claim opens");
      return;
    }
    setBusy(true);
    try {
      await onUpdate(t.id, {
        delivery_status: "delayed_claim",
        claim_date: claimDate,
        claim_deadline: claimDeadline || null,
        claim_reference: reference.trim() || null,
      });
      toast.success("Marked as delayed — we'll remind you when you can claim");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report a delayed parcel</DialogTitle>
          <DialogDescription>
            Set when you can raise a claim and how long you get. It'll appear on your dashboard
            as a reminder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="claim-date">Claim can be raised from</Label>
            <Input
              id="claim-date"
              type="date"
              value={claimDate}
              onChange={(e) => setClaimDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-deadline">Claim deadline</Label>
            <div className="flex flex-wrap gap-2">
              {WINDOW_PRESETS.map((p) => (
                <Button
                  key={p.days}
                  type="button"
                  variant={
                    claimDate && claimDeadline === addDaysIso(claimDate, p.days)
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => applyPreset(p.days)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <Input
              id="claim-deadline"
              type="date"
              value={claimDeadline}
              min={claimDate || undefined}
              onChange={(e) => setClaimDeadline(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Optional, but marketplaces often give you only 48 hours.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-reference">Case or order reference</Label>
            <Input
              id="claim-reference"
              placeholder="Optional"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={save}>
            Save reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
