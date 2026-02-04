import { LayoutDashboard, Building2, CreditCard, Settings, Activity, Shield } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";

const navItems = [
  { to: "/platform-admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/platform-admin/organizations", icon: Building2, label: "Organizations" },
  { to: "/platform-admin/subscriptions", icon: CreditCard, label: "Subscriptions" },
  { to: "/platform-admin/settings", icon: Settings, label: "Platform Settings" },
  { to: "/platform-admin/health", icon: Activity, label: "System Health" },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar-background">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">GoodTeams</h1>
            <p className="text-xs text-muted-foreground -mt-1">Platform Admin</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50",
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span>Platform Admin v1.0</span>
        </div>
      </div>
    </aside>
  );
}
