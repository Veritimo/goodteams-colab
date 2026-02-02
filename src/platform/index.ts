/**
 * GoodTeams Platform Module
 *
 * Core platform layer for multi-tenant SaaS functionality.
 * Built on top of OpenClaw gateway infrastructure.
 *
 * Modules:
 *   - db: Database access via Prisma
 *   - api: Platform REST API
 *   - auth: Authentication and authorization (Phase 2)
 *   - audit: Audit logging utilities (Phase 2)
 */

// Database
export * from "./db/index.js";

// Platform API
export {
  createPlatformApiHandler,
  PLATFORM_API_BASE_PATH,
  PlatformError,
  sendError,
} from "./api/index.js";
export type {
  RequestContext,
  PlatformErrorCode,
  PlatformErrorResponse,
} from "./api/index.js";

// Auth (stub for Phase 2)
export { AUTH_MODULE_VERSION } from "./auth/index.js";

// Audit
export {
  AUDIT_MODULE_VERSION,
  logAudit,
  logSystemAudit,
  logAuditBatch,
  getAuditLogById,
  AUDIT_ACTIONS,
  TARGET_TYPES,
  RISK_LEVELS,
  queryAuditLogs,
  queryAuditLogsPaginated,
  countAuditLogs,
  getAuditStats,
  createAuditContext,
  createAuditContextFromUser,
  exportAuditLogs,
} from "./audit/index.js";
export type {
  AuditContext,
  SystemAuditContext,
  AuditAction,
  TargetType,
  RiskLevel,
  AuditQueryParams,
  PaginatedAuditLogs,
  ExportFormat,
} from "./audit/index.js";
