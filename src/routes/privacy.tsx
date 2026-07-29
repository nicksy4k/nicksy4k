import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Ledgerly" },
      { name: "description", content: "How Ledgerly collects, stores, and protects your data during the beta." },
      { property: "og:title", content: "Privacy Policy — Ledgerly" },
      { property: "og:description", content: "How Ledgerly collects, stores, and protects your data during the beta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/auth"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
        </Button>

        <div className="mb-8 flex items-start gap-3">
          <div className="mt-1 h-10 w-10 rounded-xl bg-primary/15 ring-1 ring-primary/30 grid place-items-center">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">Privacy Policy</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">Placeholder</Badge>
              <span className="text-xs text-muted-foreground">Last updated: 29 July 2026</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Ledgerly is currently in beta. This page is a plain-English summary of how the app handles your data
          today and will be replaced with a full policy before a public launch.
        </p>

        <div className="space-y-4">
          <Section title="What we collect">
            <ul>
              <li>Account details you provide at signup: name, display name, email, country, preferred currency, and how you heard about us.</li>
              <li>The financial data you enter yourself: transactions, receipts, incomes, commitments, savings, loans, and debts.</li>
              <li>Basic technical context when you send feedback: app version, current page, and browser user agent.</li>
            </ul>
          </Section>

          <Section title="How it's stored">
            <ul>
              <li>Data is stored in our managed backend (Lovable Cloud, powered by Supabase) with encryption in transit and at rest.</li>
              <li>Row-Level Security policies restrict every table so you can only read or change rows tied to your own account.</li>
              <li>Receipts and feedback attachments are stored in private buckets with the same per-user restrictions.</li>
            </ul>
          </Section>

          <Section title="Third-party services">
            <ul>
              <li>Lovable Cloud / Supabase — hosting, database, storage, authentication.</li>
              <li>Google Sign-In (optional) — only used when you choose "Continue with Google".</li>
              <li>Transactional email — beta feedback notifications are sent from our sending domain.</li>
            </ul>
          </Section>

          <Section title="Your rights">
            <ul>
              <li>Export: Settings → Data → "Download my data" produces a ZIP of your records.</li>
              <li>Deletion: email <a className="text-primary hover:underline" href="mailto:admin@itemizedkeeper.co.uk">admin@itemizedkeeper.co.uk</a> to request account and data deletion.</li>
              <li>Correction: you can edit or remove any record you've entered from within the app.</li>
            </ul>
          </Section>

          <Section title="Contact">
            <p>Questions or concerns? Email <a className="text-primary hover:underline" href="mailto:admin@itemizedkeeper.co.uk">admin@itemizedkeeper.co.uk</a>.</p>
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
      <CardContent className="text-sm text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-primary">
        {children}
      </CardContent>
    </Card>
  );
}
