import { format, parseISO } from "date-fns";
import { Check, Repeat, Tag } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fmt } from "@/lib/format";
import type { Commitment } from "@/lib/types";
import { cadenceLabel, hasActivePromo } from "@/lib/subscriptions";

export function OutgoingsList({
  items,
  resetDate,
  fundedMap,
  onSelect,
  emptyLabel,
}: {
  items: Commitment[];
  resetDate: string;
  fundedMap: Record<string, boolean>;
  onSelect: (id: string) => void;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{emptyLabel}</p>;
  }

  const sorted = items
    .slice()
    .sort((a, b) => (a.next_due_date ?? "9999").localeCompare(b.next_due_date ?? "9999"));

  return (
    <TooltipProvider delayDuration={150}>
      <ul className="space-y-2">
        {sorted.map((c) => {
          const dueLabel = c.next_due_date
            ? format(parseISO(c.next_due_date), "d MMM yyyy")
            : "no date";
          const resetLabel = format(parseISO(resetDate), "d MMM yyyy");
          const paidLabel = c.last_paid_date
            ? format(parseISO(c.last_paid_date), "d MMM yyyy")
            : "date unknown";
          const notDueYet = !!c.next_due_date && c.next_due_date >= resetDate;
          let statusTitle: string;
          let statusBody: string;
          if (c.paid) {
            statusTitle = "Paid this cycle";
            statusBody = `Marked paid on ${paidLabel}. Next due ${dueLabel}.`;
          } else if (notDueYet) {
            statusTitle = "Covered — not due this cycle";
            statusBody = `Next due ${dueLabel}, after the current cycle ends on ${resetLabel}.`;
          } else if (fundedMap[c.id]) {
            statusTitle = "Funded by Bill Money";
            statusBody = `Due ${dueLabel} (this cycle). Bill Money currently covers it — mark paid when the charge lands.`;
          } else {
            statusTitle = "Shortfall";
            statusBody = `Due ${dueLabel} (this cycle). Bill Money is exhausted by earlier rows — top up or reprioritise.`;
          }
          const promo = c.is_subscription && hasActivePromo(c);

          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="w-full text-left rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors px-4 py-3 flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">{c.item_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider">
                      {c.category || "—"}
                    </span>
                    {c.is_subscription && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px]">
                        <Repeat className="h-3 w-3" />
                        {cadenceLabel(c.cadence)}
                      </span>
                    )}
                    <span>
                      {c.next_due_date
                        ? `${c.is_subscription ? "Renews" : "Due"} ${dueLabel}`
                        : "No date"}
                    </span>
                    {promo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning px-2 py-0.5 text-[10px]">
                        <Tag className="h-3 w-3" />
                        Offer ends {format(parseISO(c.promo_ends_on!), "d MMM")}
                        {typeof c.standard_price === "number"
                          ? ` — then ${fmt(c.standard_price)}`
                          : ""}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold tabular-nums">{fmt(c.amount)}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        onClick={(e) => e.stopPropagation()}
                        aria-label={statusTitle}
                        className={
                          c.paid
                            ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary"
                            : notDueYet
                              ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/5 text-primary/70 ring-1 ring-primary/25"
                              : `inline-flex h-2.5 w-2.5 rounded-full ${
                                  fundedMap[c.id] ? "bg-yellow-400" : "bg-destructive"
                                }`
                        }
                      >
                        {c.paid || notDueYet ? <Check className="h-4 w-4" /> : null}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p className="font-medium">{statusTitle}</p>
                      <p className="text-xs text-muted-foreground mt-1">{statusBody}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </TooltipProvider>
  );
}

export function OutgoingsLegend() {
  return (
    <div className="mb-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Check className="h-4 w-4" />
        </span>
        <span>Paid this cycle</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/5 text-primary/70 ring-1 ring-primary/25">
          <Check className="h-4 w-4" />
        </span>
        <span>Covered — not due this cycle</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <span>Due this cycle · funded</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
        <span>Due this cycle · shortfall</span>
      </div>
    </div>
  );
}
