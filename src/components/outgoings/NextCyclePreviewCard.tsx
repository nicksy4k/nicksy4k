import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarRange, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/format";
import type { NextCyclePreview } from "@/lib/outgoings";

const KIND_LABEL = { bill: "Bill", sub: "Subscription", plan: "Plan" } as const;

export function NextCyclePreviewCard({
  startISO,
  endISO,
  preview,
}: {
  startISO: string;
  endISO: string;
  preview: NextCyclePreview;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="mb-5 md:mb-6">
      <CardContent className="p-4 md:p-5 space-y-3">
        <div className="flex items-start gap-3 flex-wrap">
          <CalendarRange className="h-4 w-4 text-primary shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Next cycle preview
            </p>
            <p className="text-sm font-medium tabular-nums">
              {format(parseISO(startISO), "d MMM")} – {format(parseISO(endISO), "d MMM yyyy")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums text-primary">{fmt(preview.total)}</p>
            <p className="text-[11px] text-muted-foreground">
              {preview.items.length} payment{preview.items.length === 1 ? "" : "s"} expected
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <Mini label="Bills" value={preview.bills} />
          <Mini label="Subscriptions" value={preview.subs} />
          <Mini label="Pay-later & debts" value={preview.plans} />
        </div>

        {preview.items.length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${open ? "rotate-180" : ""}`} />
              {open ? "Hide" : "Show"} what's coming
            </Button>
            {open && (
              <ul className="divide-y divide-border rounded-md border">
                {preview.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {format(parseISO(i.date), "d MMM")}
                    </span>
                    <span className="flex-1 min-w-0 truncate">{i.name}</span>
                    <Badge variant="secondary" className="hidden sm:inline-flex">
                      {KIND_LABEL[i.kind]}
                    </Badge>
                    <span className="tabular-nums font-medium">{fmt(i.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <p className="text-[11px] text-muted-foreground">
          Based on today's outgoings and pay-later schedules — new plans show up here straight away.
        </p>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground break-words">{label}</p>
      <p className="text-sm font-medium tabular-nums">{fmt(value)}</p>
    </div>
  );
}
