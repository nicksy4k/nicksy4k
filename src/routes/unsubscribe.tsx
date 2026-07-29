import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, MailX } from "lucide-react";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({
    meta: [
      { title: "Unsubscribe — Ledgerly" },
      { name: "description", content: "Manage your Ledgerly email preferences." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UnsubscribePage,
});

type State =
  | { status: "loading" }
  | { status: "invalid"; reason?: string }
  | { status: "confirm" }
  | { status: "submitting" }
  | { status: "already" }
  | { status: "success" }
  | { status: "error"; message: string };

function UnsubscribePage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) {
      setState({ status: "invalid" });
      return;
    }
    setToken(t);
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) return setState({ status: "invalid", reason: body?.error });
        if (body?.valid === false && body?.reason === "already_unsubscribed") {
          return setState({ status: "already" });
        }
        if (body?.valid) return setState({ status: "confirm" });
        setState({ status: "invalid" });
      })
      .catch(() => setState({ status: "invalid" }));
  }, []);

  const confirm = async () => {
    if (!token) return;
    setState({ status: "submitting" });
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (body?.success) return setState({ status: "success" });
      if (body?.reason === "already_unsubscribed") return setState({ status: "already" });
      setState({ status: "error", message: body?.error ?? "Something went wrong." });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Network error.",
      });
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailX className="h-5 w-5 text-primary" /> Email preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {state.status === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your link...
            </div>
          )}
          {state.status === "invalid" && (
            <div className="flex gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>This unsubscribe link is invalid or has expired.</p>
            </div>
          )}
          {state.status === "confirm" && (
            <>
              <p>Click below to unsubscribe from all future Ledgerly emails.</p>
              <Button className="w-full" onClick={confirm}>
                Confirm unsubscribe
              </Button>
            </>
          )}
          {state.status === "submitting" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Processing...
            </div>
          )}
          {state.status === "already" && (
            <div className="flex gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <p>You're already unsubscribed. No further emails will be sent.</p>
            </div>
          )}
          {state.status === "success" && (
            <div className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <p>Done — you've been unsubscribed.</p>
            </div>
          )}
          {state.status === "error" && (
            <div className="flex gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{state.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
