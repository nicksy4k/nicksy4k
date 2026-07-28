import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";

// TanStack Router escapes literal dots in URL segments with [.], so this file
// serves the path `/.lovable/oauth/consent`.

// The `supabase.auth.oauth.*` namespace is beta; declare a minimal typed
// wrapper so we don't have to grep node_modules.
type AuthorizationDetails = {
  redirect_url?: string;
  redirect_to?: string;
  client?: { name?: string } | null;
  scope?: string;
} | null;

type OAuthResult = {
  data: { redirect_url?: string; redirect_to?: string } | null;
  error: { message: string } | null;
};

type SupabaseOAuth = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

function getOAuth(): SupabaseOAuth {
  return (supabase.auth as unknown as { oauth: SupabaseOAuth }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      // Preserve the consent URL as a same-origin relative path so the user
      // returns here with the same authorization_id after signing in.
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId =
      new URLSearchParams(location.search).get("authorization_id") ?? "";
    const { data, error } = await getOAuth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      // Already approved for this client — bounce straight back to it.
      throw redirect({ href: immediate });
    }
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <p className="text-sm text-muted-foreground">
        Could not load this authorization request:{" "}
        {String((error as Error)?.message ?? error)}
      </p>
    </div>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const oauth = getOAuth();
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <div className="min-h-screen w-full bg-background grid place-items-center px-4 py-10">
      <Card className="w-full max-w-md border-border/60 shadow-xl shadow-black/20">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/15 ring-1 ring-primary/30 grid place-items-center mb-3">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-semibold">
            Connect {clientName} to Ledgerly
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {clientName} will be able to call Ledgerly's tools while you are
            signed in. It will act as you under your normal Row Level Security
            — no other user's data is exposed.
          </p>
          {error && (
            <p className="text-sm text-destructive text-center" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => decide(false)}
            >
              Cancel connection
            </Button>
            <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
              {busy ? "Working…" : "Approve"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            This does not bypass Ledgerly's permissions or backend policies.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
