import { format } from "date-fns";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/format";

export interface OutgoingsSummaryProps {
  cycleStart: Date;
  cycleEnd: Date;
  cycleOverridden?: boolean;
  bills: number;
  subs: number;
  billsCount: number;
  subsCount: number;
  paid: number;
  leftToPay: number;
  everyCycleTotal: number;
  everyCycleCount: number;
  billPocketBalance: number;
}

export function OutgoingsSummary({
  cycleStart,
  cycleEnd,
  cycleOverridden,
  bills,
  subs,
  billsCount,
  subsCount,
  paid,
  leftToPay,
  everyCycleTotal,
  everyCycleCount,
  billPocketBalance,
}: OutgoingsSummaryProps) {
  const total = bills + subs;
  const shortfall = leftToPay - billPocketBalance;

  return (
    <div className="space-y-3 md:space-y-4 mb-5 md:mb-6">
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">

            <Figure
              label="Bills this cycle"
              value={fmt(bills)}
              hint={`${billsCount} tracked`}
              muted
            />
            <Figure
              label="Subscriptions this cycle"
              value={fmt(subs)}
              hint={`${subsCount} tracked`}
              muted
            />
            <Figure label="Total outgoings" value={fmt(total)} hint={`paid ${fmt(paid)}`} accent />
            <Figure
              label="Left to pay"
              value={fmt(leftToPay)}
              hint="Unpaid only"
              destructive={leftToPay > 0.001}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
        <Card className="bg-muted/40">
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0 text-xs text-muted-foreground">

              <p className="text-foreground text-sm font-medium tabular-nums">
                {format(cycleStart, "d MMM")} – {format(cycleEnd, "d MMM yyyy")}
                {cycleOverridden && <span className="ml-2 text-amber-600">· override</span>}
              </p>
              <p className="mt-0.5">
                Every cycle (all tracked): {fmt(everyCycleTotal)} across {everyCycleCount} rows ·
                annual plans spread over 12
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/settings">Change cycle</Link>
            </Button>
          </CardContent>
        </Card>

        <Card
          className={
            shortfall > 0.001
              ? "border-destructive/40 bg-destructive/5"
              : "border-primary/30 bg-primary/5"
          }
        >
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            {shortfall > 0.001 ? (
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            )}
            {shortfall > 0.001 ? (
              <p className="break-words">
                <span className="font-semibold">Shortfall:</span> move{" "}
                <span className="font-semibold tabular-nums">{fmt(shortfall)}</span> into your Bill
                Money pocket to cover what's left.
              </p>
            ) : (
              <p className="break-words">
                <span className="font-semibold">Bill Money is fully funded.</span>{" "}
                <span className="text-muted-foreground">
                  Balance {fmt(billPocketBalance)} · needed {fmt(leftToPay)}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  accent,
  destructive,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  destructive?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 break-words">
        {label}
      </p>
      <p
        className={`text-2xl font-semibold tabular-nums ${
          destructive
            ? "text-destructive"
            : accent
              ? "text-primary"
              : muted
                ? "text-muted-foreground"
                : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1 break-words">{hint}</p>}
    </div>
  );
}
