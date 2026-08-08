import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowLeft, AlertTriangle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DESCRIPTION =
  "What to expect from Ledgerly during beta: accuracy limits, changing features, backups and liability.";

export const Route = createFileRoute("/beta-disclaimer")({
  head: () => ({
    meta: [
      { title: "Beta Disclaimer — Ledgerly" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Beta Disclaimer — Ledgerly" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://itemizedkeeper.co.uk/beta-disclaimer" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://itemizedkeeper.co.uk/beta-disclaimer" }],
  }),
  component: BetaPage,
});

function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);
  return signedIn;
}

function BetaPage() {
  const signedIn = useSignedIn();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          {signedIn ? (
            <Link to="/settings">
              <ArrowLeft className="h-4 w-4" /> Back to settings
            </Link>
          ) : (
            <Link to="/auth">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          )}
        </Button>

        <div className="mb-8 flex items-start gap-3">
          <div className="mt-1 h-10 w-10 rounded-xl bg-primary/15 ring-1 ring-primary/30 grid place-items-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">
              Beta Disclaimer
            </h1>
            <span className="mt-2 block text-xs text-muted-foreground">
              Last updated: 8 August 2026
            </span>
          </div>
        </div>

        <Card className="border-amber-500/40 bg-amber-500/5 mb-6">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Ledgerly is in <strong className="text-foreground">active beta</strong>. Features,
              layouts, and data structures may change without notice. Some flows are still being
              polished and bugs are expected.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Section title="1. App status and purpose">
            <p>
              Ledgerly is a personal project in active development, currently in its beta testing
              phase. It is designed strictly as a personal tracking tool and should not be relied
              upon for absolute accuracy, as an official financial record, or as a substitute for a
              professional financial manager.
            </p>
            <p>
              Nothing in the app is financial, tax, or legal advice. Do not use Ledgerly as a source
              of truth for tax filings, loan applications, legal disputes, or any decision where
              accuracy matters.
            </p>
          </Section>

          <Section title="2. User input and accuracy">
            <p>
              All data, tracking, and calculations within Ledgerly rely entirely on manual user
              input. We do not guarantee the accuracy of any generated report, cycle figure, or
              pocket balance — they reflect only the information you provide.
            </p>
            <p>
              Automated helpers such as receipt scanning, rollover, and cycle carryover are
              convenience features. Always check the figures they produce before relying on them.
            </p>
          </Section>

          <Section title="3. Beta testing expectations">
            <ul>
              <li>Screens, navigation, and terminology may change between releases.</li>
              <li>Calculations, cycle logic, and rollover behaviour may be revised.</li>
              <li>
                The database structure may change — with best-effort migrations, but no guarantees.
                Data may occasionally need to be migrated, reset, or removed while we iterate.
              </li>
              <li>Features may be added, altered, or removed at any time.</li>
              <li>
                As a beta tester, it is strongly recommended that you use fake or non-critical data
                where possible.
              </li>
            </ul>
          </Section>

          <Section title="4. Data backups and liability">
            <p>
              While your data is stored securely with row-level security, you are advised to keep
              your own personal backups of any important financial information. Settings → Data →
              "Download my data" gives you a complete ZIP at any time.
            </p>
            <p>
              Ledgerly and its developer assume no liability for lost data, calculation errors, or
              financial discrepancies resulting from the use of this software.
            </p>
          </Section>

          <Section title="5. No warranty">
            <p>
              The app is provided "as is" and "as available" during beta, without warranty of any
              kind, express or implied. To the fullest extent permitted by law, the developer is not
              liable for any loss or damage arising from use of the app. Nothing here limits
              liability that cannot be excluded by law.
            </p>
          </Section>

          <Section title="6. Feedback and contact">
            <p>
              Report bugs or share ideas via the in-app feedback button, or email{" "}
              <a className="text-primary hover:underline" href="mailto:admin@itemizedkeeper.co.uk">
                admin@itemizedkeeper.co.uk
              </a>
              .
            </p>
          </Section>
        </div>

        <Card className="mt-6 border-border/60 bg-muted/30">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              For what is collected and how it is protected, see the{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{" "}
              and the{" "}
              <Link to="/cookies" className="text-primary hover:underline">
                Cookie &amp; Analytics Notice
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Ledgerly · Built by Nicksy4K. All rights reserved.
        </p>
      </main>
    </div>
  );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-primary">
        {children}
      </CardContent>
    </Card>
  );
}
