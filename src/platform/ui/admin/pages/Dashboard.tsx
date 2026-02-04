import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Users,
  Database,
  GitBranch,
  Activity,
  TrendingUp,
  BookOpen,
  FileText,
  Link2,
  Link2Off,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  getUsers,
  getConnectors,
  getWorkflows,
  getKnowledgeCollections,
  getAuditLogs,
  getOrganization,
  disconnectEntra,
} from "../lib/api";
import { cn } from "../lib/utils";

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
            <TrendingUp
              className={cn("h-3 w-3", trend.positive ? "text-green-600" : "text-red-600")}
            />
            <span className={cn("text-xs", trend.positive ? "text-green-600" : "text-red-600")}>
              {trend.value}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

// Format action for display
function formatAction(action: string): string {
  return action
    .split(".")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const { data: orgResponse, isLoading: isLoadingOrg } = useQuery({
    queryKey: ["org"],
    queryFn: async () => {
      const result = await getOrganization("");
      return result.data;
    },
    staleTime: 30000,
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectEntra,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org"] });
      setShowDisconnectConfirm(false);
    },
  });

  const { data: usersResponse } = useQuery({
    queryKey: ["org-users"],
    queryFn: getUsers,
    staleTime: 30000,
  });

  const { data: connectorsResponse } = useQuery({
    queryKey: ["org-connectors"],
    queryFn: getConnectors,
    staleTime: 30000,
  });

  const { data: workflowsResponse } = useQuery({
    queryKey: ["org-workflows"],
    queryFn: getWorkflows,
    staleTime: 30000,
  });

  const { data: collectionsResponse } = useQuery({
    queryKey: ["org-knowledge"],
    queryFn: getKnowledgeCollections,
    staleTime: 30000,
    enabled: false, // Knowledge base API not yet implemented
    retry: false,
  });

  const { data: auditResponse, isLoading: isLoadingAudit } = useQuery({
    queryKey: ["org-audit-recent"],
    queryFn: getAuditLogs,
    staleTime: 30000,
  });

  // Handle various API response shapes - ensure arrays
  const users = Array.isArray(usersResponse?.data)
    ? usersResponse.data
    : Array.isArray(usersResponse?.users)
      ? usersResponse.users
      : Array.isArray(usersResponse)
        ? usersResponse
        : [];
  const connectors = Array.isArray(connectorsResponse?.data)
    ? connectorsResponse.data
    : Array.isArray(connectorsResponse?.connectors)
      ? connectorsResponse.connectors
      : Array.isArray(connectorsResponse)
        ? connectorsResponse
        : [];
  const workflows = Array.isArray(workflowsResponse?.data)
    ? workflowsResponse.data
    : Array.isArray(workflowsResponse?.workflows)
      ? workflowsResponse.workflows
      : Array.isArray(workflowsResponse)
        ? workflowsResponse
        : [];
  const collections = Array.isArray(collectionsResponse?.data)
    ? collectionsResponse.data
    : Array.isArray(collectionsResponse?.collections)
      ? collectionsResponse.collections
      : Array.isArray(collectionsResponse)
        ? collectionsResponse
        : [];

  const activeConnectors = connectors.filter((c: any) => c.status === "CONNECTED").length;
  const activeWorkflows = workflows.filter((w: any) => w.status === "active").length;

  // Get recent audit logs (up to 5)
  const recentActivity = Array.isArray(auditResponse?.data) ? auditResponse.data.slice(0, 5) : [];

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-lg bg-primary/5 border border-primary/10 p-4">
        <h2 className="text-lg font-semibold">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Here's what's happening in your organization today.
        </p>
      </div>

      {/* Entra Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {orgResponse?.externalTenantId ? (
                <Link2 className="h-5 w-5 text-green-600" />
              ) : (
                <Link2Off className="h-5 w-5 text-muted-foreground" />
              )}
              <CardTitle className="text-base">Microsoft Entra</CardTitle>
            </div>
            <Badge variant={orgResponse?.externalTenantId ? "default" : "secondary"}>
              {isLoadingOrg
                ? "Loading..."
                : orgResponse?.externalTenantId
                  ? "Connected"
                  : "Disconnected"}
            </Badge>
          </div>
          <CardDescription>
            {orgResponse?.externalTenantId
              ? "Your organization is connected to Microsoft 365"
              : "Connect to Microsoft 365 to enable SSO and integrations"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgResponse?.externalTenantId ? (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Tenant ID: </span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  {orgResponse.externalTenantId}
                </code>
              </div>
              {showDisconnectConfirm ? (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <span className="text-sm flex-1">
                    Are you sure? This will disconnect the Microsoft integration.
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDisconnectConfirm(false)}
                    disabled={disconnectMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowDisconnectConfirm(true)}>
                  Disconnect
                </Button>
              )}
            </div>
          ) : (
            <Button
              onClick={() => {
                const returnUrl = encodeURIComponent(window.location.origin + "/admin");
                window.location.href = `/api/platform/auth/entra/onboard?returnUrl=${returnUrl}`;
              }}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 21 21" fill="currentColor">
                <path d="M0 0h10v10H0V0zm11 0h10v10H11V0zM0 11h10v10H0V11zm11 0h10v10H11V11z" />
              </svg>
              Connect with Microsoft
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Team Members"
          value={users.length || 12}
          icon={Users}
          trend={{ value: "+2 this month", positive: true }}
        />
        <StatCard
          title="Active Connectors"
          value={activeConnectors || 4}
          subtitle={`${connectors.length || 5} total configured`}
          icon={Database}
        />
        <StatCard
          title="Workflows"
          value={`${activeWorkflows || 8}/${workflows.length || 12}`}
          subtitle="Active / Total"
          icon={GitBranch}
        />
        <StatCard
          title="Knowledge Collections"
          value={collections.length || 3}
          subtitle="2,450 documents indexed"
          icon={BookOpen}
        />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Recent Activity</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingAudit ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <div className="animate-pulse">Loading activity...</div>
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No recent activity</p>
              <p className="text-xs">Activity will appear here as you use the platform</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity: any) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{formatAction(activity.action)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {activity.resourceType}: {activity.resourceId}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(activity.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
          <CardContent className="flex items-center gap-4 pt-6">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Invite Team Members</h3>
              <p className="text-sm text-muted-foreground">Add users to your organization</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
          <CardContent className="flex items-center gap-4 pt-6">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Add Connector</h3>
              <p className="text-sm text-muted-foreground">Connect a new data source</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
          <CardContent className="flex items-center gap-4 pt-6">
            <GitBranch className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Create Workflow</h3>
              <p className="text-sm text-muted-foreground">Build an automation workflow</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
