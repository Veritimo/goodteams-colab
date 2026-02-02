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
 *   - tenant: Multi-tenancy config and credentials (Phase 3)
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
export type { RequestContext, PlatformErrorCode, PlatformErrorResponse } from "./api/index.js";

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

// Tenant - Config & Credentials
export {
  generateTenantConfig,
  generateTenantToken,
  writeConfigToFile,
  generateAndWriteConfig,
  getConfigPath,
  getTenantBasePath,
  setCredential,
  getCredential,
  deleteCredential,
  listCredentialKeys,
  rotateCredential,
  hasCredential,
  deleteAllCredentials,
  getEncryptionKey,
  CredentialKeyMissingError,
  CredentialDecryptionError,
} from "./tenant/index.js";

// Tenant - Gateway Manager
export {
  spawnGateway,
  stopGateway,
  restartGateway,
  getGatewayProcess,
  getGatewayStatus,
  sendSignal,
  isGatewayRunning,
  getRunningGatewayIds,
  stopAllGateways,
} from "./tenant/index.js";

// Tenant - Health Monitor
export {
  startHealthMonitor,
  stopHealthMonitor,
  isHealthMonitorRunning,
  checkGatewayHealth,
  triggerHealthCheck,
  getBackoffInfo,
  clearBackoff,
} from "./tenant/index.js";

// Tenant - Router
export {
  extractSubdomain,
  getOrganizationBySlug,
  getTenantGateway,
  resolveTenant,
  tenantContextMiddleware,
  createTenantProxy,
  getTenantContext,
  TENANT_ID_HEADER,
} from "./tenant/index.js";

// Tenant - Port Allocator
export { PortAllocator, createPortAllocator, PORT_RANGE, TOTAL_PORTS } from "./tenant/index.js";

// Tenant - WebSocket Proxy
export { setupWebSocketProxy } from "./tenant/index.js";

// Tenant Types
export type {
  GeneratedConfig,
  GatewayProcess,
  GatewayInfo,
  GatewayStatus,
  PortAllocatorOptions,
  AllocatedPort,
  TenantContext,
  TenantRequest,
} from "./tenant/index.js";
