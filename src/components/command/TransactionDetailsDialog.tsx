import { format, parseISO } from "date-fns";
import { ExternalLink, History, Pencil, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/format";
import { deliveryMeta, trackingLink } from "@/lib/delivery";
import type { PaymentSplit, Transaction } from "@/lib/types";

function niceDate(d: string) {
  try {
    return format(parseISO(d), "EEE d MMM yyyy");
  } catch {
    return d;
  }
}

function splitLabel(s: PaymentSplit): string {
  if (s.label) return s.label;
  if (s.source === "main") return "Main";
  if (s.source.startsWith("pocket:")) return `${s.source.slice(7)} pocket`;
  if (s.source.startsWith("bnpl:")) return "Pay later";
  return s.source;
}

/**
 * Read-only receipt view. Nothing here can change data — the user must
 * press Edit to open the editable form, which avoids accidental changes.
 */
export function TransactionDetailsDialog({
  transaction: t,
  onClose,
  onEdit,
  onViewHistory,
  onPrint,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  onEdit: (t: Transaction) => void;
  onViewHistory: (t: Transaction) => void;
  onPrint: (t: Transaction) => void;
}) {
  const refunded = (t?.refunds ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
  const delivery = deliveryMeta(t?.delivery_status);
  const link = t ? trackingLink(t.courier, t.tracking_number) : null;

  return (
    <Dialog open={t !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90svh] overflow-y-auto">
        {t && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {t.retailer || "Untitled"}
                {t.is_pending && <Badge variant="outline">Pending</Badge>}
                {refunded > 0 && <Badge variant="outline">Refunded {fmt(refunded)}</Badge>}
              </DialogTitle>
              <DialogDescription>{niceDate(t.date)} · view only</DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
              <div className="font-display text-3xl font-semibold tabular-nums">
                {fmt(t.total_amount)}
              </div>
            </div>

            {t.items?.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Items
                </h3>
                <ul className="divide-y divide-border/60 rounded-md border border-border/60">
                  {t.items.map((i) => {
                    const qty = i.quantity ?? 1;
                    return (
                      <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium break-words">
                            {i.item_name || "Item"}
                            {qty > 1 && (
                              <span className="text-muted-foreground"> × {qty}</span>
                            )}
                          </div>
                          {i.category && (
                            <div className="text-xs text-muted-foreground">{i.category}</div>
                          )}
                        </div>
                        <div className="text-sm tabular-nums shrink-0">
                          {fmt(i.price * qty)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {(t.payment_splits?.length ?? 0) > 0 && (
              <section className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Paid with
                </h3>
                <p className="text-sm">
                  {t.payment_splits!.map((s) => `${splitLabel(s)} ${fmt(s.amount)}`).join(" · ")}
                </p>
              </section>
            )}

            {delivery && (
              <section className="space-y-1.5">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Delivery
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${delivery.className}`}
                  >
                    {delivery.emoji} {delivery.label}
                  </span>
                  {t.courier && <span className="text-sm text-muted-foreground">{t.courier}</span>}
                </div>
                {link && (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Track {link.tracking} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </section>
            )}

            {(t.notes || t.receipt_attached) && (
              <section className="space-y-1 text-sm">
                {t.receipt_attached && (
                  <p className="text-muted-foreground">
                    Receipt: {t.receipt_type}
                    {t.receipt_location ? ` · ${t.receipt_location}` : ""}
                  </p>
                )}
                {t.notes && <p className="whitespace-pre-wrap">{t.notes}</p>}
              </section>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" size="sm" onClick={() => onPrint(t)}>
                <Printer className="h-4 w-4" /> Print / PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => onViewHistory(t)}>
                <History className="h-4 w-4" /> View in History
              </Button>
              <Button size="sm" onClick={() => onEdit(t)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
