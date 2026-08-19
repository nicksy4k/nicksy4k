import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Check, CalendarClock, FileText, Truck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isStoragePath } from "@/components/ReceiptUpload";
import { supabase } from "@/integrations/supabase/client";
import { fmt } from "@/lib/format";
import { protectionStatus, type ProtectionType } from "@/lib/protection";
import { daysUntilPromoEnd } from "@/lib/subscriptions";
import type { DueSoonOutgoing } from "@/lib/outgoings";
import type { Commitment, Transaction } from "@/lib/types";

/**
 * Transactions whose protection needs attention right now:
 * return windows closing within 7 days, warranties within 30 days
 * (both thresholds come from `protectionStatus`), plus anything that
 * expired in the last day. Dismissed rows never show.
 */
export function urgentProtections(items: Transaction[], now: Date = new Date()): Transaction[] {
  return items
    .filter((t) => {
      if (!t.protection_type || !t.expiration_date) return false;
      if (t.dismissed_at) return false;
      const { status, daysLeft } = protectionStatus(
        (t.protection_type as ProtectionType) ?? "Return Window",
        t.expiration_date,
        now,
      );
      if (status === "expired") return daysLeft >= -1;
      return status === "warn";
    })
    .sort(
      (a, b) => parseISO(a.expiration_date!).getTime() - parseISO(b.expiration_date!).getTime(),
    );
}

interface Props {
  protections: Transaction[];
  promos: Commitment[];
  deliveryCount: number;
  onDismiss: (id: string) => void;
  highlightedId?: string | null;
  dueSoon?: DueSoonOutgoing[];
  pocketBalance?: number;
  dueSoonTotal?: number;
  onMarkPaid?: (c: Commitment) => void;
}

export function AttentionCard({
  protections,
  promos,
  deliveryCount,
  onDismiss,
  highlightedId,
  dueSoon = [],
  pocketBalance = 0,
  dueSoonTotal = 0,
  onMarkPaid,
}: Props) {
  const total =
    protections.length + promos.length + dueSoon.length + (deliveryCount > 0 ? 1 : 0);
  if (total === 0) return null;

  return (
    <Card data-tour="warranty-alerts">
      <CardHeader className="flex-row items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <CardTitle>Needs your attention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {dueSoon.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Due soon</p>
              <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                <Link to="/commitments">View all</Link>
              </Button>
            </div>
            <ul className="space-y-2">
              {dueSoon.slice(0, 5).map((row) => (
                <DueRow key={row.commitment.id} row={row} onMarkPaid={onMarkPaid} />
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Bill Money {fmt(pocketBalance)} · {fmt(dueSoonTotal)} due in the next 7 days
            </p>
          </div>
        )}

        {protections.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Returns &amp; warranties
              </p>
              <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                <Link to="/history" search={{ protection: "all" }}>
                  View all
                </Link>
              </Button>
            </div>
            <ul className="space-y-3">
              {protections.slice(0, 6).map((t) => (
                <AlertRow
                  key={t.id}
                  txn={t}
                  onDismiss={() => onDismiss(t.id)}
                  highlighted={highlightedId === t.id}
                />
              ))}
            </ul>
          </div>
        )}

        {promos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Subscription offers ending
            </p>
            <ul className="space-y-1.5">
              {promos.slice(0, 3).map((c) => {
                const days = daysUntilPromoEnd(c) ?? 0;
                return (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {c.item_name}{" "}
                      <span className="text-muted-foreground">
                        · {days > 0 ? `in ${days}d` : "today"}
                      </span>
                    </span>
                    <Button asChild size="sm" variant="outline" className="shrink-0">
                      <Link to="/commitments" search={{ view: "subs" }}>
                        Review
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {deliveryCount > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
            <div className="flex items-center gap-2 min-w-0">
              <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm truncate">
                <span className="font-medium tabular-nums">{deliveryCount}</span> order
                {deliveryCount !== 1 ? "s" : ""} on the way
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link to="/history" search={{ delivery: "on_the_way" }}>
                Track
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertRow({
  txn,
  onDismiss,
  highlighted,
}: {
  txn: Transaction;
  onDismiss: () => void;
  highlighted?: boolean;
}) {
  const type = (txn.protection_type as ProtectionType) ?? "Return Window";
  const { status, daysLeft } = protectionStatus(type, txn.expiration_date!);

  const itemSummary = txn.items.length === 1 ? txn.items[0].item_name : `${txn.items.length} items`;

  const chipClass =
    status === "expired"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : status === "warn"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";

  const chipLabel = status === "expired" ? "Expired" : daysLeft === 0 ? "Today" : `${daysLeft}d`;

  const canOpenReceipt = txn.receipt_attached && isStoragePath(txn.receipt_location);

  async function openReceipt() {
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(txn.receipt_location, 3600);
    if (error || !data) {
      toast.error("Could not open receipt");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <li
      className={`flex items-start gap-2 rounded-lg border p-3 transition ${highlighted ? "border-primary/60 bg-primary/10 ring-2 ring-primary/40" : "border-border/60 bg-card/40"}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate">{txn.retailer}</p>
          <Badge variant="outline" className="font-normal text-[10px] h-4 px-1.5">
            {type}
          </Badge>
          {status === "expired" && (
            <Badge variant="destructive" className="font-normal text-[10px] h-4 px-1.5">
              Expired
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {itemSummary} · {fmt(txn.total_amount)} · expires{" "}
          {format(parseISO(txn.expiration_date!), "MMM d")}
        </p>
      </div>
      <span
        className={`shrink-0 text-xs font-medium tabular-nums rounded-md border px-2 py-0.5 ${chipClass}`}
      >
        {chipLabel}
      </span>
      {canOpenReceipt && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          title="Open receipt"
          onClick={openReceipt}
        >
          <FileText className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        title="Mark handled"
        onClick={onDismiss}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

function DueRow({
  row,
  onMarkPaid,
}: {
  row: DueSoonOutgoing;
  onMarkPaid?: (c: Commitment) => void;
}) {
  const { commitment: c, daysUntil, overdue, funded } = row;

  const tone =
    overdue || funded === "none"
      ? "border-destructive/30 bg-destructive/10"
      : funded === "partial"
        ? "border-amber-500/30 bg-amber-500/10"
        : "border-emerald-500/30 bg-emerald-500/10";

  const chipClass =
    overdue || funded === "none"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : funded === "partial"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";

  const chipLabel = overdue
    ? `${Math.abs(daysUntil)}d late`
    : daysUntil === 0
      ? "Today"
      : `${daysUntil}d`;

  const fundedLabel = overdue
    ? "Overdue"
    : funded === "full"
      ? "Covered by Bill Money"
      : funded === "partial"
        ? "Only part-covered"
        : "Not covered";

  return (
    <li className={`flex items-start gap-2 rounded-lg border p-3 ${tone}`}>
      <CalendarClock className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{c.item_name}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {fmt(c.amount)} · due {c.next_due_date ? format(parseISO(c.next_due_date), "d MMM") : "—"}{" "}
          · {fundedLabel}
        </p>
      </div>
      <span
        className={`shrink-0 text-xs font-medium tabular-nums rounded-md border px-2 py-0.5 ${chipClass}`}
      >
        {chipLabel}
      </span>
      {onMarkPaid && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          title="Mark paid"
          onClick={() => onMarkPaid(c)}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      )}
    </li>
  );
}
