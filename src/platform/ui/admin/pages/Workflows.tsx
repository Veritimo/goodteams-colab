import { useQuery } from "@tanstack/react-query";
import {
  GitBranch,
  Plus,
  Play,
  Pause,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Loader2,
  AlertCircle,
  Zap,
  Calendar,
  Webhook,
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
import { Switch } from "../components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { getWorkflows } from "../lib/api";

// Types
interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: "active" | "disabled" | "draft";
  triggerType: "manual" | "schedule" | "webhook" | "event";
  lastRun?: string;
  nextRun?: string;
  successRate: number;
  totalRuns: number;
  organizationId: string;
  organizationName: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  duration?: number;
}

// Transform API workflow to internal format
function transformApiWorkflow(apiWorkflow: any): Workflow {
  return {
    id: apiWorkflow.id,
    name: apiWorkflow.name,
    description: apiWorkflow.description || undefined,
    status:
      apiWorkflow.status === "active"
        ? "active"
        : apiWorkflow.status === "inactive"
          ? "disabled"
          : "draft",
    triggerType: "manual",
    successRate: 0,
    totalRuns: 0,
    organizationId: apiWorkflow.organizationId,
    organizationName: "Organization",
    createdAt: apiWorkflow.createdAt,
    updatedAt: apiWorkflow.updatedAt,
  };
}

// Helper functions
function formatDate(dateString?: string): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms?: number): string {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function getTriggerIcon(type: Workflow["triggerType"]) {
  switch (type) {
    case "manual":
      return <Play className="h-4 w-4" />;
    case "schedule":
      return <Calendar className="h-4 w-4" />;
    case "webhook":
      return <Webhook className="h-4 w-4" />;
    case "event":
      return <Zap className="h-4 w-4" />;
  }
}

function getStatusBadge(status: Workflow["status"]) {
  switch (status) {
    case "active":
      return <Badge variant="success">Active</Badge>;
    case "disabled":
      return <Badge variant="secondary">Disabled</Badge>;
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
  }
}

function getExecutionStatusIcon(status: WorkflowExecution["status"]) {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "cancelled":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  }
}

// Components
function WorkflowsList({
  workflows,
  onSelect,
  onToggleStatus,
}: {
  workflows: Workflow[];
  onSelect: (workflow: Workflow) => void;
  onToggleStatus: (id: string, enabled: boolean) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Organization</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Last Run</TableHead>
          <TableHead>Success Rate</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workflows.map((workflow) => (
          <TableRow key={workflow.id} className="cursor-pointer" onClick={() => onSelect(workflow)}>
            <TableCell>
              <div>
                <div className="font-medium">{workflow.name}</div>
                {workflow.description && (
                  <div className="text-sm text-muted-foreground truncate max-w-xs">
                    {workflow.description}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">{workflow.organizationName}</span>
            </TableCell>
            <TableCell>{getStatusBadge(workflow.status)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getTriggerIcon(workflow.triggerType)}
                <span className="capitalize text-sm">{workflow.triggerType}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                {formatDate(workflow.lastRun)}
                {workflow.nextRun && (
                  <div className="text-xs text-muted-foreground">
                    Next: {formatDate(workflow.nextRun)}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${workflow.successRate}%` }}
                  />
                </div>
                <span className="text-sm">{workflow.successRate.toFixed(1)}%</span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div
                className="flex items-center justify-end gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Switch
                  checked={workflow.status === "active"}
                  onCheckedChange={(checked) => onToggleStatus(workflow.id, checked)}
                  disabled={workflow.status === "draft"}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function WorkflowDetail({
  workflow,
  executions,
  onBack,
  onRun,
  onToggleStatus,
}: {
  workflow: Workflow;
  executions: WorkflowExecution[];
  onBack: () => void;
  onRun: () => void;
  onToggleStatus: (enabled: boolean) => void;
}) {
  const workflowExecutions = executions.filter((e) => e.workflowId === workflow.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{workflow.name}</h2>
            <p className="text-muted-foreground">{workflow.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {workflow.status === "active" ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={workflow.status === "active"}
              onCheckedChange={onToggleStatus}
              disabled={workflow.status === "draft"}
            />
          </div>
          <Button onClick={onRun} disabled={workflow.status === "draft"}>
            <Play className="h-4 w-4 mr-2" />
            Run Now
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>{getStatusBadge(workflow.status)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Trigger Type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getTriggerIcon(workflow.triggerType)}
              <span className="capitalize">{workflow.triggerType}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Runs</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{workflow.totalRuns.toLocaleString()}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Success Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{workflow.successRate.toFixed(1)}%</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Definition</CardTitle>
          <CardDescription>Visual workflow preview (read-only)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Workflow Designer Preview</p>
              <p className="text-sm">Click "Edit Workflow" to open the full designer</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Execution History</CardTitle>
              <CardDescription>Recent workflow executions</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Triggered By</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflowExecutions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No executions yet
                  </TableCell>
                </TableRow>
              ) : (
                workflowExecutions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getExecutionStatusIcon(execution.status)}
                        <span className="capitalize">{execution.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>{execution.triggeredBy}</TableCell>
                    <TableCell>{formatDate(execution.startedAt)}</TableCell>
                    <TableCell>{formatDuration(execution.duration)}</TableCell>
                    <TableCell>
                      {execution.error ? (
                        <span className="text-red-500 text-sm truncate max-w-xs block">
                          {execution.error}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function Workflows() {
  const { data: workflowsResponse, isLoading } = useQuery({
    queryKey: ["org-workflows"],
    queryFn: getWorkflows,
    staleTime: 30000,
  });

  // Transform API response
  const apiWorkflows: Workflow[] = Array.isArray(workflowsResponse?.data)
    ? workflowsResponse.data.map(transformApiWorkflow)
    : Array.isArray(workflowsResponse)
      ? (workflowsResponse as any[]).map(transformApiWorkflow)
      : [];

  const [localWorkflows, setLocalWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);

  // Combine API workflows with locally added ones
  const workflows = [...apiWorkflows, ...localWorkflows];

  // Empty executions - would come from a separate API
  const executions: WorkflowExecution[] = [];

  const handleToggleStatus = useCallback((id: string, enabled: boolean) => {
    setLocalWorkflows((prev) =>
      prev.map((wf) => (wf.id === id ? { ...wf, status: enabled ? "active" : "disabled" } : wf)),
    );
  }, []);

  const handleRunWorkflow = useCallback(() => {
    // In real implementation, this would trigger the workflow via API
    console.log("Running workflow:", selectedWorkflow?.id);
  }, [selectedWorkflow]);

  if (selectedWorkflow) {
    return (
      <WorkflowDetail
        workflow={selectedWorkflow}
        executions={executions}
        onBack={() => setSelectedWorkflow(null)}
        onRun={handleRunWorkflow}
        onToggleStatus={(enabled) => {
          handleToggleStatus(selectedWorkflow.id, enabled);
          setSelectedWorkflow({
            ...selectedWorkflow,
            status: enabled ? "active" : "disabled",
          });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Workflows</h1>
        </div>
        <Button onClick={() => setIsDesignerOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{workflows.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-green-500">
              {workflows.filter((w) => w.status === "active").length}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Disabled</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-muted-foreground">
              {workflows.filter((w) => w.status === "disabled").length}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Drafts</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-yellow-500">
              {workflows.filter((w) => w.status === "draft").length}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Workflows</CardTitle>
          <CardDescription>Manage workflows across all organizations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <GitBranch className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No workflows yet</p>
              <p className="text-sm mb-4">Create your first workflow to automate tasks.</p>
              <Button onClick={() => setIsDesignerOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Workflow
              </Button>
            </div>
          ) : (
            <WorkflowsList
              workflows={workflows}
              onSelect={setSelectedWorkflow}
              onToggleStatus={handleToggleStatus}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isDesignerOpen} onOpenChange={setIsDesignerOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>Design your workflow using the visual editor</DialogDescription>
          </DialogHeader>
          <div className="h-96 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Workflow Designer</p>
              <p className="text-sm">The WorkflowDesigner component would be integrated here</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
