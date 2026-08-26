import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Repeat, Tag, Trash2, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fmt } from "@/lib/format";
import type { Commitment, Debt } from "@/lib/types";
import { debtRemaining } from "@/lib/credit";
import { useActiveCycle } from "@/lib/cycle";
import { cadenceLabel } from "@/lib/subscriptions";
import { Row } from "./shared";
import { ResetOptions } from "./ConfirmResetOptions";

export function OutgoingDetailsDialog({
  item,
  cycle,
  linkedDebt = null,
  onClose,
  onEdit,
  onDelete,
  onConfirmReset,
  onUnmarkPaid,
  onToggleType,
  onLogOffer,
}: {
  item: Commitment | null;
  cycle: ReturnType<typeof useActiveCycle>;
  /** Debt this outgoing pays down, when linked. */
  linkedDebt?: Debt | null;
  onClose: () => void;
  onEdit: (c: Commitment) => void;
  onDelete: (id: string) => void;
  onConfirmReset: (c: Commitment, newDue: string) => void | Promise<void>;
  onUnmarkPaid: (c: Commitment) => void | Promise<void>;
  onToggleType: (c: Commitment) => void;
  onLogOffer: (c: Commitment) => void;
}) {
  const [mode, setMode] = useState<"details" | "confirm">("details");

  useEffect(() => {
    if (item) setMode("details");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const isSub = !!item?.is_subscription;

  return (
    <Dialog
      open={!!item}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        {item && mode === "details" && (
          <>
            <DialogHeader>
              <DialogTitle className="break-words pr-6">{item.item_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <Row
                label="Amount"
                value={<span className="font-semibold tabular-nums">{fmt(item.amount)}</span>}
              />
              <Row
                label="Type"
                value={isSub ? `Subscription · ${cadenceLabel(item.cadence)}` : "Bill"}
              />
              <Row label="Category" value={item.category || "—"} />
              <Row label="Store / provider" value={item.store || "—"} />
              <Row label="Payment method" value={item.payment_method || "—"} />
              <Row
                label={isSub ? "Next renewal" : "Next due"}
                value={
                  item.next_due_date ? format(parseISO(item.next_due_date), "d MMM yyyy") : "—"
                }
              />
              <Row
                label="Last paid"
                value={
                  item.last_paid_date ? format(parseISO(item.last_paid_date), "d MMM yyyy") : "—"
                }
              />
              {isSub && item.promo_ends_on && (
                <Row
                  label="Offer"
                  value={
                    <span>
                      Ends {format(parseISO(item.promo_ends_on), "d MMM yyyy")}
                      {typeof item.standard_price === "number"
                        ? ` → ${fmt(item.standard_price)}`
                        : ""}
                    </span>
                  }
                />
              )}
              {linkedDebt && (
                <Row
                  label="Pays down"
                  value={
                    <span>
                      {linkedDebt.name} ·{" "}
                      <span className="tabular-nums">{fmt(debtRemaining(linkedDebt))}</span> left
                    </span>
                  }
                />
              )}
              {item.notes && (
                <Row
                  label="Notes"
                  value={<span className="italic text-muted-foreground">{item.notes}</span>}
                />
              )}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <Label htmlFor="outgoing-paid-toggle">Paid this cycle</Label>
                <Switch
                  id="outgoing-paid-toggle"
                  checked={item.paid}
                  onCheckedChange={(v) => {
                    if (v) {
                      setMode("confirm");
                    } else {
                      void onUnmarkPaid(item);
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
              {isSub && (
                <Button variant="outline" size="sm" onClick={() => onLogOffer(item)}>
                  <Tag className="h-4 w-4" /> Log offer
                </Button>
              )}
              {!(item.debt_id && (linkedDebt?.kind ?? "bnpl") === "bnpl") && (
                <Button variant="outline" size="sm" onClick={() => onToggleType(item)}>
                  {isSub ? (
                    <>
                      <Undo2 className="h-4 w-4" /> Make a bill
                    </>
                  ) : (
                    <>
                      <Repeat className="h-4 w-4" /> Make a subscription
                    </>
                  )}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button size="sm" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}

        {item && mode === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="break-words">Confirm payment reset?</DialogTitle>
            </DialogHeader>
            <ResetOptions item={item} cycle={cycle} onConfirm={onConfirmReset} />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setMode("details")}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
