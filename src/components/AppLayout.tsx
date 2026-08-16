import { useEffect } from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { useCommitmentRollover } from "@/lib/commitmentRollover";
import { useRecurringIncomeGenerator } from "@/lib/recurringIncome";
import { useCycleCarryover } from "@/lib/carryover";
import { useOnboardingStatus } from "@/lib/onboarding";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";
import { DemoModeProvider } from "@/lib/demoMode";
import { usePreferences } from "@/lib/preferences";
import { useIsDemoUser } from "@/lib/demoAccount";
import { LegalFooter } from "@/components/LegalFooter";
import { setDemoSession } from "@/lib/analytics";

export function AppLayout() {
  // Master cycle-rollover engine — runs globally on every page mount so it
  // fires the moment a new cycle starts, regardless of which route is open.
  useCommitmentRollover();
  useRecurringIncomeGenerator();
  useCycleCarryover();

  const { prefs } = usePreferences();
  const isDemo = useIsDemoUser();
  const moneyKey = `${prefs.currency}:${prefs.customSymbol}:${prefs.symbolPosition}`;

  useEffect(() => {
    setDemoSession(isDemo);
  }, [isDemo]);

  const { completed } = useOnboardingStatus();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (completed === false && pathname !== "/setup") {
      navigate({ to: "/setup", replace: true });
    }
  }, [completed, pathname, navigate]);

  return (
    <SidebarProvider defaultOpen={true}>
      <DemoModeProvider>
        <TutorialProvider>
          {/* Remount on currency change so every `fmt()` call re-renders. */}
          <div key={moneyKey} className="flex min-h-svh w-full">
            <AppSidebar />
            <SidebarInset className="min-h-svh">
              <header className="flex h-14 items-center gap-2 border-b border-border/60 px-4 md:px-6 bg-background/80 backdrop-blur-xl sticky top-0 z-10">
                <SidebarTrigger className="-ml-1.5" />
                <div className="h-6 w-px bg-border/60 mx-1 hidden md:block" />
                <div className="text-sm font-display font-medium text-foreground/90">Ledgerly</div>
                <div className="ml-auto">
                  <FeedbackDialog defaultType="bug">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      title="Share feedback / report a bug"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Feedback</span>
                    </Button>
                  </FeedbackDialog>
                </div>
              </header>
              {isDemo && (
                <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-600 dark:text-amber-400 md:px-6">
                  <span className="font-medium">Demo sandbox</span> — you're exploring Ledgerly with
                  sample data. Changes here are temporary and reset on the next demo visit.
                </div>
              )}
              <main className="flex-1 min-w-0 p-4 md:p-6">
                <Outlet />
              </main>
              <LegalFooter />
            </SidebarInset>
            <Toaster richColors position="top-right" />
          </div>
        </TutorialProvider>
      </DemoModeProvider>
    </SidebarProvider>
  );
}
