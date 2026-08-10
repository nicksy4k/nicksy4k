import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startDemoSession } from "@/lib/api/demo.functions";
import { trackEvent } from "@/lib/analytics";
import { useQueryClient } from "@tanstack/react-query";

import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrivacyDetailsDialog } from "@/components/PrivacyDetailsDialog";
import { AboutStory } from "@/components/AboutStory";
import { SupportDevCard } from "@/components/SupportDevCard";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

import { FeedbackDialog } from "@/components/FeedbackDialog";
import {
  Wallet,
  Eye,
  EyeOff,
  ShieldCheck,
  PiggyBank,
  CalendarClock,
  ListChecks,
  ArrowRight,
  Sparkles,
  MessageSquare,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import heroAsset from "@/assets/auth-hero.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Ledgerly — Track, budget, and protect your spending" },
      {
        name: "description",
        content:
          "Ledgerly is a personal expense tracker built around your income cycle. Log itemized purchases, attach receipts, track warranties, route income into pockets, and budget with confidence.",
      },
      { property: "og:title", content: "Ledgerly — Track, budget, and protect your spending" },
      {
        property: "og:description",
        content:
          "Ledgerly is a personal expense tracker built around your income cycle. Log itemized purchases, attach receipts, track warranties, route income into pockets, and budget with confidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const features = [
  {
    icon: <ListChecks className="h-5 w-5" />,
    title: "Itemized tracking",
    description: "Log every item, not just a total. See where money actually goes.",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Receipts & warranties",
    description: "Attach receipts and get automatic return-window alerts.",
  },
  {
    icon: <PiggyBank className="h-5 w-5" />,
    title: "Income routing & pockets",
    description: "Auto-route income into sinking funds and keep the rest to spend.",
  },
  {
    icon: <CalendarClock className="h-5 w-5" />,
    title: "Cycle-based budgeting",
    description: "Budget around your pay cycle — monthly or every 4 weeks.",
  },
];

// Read a same-origin relative return path to preserve through sign-in. This
// is what lets the OAuth consent route (`/.lovable/oauth/consent`) resume
// after the user authenticates.
function getReturnPath(): string {
  if (typeof window === "undefined") return "/";
  const search = new URLSearchParams(window.location.search);
  const next = search.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  const path = window.location.pathname;
  if (path && path !== "/auth" && path !== "/" && !path.startsWith("//")) {
    return path + window.location.search;
  }
  return "/";
}

const COUNTRIES = [
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "IE", label: "Ireland" },
  { value: "NZ", label: "New Zealand" },
  { value: "OTHER", label: "Other" },
];

const CURRENCIES = [
  { value: "GBP", label: "GBP £ — British Pound" },
  { value: "USD", label: "USD $ — US Dollar" },
  { value: "EUR", label: "EUR € — Euro" },
  { value: "CAD", label: "CAD $ — Canadian Dollar" },
  { value: "AUD", label: "AUD $ — Australian Dollar" },
  { value: "NZD", label: "NZD $ — New Zealand Dollar" },
  { value: "JPY", label: "JPY ¥ — Japanese Yen" },
  { value: "OTHER", label: "Other" },
];

const HEARD_ABOUT = [
  "Friend or family",
  "Social media",
  "Beta tester group",
  "Search engine",
  "Blog or article",
  "Other",
];

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your name").max(80),
  displayName: z.string().trim().min(2, "Pick a display name").max(40),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(200),
  country: z.string().min(1, "Select your country"),
  currency: z.string().min(1, "Select a currency"),
  heardAbout: z.string().optional(),
  acceptedPrivacy: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Privacy Policy" }),
  }),
  acceptedBeta: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Beta Disclaimer" }),
  }),
});

export function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const beginDemo = useServerFn(startDemoSession);
  const queryClient = useQueryClient();

  // Signup-only state
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("GB");
  const [currency, setCurrency] = useState("GBP");
  const [heardAbout, setHeardAbout] = useState<string>("");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedBeta, setAcceptedBeta] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const returnPath = getReturnPath();
      if (mode === "signup") {
        const parsed = signupSchema.safeParse({
          fullName,
          displayName,
          email,
          password,
          country,
          currency,
          heardAbout: heardAbout || undefined,
          acceptedPrivacy,
          acceptedBeta,
        });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
          return;
        }
        const now = new Date().toISOString();
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}${returnPath}`,
            data: {
              full_name: parsed.data.fullName,
              display_name: parsed.data.displayName,
              country: parsed.data.country,
              currency: parsed.data.currency,
              heard_about: parsed.data.heardAbout ?? "",
              accepted_privacy_at: now,
              accepted_beta_disclaimer_at: now,
            },
          },
        });
        if (error) throw error;
        trackEvent("sign_up", { method: "email" });
        toast.success("Account created. Welcome to Ledgerly.");
      } else {
        if (!email || password.length < 6) {
          toast.error("Enter an email and a password of at least 6 characters.");
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        trackEvent("login", { method: "email" });
        toast.success("Welcome back.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    try {
      const returnPath = getReturnPath();
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}${returnPath}`,
      });
      if (result.error) throw result.error;
      trackEvent("login", { method: "google" });
      toast.success("Signed in with Google.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function startDemo() {
    setDemoLoading(true);
    try {
      const tokens = await beginDemo();
      const { error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (error) throw error;
      // Start from a clean slate: the cached cycle window and any query data
      // from a previous session must not leak into the demo dashboard.
      try {
        localStorage.removeItem("ledgerly.cycle.v2");
      } catch {
        /* storage unavailable */
      }
      queryClient.clear();
      trackEvent("login", { method: "demo" });
      toast.success("Demo sandbox ready — sample data loaded.");
      window.location.assign("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the demo");
      setDemoLoading(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-6 empty:hidden">
        <AnnouncementBanner />
      </div>
      <div className="w-full border-b border-primary/20 bg-primary/5">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 rounded-md bg-primary/15 p-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Ledgerly is in beta — features and design are evolving
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Things may change without notice, some flows are still being polished, and
                occasional bugs are expected. Please share anything you spot — it directly shapes
                what ships next.
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12 lg:py-16">
        <header className="mb-8 flex items-center gap-3 md:mb-12">
          <div className="h-10 w-10 rounded-xl bg-primary/15 ring-1 ring-primary/30 grid place-items-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-display font-semibold tracking-tight">Ledgerly</span>
          <Badge
            variant="outline"
            className="text-xs font-medium px-2 py-0.5 rounded-full bg-card/50 border-border/60 text-muted-foreground"
          >
            Beta
          </Badge>
        </header>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-start">
          <div className="space-y-6 lg:sticky lg:top-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-semibold leading-[1.1] tracking-tight">
                Track, budget, and protect your spending.
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                A personal ledger built around your income cycle. Log every item, attach receipts,
                track warranties, and route income into pockets.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 ring-1 ring-primary/10 shadow-2xl shadow-primary/5">
              <img
                src={heroAsset.url}
                alt="Abstract finance visualization"
                width={1024}
                height={1024}
                className="aspect-square w-full object-cover"
                loading="eager"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
            </div>
          </div>

          <div className="grid gap-4">
            <Card className="border-border/60 shadow-xl shadow-black/20">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto h-12 w-12 rounded-xl bg-primary/15 ring-1 ring-primary/30 grid place-items-center mb-3">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-semibold">
                  {isSignup ? "Create your account" : "Sign in to Ledgerly"}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {isSignup
                    ? "Join the beta — takes under a minute."
                    : "Your finances, private and synced."}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={signInWithGoogle}
                  disabled={googleLoading}
                >
                  <GoogleIcon className="mr-2 h-4 w-4" />
                  {googleLoading ? "Connecting…" : "Continue with Google"}
                </Button>

                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/60" />
                  </div>
                  <span className="relative bg-card px-2 text-xs text-muted-foreground">
                    or email
                  </span>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                  {isSignup && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="fullName">Full name</Label>
                          <Input
                            id="fullName"
                            autoComplete="name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="displayName">Display name</Label>
                          <Input
                            id="displayName"
                            autoComplete="nickname"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={isSignup ? "new-password" : "current-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isSignup && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="country">Country / region</Label>
                          <Select value={country} onValueChange={setCountry}>
                            <SelectTrigger id="country">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {COUNTRIES.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="currency">Main currency</Label>
                          <Select value={currency} onValueChange={setCurrency}>
                            <SelectTrigger id="currency">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {CURRENCIES.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="heardAbout">
                          How did you hear about us?{" "}
                          <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Select value={heardAbout} onValueChange={setHeardAbout}>
                          <SelectTrigger id="heardAbout">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {HEARD_ABOUT.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                        <label className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={acceptedPrivacy}
                            onCheckedChange={(v) => setAcceptedPrivacy(v === true)}
                            className="mt-0.5"
                          />
                          <span className="text-muted-foreground leading-relaxed">
                            I have read and agree to the{" "}
                            <Link
                              to="/privacy"
                              target="_blank"
                              className="text-primary hover:underline"
                            >
                              Privacy Policy
                            </Link>{" "}
                            and{" "}
                            <Link
                              to="/cookies"
                              target="_blank"
                              className="text-primary hover:underline"
                            >
                              Cookie Notice
                            </Link>
                            .
                          </span>

                        </label>
                        <label className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={acceptedBeta}
                            onCheckedChange={(v) => setAcceptedBeta(v === true)}
                            className="mt-0.5"
                          />
                          <span className="text-muted-foreground leading-relaxed">
                            I understand Ledgerly is in beta — features may change, some flows may
                            be incomplete, and I will not rely on it as an official financial
                            record. As a beta tester I'll use fake or non-critical data where
                            possible. See the{" "}
                            <Link
                              to="/beta-disclaimer"
                              target="_blank"
                              className="text-primary hover:underline"
                            >
                              Beta Disclaimer
                            </Link>
                            .
                          </span>
                        </label>
                      </div>
                    </>
                  )}

                  <Button type="submit" className="w-full group" disabled={loading}>
                    {loading ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
                    {!loading && (
                      <ArrowRight className="ml-1 h-4 w-4 opacity-60 group-hover:translate-x-0.5 transition" />
                    )}
                  </Button>
                </form>

                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 space-y-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={startDemo}
                    disabled={demoLoading}
                  >
                    <Compass className="mr-2 h-4 w-4" />
                    {demoLoading ? "Preparing demo…" : "View Demo Account"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Explore Ledgerly with sample data — no signup. The demo sandbox resets on each
                    visit.
                  </p>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  {isSignup ? (
                    <>
                      Already registered?{" "}
                      <button
                        className="text-primary hover:underline"
                        onClick={() => setMode("signin")}
                      >
                        Sign in
                      </button>
                    </>
                  ) : (
                    <>
                      No account?{" "}
                      <button
                        className="text-primary hover:underline"
                        onClick={() => setMode("signup")}
                      >
                        Sign up
                      </button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <FeedbackDialog defaultType="bug" anonymous>
                <Button variant="outline" size="sm">
                  <MessageSquare className="h-3.5 w-3.5" /> Share feedback / report a bug
                </Button>
              </FeedbackDialog>
              <PrivacyDetailsDialog
                trigger={
                  <Button variant="ghost" size="sm">
                    <ShieldCheck className="h-3.5 w-3.5" /> Privacy & security details
                  </Button>
                }
              />
            </div>

            <footer className="text-xs text-muted-foreground text-center text-balance leading-relaxed">
              <p>
                Ledgerly is currently in Beta. Disclaimer: This app is a personal tracking tool and
                should not be relied upon for absolute accuracy or as a professional financial
                manager. All data and calculations rely entirely on manual user input.
              </p>
              <p className="mt-2">
                Privacy & Security: Your financial records are secured with Row Level Security (RLS)
                and encrypted storage, so they are only accessible to you. See our{" "}
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                ,{" "}
                <Link to="/beta-disclaimer" className="text-primary hover:underline">
                  Beta Disclaimer
                </Link>{" "}
                and{" "}
                <Link to="/cookies" className="text-primary hover:underline">
                  Cookie Notice
                </Link>
                .
              </p>
              <p className="mt-2">
                © {new Date().getFullYear()} Ledgerly · Built by Nicksy4K. All rights reserved.
              </p>
            </footer>

          </div>
        </div>

        <section className="mt-12 md:mt-16 grid gap-4 lg:grid-cols-5 lg:gap-6 items-start">
          <AboutStory className="lg:col-span-3" />
          <SupportDevCard className="lg:col-span-2" />
        </section>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-border/60 bg-card/40 backdrop-blur-sm transition hover:border-primary/30 hover:bg-card/60">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M23.766 12.2764c0-.8511-.0762-1.6742-.2183-2.4636H12.2422v4.6606h6.4671c-.2789 1.5079-1.1186 2.7842-2.3804 3.6406v3.0278h3.8551c2.2565-2.0773 3.5562-5.1406 3.5562-8.8654z"
        fill="#4285F4"
      />
      <path
        d="M12.2422 24c3.2186 0 5.9187-1.0678 7.892-2.8942l-3.8551-3.0278c-1.0678.715-2.4339 1.1369-4.0369 1.1369-3.1056 0-5.7353-2.0965-6.6698-4.9187H1.71094v3.126C3.67969 21.324 7.67734 24 12.2422 24z"
        fill="#34A853"
      />
      <path
        d="M5.57242 14.2961c-.2406-.715-.3789-1.4735-.3789-2.2606s.1383-1.5456.3789-2.2606V6.64844H1.71094C.620312 8.81328 0 11.2141 0 13.8355s.620312 5.0222 1.71094 7.1871l3.86148-2.7265z"
        fill="#FBBC05"
      />
      <path
        d="M12.2422 4.75c1.7515 0 3.3256.6031 4.5612 1.7867l3.4211-3.4209C17.1548 1.1604 14.9545 0 12.2422 0 7.67734 0 3.67969 2.676 1.71094 6.64844l3.86148 2.7265c.9345-2.8222 3.5642-4.9187 6.6698-4.9187z"
        fill="#EA4335"
      />
    </svg>
  );
}
