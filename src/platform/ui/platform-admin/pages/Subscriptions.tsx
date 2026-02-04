import { CreditCard, Building2, AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../admin/components/ui/table";
import { cn } from "../lib/utils";

// Mock subscription data
const mockSubscriptions = [
  {
    id: "1",
    organizationId: "1",
    organizationName: "Acme Corporation",
    tier: "enterprise" as const,
    status: "active" as const,
    currentPeriodStart: "2024-12-01",
    currentPeriodEnd: "2025-01-01",
    monthlyApiCalls: 1_850_000,
    apiCallLimit: 2_000_000,
    monthlyPrice: 999,
  },
  {
    id: "2",
    organizationId: "2",
    organizationName: "TechStart Inc",
    tier: "pro" as const,
    status: "active" as const,
    currentPeriodStart: "2024-12-15",
    currentPeriodEnd: "2025-01-15",
    monthlyApiCalls: 45_000,
    apiCallLimit: 100_000,
    monthlyPrice: 99,
  },
  {
    id: "3",
    organizationId: "3",
    organizationName: "Global Solutions Ltd",
    tier: "enterprise" as const,
    status: "active" as const,
    currentPeriodStart: "2024-11-20",
    currentPeriodEnd: "2024-12-20",
    monthlyApiCalls: 890_000,
    apiCallLimit: 2_000_000,
    monthlyPrice: 999,
  },
  {
    id: "4",
    organizationId: "4",
    organizationName: "InnovateLabs",
    tier: "free" as const,
    status: "active" as const,
    currentPeriodStart: "2024-12-01",
    currentPeriodEnd: "2025-01-01",
    monthlyApiCalls: 8_500,
    apiCallLimit: 10_000,
    monthlyPrice: 0,
  },
  {
    id: "5",
    organizationId: "5",
    organizationName: "StartupXYZ",
    tier: "pro" as const,
    status: "past_due" as const,
    currentPeriodStart: "2024-11-10",
    currentPeriodEnd: "2024-12-10",
    monthlyApiCalls: 0,
    apiCallLimit: 100_000,
    monthlyPrice: 99,
  },
];

const planDetails = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    features: ["10K API calls/month", "1 connector", "Community support"],
  },
  {
    tier: "pro",
    name: "Pro",
    price: 99,
    features: ["100K API calls/month", "5 connectors", "Email support", "Custom workflows"],
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    price: 999,
    features: [
      "2M API calls/month",
      "Unlimited connectors",
      "Priority support",
      "SSO/SAML",
      "Custom models",
    ],
  },
];

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

export function Subscriptions() {
  const [loading] = useState(false);

  const totalMRR = mockSubscriptions.reduce((sum, sub) => sum + sub.monthlyPrice, 0);
  const activeCount = mockSubscriptions.filter((s) => s.status === "active").length;
  const pastDueCount = mockSubscriptions.filter((s) => s.status === "past_due").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Active
          </Badge>
        );
      case "past_due":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Past Due
          </Badge>
        );
      case "canceled":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Canceled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "enterprise":
        return <Badge variant="default">Enterprise</Badge>;
      case "pro":
        return <Badge variant="secondary">Pro</Badge>;
      case "free":
        return <Badge variant="outline">Free</Badge>;
      default:
        return <Badge variant="outline">{tier}</Badge>;
    }
  };

  const getUsagePercent = (used: number, limit: number) => {
    return Math.round((used / limit) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Subscriptions</h1>
        </div>
        <Button variant="outline" size="sm" disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMRR)}</div>
            <p className="text-xs text-muted-foreground">
              from {mockSubscriptions.length} subscriptions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{activeCount}</div>
            <p className="text-xs text-muted-foreground">of {mockSubscriptions.length} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Attention Needed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{pastDueCount}</div>
            <p className="text-xs text-muted-foreground">past due subscriptions</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {planDetails.map((plan) => (
              <div
                key={plan.tier}
                className={cn(
                  "rounded-lg border p-4",
                  plan.tier === "enterprise" && "border-primary",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{plan.name}</h3>
                  {getTierBadge(plan.tier)}
                </div>
                <div className="text-2xl font-bold mb-4">
                  {plan.price === 0 ? "Free" : `${formatCurrency(plan.price)}/mo`}
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>API Usage</TableHead>
                <TableHead>Billing Period</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockSubscriptions.map((sub) => {
                const usagePercent = getUsagePercent(sub.monthlyApiCalls, sub.apiCallLimit);
                return (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{sub.organizationName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getTierBadge(sub.tier)}</TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>
                            {formatNumber(sub.monthlyApiCalls)} / {formatNumber(sub.apiCallLimit)}
                          </span>
                          <span
                            className={cn(
                              "text-xs",
                              usagePercent > 90 && "text-destructive",
                              usagePercent > 75 && usagePercent <= 90 && "text-yellow-500",
                            )}
                          >
                            {usagePercent}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all",
                              usagePercent > 90
                                ? "bg-destructive"
                                : usagePercent > 75
                                  ? "bg-yellow-500"
                                  : "bg-primary",
                            )}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sub.currentPeriodStart} → {sub.currentPeriodEnd}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {sub.monthlyPrice === 0 ? "—" : formatCurrency(sub.monthlyPrice)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
