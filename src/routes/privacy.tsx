import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DESCRIPTION =
  "How Ledgerly collects, stores, secures and deletes your data — written in plain English.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Ledgerly" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Privacy Policy — Ledgerly" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://itemizedkeeper.co.uk/privacy" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://itemizedkeeper.co.uk/privacy" }],
  }),
  component: PrivacyPage,
});

/** Signed-in readers came from Settings; signed-out readers came from the auth screen. */
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

function PrivacyPage() {
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
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">
              Privacy Policy
            </h1>
            <span className="mt-2 block text-xs text-muted-foreground">
              Last updated: 8 August 2026
            </span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Ledgerly is a personal finance tracker built and run by one developer. This policy
          explains exactly what is collected, where it lives, who can reach it, and how to get it
          back or have it deleted.
        </p>

        <div className="space-y-4">
          <Section title="1. Who we are">
            <p>
              Ledgerly is an independent personal project operated by its developer (Nick), based in
              the United Kingdom. For the purposes of UK GDPR, the developer is the data controller
              for the information described below. Contact:{" "}
              <a className="text-primary hover:underline" href="mailto:admin@itemizedkeeper.co.uk">
                admin@itemizedkeeper.co.uk
              </a>
              .
            </p>
          </Section>

          <Section title="2. What we collect">
            <ul>
              <li>
                <strong>Account &amp; profile</strong> — full name, display name, email address,
                country, preferred currency, and how you heard about Ledgerly.
              </li>
              <li>
                <strong>The data you enter</strong> — transactions and their line items, receipt
                images and PDFs, incomes, commitments, subscriptions, savings pockets, loans and
                debts, categories, and your app preferences.
              </li>
              <li>
                <strong>Feedback context</strong> — when you send feedback, the app version, the
                page you were on, and your browser user agent are attached so bugs can be
                reproduced.
              </li>
              <li>
                <strong>Operational records</strong> — sign-in timestamps and diagnostic error logs
                needed to keep the service running.
              </li>
            </ul>
            <p>
              Ledgerly does not connect to your bank and never asks for bank credentials. Everything
              in the app is entered by you or extracted from receipts you upload.
            </p>
          </Section>

          <Section title="3. How your data is stored and secured">
            <ul>
              <li>
                Data is held in a managed backend (Lovable Cloud, powered by Supabase), encrypted in
                transit over HTTPS and encrypted at rest by the provider.
              </li>
              <li>
                Every table carries your user ID and is protected by Row Level Security, so a query
                for anyone else's rows returns nothing — enforced by the database itself, not just
                by app code.
              </li>
              <li>
                Receipts and feedback attachments live in private storage buckets. They are not
                served from public URLs; the app opens them through short-lived signed links.
              </li>
              <li>
                Authentication is handled by the managed identity provider. Ledgerly never stores
                your password.
              </li>
            </ul>
          </Section>

          <Section title="4. What the developer can and cannot see">
            <p>
              Through the Ledgerly app the developer cannot read your financial records — Row Level
              Security blocks that access exactly as it blocks any other user. Administrative
              database tooling does exist, because backups and schema migrations require it, but it
              is not used to browse your records.
            </p>
            <p>
              Your email address and account metadata are visible in the authentication console, as
              they must be for account support.
            </p>
          </Section>

          <Section title="5. Third-party services">
            <ul>
              <li>
                <strong>Lovable Cloud / Supabase</strong> — hosting, database, file storage and
                authentication.
              </li>
              <li>
                <strong>Google Sign-In</strong> — optional, used only if you choose "Continue with
                Google".
              </li>
              <li>
                <strong>Transactional email</strong> — used to send feedback notifications and
                account emails from our sending domain.
              </li>
              <li>
                <strong>AI receipt scanning</strong> — if you use the receipt scanner, the image or
                PDF you upload is sent to an AI provider through the Lovable AI Gateway purely to
                extract the retailer, date, items and totals. It is processed for that request only
                and is not used to train models.
              </li>
            </ul>
            <p>
              The only analytics used is Google Analytics, and it is strictly opt-in — nothing is
              loaded or measured unless you accept the analytics prompt, and you can change your
              mind at any time in Settings › Personalise. When it is on, it records which pages and
              features are used; it never receives your amounts, item names, or anything else you
              have typed into the app. Google's handling of that data is covered by{" "}
              <a
                className="text-primary hover:underline"
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer noopener"
              >
                Google's privacy policy
              </a>
              . No advertising or cross-site tracking scripts are embedded. See the{" "}
              <Link to="/cookies" className="text-primary hover:underline">
                Cookie &amp; Analytics Notice
              </Link>{" "}
              for the detail.
            </p>
          </Section>

          <Section title="6. How long we keep it">
            <p>
              Your records are kept for as long as your account exists. If you ask for deletion,
              your account and its associated rows and files are removed. Because Ledgerly is in
              beta, data may occasionally need to be migrated or reset — see the{" "}
              <Link to="/beta-disclaimer" className="text-primary hover:underline">
                Beta Disclaimer
              </Link>
              .
            </p>
          </Section>

          <Section title="7. Your data rights">
            <ul>
              <li>
                <strong>Export</strong> — Settings → Data → "Download my data" produces a ZIP of
                every record plus your receipt files, at any time.
              </li>
              <li>
                <strong>Correct</strong> — you can edit or remove any record you have entered from
                inside the app.
              </li>
              <li>
                <strong>Erase</strong> — clear all data from Settings, or email us to have the whole
                account and its records deleted.
              </li>
              <li>
                <strong>Access, restrict or object</strong> — email us and we will respond within 30
                days. UK users can also complain to the Information Commissioner's Office.
              </li>
            </ul>
          </Section>

          <Section title="8. Cookies and local storage">
            <p>
              Ledgerly stores your login session and a few interface preferences (theme, currency,
              tutorial progress) in your browser. There are no advertising or cross-site tracking
              cookies. Full detail is in the{" "}
              <Link to="/cookies" className="text-primary hover:underline">
                Cookie &amp; Analytics Notice
              </Link>
              .
            </p>
          </Section>

          <Section title="9. Children">
            <p>
              Ledgerly is not intended for use by anyone under 18, and accounts are not knowingly
              created for children.
            </p>
          </Section>

          <Section title="10. Changes to this policy">
            <p>
              This page is dated at the top and updated whenever how we handle data changes.
              Meaningful changes are also noted in the in-app changelog and the privacy history tab
              in Settings.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              Questions or concerns? Email{" "}
              <a className="text-primary hover:underline" href="mailto:admin@itemizedkeeper.co.uk">
                admin@itemizedkeeper.co.uk
              </a>
              .
            </p>
          </Section>
        </div>

        <Card className="mt-6 border-border/60 bg-muted/30">
          <CardContent className="p-4 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Ledgerly is in active beta. Please also read the{" "}
              <Link to="/beta-disclaimer" className="text-primary hover:underline">
                Beta Disclaimer
              </Link>{" "}
              for what that means for your data and the accuracy of the numbers.
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
