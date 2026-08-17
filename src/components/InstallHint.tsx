import { useEffect, useState } from "react";
import { Share, X, Download } from "lucide-react";

import { Button } from "@/components/ui/button";

const DISMISS_KEY = "ledgerly.installHint.dismissed";

type Platform = "ios" | "android" | "other";

/**
 * One-time nudge telling the visitor how to install Ledgerly to their home
 * screen. Uses the native install prompt on Chrome/Android when it fires,
 * and falls back to Share-sheet instructions on iOS.
 */
export function InstallHint() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [deferred, setDeferred] = useState<Event | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (dismissed) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Only nudge on phones — desktop users already have the tab open.
    if (window.innerWidth >= 768) return;

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    setPlatform(isIOS ? "ios" : /Android/.test(ua) ? "android" : "other");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS never fires beforeinstallprompt — show the manual hint instead.
    const timer = window.setTimeout(() => setVisible(true), isIOS ? 2500 : 6000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    const p = deferred as unknown as { prompt?: () => Promise<void> } | null;
    if (p?.prompt) await p.prompt();
    dismiss();
  };

  if (!visible) return null;

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
            ) : deferred ? (
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
      {deferred && (
        <Button size="sm" className="mt-3 w-full gap-1.5" onClick={install}>
          <Download className="h-3.5 w-3.5" />
          Install Ledgerly
        </Button>
      )}
    </div>
  );
}
