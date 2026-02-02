/**
 * Audit Log Export Utilities
 *
 * Provides CSV and JSON export functionality for audit logs.
 * Supports streaming for large exports.
 */

import type { AuditLog } from "@prisma/client";
import { queryAuditLogs, type AuditQueryParams } from "./query.js";

/**
 * Export format options
 */
export type ExportFormat = "json" | "csv";

/**
 * CSV column configuration
 */
interface CsvColumn {
  header: string;
  getValue: (log: AuditLog) => string;
}

/**
 * Default CSV columns for audit export
 */
const CSV_COLUMNS: CsvColumn[] = [
  { header: "ID", getValue: (log) => log.id },
  { header: "Timestamp", getValue: (log) => log.createdAt.toISOString() },
  { header: "Organization ID", getValue: (log) => log.organizationId },
  { header: "Actor ID", getValue: (log) => log.actorId },
  { header: "Actor Role", getValue: (log) => log.actorRole },
  { header: "Action", getValue: (log) => log.action },
  { header: "Target Type", getValue: (log) => log.targetType },
  { header: "Target ID", getValue: (log) => log.targetId ?? "" },
  { header: "IP Address", getValue: (log) => log.ipAddress ?? "" },
  { header: "User Agent", getValue: (log) => log.userAgent ?? "" },
  { header: "Details", getValue: (log) => JSON.stringify(log.details) },
];

/**
 * Escape a value for CSV output
 */
function escapeCsvValue(value: string): string {
  // If the value contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert audit logs to CSV format
 *
 * @param logs - Array of audit log entries
 * @param includeHeader - Whether to include header row
 * @returns CSV string
 */
export function auditLogsToCsv(logs: AuditLog[], includeHeader = true): string {
  const lines: string[] = [];

  if (includeHeader) {
    lines.push(CSV_COLUMNS.map((col) => escapeCsvValue(col.header)).join(","));
  }

  for (const log of logs) {
    const values = CSV_COLUMNS.map((col) => escapeCsvValue(col.getValue(log)));
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

/**
 * Convert audit logs to JSON format
 *
 * @param logs - Array of audit log entries
 * @param pretty - Whether to pretty-print the JSON
 * @returns JSON string
 */
export function auditLogsToJson(logs: AuditLog[], pretty = false): string {
  const data = logs.map((log) => ({
    id: log.id,
    timestamp: log.createdAt.toISOString(),
    organizationId: log.organizationId,
    actor: {
      id: log.actorId,
      role: log.actorRole,
    },
    action: log.action,
    target: {
      type: log.targetType,
      id: log.targetId,
    },
    details: log.details,
    metadata: {
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
    },
  }));

  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

/**
 * Export audit logs in the specified format
 *
 * @param params - Query parameters to filter logs
 * @param format - Export format (json or csv)
 * @returns Formatted string
 */
export async function exportAuditLogs(
  params: AuditQueryParams,
  format: ExportFormat,
): Promise<string> {
  // Increase limit for exports (but cap at reasonable max)
  const exportParams = {
    ...params,
    limit: Math.min(params.limit ?? 10000, 50000),
  };

  const logs = await queryAuditLogs(exportParams);

  switch (format) {
    case "csv":
      return auditLogsToCsv(logs);
    case "json":
      return auditLogsToJson(logs, true);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Get content type for export format
 */
export function getExportContentType(format: ExportFormat): string {
  switch (format) {
    case "csv":
      return "text/csv; charset=utf-8";
    case "json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

/**
 * Get filename for export
 */
export function getExportFilename(format: ExportFormat, organizationId: string): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `audit-logs-${organizationId}-${timestamp}.${format}`;
}

/**
 * Streaming export generator for large datasets
 * Yields chunks of formatted data
 *
 * @param params - Query parameters
 * @param format - Export format
 * @param chunkSize - Number of records per chunk
 */
export async function* streamAuditExport(
  params: AuditQueryParams,
  format: ExportFormat,
  chunkSize = 1000,
): AsyncGenerator<string, void, unknown> {
  let offset = 0;
  let isFirstChunk = true;

  if (format === "json") {
    yield "[\n";
  }

  while (true) {
    const logs = await queryAuditLogs({
      ...params,
      limit: chunkSize,
      offset,
    });

    if (logs.length === 0) {
      break;
    }

    if (format === "csv") {
      yield auditLogsToCsv(logs, isFirstChunk);
      yield "\n";
    } else {
      const jsonChunk = auditLogsToJson(logs, false);
      // Remove the array brackets from the chunk
      const items = jsonChunk.slice(1, -1);
      if (!isFirstChunk && items) {
        yield ",\n";
      }
      yield items;
    }

    isFirstChunk = false;
    offset += chunkSize;

    // Check if we got fewer results than requested (last page)
    if (logs.length < chunkSize) {
      break;
    }
  }

  if (format === "json") {
    yield "\n]";
  }
}
