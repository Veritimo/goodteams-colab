/**
 * Report Client
 *
 * Salesforce Reports API integration:
 * - List available reports
 * - Get report metadata
 * - Execute reports with filters
 * - Parse report results
 *
 * @see https://developer.salesforce.com/docs/atlas.en-us.api_analytics.meta/api_analytics/
 */

import type { Connection } from "jsforce";
import type { SalesforceConnector } from "./salesforce-connector.js";
import type {
  ReportSummary,
  ReportMetadata,
  ReportResult,
  ReportFormat,
  ReportColumn,
  ReportFilter,
  ReportFilterOverride,
  ReportRow,
  ReportFactMapEntry,
} from "./types.js";
import { SalesforceConnectorError } from "./salesforce-connector.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Report list options
 */
export interface ListReportsOptions {
  /** Filter by folder name */
  folderName?: string;
  /** Search by report name */
  search?: string;
  /** Maximum reports to return */
  limit?: number;
}

/**
 * Report execution options
 */
export interface RunReportOptions {
  /** Filter overrides */
  filters?: ReportFilterOverride[];
  /** Include detail rows in response */
  includeDetails?: boolean;
  /** Maximum detail rows to return */
  maxDetailRows?: number;
}

/**
 * Parsed report data (flattened for easier consumption)
 */
export interface ParsedReportData {
  /** Column headers */
  columns: string[];
  /** Data rows (as arrays matching column order) */
  rows: unknown[][];
  /** Summary aggregates (grand totals) */
  totals?: Record<string, unknown>;
  /** Number of rows */
  rowCount: number;
  /** Whether data was truncated */
  truncated: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default max detail rows */
const DEFAULT_MAX_DETAIL_ROWS = 2000;

/** Reports API base path */
const REPORTS_API_BASE = "/services/data";

// =============================================================================
// REPORT CLIENT CLASS
// =============================================================================

/**
 * Report Client
 *
 * Interacts with Salesforce Reports API.
 *
 * @example
 * ```typescript
 * const client = new ReportClient(connector);
 *
 * // List reports
 * const reports = await client.listReports({ search: 'Pipeline' });
 *
 * // Get report metadata
 * const metadata = await client.getReportMetadata(reportId);
 *
 * // Run report
 * const result = await client.runReport(reportId, {
 *   includeDetails: true,
 *   filters: [{ column: 'STAGE_NAME', operator: 'equals', value: 'Closed Won' }]
 * });
 *
 * // Parse results
 * const data = client.parseReportResult(result);
 * ```
 */
export class ReportClient {
  private connector: SalesforceConnector;

  constructor(connector: SalesforceConnector) {
    this.connector = connector;
  }

  // ===========================================================================
  // LIST REPORTS
  // ===========================================================================

  /**
   * List available reports
   */
  async listReports(options?: ListReportsOptions): Promise<ReportSummary[]> {
    const conn = await this.connector.getConnection();

    try {
      // Query reports using SOQL (Reports are stored as Report object)
      let soql = `
        SELECT Id, Name, Description, FolderName, Format, LastRunDate, ReportType.Name
        FROM Report
        WHERE IsDeleted = false
      `;

      if (options?.folderName) {
        soql += ` AND FolderName = '${this.escapeSoql(options.folderName)}'`;
      }

      if (options?.search) {
        soql += ` AND Name LIKE '%${this.escapeSoql(options.search)}%'`;
      }

      soql += " ORDER BY Name ASC";

      if (options?.limit) {
        soql += ` LIMIT ${options.limit}`;
      }

      const result = await conn.query<ReportRecord>(soql);

      return result.records.map((record) => ({
        id: record.Id,
        name: record.Name,
        description: record.Description ?? undefined,
        folderName: record.FolderName ?? undefined,
        format: (record.Format ?? "TABULAR") as ReportFormat,
        lastRunDate: record.LastRunDate ?? undefined,
        reportType: record.ReportType?.Name,
      }));
    } catch (error) {
      throw this.mapReportError(error, "listReports");
    }
  }

  /**
   * Get report by ID (summary info)
   */
  async getReport(reportId: string): Promise<ReportSummary | null> {
    const conn = await this.connector.getConnection();

    try {
      const soql = `
        SELECT Id, Name, Description, FolderName, Format, LastRunDate, ReportType.Name
        FROM Report
        WHERE Id = '${this.escapeSoql(reportId)}'
        LIMIT 1
      `;

      const result = await conn.query<ReportRecord>(soql);

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      return {
        id: record.Id,
        name: record.Name,
        description: record.Description ?? undefined,
        folderName: record.FolderName ?? undefined,
        format: (record.Format ?? "TABULAR") as ReportFormat,
        lastRunDate: record.LastRunDate ?? undefined,
        reportType: record.ReportType?.Name,
      };
    } catch (error) {
      throw this.mapReportError(error, `getReport(${reportId})`);
    }
  }

  // ===========================================================================
  // REPORT METADATA
  // ===========================================================================

  /**
   * Get detailed report metadata (structure, filters, groupings)
   */
  async getReportMetadata(reportId: string): Promise<ReportMetadata> {
    const conn = await this.connector.getConnection();

    try {
      const url = `${REPORTS_API_BASE}/v${conn.version}/analytics/reports/${reportId}/describe`;
      const response = await conn.request({
        method: "GET",
        url,
      });

      return this.parseReportMetadata(reportId, response as RawReportDescribe);
    } catch (error) {
      throw this.mapReportError(error, `getReportMetadata(${reportId})`);
    }
  }

  // ===========================================================================
  // RUN REPORT
  // ===========================================================================

  /**
   * Execute a report and get results
   */
  async runReport(reportId: string, options?: RunReportOptions): Promise<ReportResult> {
    const conn = await this.connector.getConnection();
    const includeDetails = options?.includeDetails ?? true;

    try {
      let url = `${REPORTS_API_BASE}/v${conn.version}/analytics/reports/${reportId}`;

      // Add query params
      const params: string[] = [];
      if (includeDetails) {
        params.push("includeDetails=true");
      }

      if (params.length > 0) {
        url += `?${params.join("&")}`;
      }

      // Build request body for filters
      let body: unknown = undefined;
      if (options?.filters && options.filters.length > 0) {
        body = {
          reportMetadata: {
            reportFilters: options.filters.map((f) => ({
              column: f.column,
              operator: f.operator,
              value: f.value,
            })),
          },
        };
      }

      const response = await conn.request({
        method: body ? "POST" : "GET",
        url,
        body: body ? JSON.stringify(body) : undefined,
        headers: body ? { "Content-Type": "application/json" } : undefined,
      });

      return this.parseReportResult(response as RawReportResult);
    } catch (error) {
      throw this.mapReportError(error, `runReport(${reportId})`);
    }
  }

  /**
   * Run report asynchronously (for large reports)
   *
   * Returns a job ID that can be polled for completion.
   */
  async runReportAsync(reportId: string, options?: RunReportOptions): Promise<string> {
    const conn = await this.connector.getConnection();

    try {
      const url = `${REPORTS_API_BASE}/v${conn.version}/analytics/reports/${reportId}/instances`;

      let body: unknown = undefined;
      if (options?.filters && options.filters.length > 0) {
        body = {
          reportMetadata: {
            reportFilters: options.filters.map((f) => ({
              column: f.column,
              operator: f.operator,
              value: f.value,
            })),
          },
        };
      }

      const response = await conn.request({
        method: "POST",
        url,
        body: body ? JSON.stringify(body) : undefined,
        headers: { "Content-Type": "application/json" },
      });

      const result = response as { id: string };
      return result.id;
    } catch (error) {
      throw this.mapReportError(error, `runReportAsync(${reportId})`);
    }
  }

  /**
   * Get async report instance status/results
   */
  async getReportInstance(reportId: string, instanceId: string): Promise<ReportResult | null> {
    const conn = await this.connector.getConnection();

    try {
      const url = `${REPORTS_API_BASE}/v${conn.version}/analytics/reports/${reportId}/instances/${instanceId}`;

      const response = await conn.request({
        method: "GET",
        url,
      });

      const raw = response as RawReportInstance;

      // Check if still processing
      if (raw.status === "Running" || raw.status === "New") {
        return null;
      }

      // Check for error
      if (raw.status === "Error") {
        throw new SalesforceConnectorError(
          `Report instance failed: ${raw.errorMessage ?? "Unknown error"}`,
          "REPORT_INSTANCE_ERROR",
          500,
        );
      }

      // Parse result
      return this.parseReportResult(response as RawReportResult);
    } catch (error) {
      if (error instanceof SalesforceConnectorError) {
        throw error;
      }
      throw this.mapReportError(error, `getReportInstance(${reportId}, ${instanceId})`);
    }
  }

  // ===========================================================================
  // RESULT PARSING
  // ===========================================================================

  /**
   * Parse report result into a flat data structure
   */
  parseReportData(result: ReportResult): ParsedReportData {
    const columns = result.reportMetadata.detailColumns.map((c) => c.label);
    const rows: unknown[][] = [];

    // Get detail rows from factMap
    const factMapEntry =
      result.factMap["T!T"] ?? result.factMap["0!T"] ?? Object.values(result.factMap)[0];

    if (factMapEntry?.rows) {
      for (const row of factMapEntry.rows) {
        const rowData = row.dataCells.map((cell) => cell.value);
        rows.push(rowData);
      }
    }

    // Get grand totals
    let totals: Record<string, unknown> | undefined;
    if (factMapEntry?.aggregates) {
      totals = {};
      for (let i = 0; i < factMapEntry.aggregates.length; i++) {
        const agg = factMapEntry.aggregates[i];
        const aggMeta = result.reportMetadata.aggregates?.[i];
        const key = aggMeta?.label ?? `aggregate_${i}`;
        totals[key] = agg.value;
      }
    }

    return {
      columns,
      rows,
      totals,
      rowCount: rows.length,
      truncated: !result.hasDetailRows && rows.length > 0,
    };
  }

  /**
   * Convert report to CSV format
   */
  reportToCsv(result: ReportResult): string {
    const data = this.parseReportData(result);
    const lines: string[] = [];

    // Header row
    lines.push(data.columns.map((c) => this.escapeCsvValue(c)).join(","));

    // Data rows
    for (const row of data.rows) {
      lines.push(row.map((v) => this.escapeCsvValue(String(v ?? ""))).join(","));
    }

    return lines.join("\n");
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Parse raw report metadata response
   */
  private parseReportMetadata(reportId: string, raw: RawReportDescribe): ReportMetadata {
    return {
      id: reportId,
      name: raw.reportMetadata?.name ?? "",
      reportType: {
        type: raw.reportTypeMetadata?.type ?? "",
        label: raw.reportTypeMetadata?.label ?? "",
      },
      reportFormat: (raw.reportMetadata?.reportFormat ?? "TABULAR") as ReportFormat,
      detailColumns:
        raw.reportMetadata?.detailColumns?.map((col) => ({
          name: col,
          label: raw.reportExtendedMetadata?.detailColumnInfo?.[col]?.label ?? col,
          type: raw.reportExtendedMetadata?.detailColumnInfo?.[col]?.dataType ?? "string",
        })) ?? [],
      reportFilters: raw.reportMetadata?.reportFilters?.map((f) => ({
        column: f.column,
        operator: f.operator,
        value: f.value,
      })),
      groupingsDown: raw.reportMetadata?.groupingsDown?.map((g) => ({
        name: g.name,
        dateGranularity: g.dateGranularity,
        sortOrder: g.sortOrder,
      })),
      groupingsAcross: raw.reportMetadata?.groupingsAcross?.map((g) => ({
        name: g.name,
        dateGranularity: g.dateGranularity,
        sortOrder: g.sortOrder,
      })),
      aggregates: raw.reportMetadata?.aggregates?.map((a) => ({
        name: a.name,
        label: a.label,
        type: a.type ?? "sum",
      })),
    };
  }

  /**
   * Parse raw report result
   */
  private parseReportResult(raw: RawReportResult): ReportResult {
    const factMap: Record<string, ReportFactMapEntry> = {};

    for (const [key, entry] of Object.entries(raw.factMap ?? {})) {
      factMap[key] = {
        rows: entry.rows?.map((r) => ({
          dataCells: r.dataCells.map((c) => ({
            label: c.label ?? String(c.value ?? ""),
            value: c.value,
          })),
        })),
        aggregates:
          entry.aggregates?.map((a) => ({
            label: a.label ?? "",
            value: a.value,
          })) ?? [],
      };
    }

    return {
      reportMetadata: {
        id: raw.reportMetadata?.id ?? "",
        name: raw.reportMetadata?.name ?? "",
        reportType: {
          type: raw.reportMetadata?.reportType?.type ?? "",
          label: raw.reportMetadata?.reportType?.label ?? "",
        },
        reportFormat: (raw.reportMetadata?.reportFormat ?? "TABULAR") as ReportFormat,
        detailColumns:
          raw.reportMetadata?.detailColumns?.map((col) => ({
            name: typeof col === "string" ? col : col.name,
            label: typeof col === "string" ? col : col.label,
            type: "string",
          })) ?? [],
        reportFilters: raw.reportMetadata?.reportFilters,
        groupingsDown: raw.reportMetadata?.groupingsDown,
        groupingsAcross: raw.reportMetadata?.groupingsAcross,
        aggregates: raw.reportMetadata?.aggregates?.map((agg) => ({
          name: agg.name,
          label: agg.label,
          type: agg.type ?? "unknown",
        })),
      },
      factMap,
      hasDetailRows: raw.hasDetailRows ?? false,
      reportExtendedMetadata: raw.reportExtendedMetadata,
    };
  }

  /**
   * Escape SOQL string value
   */
  private escapeSoql(value: string): string {
    return value.replace(/'/g, "\\'");
  }

  /**
   * Escape CSV value
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Map report errors
   */
  private mapReportError(error: unknown, context: string): SalesforceConnectorError {
    if (error instanceof SalesforceConnectorError) {
      return error;
    }

    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
      const errorCode = (err.errorCode as string) || (err.name as string) || "REPORT_ERROR";
      const message = (err.message as string) || "Report operation failed";

      return new SalesforceConnectorError(
        `${context}: ${message}`,
        errorCode,
        err.statusCode as number | undefined,
        error,
      );
    }

    if (error instanceof Error) {
      return new SalesforceConnectorError(`${context}: ${error.message}`, "REPORT_ERROR");
    }

    return new SalesforceConnectorError(`${context} failed`, "REPORT_ERROR");
  }
}

// =============================================================================
// RAW API TYPES
// =============================================================================

interface ReportRecord {
  Id: string;
  Name: string;
  Description?: string;
  FolderName?: string;
  Format?: string;
  LastRunDate?: string;
  ReportType?: { Name: string };
}

interface RawReportDescribe {
  reportMetadata?: {
    name?: string;
    reportFormat?: string;
    detailColumns?: string[];
    reportFilters?: Array<{ column: string; operator: string; value: string }>;
    groupingsDown?: Array<{ name: string; dateGranularity?: string; sortOrder: "Asc" | "Desc" }>;
    groupingsAcross?: Array<{ name: string; dateGranularity?: string; sortOrder: "Asc" | "Desc" }>;
    aggregates?: Array<{ name: string; label: string; type?: string }>;
  };
  reportTypeMetadata?: {
    type?: string;
    label?: string;
  };
  reportExtendedMetadata?: {
    detailColumnInfo?: Record<string, { label?: string; dataType?: string }>;
  };
}

interface RawReportResult {
  reportMetadata?: {
    id?: string;
    name?: string;
    reportType?: { type?: string; label?: string };
    reportFormat?: string;
    detailColumns?: Array<string | { name: string; label: string }>;
    reportFilters?: ReportFilter[];
    groupingsDown?: Array<{ name: string; dateGranularity?: string; sortOrder: "Asc" | "Desc" }>;
    groupingsAcross?: Array<{ name: string; dateGranularity?: string; sortOrder: "Asc" | "Desc" }>;
    aggregates?: Array<{ name: string; label: string; type?: string }>;
  };
  factMap?: Record<
    string,
    {
      rows?: Array<{ dataCells: Array<{ label?: string; value: unknown }> }>;
      aggregates?: Array<{ label?: string; value: unknown }>;
    }
  >;
  hasDetailRows?: boolean;
  reportExtendedMetadata?: Record<string, unknown>;
}

interface RawReportInstance {
  id: string;
  status: "New" | "Running" | "Success" | "Error";
  errorMessage?: string;
  requestDate?: string;
  completionDate?: string;
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a report client from a connector
 */
export function createReportClient(connector: SalesforceConnector): ReportClient {
  return new ReportClient(connector);
}
