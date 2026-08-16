import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Commitment } from "@/lib/types";
import { Field } from "./shared";

export function PromoOfferDialog({
  item,
  onClose,
  onSave,
}: {
  item: Commitment | null;
  onClose: () => void;
  onSave: (item: Commitment, patch: Partial<Commitment>) => void | Promise<void>;
}) {
  const [price, setPrice] = useState("");
  const [ends, setEnds] = useState("");
  const [standard, setStandard] = useState("");

  useEffect(() => {
    if (!item) return;
    setPrice(String(item.amount));
    setEnds("");
    setStandard(typeof item.standard_price === "number" ? String(item.standard_price) : "");
  }, [item]);

  return (
    <Dialog
      open={!!item}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="break-words pr-6">New offer — {item.item_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="New offer price">
                  <Input
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </Field>
                <Field label="Offer ends on">
                  <Input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
                </Field>
              </div>
              <Field label="Price after this offer">
                <Input
                  inputMode="decimal"
                  value={standard}
                  onChange={(e) => setStandard(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const amt = parseFloat(price);
                  const std = parseFloat(standard);
                  if (!(amt >= 0) || !ends) {
                    toast.error("Enter the new price and the date it ends.");
                    return;
                  }
                  void onSave(item, {
                    amount: amt,
                    promo_price: amt,
                    promo_ends_on: ends,
                    standard_price: std > 0 ? std : null,
                    promo_alert_snoozed_until: null,
                  });
                }}
              >
                Save offer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
