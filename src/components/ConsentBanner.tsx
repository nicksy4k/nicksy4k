import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalyticsConsent } from "@/lib/analytics";

/**
 * Opt-in consent bar for Google Analytics. Shown only while the visitor
 * hasn't chosen, and only when a measurement ID is actually configured.
 * Declining means the analytics script is never injected.
 */
export function ConsentBanner() {
  const { consent, setConsent, available } = useAnalyticsConsent();

  if (!available || consent !== "unset") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 md:p-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-xl border border-primary/30 bg-background/95 backdrop-blur-xl px-4 py-3 shadow-lg flex flex-col gap-3 sm:flex-row sm:items-center">
        <Cookie className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground min-w-0 flex-1">
          We'd like to use Google Analytics to see which pages and features get used. It's optional
          and off unless you accept — read the{" "}
          <Link to="/cookies" className="text-primary hover:underline">
            Cookie Notice
          </Link>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setConsent("denied")}>
            Decline
          </Button>
          <Button size="sm" onClick={() => setConsent("granted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
