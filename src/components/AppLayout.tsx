import { Outlet } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useCommitmentRollover } from "@/lib/commitmentRollover";
import { useRecurringIncomeGenerator } from "@/lib/recurringIncome";
import { useCycleCarryover } from "@/lib/carryover";

export function AppLayout() {
  // Master cycle-rollover engine — runs globally on every page mount so it
  // fires the moment a new cycle starts, regardless of which route is open.
  useCommitmentRollover();
  useRecurringIncomeGenerator();
  useCycleCarryover();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-svh w-full">
        <AppSidebar />
        <SidebarInset className="min-h-svh">
          <header className="flex h-14 items-center gap-2 border-b border-border/60 px-4 md:px-6 bg-background/80 backdrop-blur-xl sticky top-0 z-10">
            <SidebarTrigger className="-ml-1.5" />
            <div className="h-6 w-px bg-border/60 mx-1 hidden md:block" />
            <div className="text-sm font-display font-medium text-foreground/90">
              Ledgerly
            </div>
          </header>
          <main className="flex-1 min-w-0 p-4 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>
        <Toaster richColors position="top-right" />
      </div>
    </SidebarProvider>
  );
}
