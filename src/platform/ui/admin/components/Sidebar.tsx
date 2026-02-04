import {
  LayoutDashboard,
  Users,
  Database,
  GitBranch,
  BookOpen,
  Sparkles,
  Brain,
  FileText,
  Settings,
  Building2,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";
import { useAuth } from "./AuthProvider";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/connectors", icon: Database, label: "Connectors" },
  { to: "/admin/workflows", icon: GitBranch, label: "Workflows" },
  { to: "/admin/knowledge-base", icon: BookOpen, label: "Knowledge Base" },
  { to: "/admin/skills", icon: Sparkles, label: "Skills" },
  { to: "/admin/models", icon: Brain, label: "Models" },
  { to: "/admin/audit-logs", icon: FileText, label: "Audit Logs" },
  { to: "/admin/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-sidebar-background">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">
              {user?.organizationName || "Organization"}
            </h1>
            <p className="text-xs text-muted-foreground -mt-1">Admin Panel</p>
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

      {/* Footer - Show Platform Admin link for SUPER_ADMIN */}
      <div className="border-t p-4 space-y-2">
        {user?.role === "SUPER_ADMIN" && (
          <a
            href="/platform-admin"
            className="flex items-center gap-2 text-xs text-primary hover:underline"
          >
            <Settings className="h-3 w-3" />
            Platform Admin
          </a>
        )}
        <p className="text-xs text-muted-foreground">GoodTeams Admin v1.0</p>
      </div>
    </aside>
  );
}
