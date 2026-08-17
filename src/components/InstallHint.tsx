import { useEffect, useState } from "react";
import { Share, X, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/lib/pwaInstall";

const DISMISS_KEY = "ledgerly.installHint.dismissed";

/**
 * One-time nudge telling the visitor how to install Ledgerly to their home
 * screen. Dismissing it is not the end of the road — Settings › Personalise and
 * the mobile More sheet both keep a permanent Install button.
 */
export function InstallHint() {
  const { canPrompt, isStandalone, platform, promptInstall } = useInstallPrompt();
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (dismissed) return;
    // Only nudge on phones — desktop users already have the tab open.
    if (window.innerWidth >= 768) return;
    setAllowed(true);
    const timer = window.setTimeout(() => setReady(true), platform === "ios" ? 2500 : 6000);
    return () => window.clearTimeout(timer);
  }, [platform]);

  const dismiss = () => {
    setAllowed(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    await promptInstall();
    dismiss();
  };

  if (!allowed || isStandalone) return null;
  if (!ready && !canPrompt) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 rounded-2xl border border-border/60 bg-card/95 p-4 shadow-xl backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Add Ledgerly to your home screen</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {platform === "ios" ? (
              <>
                Tap the <Share className="inline h-3 w-3 align-[-2px]" /> Share button in Safari,
                then choose <span className="font-medium">Add to Home Screen</span>.
              </>
            ) : canPrompt ? (
              "Install it once and open it straight from your app icon — no typing the address."
            ) : (
              "Open your browser menu and choose Install app / Add to Home screen."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install hint"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {canPrompt && (
        <Button size="sm" className="mt-3 w-full gap-1.5" onClick={install}>
          <Download className="h-3.5 w-3.5" />
          Install Ledgerly
        </Button>
      )}
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        You can also install later from Settings › Personalise.
      </p>
    </div>
  );
}
