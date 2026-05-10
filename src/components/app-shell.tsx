import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  CreditCard,
  TrendingDown,
  PiggyBank,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Calendar as CalendarIcon,
  BarChart3,
  Printer,
  Wallet2,

} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarIcon },
  { to: "/income", label: "Income", icon: Wallet },
  { to: "/budget", label: "Budget", icon: Wallet2 },
  { to: "/bills", label: "Bills", icon: Receipt },
  { to: "/cards", label: "Credit Cards", icon: CreditCard },
  { to: "/payoff", label: "Payoff Planner", icon: TrendingDown },
  { to: "/savings", label: "Savings", icon: PiggyBank },
  { to: "/charts", label: "Charts", icon: BarChart3 },
  { to: "/report", label: "Report", icon: Printer },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children?: ReactNode }) {
  const { signOut, user } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    nav({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <Brand />
        <NavList currentPath={loc.pathname} onNavigate={() => {}} />
        <SidebarFooter user={user?.email ?? ""} onSignOut={handleSignOut} theme={theme} toggle={toggle} />
      </aside>

      {/* Sidebar — mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col bg-sidebar border-r border-sidebar-border">
            <div className="flex items-center justify-between p-4">
              <Brand />
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>
            <NavList currentPath={loc.pathname} onNavigate={() => setOpen(false)} />
            <SidebarFooter user={user?.email ?? ""} onSignOut={handleSignOut} theme={theme} toggle={toggle} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar — mobile */}
        <header className="md:hidden flex items-center justify-between p-3 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <span className="font-semibold tracking-tight">Ledger</span>
          <Button variant="ghost" size="icon" onClick={toggle}>
            {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
        </header>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-6xl p-4 md:p-8">{children ?? <Outlet />}</div>
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="px-5 pt-6 pb-4 flex items-center gap-2">
      <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-info grid place-items-center text-primary-foreground font-bold">
        L
      </div>
      <span className="font-semibold tracking-tight text-lg">Ledger</span>
    </div>
  );
}

function NavList({ currentPath, onNavigate }: { currentPath: string; onNavigate: () => void }) {
  return (
    <nav className="flex-1 px-3 space-y-1">
      {NAV.map(item => {
        const Icon = item.icon;
        const active = currentPath === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({
  user,
  onSignOut,
  theme,
  toggle,
}: {
  user: string;
  onSignOut: () => void;
  theme: string;
  toggle: () => void;
}) {
  return (
    <div className="p-3 border-t border-sidebar-border space-y-2">
      <div className="px-2 py-1 text-xs text-muted-foreground truncate">{user}</div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={toggle}>
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={onSignOut}>
          <LogOut className="size-4" />
        </Button>
      </div>
    </div>
  );
}
