import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Plus, Receipt, Settings, Wallet } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type NavItem = { to: "/" | "/new" | "/history" | "/settings"; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/new", label: "Log Transaction", icon: Plus },
  { to: "/history", label: "History", icon: Receipt },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-64 md:min-h-screen border-b md:border-b-0 md:border-r border-sidebar-border bg-sidebar/60 backdrop-blur-xl">
        <div className="p-6 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/15 ring-1 ring-primary/30 grid place-items-center">
            <Wallet className="h-4.5 w-4.5 text-primary" strokeWidth={2.25} />
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold text-base">Ledgerly</div>
            <div className="text-[11px] text-muted-foreground tracking-wide uppercase">Expense Tracker</div>
          </div>
        </div>
        <nav className="px-3 pb-4 md:pb-0 flex md:flex-col gap-1 overflow-x-auto">
          {nav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
