/**
 * ExecutionLogEntry Component
 *
 * Displays a single log entry from workflow execution.
 * Shows timestamp, node name, log level, message, and expandable details.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §4.3
 */

import React, { useState } from "react";

/**
 * Log level types
 */
export type LogLevel = "debug" | "info" | "warn" | "error" | "success";

/**
 * Props for the ExecutionLogEntry component
 */
export interface ExecutionLogEntryProps {
  /** ISO timestamp of the log entry */
  timestamp: string;
  /** Name of the node that generated the log (null for workflow-level) */
  nodeName?: string | null;
  /** Node ID for reference */
  nodeId?: string | null;
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Optional additional data for expandable details */
  details?: Record<string, unknown>;
}

/**
 * Get the styling for a log level
 */
function getLevelStyles(level: LogLevel): {
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: string;
} {
  switch (level) {
    case "debug":
      return {
        bgColor: "bg-slate-700/50",
        textColor: "text-slate-400",
        borderColor: "border-slate-600",
        icon: "🔍",
      };
    case "info":
      return {
        bgColor: "bg-blue-900/30",
        textColor: "text-blue-400",
        borderColor: "border-blue-700",
        icon: "ℹ️",
      };
    case "warn":
      return {
        bgColor: "bg-amber-900/30",
        textColor: "text-amber-400",
        borderColor: "border-amber-700",
        icon: "⚠️",
      };
    case "error":
      return {
        bgColor: "bg-red-900/30",
        textColor: "text-red-400",
        borderColor: "border-red-700",
        icon: "❌",
      };
    case "success":
      return {
        bgColor: "bg-green-900/30",
        textColor: "text-green-400",
        borderColor: "border-green-700",
        icon: "✅",
      };
  }
}

/**
 * Format timestamp to human-readable format
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return isoString;
  }
}

/**
 * Execution log entry component
 */
export function ExecutionLogEntry({
  timestamp,
  nodeName,
  nodeId,
  level,
  message,
  details,
}: ExecutionLogEntryProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = details && Object.keys(details).length > 0;
  const styles = getLevelStyles(level);

  return (
    <div
      className={`
        ${styles.bgColor} ${styles.borderColor}
        border-l-4 rounded-r-lg p-3
        transition-all duration-200
        ${hasDetails ? "cursor-pointer hover:bg-opacity-80" : ""}
      `}
      onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      role={hasDetails ? "button" : undefined}
      tabIndex={hasDetails ? 0 : undefined}
      onKeyDown={(e) => {
        if (hasDetails && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setIsExpanded(!isExpanded);
        }
      }}
      aria-expanded={hasDetails ? isExpanded : undefined}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Level icon */}
        <span className="text-sm flex-shrink-0" aria-hidden="true">
          {styles.icon}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Timestamp and node info */}
          <div className="flex items-center gap-2 text-xs mb-1">
            <span className="text-slate-500 font-mono">{formatTimestamp(timestamp)}</span>
            {nodeName && (
              <>
                <span className="text-slate-600">•</span>
                <span className={`${styles.textColor} font-semibold`}>{nodeName}</span>
              </>
            )}
            {nodeId && !nodeName && (
              <>
                <span className="text-slate-600">•</span>
                <code className="text-slate-500 text-xs">{nodeId}</code>
              </>
            )}
            <span className="text-slate-600">•</span>
            <span className={`${styles.textColor} uppercase text-xs font-bold tracking-wider`}>
              {level}
            </span>
          </div>

          {/* Message */}
          <p className="text-sm text-slate-200 break-words">{message}</p>
        </div>

        {/* Expand indicator */}
        {hasDetails && (
          <span
            className={`
              text-slate-500 transition-transform duration-200
              ${isExpanded ? "rotate-90" : ""}
            `}
            aria-hidden="true"
          >
            ▶
          </span>
        )}
      </div>

      {/* Expandable details */}
      {hasDetails && isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <pre className="text-xs text-slate-400 font-mono overflow-x-auto p-2 bg-slate-900/50 rounded">
            {JSON.stringify(details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default ExecutionLogEntry;
