import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Link2, Mail, Info } from "lucide-react";
import { toast } from "sonner";

type Identity = {
  identity_id?: string;
  id: string;
  user_id: string;
  provider: string;
  identity_data?: Record<string, unknown> | null;
  created_at?: string;
  last_sign_in_at?: string;
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.766 12.2764c0-.8511-.0762-1.6742-.2183-2.4636H12.2422v4.6606h6.4671c-.2789 1.5079-1.1186 2.7842-2.3804 3.6406v3.0278h3.8551c2.2565-2.0773 3.5562-5.1406 3.5562-8.8654z" fill="#4285F4" />
      <path d="M12.2422 24c3.2186 0 5.9187-1.0678 7.892-2.8942l-3.8551-3.0278c-1.0678.715-2.4339 1.1369-4.0369 1.1369-3.1056 0-5.7353-2.0965-6.6698-4.9187H1.71094v3.126C3.67969 21.324 7.67734 24 12.2422 24z" fill="#34A853" />
      <path d="M5.57242 14.2961c-.2406-.715-.3789-1.4735-.3789-2.2606s.1383-1.5456.3789-2.2606V6.64844H1.71094C.620312 8.81328 0 11.2141 0 13.8355s.620312 5.0222 1.71094 7.1871l3.86148-2.7265z" fill="#FBBC05" />
      <path d="M12.2422 4.75c1.7515 0 3.3256.6031 4.5612 1.7867l3.4211-3.4209C17.1548 1.1604 14.9545 0 12.2422 0 7.67734 0 3.67969 2.676 1.71094 6.64844l3.86148 2.7265c.9345-2.8222 3.5642-4.9187 6.6698-4.9187z" fill="#EA4335" />
    </svg>
  );
}

export function ConnectedAccountsCard() {
  const [identities, setIdentities] = useState<Identity[] | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) {
      toast.error(error.message);
      setIdentities([]);
      return;
    }
    setIdentities((data?.identities ?? []) as Identity[]);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const google = identities?.find((i) => i.provider === "google");
  const email = identities?.find((i) => i.provider === "email");
  const primaryEmail = (email?.identity_data?.email as string | undefined)
    ?? (google?.identity_data?.email as string | undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" /> Connected sign-in methods
        </CardTitle>
        <CardDescription>
          The ways you can currently sign in to this Ledgerly account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Email row */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><Mail className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-medium">Email &amp; password</p>
              <p className="text-xs text-muted-foreground">
                {email ? (email.identity_data?.email as string | undefined) ?? "Connected" : "Not connected"}
              </p>
            </div>
          </div>
          {email ? <Badge variant="secondary">Connected</Badge> : <Badge variant="outline">Not linked</Badge>}
        </div>

        {/* Google row */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><GoogleIcon className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-medium">Google</p>
              <p className="text-xs text-muted-foreground">
                {google ? (google.identity_data?.email as string | undefined) ?? "Connected" : "Not connected"}
              </p>
            </div>
          </div>
          {google ? <Badge variant="secondary">Connected</Badge> : <Badge variant="outline">Not linked</Badge>}
        </div>

        {!google && (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center gap-2 text-foreground">
              <Info className="h-4 w-4 text-primary" />
              <span className="font-medium">Want to add Google sign-in?</span>
            </div>
            <p>
              Manual account linking isn't available on this hosting plan, but you can still merge
              sign-in methods using a matching email address:
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Sign out of Ledgerly.</li>
              <li>On the sign-in page, choose <span className="font-medium text-foreground">Continue with Google</span>.</li>
              <li>
                Pick the Google account whose email matches
                {primaryEmail ? <> <span className="font-medium text-foreground">{primaryEmail}</span></> : " your Ledgerly email"}.
              </li>
            </ol>
            <p>
              If the emails match and both are verified, Google will attach to this same account.
              If you use a different Google email, it will create a separate account instead.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
