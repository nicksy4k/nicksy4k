import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet,
  Eye,
  EyeOff,
  Receipt,
  ShieldCheck,
  PiggyBank,
  CalendarClock,
  ListChecks,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import heroAsset from "@/assets/auth-hero.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Ledgerly — Track, budget, and protect your spending" },
      { name: "description", content: "Ledgerly is a personal expense tracker built around your income cycle. Log itemized purchases, attach receipts, track warranties, route income into pockets, and budget with confidence." },
      { property: "og:title", content: "Ledgerly — Track, budget, and protect your spending" },
      { property: "og:description", content: "Ledgerly is a personal expense tracker built around your income cycle. Log itemized purchases, attach receipts, track warranties, route income into pockets, and budget with confidence." },
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

export function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || password.length < 6) {
      toast.error("Enter an email and a password of at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
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
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      // If we got here without redirect, the session is already set.
      toast.success("Signed in with Google.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12 lg:py-16">
        <header className="mb-8 flex items-center gap-3 md:mb-12">
          <div className="h-10 w-10 rounded-xl bg-primary/15 ring-1 ring-primary/30 grid place-items-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-display font-semibold tracking-tight">Ledgerly</span>
        </header>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-semibold leading-[1.1] tracking-tight">
                Track, budget, and protect your spending.
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                A personal ledger built around your income cycle. Log every item, attach receipts, track warranties, and route income into pockets.
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
                  {mode === "signin" ? "Sign in to Ledgerly" : "Create your account"}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Your finances, private and synced.
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
                  <span className="relative bg-card px-2 text-xs text-muted-foreground">or email</span>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
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
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
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
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full group" disabled={loading}>
                    {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                    {!loading && <ArrowRight className="ml-1 h-4 w-4 opacity-60 group-hover:translate-x-0.5 transition" />}
                  </Button>
                </form>

                <div className="text-center text-sm text-muted-foreground">
                  {mode === "signin" ? (
                    <>No account?{" "}
                      <button className="text-primary hover:underline" onClick={() => setMode("signup")}>
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>Already registered?{" "}
                      <button className="text-primary hover:underline" onClick={() => setMode("signin")}>
                        Sign in
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
          </div>
        </div>
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
          <div className="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
            {icon}
          </div>
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
      <path d="M23.766 12.2764c0-.8511-.0762-1.6742-.2183-2.4636H12.2422v4.6606h6.4671c-.2789 1.5079-1.1186 2.7842-2.3804 3.6406v3.0278h3.8551c2.2565-2.0773 3.5562-5.1406 3.5562-8.8654z" fill="#4285F4" />
      <path d="M12.2422 24c3.2186 0 5.9187-1.0678 7.892-2.8942l-3.8551-3.0278c-1.0678.715-2.4339 1.1369-4.0369 1.1369-3.1056 0-5.7353-2.0965-6.6698-4.9187H1.71094v3.126C3.67969 21.324 7.67734 24 12.2422 24z" fill="#34A853" />
      <path d="M5.57242 14.2961c-.2406-.715-.3789-1.4735-.3789-2.2606s.1383-1.5456.3789-2.2606V6.64844H1.71094C.620312 8.81328 0 11.2141 0 13.8355s.620312 5.0222 1.71094 7.1871l3.86148-2.7265z" fill="#FBBC05" />
      <path d="M12.2422 4.75c1.7515 0 3.3256.6031 4.5612 1.7867l3.4211-3.4209C17.1548 1.1604 14.9545 0 12.2422 0 7.67734 0 3.67969 2.676 1.71094 6.64844l3.86148 2.7265c.9345-2.8222 3.5642-4.9187 6.6698-4.9187z" fill="#EA4335" />
    </svg>
  );
}
