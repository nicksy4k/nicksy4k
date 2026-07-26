import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Plus,
  Receipt,
  Settings,
  Wallet,
  TrendingUp,
  PiggyBank,
  CalendarClock,
  LogOut,
  CreditCard,
  Archive,
  BarChart3,
  LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type NavItem = {
  to: "/" | "/new" | "/history" | "/income" | "/savings" | "/commitments" | "/credit" | "/archive" | "/reports" | "/settings";
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  accent?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/new", label: "New Spend", icon: Plus, accent: true },
    ],
  },
  {
    label: "Money in",
    items: [
      { to: "/income", label: "Income", icon: TrendingUp },
      { to: "/savings", label: "Savings & Pockets", icon: PiggyBank },
    ],
  },
  {
    label: "Money out",
    items: [
      { to: "/commitments", label: "Commitments", icon: CalendarClock },
      { to: "/credit", label: "Credit & Debt", icon: CreditCard },
      { to: "/history", label: "History", icon: Receipt },
    ],
  },
  {
    label: "Plan & review",
    items: [
      { to: "/reports", label: "Reports", icon: BarChart3 },
      { to: "/archive", label: "Past Cycles", icon: Archive },
    ],
  },
  {
    label: "App",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });

  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  const initial = (email?.[0] ?? "?").toUpperCase();

  const isActive = (path: string, exact?: boolean) =>
    exact ? currentPath === path : currentPath.startsWith(path);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/15 ring-1 ring-primary/30 grid shrink-0 place-items-center">
            <Wallet className="h-4.5 w-4.5 text-primary" strokeWidth={2.25} />
          </div>
          {!collapsed && (
            <div className="leading-tight min-w-0">
              <div className="font-display font-semibold text-base">Ledgerly</div>
              <div className="text-[11px] text-muted-foreground tracking-wide uppercase">
                Expense Tracker
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-1">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            {!collapsed && (
              <SidebarGroupLabel className="px-4 text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/50">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ to, label, icon: Icon, exact, accent }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(to, exact)}
                      className={cn(
                        accent &&
                          !isActive(to, exact) &&
                          "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                        accent && isActive(to, exact) && "bg-primary text-primary-foreground"
                      )}
                      tooltip={collapsed ? label : undefined}
                    >
                      <Link to={to} className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className={cn("flex items-center gap-2.5", collapsed && "flex-col")}>
          <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/15 ring-1 ring-primary/30 grid place-items-center text-xs font-semibold text-primary">
            {initial}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate" title={email ?? ""}>
                  {email ?? "—"}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                onClick={() => supabase.auth.signOut()}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
