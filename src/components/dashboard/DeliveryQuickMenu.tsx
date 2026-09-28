import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DelayedClaimDialog } from "@/components/history/DelayedClaimDialog";
import { deliveryMeta, type DeliveryStatus } from "@/lib/delivery";
import type { Transaction } from "@/lib/types";

const OPTIONS: DeliveryStatus[] = ["awaiting_dispatch", "in_transit", "out_for_delivery", "delivered"];

/** Compact status changer + "report delayed" for parcels on the dashboard. */
export function DeliveryQuickMenu({
  txn,
  onUpdate,
}: {
  txn: Transaction;
  onUpdate: (id: string, patch: Partial<Transaction>) => Promise<unknown>;
}) {
  const [claimOpen, setClaimOpen] = useState(false);
  const delayed = txn.delivery_status === "delayed_claim";

  const setStatus = async (status: DeliveryStatus) => {
    try {
      await onUpdate(txn.id, {
        delivery_status: status,
        claim_date: null,
        claim_deadline: null,
        claim_reference: null,
      });
      toast.success(`Marked as ${deliveryMeta(status)!.label.toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the order");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8" aria-label={`Change status for ${txn.retailer}`}>
            Status <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Delivery status</DropdownMenuLabel>
          {OPTIONS.filter((s) => s !== txn.delivery_status).map((s) => (
            <DropdownMenuItem key={s} onSelect={() => void setStatus(s)}>
              {deliveryMeta(s)!.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setClaimOpen(true)}>
            <AlertTriangle className="h-4 w-4" />
            {delayed ? "Edit claim details" : "Report delayed / lost"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DelayedClaimDialog open={claimOpen} onOpenChange={setClaimOpen} transaction={txn} onUpdate={onUpdate} />
    </>
  );
}
