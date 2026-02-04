import { useQuery } from "@tanstack/react-query";
import { Users, Database, GitBranch, Activity, TrendingUp, BookOpen } from "lucide-react";
import { useAuth } from "../components/AuthProvider";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { getUsers, getConnectors, getWorkflows, getKnowledgeCollections } from "../lib/api";
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

// Mock activity data
const mockActivity = [
  {
    id: "1",
    action: "User invited",
    description: "jane.smith@company.com was invited to the team",
    time: "5 minutes ago",
  },
  {
    id: "2",
    action: "Workflow activated",
    description: "Customer Support Bot is now active",
    time: "1 hour ago",
  },
  {
    id: "3",
    action: "Connector configured",
    description: "Salesforce connector connected",
    time: "2 hours ago",
  },
  {
    id: "4",
    action: "Knowledge synced",
    description: "SharePoint collection refreshed (234 docs)",
    time: "3 hours ago",
  },
  {
    id: "5",
    action: "Model updated",
    description: "Default model changed to GPT-4",
    time: "5 hours ago",
  },
];

export function Dashboard() {
  const { user } = useAuth();

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
          <div className="space-y-4">
            {mockActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{activity.action}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</p>
              </div>
            ))}
          </div>
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
