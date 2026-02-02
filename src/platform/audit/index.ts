/**
 * Platform Audit Logging Module
 *
 * Comprehensive audit logging system for GoodTeams platform.
 * Provides structured audit event logging, querying, and export capabilities.
 *
 * Usage:
 *   import { logAudit, AUDIT_ACTIONS, queryAuditLogs } from '@/platform/audit';
 *
 *   // Log an audit event
 *   await logAudit(ctx, AUDIT_ACTIONS.USER_ROLE_CHANGED, 'user', userId, {
 *     previousRole: 'member',
 *     newRole: 'admin',
 *   });
 *
 *   // Query audit logs
 *   const logs = await queryAuditLogs({
 *     organizationId: 'org-123',
 *     action: 'user.*',
 *     limit: 50,
 *   });
 *
 * See: docs/AUDIT-LOGGING-SPEC.md
 */

export const AUDIT_MODULE_VERSION = "1.0.0";

// Logger
export {
  logAudit,
  logSystemAudit,
  logAuditBatch,
  getAuditLogById,
  type AuditContext,
  type SystemAuditContext,
  type LogAuditOptions,
} from "./logger.js";

// Actions
export {
  AUDIT_ACTIONS,
  TARGET_TYPES,
  RISK_LEVELS,
  ACTION_RISK_LEVELS,
  type AuditAction,
  type TargetType,
  type RiskLevel,
} from "./actions.js";

// Query
export {
  queryAuditLogs,
  queryAuditLogsPaginated,
  countAuditLogs,
  getAuditStats,
  getUserActivity,
  getResourceActivity,
  getHighRiskEvents,
  type AuditQueryParams,
  type PaginatedAuditLogs,
  type AuditStats,
} from "./query.js";

// Context
export {
  createAuditContext,
  createAuditContextFromUser,
  extractClientIp,
  sanitizeUserAgent,
  hasAuditContext,
} from "./context.js";

// Export
export {
  exportAuditLogs,
  auditLogsToCsv,
  auditLogsToJson,
  getExportContentType,
  getExportFilename,
  streamAuditExport,
  type ExportFormat,
} from "./export.js";
