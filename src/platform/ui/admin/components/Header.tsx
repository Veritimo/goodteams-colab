import { Bell, User, LogOut } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { Button } from "./ui/button";

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/users": "Users",
  "/admin/connectors": "Connectors",
  "/admin/workflows": "Workflows",
  "/admin/knowledge-base": "Knowledge Base",
  "/admin/skills": "Skills",
  "/admin/models": "Models",
  "/admin/audit-logs": "Audit Logs",
  "/admin/settings": "Settings",
};

export function Header() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const title = pageTitles[location.pathname] || "Admin";

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <h2 className="text-xl font-semibold">{title}</h2>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
            3
          </span>
        </Button>

        {/* User menu */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium">{user?.name || "Admin User"}</p>
            <p className="text-xs text-muted-foreground">{user?.email || "admin@goodteams.ai"}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-5 w-5" />
          </div>
          <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
