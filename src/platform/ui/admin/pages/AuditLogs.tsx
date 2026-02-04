import {
  FileText,
  Search,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  User,
  Activity,
  Server,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  X,
  Eye,
} from "lucide-react";
import { useState, useCallback } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

// Types
interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  actionCategory: "auth" | "data" | "config" | "admin" | "system";
  resource: string;
  resourceType: "user" | "organization" | "workflow" | "model" | "skill" | "setting" | "api_key";
  status: "success" | "failure" | "warning";
  ipAddress: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  changes?: { field: string; oldValue: unknown; newValue: unknown }[];
}

// Mock data
const mockLogs: AuditLogEntry[] = [
  {
    id: "log-1",
    timestamp: "2024-01-15T15:45:32Z",
    userId: "user-1",
    userName: "John Doe",
    userEmail: "john@acme.com",
    action: "user.login",
    actionCategory: "auth",
    resource: "session-abc123",
    resourceType: "user",
    status: "success",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    details: { method: "password", mfa: true },
  },
  {
    id: "log-2",
    timestamp: "2024-01-15T15:30:00Z",
    userId: "user-2",
    userName: "Jane Smith",
    userEmail: "jane@acme.com",
    action: "workflow.create",
    actionCategory: "data",
    resource: "wf-xyz789",
    resourceType: "workflow",
    status: "success",
    ipAddress: "192.168.1.101",
    details: { workflowName: "Customer Onboarding v2" },
  },
  {
    id: "log-3",
    timestamp: "2024-01-15T15:15:00Z",
    userId: "user-1",
    userName: "John Doe",
    userEmail: "john@acme.com",
    action: "model.config.update",
    actionCategory: "config",
    resource: "anthropic",
    resourceType: "model",
    status: "success",
    ipAddress: "192.168.1.100",
    changes: [
      { field: "defaultModel", oldValue: "claude-3-5-sonnet", newValue: "claude-sonnet-4" },
    ],
  },
  {
    id: "log-4",
    timestamp: "2024-01-15T14:45:00Z",
    userId: "user-3",
    userName: "Bob Wilson",
    userEmail: "bob@techstart.io",
    action: "api_key.create",
    actionCategory: "admin",
    resource: "key-def456",
    resourceType: "api_key",
    status: "success",
    ipAddress: "10.0.0.50",
    details: { keyName: "Production API Key", scopes: ["read", "write"] },
  },
  {
    id: "log-5",
    timestamp: "2024-01-15T14:30:00Z",
    userId: "system",
    userName: "System",
    userEmail: "system@internal",
    action: "skill.sync",
    actionCategory: "system",
    resource: "skill-browser",
    resourceType: "skill",
    status: "success",
    ipAddress: "127.0.0.1",
    details: { version: "1.2.0", source: "bundled" },
  },
  {
    id: "log-6",
    timestamp: "2024-01-15T14:00:00Z",
    userId: "user-4",
    userName: "Alice Brown",
    userEmail: "alice@acme.com",
    action: "user.login",
    actionCategory: "auth",
    resource: "session-failed",
    resourceType: "user",
    status: "failure",
    ipAddress: "203.0.113.50",
    details: { reason: "Invalid password", attempts: 3 },
  },
  {
    id: "log-7",
    timestamp: "2024-01-15T13:45:00Z",
    userId: "user-2",
    userName: "Jane Smith",
    userEmail: "jane@acme.com",
    action: "organization.member.invite",
    actionCategory: "admin",
    resource: "org-acme",
    resourceType: "organization",
    status: "success",
    ipAddress: "192.168.1.101",
    details: { invitedEmail: "newuser@acme.com", role: "member" },
  },
  {
    id: "log-8",
    timestamp: "2024-01-15T13:30:00Z",
    userId: "user-1",
    userName: "John Doe",
    userEmail: "john@acme.com",
    action: "setting.update",
    actionCategory: "config",
    resource: "security-settings",
    resourceType: "setting",
    status: "warning",
    ipAddress: "192.168.1.100",
    details: { warning: "MFA requirement disabled" },
    changes: [{ field: "requireMfa", oldValue: true, newValue: false }],
  },
];

// Helper functions
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getStatusIcon(status: AuditLogEntry["status"]) {
  switch (status) {
    case "success":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failure":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "warning":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  }
}

function getStatusBadge(status: AuditLogEntry["status"]) {
  switch (status) {
    case "success":
      return <Badge variant="success">Success</Badge>;
    case "failure":
      return <Badge variant="destructive">Failed</Badge>;
    case "warning":
      return <Badge variant="warning">Warning</Badge>;
  }
}

function getCategoryBadge(category: AuditLogEntry["actionCategory"]) {
  const colors: Record<string, string> = {
    auth: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    data: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    config: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
    admin: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
    system: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${colors[category]}`}
    >
      {category}
    </span>
  );
}

function exportToCSV(logs: AuditLogEntry[]) {
  const headers = [
    "Timestamp",
    "User",
    "Email",
    "Action",
    "Category",
    "Resource",
    "Status",
    "IP Address",
  ];
  const rows = logs.map((log) => [
    log.timestamp,
    log.userName,
    log.userEmail,
    log.action,
    log.actionCategory,
    log.resource,
    log.status,
    log.ipAddress,
  ]);

  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Components
function LogDetailDialog({
  log,
  open,
  onOpenChange,
}: {
  log: AuditLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon(log.status)}
            {log.action}
          </DialogTitle>
          <DialogDescription>{formatTimestamp(log.timestamp)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">User</h4>
              <p className="text-sm">{log.userName}</p>
              <p className="text-xs text-muted-foreground">{log.userEmail}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">IP Address</h4>
              <p className="text-sm font-mono">{log.ipAddress}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Category</h4>
              {getCategoryBadge(log.actionCategory)}
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Status</h4>
              {getStatusBadge(log.status)}
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Resource Type</h4>
              <p className="text-sm capitalize">{log.resourceType.replace("_", " ")}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Resource ID</h4>
              <p className="text-sm font-mono">{log.resource}</p>
            </div>
          </div>

          {log.userAgent && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">User Agent</h4>
              <p className="text-xs text-muted-foreground break-all">{log.userAgent}</p>
            </div>
          )}

          {log.changes && log.changes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Changes</h4>
              <div className="space-y-2">
                {log.changes.map((change, i) => (
                  <div key={i} className="bg-muted rounded p-2">
                    <p className="text-sm font-medium">{change.field}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-red-500 line-through">
                        {JSON.stringify(change.oldValue)}
                      </span>
                      <span>→</span>
                      <span className="text-green-500">{JSON.stringify(change.newValue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {log.details && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Details</h4>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AuditLogs() {
  const [logs] = useState<AuditLogEntry[]>(mockLogs);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Filters
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsLoading(false);
  }, []);

  const handleViewDetails = useCallback((log: AuditLogEntry) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setFilterUser("");
    setFilterAction("");
    setFilterStatus("");
    setFilterCategory("");
    setDateFrom("");
    setDateTo("");
  }, []);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUser =
      !filterUser ||
      log.userId === filterUser ||
      log.userName.toLowerCase().includes(filterUser.toLowerCase());
    const matchesAction = !filterAction || log.action.includes(filterAction);
    const matchesStatus = !filterStatus || log.status === filterStatus;
    const matchesCategory = !filterCategory || log.actionCategory === filterCategory;
    const matchesDateFrom = !dateFrom || new Date(log.timestamp) >= new Date(dateFrom);
    const matchesDateTo = !dateTo || new Date(log.timestamp) <= new Date(dateTo);

    return (
      matchesSearch &&
      matchesUser &&
      matchesAction &&
      matchesStatus &&
      matchesCategory &&
      matchesDateFrom &&
      matchesDateTo
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const hasActiveFilters =
    filterUser || filterAction || filterStatus || filterCategory || dateFrom || dateTo;

  // Get unique values for filters
  const uniqueUsers = [...new Set(logs.map((l) => l.userName))];
  const uniqueActions = [...new Set(logs.map((l) => l.action.split(".")[0]))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Audit Logs</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" onClick={() => exportToCSV(filteredLogs)}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Events</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{logs.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Success</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-green-500">
              {logs.filter((l) => l.status === "success").length}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failures</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-red-500">
              {logs.filter((l) => l.status === "failure").length}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Warnings</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-yellow-500">
              {logs.filter((l) => l.status === "warning").length}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Event Log</CardTitle>
              <CardDescription>
                {filteredLogs.length} events {hasActiveFilters && "(filtered)"}
              </CardDescription>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-36"
                  placeholder="From"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-36"
                  placeholder="To"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <Select
                  options={[
                    { value: "", label: "All Users" },
                    ...uniqueUsers.map((u) => ({ value: u, label: u })),
                  ]}
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <Select
                  options={[
                    { value: "", label: "All Actions" },
                    ...uniqueActions.map((a) => ({ value: a, label: a })),
                  ]}
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  options={[
                    { value: "", label: "All Status" },
                    { value: "success", label: "Success" },
                    { value: "failure", label: "Failure" },
                    { value: "warning", label: "Warning" },
                  ]}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <Select
                  options={[
                    { value: "", label: "All Categories" },
                    { value: "auth", label: "Auth" },
                    { value: "data", label: "Data" },
                    { value: "config", label: "Config" },
                    { value: "admin", label: "Admin" },
                    { value: "system", label: "System" },
                  ]}
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-36"
                />
              </div>
            </div>

            {/* Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : paginatedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No logs found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLogs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDetails(log)}
                    >
                      <TableCell className="text-sm">{formatTimestamp(log.timestamp)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm font-medium">{log.userName}</div>
                          <div className="text-xs text-muted-foreground">{log.userEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getCategoryBadge(log.actionCategory)}
                          <span className="text-sm font-mono">{log.action}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm font-mono">{log.resource}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {log.resourceType.replace("_", " ")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className="text-sm capitalize">{log.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.ipAddress}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(log);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * pageSize + 1} to{" "}
                  {Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length}{" "}
                  entries
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <LogDetailDialog log={selectedLog} open={isDetailOpen} onOpenChange={setIsDetailOpen} />
    </div>
  );
}
