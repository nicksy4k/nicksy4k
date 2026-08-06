import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  {
    keys: ["Enter"],
    label: "In Item name: commit and jump to Price. In Price: start the next item.",
  },
  { keys: ["↑", "↓"], label: "Move through suggestions in the item and retailer fields." },
  { keys: ["Esc"], label: "Dismiss the suggestion list, or close this dialog." },
  { keys: ["Tab"], label: "Move to the next field and close any open suggestions." },
  { keys: ["⌘", "Ctrl", "+ Enter"], label: "Save the transaction from anywhere in the form." },
  { keys: ["?"], label: "Open this shortcuts reference." },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Move through the form without touching the mouse.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-start gap-3 py-2.5">
              <span className="flex flex-wrap gap-1 shrink-0 w-32">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
              <span className="text-sm text-muted-foreground">{s.label}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Keyboard-icon button plus the shortcuts dialog. Also opens on "?" when the
 * user isn't typing in a field.
 */
export function ShortcutsHelp({
  className,
  open: openProp,
  onOpenChange,
}: {
  className?: string;
  /** Optional controlled state so a parent can open the dialog from elsewhere. */
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (o: boolean) => {
    setInternalOpen(o);
    onOpenChange?.(o);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);


  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={className}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        onClick={() => setOpen(true)}
      >
        <Keyboard className="h-4 w-4" /> Shortcuts
      </Button>
      <ShortcutsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
