import {
  Activity,
  Server,
  Database,
  Cloud,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Clock,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../admin/components/ui/card";
import { cn } from "../lib/utils";

// Mock health data
const mockHealthData = {
  overall: "healthy" as const,
  lastCheck: "2024-12-03T18:30:00Z",
  services: [
    { name: "API Gateway", status: "up" as const, latencyMs: 45, lastCheck: "30s ago" },
    { name: "PostgreSQL", status: "up" as const, latencyMs: 12, lastCheck: "30s ago" },
    { name: "Redis Cache", status: "up" as const, latencyMs: 3, lastCheck: "30s ago" },
    { name: "Azure OpenAI", status: "up" as const, latencyMs: 234, lastCheck: "30s ago" },
    { name: "Blob Storage", status: "up" as const, latencyMs: 89, lastCheck: "30s ago" },
    { name: "Vector Database", status: "degraded" as const, latencyMs: 456, lastCheck: "30s ago" },
    { name: "Email Service", status: "up" as const, latencyMs: 178, lastCheck: "30s ago" },
    { name: "Auth Service", status: "up" as const, latencyMs: 67, lastCheck: "30s ago" },
  ],
  metrics: {
    totalApiCalls24h: 245_000,
    errorRate24h: 0.12,
    avgLatencyMs: 145,
    activeUsers24h: 1_248,
    p95LatencyMs: 456,
    p99LatencyMs: 890,
  },
  recentIncidents: [
    {
      id: "1",
      severity: "warning" as const,
      title: "Elevated latency on Vector Database",
      time: "2 hours ago",
      status: "investigating" as const,
    },
    {
      id: "2",
      severity: "resolved" as const,
      title: "API Gateway timeout errors",
      time: "1 day ago",
      status: "resolved" as const,
    },
  ],
};

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toString();
}

export function SystemHealth() {
  const [refreshing, setRefreshing] = useState(false);
  const health = mockHealthData;

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const getOverallStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            All Systems Operational
          </Badge>
        );
      case "degraded":
        return (
          <Badge variant="warning" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Degraded Performance
          </Badge>
        );
      case "unhealthy":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            System Issues
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getServiceIcon = (name: string) => {
    if (name.includes("Database") || name.includes("PostgreSQL")) return Database;
    if (name.includes("Azure") || name.includes("Cloud") || name.includes("Blob")) return Cloud;
    return Server;
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case "up":
        return <div className="h-3 w-3 rounded-full bg-green-500" />;
      case "degraded":
        return <div className="h-3 w-3 rounded-full bg-yellow-500 animate-pulse" />;
      case "down":
        return <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />;
      default:
        return <div className="h-3 w-3 rounded-full bg-muted" />;
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return "text-green-500";
    if (latency < 300) return "text-yellow-500";
    return "text-destructive";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">System Health</h1>
          </div>
          {getOverallStatusBadge(health.overall)}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">API Calls (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(health.metrics.totalApiCalls24h)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Error Rate (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                health.metrics.errorRate24h > 1 ? "text-destructive" : "text-green-500",
              )}
            >
              {health.metrics.errorRate24h}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.metrics.avgLatencyMs}ms</div>
            <p className="text-xs text-muted-foreground">
              P95: {health.metrics.p95LatencyMs}ms / P99: {health.metrics.p99LatencyMs}ms
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Users (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(health.metrics.activeUsers24h)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Service Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service Status</CardTitle>
            <CardDescription>Real-time health of platform services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {health.services.map((service) => {
                const Icon = getServiceIcon(service.name);
                return (
                  <div
                    key={service.name}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIndicator(service.status)}
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={getLatencyColor(service.latencyMs)}>
                        {service.latencyMs}ms
                      </span>
                      <span className="text-muted-foreground text-xs">{service.lastCheck}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Incidents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Incidents</CardTitle>
            <CardDescription>Platform incidents and their status</CardDescription>
          </CardHeader>
          <CardContent>
            {health.recentIncidents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recent incidents</p>
              </div>
            ) : (
              <div className="space-y-4">
                {health.recentIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className={cn(
                      "rounded-lg p-4",
                      incident.severity === "warning" &&
                        "bg-yellow-500/10 border border-yellow-500/20",
                      incident.severity === "resolved" && "bg-muted border border-border",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {incident.severity === "warning" && (
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          )}
                          {incident.severity === "resolved" && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          <span className="font-medium">{incident.title}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {incident.time}
                        </div>
                      </div>
                      <Badge variant={incident.status === "resolved" ? "success" : "warning"}>
                        {incident.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Uptime Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uptime Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { period: "Today", uptime: "100%" },
              { period: "Last 7 days", uptime: "99.98%" },
              { period: "Last 30 days", uptime: "99.95%" },
              { period: "Last 90 days", uptime: "99.92%" },
            ].map((item) => (
              <div key={item.period} className="text-center">
                <p className="text-sm text-muted-foreground">{item.period}</p>
                <p className="text-2xl font-bold text-green-500">{item.uptime}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
