import * as React from "react";
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
  className?: string;
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
  className,
  protections: allProtections,
  promos: allPromos,
  deliveryCount,
  onDismiss,
  highlightedId,
  dueSoon: allDueSoon = [],
  pocketBalance = 0,
  dueSoonTotal = 0,
  onMarkPaid,
}: Props) {
  // Snoozed / dismissed rows are filtered out here so every section honours the
  // persisted state stored in the database.
  const { isHidden } = useAlertSnoozes();
  const protections = allProtections.filter((t) => !isHidden(alertKeys.protection(t.id)));
  const promos = allPromos.filter((c) => !isHidden(alertKeys.promo(c.id, c.promo_ends_on)));
  const dueSoon = allDueSoon.filter(
    (r) => !isHidden(alertKeys.due(r.commitment.id, r.commitment.next_due_date)),
  );
  const deliveriesHidden = isHidden(alertKeys.deliveries());
  const deliveries = deliveriesHidden ? 0 : deliveryCount;

  const total = protections.length + promos.length + dueSoon.length + (deliveries > 0 ? 1 : 0);
  if (total === 0) return null;

  return (
    <Card data-tour="warranty-alerts" className={className}>
      <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning/10">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <CardTitle>Needs your attention</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-4 md:p-6">
        {dueSoon.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>Due soon</SectionTitle>
              <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                <Link to="/commitments">View all</Link>
              </Button>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {dueSoon.slice(0, 5).map((row) => (
                <DueRow key={row.commitment.id} row={row} onMarkPaid={onMarkPaid} />
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Bill Money {fmt(pocketBalance)} · {fmt(dueSoonTotal)} due in the next 7 days
            </p>
          </section>
        )}

        {protections.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>Returns &amp; warranties</SectionTitle>
              <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                <Link to="/history" search={{ protection: "all" }}>
                  View all
                </Link>
              </Button>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {protections.slice(0, 6).map((t) => (
                <AlertRow
                  key={t.id}
                  txn={t}
                  onDismiss={() => onDismiss(t.id)}
                  highlighted={highlightedId === t.id}
                />
              ))}
            </ul>
          </section>
        )}

        {promos.length > 0 && (
          <section className="space-y-3">
            <SectionTitle>Subscription offers ending</SectionTitle>
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {promos.slice(0, 3).map((c) => (
                <PromoRow key={c.id} commitment={c} />
              ))}
            </ul>
          </section>
        )}

        {(deliveryCount > 0 || dueSoon.length > 0) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/60 bg-secondary/30 p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>
                Bill Money <span className="font-semibold text-foreground">{fmt(pocketBalance)}</span>
              </span>
              <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-muted-foreground/50" />
              <span>
                <span className="font-semibold text-warning">{fmt(dueSoonTotal)}</span> due in the next 7 days
              </span>
            </div>
            {deliveryCount > 0 && (
              <div className="flex items-center justify-between sm:justify-end gap-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="font-medium tabular-nums">{deliveryCount}</span> order
                    {deliveryCount !== 1 ? "s" : ""} on the way
                  </span>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link to="/history" search={{ delivery: "on_the_way" }}>
                    Track
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
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
      className={`group relative flex flex-row md:flex-col gap-2 md:gap-3 rounded-lg border p-3 transition ${highlighted ? "border-primary/60 bg-primary/10 ring-2 ring-primary/40" : "border-border/60 bg-card/40 hover:border-border"}`}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary/60">
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <div className="min-w-0 md:pr-6">
            <p className="text-sm font-medium truncate">{txn.retailer}</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5 md:hidden">
              <Badge variant="outline" className="font-normal text-[10px] h-4 px-1.5">
                {type}
              </Badge>
              {status === "expired" && (
                <Badge variant="destructive" className="font-normal text-[10px] h-4 px-1.5">
                  Expired
                </Badge>
              )}
            </div>
          </div>
        </div>
        <span
          className={`shrink-0 text-xs font-medium tabular-nums rounded-md border px-2 py-0.5 ${chipClass}`}
        >
          {chipLabel}
        </span>
      </div>

      <p className="hidden md:block text-xs text-muted-foreground truncate">
        {itemSummary} · {fmt(txn.total_amount)} · expires{" "}
        {format(parseISO(txn.expiration_date!), "MMM d")}
      </p>
      <p className="md:hidden flex-1 text-xs text-muted-foreground truncate">
        {itemSummary} · {fmt(txn.total_amount)} · expires{" "}
        {format(parseISO(txn.expiration_date!), "MMM d")}
      </p>

      <div className="flex items-center gap-1 md:absolute md:top-3 md:right-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
      </div>
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
    <li className={`group relative flex flex-row md:flex-col gap-2 md:gap-3 rounded-lg border p-3 ${tone}`}>
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted/40">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium truncate md:pr-6">{c.item_name}</p>
        </div>
        <span
          className={`shrink-0 text-xs font-medium tabular-nums rounded-md border px-2 py-0.5 ${chipClass}`}
        >
          {chipLabel}
        </span>
      </div>
      <p className="hidden md:block text-xs text-muted-foreground truncate">
        {fmt(c.amount)} · due {c.next_due_date ? format(parseISO(c.next_due_date), "d MMM") : "—"}{" "}
        · {fundedLabel}
      </p>
      <p className="md:hidden flex-1 text-xs text-muted-foreground truncate">
        {fmt(c.amount)} · due {c.next_due_date ? format(parseISO(c.next_due_date), "d MMM") : "—"}{" "}
        · {fundedLabel}
      </p>
      {onMarkPaid && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground md:absolute md:top-3 md:right-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          title="Mark paid"
          onClick={() => onMarkPaid(c)}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      )}
    </li>
  );
}

function PromoRow({ commitment: c }: { commitment: Commitment }) {
  const days = daysUntilPromoEnd(c) ?? 0;

  return (
    <li className="group flex flex-row md:flex-col items-center md:items-start justify-between gap-2 rounded-lg border border-border/60 bg-card/40 p-3 hover:border-border transition">
      <div className="flex items-center gap-2 min-w-0">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary/60">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium truncate">{c.item_name}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">
          {days > 0 ? `in ${days}d` : "today"}
        </span>
        <Button asChild size="sm" variant="outline" className="shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <Link to="/commitments" search={{ view: "subs" }}>
            Review
          </Link>
        </Button>
      </div>
    </li>
  );
}
