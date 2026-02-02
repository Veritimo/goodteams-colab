/**
 * Audit Log Routes
 *
 * API endpoints for querying and exporting audit logs.
 * Requires admin role for access.
 *
 * Routes:
 * - GET /api/platform/audit         - Query audit logs
 * - GET /api/platform/audit/stats   - Get audit statistics
 * - GET /api/platform/audit/export  - Export audit logs
 * - GET /api/platform/audit/:id     - Get single audit entry
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";
import { sendError, errors, type PlatformError } from "../middleware/errors.js";
import { sendJson, parsePathParams, parseQueryParams, type RouteHandler } from "./utils.js";
import {
  queryAuditLogsPaginated,
  countAuditLogs,
  getAuditStats,
  type AuditQueryParams,
} from "../../audit/query.js";
import { getAuditLogById } from "../../audit/logger.js";
import {
  exportAuditLogs,
  getExportContentType,
  getExportFilename,
  type ExportFormat,
} from "../../audit/export.js";
import type { UserRole } from "@prisma/client";
import type { RiskLevel } from "../../audit/actions.js";

/**
 * Check if user has admin role
 */
function isAdmin(role: string): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Parse risk levels from comma-separated string
 */
function parseRiskLevels(riskStr: string | undefined): RiskLevel[] | undefined {
  if (!riskStr) return undefined;
  const validLevels: RiskLevel[] = ["low", "medium", "high", "critical"];
  const levels = riskStr.split(",").map((s) => s.trim().toLowerCase());
  return levels.filter((l) => validLevels.includes(l as RiskLevel)) as RiskLevel[];
}

/**
 * Build query params from URL search params
 */
function buildQueryParams(
  query: Record<string, string>,
  organizationId: string,
): AuditQueryParams {
  return {
    organizationId,
    actorId: query.actorId,
    actorRole: query.actorRole as UserRole | undefined,
    action: query.action,
    actions: query.actions?.split(",").map((s) => s.trim()),
    targetType: query.targetType,
    targetId: query.targetId,
    startDate: parseDate(query.startDate),
    endDate: parseDate(query.endDate),
    riskLevels: parseRiskLevels(query.riskLevels),
    ipAddress: query.ipAddress,
    limit: query.limit ? Math.min(parseInt(query.limit, 10), 1000) : 50,
    offset: query.offset ? parseInt(query.offset, 10) : 0,
    orderBy: (query.orderBy as "createdAt" | "action" | "actorId") ?? "createdAt",
    orderDirection: (query.orderDirection as "asc" | "desc") ?? "desc",
  };
}

/**
 * Handle GET /api/platform/audit - Query audit logs
 */
async function handleListAuditLogs(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  if (!ctx.user) {
    throw errors.unauthorized();
  }

  if (!isAdmin(ctx.user.role)) {
    throw errors.forbidden("Admin role required to view audit logs");
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  const query = parseQueryParams(url);
  const params = buildQueryParams(query, ctx.user.orgId);

  const result = await queryAuditLogsPaginated(params);

  sendJson(res, {
    logs: result.logs,
    pagination: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      hasMore: result.hasMore,
    },
  });
}

/**
 * Handle GET /api/platform/audit/stats - Get audit statistics
 */
async function handleAuditStats(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  if (!ctx.user) {
    throw errors.unauthorized();
  }

  if (!isAdmin(ctx.user.role)) {
    throw errors.forbidden("Admin role required to view audit statistics");
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  const query = parseQueryParams(url);
  const params = buildQueryParams(query, ctx.user.orgId);

  const stats = await getAuditStats(params);

  sendJson(res, { stats });
}

/**
 * Handle GET /api/platform/audit/export - Export audit logs
 */
async function handleExportAuditLogs(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  if (!ctx.user) {
    throw errors.unauthorized();
  }

  if (!isAdmin(ctx.user.role)) {
    throw errors.forbidden("Admin role required to export audit logs");
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  const query = parseQueryParams(url);

  // Validate format
  const format = (query.format?.toLowerCase() as ExportFormat) ?? "json";
  if (format !== "json" && format !== "csv") {
    throw errors.badRequest("Invalid format. Supported formats: json, csv");
  }

  const params = buildQueryParams(query, ctx.user.orgId);
  // Allow larger exports
  params.limit = Math.min(parseInt(query.limit ?? "10000", 10), 50000);

  const data = await exportAuditLogs(params, format);
  const contentType = getExportContentType(format);
  const filename = getExportFilename(format, ctx.user.orgId);

  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.end(data);
}

/**
 * Handle GET /api/platform/audit/:id - Get single audit entry
 */
async function handleGetAuditLog(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  id: string,
): Promise<void> {
  if (!ctx.user) {
    throw errors.unauthorized();
  }

  if (!isAdmin(ctx.user.role)) {
    throw errors.forbidden("Admin role required to view audit logs");
  }

  const log = await getAuditLogById(id, ctx.user.orgId);

  if (!log) {
    throw errors.notFound("Audit log entry");
  }

  sendJson(res, { log });
}

/**
 * Main audit routes handler
 */
export const handleAudit: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;

  // Only support GET method for audit logs
  if (req.method !== "GET") {
    sendError(res, "METHOD_NOT_ALLOWED", "Method not allowed", { allowed: ["GET"] });
    return;
  }

  try {
    // Route: GET /api/platform/audit/stats
    if (path.endsWith("/audit/stats")) {
      await handleAuditStats(req, res, ctx);
      return;
    }

    // Route: GET /api/platform/audit/export
    if (path.endsWith("/audit/export")) {
      await handleExportAuditLogs(req, res, ctx);
      return;
    }

    // Route: GET /api/platform/audit/:id
    const idMatch = parsePathParams("/api/platform/audit/:id", path);
    if (idMatch && idMatch.id) {
      await handleGetAuditLog(req, res, ctx, idMatch.id);
      return;
    }

    // Route: GET /api/platform/audit (list)
    if (path.endsWith("/audit") || path.endsWith("/audit/")) {
      await handleListAuditLogs(req, res, ctx);
      return;
    }

    // No route matched
    sendError(res, "NOT_FOUND", "Audit route not found");
  } catch (error) {
    if ((error as PlatformError).code) {
      const platformError = error as PlatformError;
      sendError(res, platformError.code, platformError.message, platformError.details);
    } else {
      console.error("[audit-routes] Error:", error);
      sendError(res, "INTERNAL_ERROR", "An unexpected error occurred");
    }
  }
};
