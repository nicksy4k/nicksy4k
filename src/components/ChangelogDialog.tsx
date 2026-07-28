import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Download, FileDown, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChangelogList } from "@/components/ChangelogList";
import {
  currentVersion,
  downloadChangelogCsv,
  printChangelog,
} from "@/lib/changelog";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  children: ReactNode;
  onOpen?: () => void;
}

/**
 * Renders trigger children as-is. On mobile, tapping navigates to /changelog
 * for a full-screen scrollable view. On desktop, opens a dialog with the same
 * content and export actions.
 */
export function ChangelogDialogTrigger({ children, onOpen }: Props) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <span
        onClick={() => {
          onOpen?.();
          navigate({ to: "/changelog" });
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) onOpen?.();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-6 pb-3 border-b">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle>Ledgerly changelog</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Currently on {currentVersion}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadChangelogCsv}
              >
                <FileDown className="h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={printChangelog}>
                <Printer className="h-4 w-4" /> PDF
              </Button>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 py-5">
          <ChangelogList />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export { downloadChangelogCsv, printChangelog, Download };
