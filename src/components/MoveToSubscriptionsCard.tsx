import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Repeat, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fmt } from "@/lib/format";
import type { Commitment } from "@/lib/types";
import { unmigratedSubscriptions } from "@/lib/subscriptions";

const DISMISS_KEY = "ledgerly.subscriptions.migrationDismissed";

export function MoveToSubscriptionsCard({
  items,
  update,
}: {
  items: Commitment[];
  update: (id: string, patch: Partial<Commitment>) => Promise<void> | void;
}) {
  const candidates = useMemo(() => unmigratedSubscriptions(items), [items]);
  const [dismissed, setDismissed] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  useEffect(() => {
    setSelected((prev) => {
      const next: Record<string, boolean> = {};
      for (const c of candidates) next[c.id] = prev[c.id] ?? true;
      return next;
    });
  }, [candidates]);

  if (dismissed || candidates.length === 0) return null;

  const chosen = candidates.filter((c) => selected[c.id]);

  async function move() {
    if (chosen.length === 0) return;
    setBusy(true);
    const ids = chosen.map((c) => c.id);
    try {
      for (const c of chosen) {
        await update(c.id, {
          is_subscription: true,
          cadence: c.cadence === "annual" ? "annual" : "monthly",
        });
      }
      toast.success(`Moved ${ids.length} to Subscriptions`, {
        action: {
          label: "Undo",
          onClick: () => {
            void Promise.all(ids.map((id) => update(id, { is_subscription: false })));
          },
        },
      });
    } catch {
      toast.error("Could not move all of them. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <Card className="mb-6 border-primary/30 bg-primary/5">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          <Repeat className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {candidates.length} of your commitments look like subscriptions
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Move them to the Subscriptions page. Amounts, due dates and paid state stay exactly as
              they are, so your totals don't change.
            </p>

            <ul className="mt-3 space-y-1.5">
              {candidates.map((c) => (
                <li key={c.id} className="flex items-center gap-2.5 text-sm">
                  <Checkbox
                    id={`mv-${c.id}`}
                    checked={!!selected[c.id]}
                    onCheckedChange={(v) => setSelected((s) => ({ ...s, [c.id]: v === true }))}
                  />
                  <label htmlFor={`mv-${c.id}`} className="flex-1 min-w-0 truncate cursor-pointer">
                    {c.item_name}
                    <span className="text-muted-foreground"> · {c.store || "—"}</span>
                  </label>
                  <span className="tabular-nums text-muted-foreground">{fmt(c.amount)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={move} disabled={busy || chosen.length === 0}>
                Move {chosen.length} to Subscriptions
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={dismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
