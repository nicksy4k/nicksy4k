import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  BarChart3,
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Receipt,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useIsDemoUser } from "@/lib/demoAccount";
import { QuickAddSheet } from "@/components/QuickAddSheet";
import { InstallAppButton } from "@/components/InstallAppButton";

type Path =
  | "/"
  | "/new"
  | "/history"
  | "/income"
  | "/savings"
  | "/commitments"
  | "/credit"
  | "/archive"
  | "/reports"
  | "/settings";

const moreLinks: Array<{ to: Path; label: string; icon: LucideIcon }> = [
  { to: "/new", label: "Full spend form", icon: Plus },
  { to: "/income", label: "Income", icon: TrendingUp },
  { to: "/savings", label: "Savings & Pockets", icon: PiggyBank },
  { to: "/credit", label: "Credit & Debt", icon: CreditCard },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/archive", label: "Past Cycles", icon: Archive },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Bottom tab bar shown on phones instead of the drawer sidebar. */
export function MobileNav() {
  const isDemo = useIsDemoUser();
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const links = isDemo ? moreLinks.filter((l) => l.to !== "/settings") : moreLinks;
  const isActive = (path: string, exact?: boolean) =>
    exact ? pathname === path : pathname.startsWith(path);

  const tabClass = (active: boolean) =>
    cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors",
      active ? "text-primary" : "text-muted-foreground",
    );

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className="flex items-stretch">
          <Link to="/" className={tabClass(isActive("/", true))}>
            <LayoutDashboard className="h-5 w-5" />
            <span className="truncate">Home</span>
          </Link>
          <Link to="/commitments" className={tabClass(isActive("/commitments"))}>
            <CalendarClock className="h-5 w-5" />
            <span className="truncate">Outgoings</span>
          </Link>

          <div className="flex min-w-0 flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setQuickAdd(true)}
              aria-label="Quick add spend"
              className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition-transform"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </div>

          <Link to="/history" className={tabClass(isActive("/history"))}>
            <Receipt className="h-5 w-5" />
            <span className="truncate">History</span>
          </Link>
          <button type="button" onClick={() => setMoreOpen(true)} className={tabClass(moreOpen)}>
            <MoreHorizontal className="h-5 w-5" />
            <span className="truncate">More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="text-left">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <InstallAppButton className="w-full" variant="secondary" label="Install app" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex min-w-0 items-center gap-2.5 rounded-xl border border-border/60 px-3 py-3 text-sm",
                  isActive(to) && "border-primary/40 bg-primary/10 text-primary",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              supabase.auth.signOut();
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 px-3 py-3 text-sm text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </SheetContent>
      </Sheet>

      <QuickAddSheet open={quickAdd} onOpenChange={setQuickAdd} />
    </>
  );
}
