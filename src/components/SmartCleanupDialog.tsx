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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import {
  buildFrequency,
  findDuplicateGroups,
  type DuplicateGroup,
  type SimilarityKind,
} from "@/lib/suggestionSimilarity";

type Decision =
  | { action: "keep" }
  | { action: "merge"; masterIndex: number };

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

  // Reset on open.
  useEffect(() => {
    if (open) {
      setIndex(0);
      setDecisions({});
    }
  }, [open]);

  const total = groups.length;
  const current = groups[index];
  const decision: Decision = decisions[index] ?? { action: "merge", masterIndex: 0 };

  const hideTally = Object.entries(decisions).reduce((sum, [i, d]) => {
    if (d.action !== "merge") return sum;
    const g = groups[Number(i)];
    return sum + (g ? g.names.length - 1 : 0);
  }, 0);

  function setDecision(next: Decision) {
    setDecisions((prev) => ({ ...prev, [index]: next }));
  }

  async function applyAll() {
    setApplying(true);
    try {
      const seen = new Set<string>();
      let hidden = 0;
      for (const [i, d] of Object.entries(decisions)) {
        if (d.action !== "merge") continue;
        const g = groups[Number(i)];
        if (!g) continue;
        for (let k = 0; k < g.names.length; k++) {
          if (k === d.masterIndex) continue;
          const name = g.names[k];
          if (seen.has(name)) continue;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Smart Cleanup — {title}
          </DialogTitle>
          <DialogDescription>
            Group similar entries and pick one to keep.
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
              <span>{hideTally} will be hidden</span>
            </div>

            <div className="rounded-lg border p-3">
              <RadioGroup
                value={decision.action === "merge" ? `m-${decision.masterIndex}` : "keep"}
                onValueChange={(v) => {
                  if (v === "keep") setDecision({ action: "keep" });
                  else setDecision({ action: "merge", masterIndex: Number(v.slice(2)) });
                }}
                className="space-y-2"
              >
                <ScrollArea className="max-h-56">
                  <div className="space-y-1.5 pr-2">
                    {current!.names.map((name, i) => {
                      const id = `sc-${index}-${i}`;
                      const isMaster =
                        decision.action === "merge" && decision.masterIndex === i;
                      return (
                        <Label
                          key={name}
                          htmlFor={id}
                          className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                            isMaster ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                          }`}
                        >
                          <RadioGroupItem id={id} value={`m-${i}`} />
                          <span className="flex-1 truncate" title={name}>{name}</span>
                          <Badge variant="secondary" className="font-normal">
                            {current!.counts[i]}× used
                          </Badge>
                          {isMaster && (
                            <Badge className="font-normal">Keep</Badge>
                          )}
                        </Label>
                      );
                    })}
                  </div>
                </ScrollArea>

                <div className="mt-3 pt-3 border-t">
                  <Label
                    htmlFor={`sc-${index}-keep`}
                    className="flex items-center gap-3 rounded-md px-1 py-1 cursor-pointer text-sm text-muted-foreground"
                  >
                    <RadioGroupItem id={`sc-${index}-keep`} value="keep" />
                    Keep both — leave this group untouched
                  </Label>
                </div>
              </RadioGroup>
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
              {applying ? "Applying…" : `Finish${hideTally ? ` · hide ${hideTally}` : ""}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
