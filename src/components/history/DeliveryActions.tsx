import { useState } from "react";
import { toast } from "sonner";
import { Check, RotateCcw, Truck } from "lucide-react";

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
import { deliveryMeta, nextDeliverySteps, type DeliveryStatus } from "@/lib/delivery";
import type { Transaction } from "@/lib/types";

interface Props {
  transaction: Transaction;
  onUpdate: (id: string, patch: Partial<Transaction>) => Promise<unknown>;
}

/** One-tap delivery progress buttons, plus a courier/tracking capture dialog. */
export function DeliveryActions({ transaction: t, onUpdate }: Props) {
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [courier, setCourier] = useState(t.courier ?? "");
  const [tracking, setTracking] = useState(t.tracking_number ?? "");
  const [busy, setBusy] = useState(false);

  if (!t.delivery_status) return null;

  const steps = nextDeliverySteps(t.delivery_status);

  const setStatus = async (status: DeliveryStatus, extra?: Partial<Transaction>) => {
    setBusy(true);
    try {
      await onUpdate(t.id, { delivery_status: status, ...extra });
      toast.success(`Marked as ${deliveryMeta(status)!.label.toLowerCase()}`);
      setDispatchOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {t.delivery_status === "awaiting_dispatch" && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            setCourier(t.courier ?? "");
            setTracking(t.tracking_number ?? "");
            setDispatchOpen(true);
          }}
        >
          <Truck className="h-4 w-4" /> Mark dispatched & add tracking
        </Button>
      )}

      {steps
        .filter((s) => !(s === "in_transit" && t.delivery_status === "awaiting_dispatch"))
        .map((s) => (
          <Button
            key={s}
            variant={s === "delivered" ? "default" : "outline"}
            size="sm"
            disabled={busy}
            onClick={() => setStatus(s)}
          >
            {s === "delivered" ? (
              <>
                <Check className="h-4 w-4" /> Received
              </>
            ) : (
              deliveryMeta(s)!.label
            )}
          </Button>
        ))}

      {t.delivery_status === "delivered" && (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setStatus("out_for_delivery")}
        >
          <RotateCcw className="h-4 w-4" /> Reopen
        </Button>
      )}

      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark dispatched</DialogTitle>
            <DialogDescription>
              Add courier and tracking details if you have them — both are optional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dispatch-courier">Courier</Label>
              <Input
                id="dispatch-courier"
                placeholder="e.g. Royal Mail, DPD"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dispatch-tracking">Tracking number</Label>
              <Input
                id="dispatch-tracking"
                placeholder="e.g. JD0002123456789"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDispatchOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                setStatus("in_transit", {
                  courier: courier.trim() || null,
                  tracking_number: tracking.trim() || null,
                })
              }
            >
              Save & mark in transit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
