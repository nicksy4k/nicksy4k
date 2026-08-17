import { useState } from "react";
import { CheckCircle2, Download, Share, SquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInstallPrompt } from "@/lib/pwaInstall";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  label?: string;
};

/**
 * "Install app" control. Fires the native prompt where the browser offers one,
 * and falls back to platform instructions (iOS always needs the Share sheet).
 */
export function InstallAppButton({
  className,
  variant = "default",
  size = "default",
  label = "Install app",
}: Props) {
  const { canPrompt, isStandalone, platform, promptInstall } = useInstallPrompt();
  const [helpOpen, setHelpOpen] = useState(false);

  if (isStandalone) {
    return (
      <p
        className={cn(
          "flex items-center justify-center gap-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <CheckCircle2 className="h-4 w-4 text-primary" />
        Installed — you&apos;re using the app
      </p>
    );
  }

  const handleClick = async () => {
    if (canPrompt) {
      const accepted = await promptInstall();
      if (accepted) return;
      return;
    }
    setHelpOpen(true);
  };

  return (
    <>
      <Button variant={variant} size={size} className={cn("gap-2", className)} onClick={handleClick}>
        <Download className="h-4 w-4 shrink-0" />
        {label}
      </Button>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Ledgerly to your home screen</DialogTitle>
            <DialogDescription>
              It opens full-screen with its own icon — no address bar, no typing the web address.
            </DialogDescription>
          </DialogHeader>

          {platform === "ios" ? (
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  1
                </span>
                <span className="min-w-0">
                  Open Ledgerly in <span className="font-medium">Safari</span> (Chrome on iPhone
                  can&apos;t install apps).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  2
                </span>
                <span className="min-w-0">
                  Tap the <Share className="inline h-4 w-4 align-[-3px]" />{" "}
                  <span className="font-medium">Share</span> button in the toolbar.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  3
                </span>
                <span className="min-w-0">
                  Scroll down and choose <SquarePlus className="inline h-4 w-4 align-[-3px]" />{" "}
                  <span className="font-medium">Add to Home Screen</span>, then tap Add.
                </span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  1
                </span>
                <span className="min-w-0">
                  Open your browser menu ({platform === "android" ? "the ⋮ button" : "⋮ or the icon in the address bar"}).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  2
                </span>
                <span className="min-w-0">
                  Choose <span className="font-medium">Install app</span> or{" "}
                  <span className="font-medium">Add to Home screen</span>.
                </span>
              </li>
            </ol>
          )}

          <p className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            Installing only works on the live site at{" "}
            <span className="font-medium">itemizedkeeper.co.uk</span> — not inside a preview window
            or an in-app browser like Facebook or Instagram.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
