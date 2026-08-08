import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cookie, ArrowLeft, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DESCRIPTION =
  "What Ledgerly stores in your browser: the sign-in session and a few preferences. No advertising cookies, no cross-site tracking.";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie & Analytics Notice — Ledgerly" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Cookie & Analytics Notice — Ledgerly" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://itemizedkeeper.co.uk/cookies" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://itemizedkeeper.co.uk/cookies" }],
  }),
  component: CookiesPage,
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

function CookiesPage() {
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
            <Cookie className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">
              Cookie &amp; Analytics Notice
            </h1>
            <span className="mt-2 block text-xs text-muted-foreground">
              Last updated: 8 August 2026
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <Section title="1. The short version">
            <p>
              Ledgerly sets no advertising cookies, runs no third-party analytics scripts, and does
              no cross-site tracking. The only things kept in your browser are the sign-in session
              and a handful of preferences that make the app usable. Because none of it is used for
              advertising or profiling, there is no consent banner — this page is the notice.
            </p>
          </Section>

          <Section title="2. What's actually stored">
            <ul>
              <li>
                <strong>Sign-in session</strong> — a token issued by the authentication provider and
                held in your browser's local storage so you stay signed in between visits. It
                refreshes while you use the app and is removed when you sign out.
              </li>
              <li>
                <strong>Display preferences</strong> — your theme and currency choices are cached
                locally so the app paints correctly before your profile loads.
              </li>
              <li>
                <strong>Onboarding &amp; tutorial progress</strong> — whether you've completed the
                setup wizard, the guided tour, and which changelog version you last saw, so prompts
                don't reappear.
              </li>
              <li>
                <strong>Cycle &amp; automation markers</strong> — small timestamps recording when
                commitment rollover, recurring income and cycle carryover last ran, so they don't
                run twice in a cycle.
              </li>
              <li>
                <strong>Dismissed notices</strong> — flags for banners and tips you've closed.
              </li>
            </ul>
            <p>
              These are stored on your device, not shared with anyone, and cleared when you clear
              site data.
            </p>
          </Section>

          <Section title="3. Strictly necessary vs optional">
            <p>
              The sign-in session is strictly necessary — without it you cannot stay signed in.
              Everything else is convenience only: remove it and the app still works, it just
              forgets your theme, re-runs the tour, and re-shows notices you had dismissed.
            </p>
          </Section>

          <Section title="4. Analytics and error reporting">
            <p>
              There is no Google Analytics, no advertising pixel, and no behavioural tracking. The
              app does capture unexpected errors (message, page and browser details) so crashes can
              be diagnosed and fixed, and the same technical context is attached when you submit
              feedback. None of it contains advertising identifiers, and it is never sold or shared
              for marketing.
            </p>
          </Section>

          <Section title="5. How to opt out or clear it">
            <ul>
              <li>
                <strong>Sign out</strong> — removes the session token from your browser.
              </li>
              <li>
                <strong>Clear site data</strong> — your browser's privacy settings will wipe all
                Ledgerly local storage for this site. Note this includes the session, so you'll be
                signed out.
              </li>
              <li>
                <strong>Settings → Data</strong> — export a full ZIP of your records, or clear the
                data held in your account.
              </li>
              <li>
                <strong>Block storage</strong> — you can block site storage in your browser
                entirely, but the app then cannot keep you signed in.
              </li>
            </ul>
          </Section>

          <Section title="6. Third parties that may set storage">
            <ul>
              <li>
                <strong>The authentication provider</strong> (Lovable Cloud / Supabase) — issues and
                refreshes the session token described above.
              </li>
              <li>
                <strong>Google Sign-In</strong> — only if you choose "Continue with Google", Google
                may set its own cookies on its own domain as part of that sign-in flow, governed by
                Google's privacy policy.
              </li>
            </ul>
          </Section>

          <Section title="7. Changes and contact">
            <p>
              This page is dated at the top and updated whenever what we store changes. Questions?
              Email{" "}
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
              For the fuller picture, read the{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{" "}
              and the{" "}
              <Link to="/beta-disclaimer" className="text-primary hover:underline">
                Beta Disclaimer
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
