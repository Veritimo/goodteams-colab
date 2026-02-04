import { Bell, LogOut, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { useAuth } from "./AuthProvider";

const pageTitles: Record<string, string> = {
  "/platform-admin": "Platform Dashboard",
  "/platform-admin/organizations": "Organizations",
  "/platform-admin/subscriptions": "Subscriptions",
  "/platform-admin/settings": "Platform Settings",
  "/platform-admin/health": "System Health",
};

export function Header() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const title = pageTitles[location.pathname] || "Platform Admin";

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
            2
          </span>
        </button>

        {/* User menu */}
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">{user?.name || "Admin"}</p>
            <p className="text-xs text-muted-foreground">{user?.email || "admin@goodteams.ai"}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-5 w-5" />
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
}
