import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowLeft, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/beta-disclaimer")({
  head: () => ({
    meta: [
      { title: "Beta Disclaimer — Ledgerly" },
      { name: "description", content: "Terms and expectations for using Ledgerly during its beta period." },
      { property: "og:title", content: "Beta Disclaimer — Ledgerly" },
      { property: "og:description", content: "Terms and expectations for using Ledgerly during its beta period." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BetaPage,
});

function BetaPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/auth"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
        </Button>

        <div className="mb-8 flex items-start gap-3">
          <div className="mt-1 h-10 w-10 rounded-xl bg-primary/15 ring-1 ring-primary/30 grid place-items-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">Beta Disclaimer</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">Placeholder</Badge>
              <span className="text-xs text-muted-foreground">Last updated: 29 July 2026</span>
            </div>
          </div>
        </div>

        <Card className="border-amber-500/40 bg-amber-500/5 mb-6">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Ledgerly is in <strong className="text-foreground">active beta</strong>. Features, layouts, and data
              structures may change without notice. Some flows are still being polished and bugs are expected.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Section title="Not a financial record">
            <p>
              Ledgerly is a personal tracking tool. It is <strong>not</strong> an accounting system, tax record,
              or professional financial manager. All calculations depend entirely on the data you enter manually
              and may contain errors, omissions, or bugs.
            </p>
            <p>
              Do not rely on Ledgerly as a source of truth for tax filings, loan applications, legal disputes,
              or any decision where accuracy matters.
            </p>
          </Section>

          <Section title="Use test data where possible">
            <p>
              As a beta tester, we strongly recommend using <strong>fake or non-critical data</strong>. Because
              features can change, data may occasionally need to be migrated, reset, or removed while we iterate.
            </p>
          </Section>

          <Section title="What may change">
            <ul>
              <li>Screens, navigation, and terminology.</li>
              <li>Calculations, cycle logic, and rollover behaviour.</li>
              <li>Database structure — with best-effort migrations but no guarantees.</li>
              <li>Features may be added, altered, or removed at any time.</li>
            </ul>
          </Section>

          <Section title="No warranty">
            <p>
              The app is provided "as is" during beta, without warranty of any kind. To the extent permitted by
              law, the developer is not liable for any loss or damage arising from use of the app.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Report bugs or share ideas via the in-app feedback button, or email{" "}
              <a className="text-primary hover:underline" href="mailto:admin@itemizedkeeper.co.uk">admin@itemizedkeeper.co.uk</a>.
            </p>
          </Section>
        </div>
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
