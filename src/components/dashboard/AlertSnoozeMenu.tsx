import { BellOff, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SNOOZE_OPTIONS, useAlertSnoozes } from "@/lib/alertSnooze";

/**
 * Row-level "hide this alert" menu. Snoozes and dismissals are stored in the
 * database, so they survive a refresh (and follow the user across devices).
 */
export function AlertSnoozeMenu({
  alertKey,
  label,
  className,
}: {
  alertKey: string;
  label: string;
  className?: string;
}) {
  const { snooze, dismissForever, restore } = useAlertSnoozes();

  const undo = () => {
    void restore(alertKey).then(() => toast.success(`${label} is back`));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground ${className ?? ""}`}
          title="Snooze or dismiss"
          aria-label={`Snooze or dismiss ${label}`}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {SNOOZE_OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.days}
            onClick={() => {
              void snooze(alertKey, o.days).then(() =>
                toast.success(`Snoozed ${label} for ${o.days} day${o.days === 1 ? "" : "s"}`, {
                  action: { label: "Undo", onClick: undo },
                }),
              );
            }}
          >
            <BellOff className="h-3.5 w-3.5" />
            {o.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void dismissForever(alertKey).then(() =>
              toast.success(`Dismissed ${label}`, {
                action: { label: "Undo", onClick: undo },
              }),
            );
          }}
        >
          Dismiss — don't show again
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
