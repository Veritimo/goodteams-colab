/**
 * ExecutionView Component
 *
 * Panel for viewing workflow execution status and logs.
 * Displays recent executions, real-time progress, and error details.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §4.3
 */

import React, { useState, useEffect, useCallback } from "react";
import type { ExecutionLogEntry as LogEntryType } from "../../workflows/types";
import { ExecutionLogEntry, type LogLevel } from "./components/ExecutionLogEntry";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Execution status types
 */
export type ExecutionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

/**
 * Node execution state
 */
export interface NodeExecutionState {
  nodeId: string;
  nodeName?: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

/**
 * Execution summary
 */
export interface ExecutionSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  triggeredBy?: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  nodeStates?: NodeExecutionState[];
}

/**
 * Props for the ExecutionView component
 */
export interface ExecutionViewProps {
  /** Currently selected workflow ID */
  workflowId: string;
  /** List of recent executions */
  executions: ExecutionSummary[];
  /** Currently selected execution ID */
  selectedExecutionId?: string;
  /** Execution logs for the selected execution */
  logs: LogEntryType[];
  /** Node execution states for the selected execution */
  nodeStates?: NodeExecutionState[];
  /** Callback when an execution is selected */
  onSelectExecution: (executionId: string) => void;
  /** Callback to refresh executions */
  onRefresh?: () => void;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Error message if any */
  error?: string;
  /** Polling interval in ms (0 to disable) */
  pollingInterval?: number;
  /** Callback to close the panel */
  onClose?: () => void;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get status badge styling
 */
function getStatusStyles(status: ExecutionStatus): {
  bgColor: string;
  textColor: string;
  icon: string;
} {
  switch (status) {
    case "PENDING":
      return {
        bgColor: "bg-slate-600",
        textColor: "text-slate-300",
        icon: "⏳",
      };
    case "RUNNING":
      return {
        bgColor: "bg-blue-600",
        textColor: "text-blue-100",
        icon: "▶️",
      };
    case "COMPLETED":
      return {
        bgColor: "bg-green-600",
        textColor: "text-green-100",
        icon: "✅",
      };
    case "FAILED":
      return {
        bgColor: "bg-red-600",
        textColor: "text-red-100",
        icon: "❌",
      };
    case "CANCELLED":
      return {
        bgColor: "bg-amber-600",
        textColor: "text-amber-100",
        icon: "⏹️",
      };
    default:
      return {
        bgColor: "bg-slate-600",
        textColor: "text-slate-300",
        icon: "❓",
      };
  }
}

/**
 * Get node status badge styling
 */
function getNodeStatusStyles(status: NodeExecutionState["status"]): {
  bgColor: string;
  textColor: string;
} {
  switch (status) {
    case "pending":
      return { bgColor: "bg-slate-700", textColor: "text-slate-400" };
    case "running":
      return { bgColor: "bg-blue-700", textColor: "text-blue-200" };
    case "completed":
      return { bgColor: "bg-green-700", textColor: "text-green-200" };
    case "failed":
      return { bgColor: "bg-red-700", textColor: "text-red-200" };
    case "skipped":
      return { bgColor: "bg-slate-700", textColor: "text-slate-500" };
    default:
      return { bgColor: "bg-slate-700", textColor: "text-slate-400" };
  }
}

/**
 * Format relative time
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Format duration between two dates
 */
function formatDuration(startIso: string, endIso?: string): string {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 60) return `${diffSecs}s`;
  if (diffMins < 60) return `${diffMins}m ${diffSecs % 60}s`;
  return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: ExecutionStatus }): React.ReactElement {
  const styles = getStatusStyles(status);
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold
        ${styles.bgColor} ${styles.textColor}
      `}
    >
      <span aria-hidden="true">{styles.icon}</span>
      {status}
    </span>
  );
}

/**
 * Execution list item
 */
function ExecutionListItem({
  execution,
  isSelected,
  onSelect,
}: {
  execution: ExecutionSummary;
  isSelected: boolean;
  onSelect: () => void;
}): React.ReactElement {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full text-left p-3 rounded-lg transition-colors
        ${
          isSelected
            ? "bg-blue-600/30 border border-blue-500"
            : "bg-slate-700/50 border border-transparent hover:bg-slate-700"
        }
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <StatusBadge status={execution.status} />
        <span className="text-xs text-slate-400">{formatRelativeTime(execution.startedAt)}</span>
      </div>
      <div className="text-sm text-slate-200 font-medium truncate">{execution.workflowName}</div>
      {execution.triggeredBy && (
        <div className="text-xs text-slate-400 mt-1">by {execution.triggeredBy}</div>
      )}
      {execution.status === "RUNNING" && (
        <div className="mt-2 flex items-center gap-2 text-xs text-blue-400">
          <span className="animate-pulse">●</span>
          Running for {formatDuration(execution.startedAt)}
        </div>
      )}
    </button>
  );
}

/**
 * Node progress indicator
 */
function NodeProgress({ nodeStates }: { nodeStates: NodeExecutionState[] }): React.ReactElement {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Node Progress</h4>
      <div className="space-y-1">
        {nodeStates.map((node) => {
          const styles = getNodeStatusStyles(node.status);
          return (
            <div
              key={node.nodeId}
              className={`
                flex items-center justify-between p-2 rounded
                ${styles.bgColor}
              `}
            >
              <span className={`text-sm ${styles.textColor}`}>{node.nodeName || node.nodeId}</span>
              <span className={`text-xs ${styles.textColor} capitalize`}>
                {node.status}
                {node.status === "running" && <span className="ml-1 animate-pulse">●</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Error display component
 */
function ErrorDisplay({ error }: { error: string }): React.ReactElement {
  return (
    <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
      <div className="flex items-start gap-3">
        <span className="text-red-400 text-xl">❌</span>
        <div className="flex-1">
          <h4 className="font-semibold text-red-300 mb-1">Execution Failed</h4>
          <p className="text-sm text-red-200 whitespace-pre-wrap">{error}</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Execution view panel for monitoring workflow runs
 */
export function ExecutionView({
  workflowId,
  executions,
  selectedExecutionId,
  logs,
  nodeStates = [],
  onSelectExecution,
  onRefresh,
  isLoading = false,
  error,
  pollingInterval = 5000,
  onClose,
}: ExecutionViewProps): React.ReactElement {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const selectedExecution = executions.find((e) => e.id === selectedExecutionId);

  // Polling for real-time updates
  useEffect(() => {
    if (!autoRefresh || pollingInterval === 0 || !onRefresh) return;

    const interval = setInterval(() => {
      onRefresh();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, pollingInterval, onRefresh]);

  const handleRefresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  return (
    <div className="h-full flex flex-col bg-slate-800 text-slate-100 border-l border-slate-700">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Executions</h2>
          <p className="text-xs text-slate-400">Monitor workflow runs</p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <svg
                className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
              aria-label="Close panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Auto-refresh toggle */}
      <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
          />
          Auto-refresh
        </label>
        {isLoading && <span className="text-xs text-blue-400 animate-pulse">Updating...</span>}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Execution list sidebar */}
        <div className="w-64 border-r border-slate-700 overflow-y-auto p-3 space-y-2">
          {executions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">No executions yet</div>
          ) : (
            executions.map((execution) => (
              <ExecutionListItem
                key={execution.id}
                execution={execution}
                isSelected={execution.id === selectedExecutionId}
                onSelect={() => onSelectExecution(execution.id)}
              />
            ))
          )}
        </div>

        {/* Execution details */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedExecution ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-lg">Select an execution to view details</p>
              <p className="text-sm mt-2">Or run the workflow to create a new execution</p>
            </div>
          ) : (
            <>
              {/* Execution header */}
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <StatusBadge status={selectedExecution.status} />
                    <span className="text-xs text-slate-400 font-mono">
                      {selectedExecution.id.substring(0, 8)}...
                    </span>
                  </div>
                  <div className="text-sm text-slate-300">
                    Started: {new Date(selectedExecution.startedAt).toLocaleString()}
                  </div>
                  {selectedExecution.finishedAt && (
                    <div className="text-sm text-slate-400">
                      Duration:{" "}
                      {formatDuration(selectedExecution.startedAt, selectedExecution.finishedAt)}
                    </div>
                  )}
                </div>
              </div>

              {/* Error display */}
              {selectedExecution.error && <ErrorDisplay error={selectedExecution.error} />}

              {/* Node progress */}
              {nodeStates.length > 0 && <NodeProgress nodeStates={nodeStates} />}

              {/* Logs section */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Execution Logs ({logs.length})
                </h4>
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">No logs yet</div>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log, index) => (
                      <ExecutionLogEntry
                        key={`${log.timestamp}-${index}`}
                        timestamp={log.timestamp}
                        nodeId={log.nodeId}
                        level={log.level as LogLevel}
                        message={log.message}
                        details={log.data}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Global error */}
          {error && !selectedExecution && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExecutionView;
