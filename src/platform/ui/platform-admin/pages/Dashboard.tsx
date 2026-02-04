import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Badge } from "../../admin/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { getPlatformDashboardStats, type PlatformDashboardStats } from "../lib/api";
import { cn } from "../lib/utils";

// Mock data for when APIs are not ready
const mockStats: PlatformDashboardStats = {
  totalOrganizations: 47,
  totalUsers: 1248,
  activeOrganizations: 42,
  totalApiCalls30d: 2_450_000,
  revenueThisMonth: 24_500,
  newOrgsThisMonth: 8,
};

const mockRecentOrgs = [
  { id: "1", name: "Acme Corp", tier: "enterprise", users: 156, createdAt: "2 hours ago" },
  { id: "2", name: "TechStart Inc", tier: "pro", users: 23, createdAt: "1 day ago" },
  { id: "3", name: "Global Solutions", tier: "enterprise", users: 89, createdAt: "3 days ago" },
  { id: "4", name: "InnovateLabs", tier: "free", users: 5, createdAt: "5 days ago" },
];

const mockAlerts = [
  {
    id: "1",
    type: "warning",
    message: "High API usage: Acme Corp at 92% of limit",
    time: "10 min ago",
  },
  {
    id: "2",
    type: "info",
    message: "New enterprise signup: Global Finance Ltd",
    time: "2 hours ago",
  },
  {
    id: "3",
    type: "error",
    message: "Payment failed: StartupXYZ subscription",
    time: "5 hours ago",
  },
];

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: string;
    positive: boolean;
  };
}

function StatCard({ title, value, subtitle, icon: Icon, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            {trend.positive ? (
              <ArrowUpRight className="h-3 w-3 text-green-500" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-red-500" />
            )}
            <span className={cn("text-xs", trend.positive ? "text-green-500" : "text-red-500")}>
              {trend.value}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toString();
}

function formatCurrency(num: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function Dashboard() {
  const { data: statsResponse, isLoading } = useQuery({
    queryKey: ["platform-dashboard-stats"],
    queryFn: getPlatformDashboardStats,
    staleTime: 30000,
  });

  const stats = statsResponse?.data ?? mockStats;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Organizations"
          value={stats.totalOrganizations}
          subtitle={`${stats.activeOrganizations} active`}
          icon={Building2}
          trend={{ value: `+${stats.newOrgsThisMonth} this month`, positive: true }}
        />
        <StatCard
          title="Total Users"
          value={formatNumber(stats.totalUsers)}
          icon={Users}
          trend={{ value: "+12% from last month", positive: true }}
        />
        <StatCard
          title="API Calls (30d)"
          value={formatNumber(stats.totalApiCalls30d)}
          subtitle="Across all organizations"
          icon={Activity}
        />
        <StatCard
          title="Revenue (MTD)"
          value={formatCurrency(stats.revenueThisMonth)}
          icon={DollarSign}
          trend={{ value: "+8% from last month", positive: true }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Organizations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Organizations</CardTitle>
              <a
                href="/platform-admin/organizations"
                className="text-sm text-primary hover:underline"
              >
                View all
              </a>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockRecentOrgs.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{org.name}</span>
                      <Badge
                        variant={
                          org.tier === "enterprise"
                            ? "default"
                            : org.tier === "pro"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {org.tier}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{org.users} users</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{org.createdAt}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Platform Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg p-3",
                    alert.type === "error" && "bg-destructive/10",
                    alert.type === "warning" && "bg-yellow-500/10",
                    alert.type === "info" && "bg-primary/10",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 h-2 w-2 rounded-full shrink-0",
                      alert.type === "error" && "bg-destructive",
                      alert.type === "warning" && "bg-yellow-500",
                      alert.type === "info" && "bg-primary",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:bg-secondary/50 transition-colors">
          <CardContent className="flex items-center gap-4 pt-6">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Create Organization</h3>
              <p className="text-sm text-muted-foreground">Add a new customer organization</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-secondary/50 transition-colors">
          <CardContent className="flex items-center gap-4 pt-6">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">View System Logs</h3>
              <p className="text-sm text-muted-foreground">Check platform health and metrics</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-secondary/50 transition-colors">
          <CardContent className="flex items-center gap-4 pt-6">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Usage Analytics</h3>
              <p className="text-sm text-muted-foreground">View platform usage trends</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
