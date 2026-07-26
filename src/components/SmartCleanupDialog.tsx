import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, ChevronLeft, ChevronRight, Sparkles, Check, EyeOff } from "lucide-react";
import {
  buildFrequency,
  findDuplicateGroups,
  type DuplicateGroup,
  type SimilarityKind,
} from "@/lib/suggestionSimilarity";

type Decision = { hide: Set<number> };

export function SmartCleanupDialog({
  open,
  onOpenChange,
  kind,
  title,
  catalog,
  occurrences,
  onHide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: SimilarityKind;
  title: string;
  /** Currently visible suggestion names (already filtered against hidden). */
  catalog: string[];
  /** All raw occurrences of this name across transactions, for frequency ranking. */
  occurrences: string[];
  /** Hide the given suggestion name from future dropdowns. */
  onHide: (name: string) => void | Promise<void>;
}) {
  const groups: DuplicateGroup[] = useMemo(() => {
    if (!open) return [];
    const freq = buildFrequency(occurrences, kind);
    return findDuplicateGroups(catalog, kind, freq);
  }, [open, catalog, occurrences, kind]);

  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [applying, setApplying] = useState(false);

  // Initialise decisions once groups are known: hide everything except the
  // most-used entry (index 0 — groups are pre-sorted by frequency).
  useEffect(() => {
    if (!open) return;
    setIndex(0);
    const init: Record<number, Decision> = {};
    groups.forEach((g, gi) => {
      const hide = new Set<number>();
      for (let i = 1; i < g.names.length; i++) hide.add(i);
      init[gi] = { hide };
    });
    setDecisions(init);
  }, [open, groups]);

  const total = groups.length;
  const current = groups[index];
  const decision: Decision = decisions[index] ?? { hide: new Set<number>() };

  const totalHide = Object.entries(decisions).reduce((sum, [, d]) => sum + d.hide.size, 0);

  function updateDecision(next: Decision) {
    setDecisions((prev) => ({ ...prev, [index]: next }));
  }

  function toggleRow(i: number) {
    if (!current) return;
    const next = new Set(decision.hide);
    if (next.has(i)) {
      next.delete(i);
    } else {
      // Prevent hiding the last remaining Keep.
      if (next.size >= current.names.length - 1) return;
      next.add(i);
    }
    updateDecision({ hide: next });
  }

  function keepAll() {
    updateDecision({ hide: new Set<number>() });
  }

  async function applyAll() {
    setApplying(true);
    try {
      const seen = new Set<string>();
      let hidden = 0;
      for (const [i, d] of Object.entries(decisions)) {
        const g = groups[Number(i)];
        if (!g) continue;
        for (const k of d.hide) {
          const name = g.names[k];
          if (!name || seen.has(name)) continue;
          seen.add(name);
          await onHide(name);
          hidden += 1;
        }
      }
      if (hidden === 0) {
        toast.message("No changes applied.");
      } else {
        toast.success(`Hidden ${hidden} duplicate ${hidden === 1 ? "entry" : "entries"}`);
      }
      onOpenChange(false);
    } finally {
      setApplying(false);
    }
  }

  const keepCount = current ? current.names.length - decision.hide.size : 0;
  const hideCount = decision.hide.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Smart Cleanup — {title}
          </DialogTitle>
          <DialogDescription>
            Toggle each entry to Keep or Hide. You can hide as many as you like — just leave at least one Keep per group.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs flex gap-2">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            Only hides duplicates from future dropdowns.
            Past transactions, receipts, and history are never modified.
          </p>
        </div>

        {total === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No likely duplicates found. Your suggestions list is clean.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Group {index + 1} of {total}</span>
              <span>{totalHide} will be hidden overall</span>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="text-muted-foreground">
                  Keeping <span className="font-medium text-foreground">{keepCount}</span> · Hiding{" "}
                  <span className="font-medium text-foreground">{hideCount}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={keepAll}
                  disabled={hideCount === 0}
                >
                  Keep all in this group
                </Button>
              </div>

              <ScrollArea className="max-h-64">
                <div className="space-y-1.5 pr-2">
                  {current!.names.map((name, i) => {
                    const isHidden = decision.hide.has(i);
                    const isLastKeep = !isHidden && keepCount === 1;
                    return (
                      <div
                        key={name}
                        className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                          isHidden
                            ? "border-dashed border-border bg-muted/30 opacity-70"
                            : "border-primary/40 bg-primary/5"
                        }`}
                      >
                        <span className={`flex-1 truncate ${isHidden ? "line-through text-muted-foreground" : ""}`} title={name}>
                          {name}
                        </span>
                        <Badge variant="secondary" className="font-normal">
                          {current!.counts[i]}× used
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant={isHidden ? "outline" : "default"}
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => toggleRow(i)}
                          disabled={isLastKeep}
                          title={isLastKeep ? "At least one entry must be kept" : undefined}
                        >
                          {isHidden ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" /> Hidden
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5" /> Keep
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {keepCount === 1 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  At least one entry must remain as Keep in each group.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={total === 0 || index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={total === 0 || index >= total - 1}
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
              Cancel
            </Button>
            <Button onClick={applyAll} disabled={total === 0 || applying}>
              {applying ? "Applying…" : `Finish${totalHide ? ` · hide ${totalHide}` : ""}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
