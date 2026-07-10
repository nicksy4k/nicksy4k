import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

/**
 * Minimal per-route error boundary. Keeps the app shell (sidebar + nav)
 * intact so a single failed query on one page doesn't blank the whole app.
 */
export function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <div className="flex justify-center mb-3">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold mb-1">This page didn't load</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {error?.message || "Something went wrong loading this view."}
        </p>
        <Button
          size="sm"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
