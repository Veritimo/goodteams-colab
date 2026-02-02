/**
 * Tenant Management Module
 *
 * Handles multi-tenant gateway lifecycle, health monitoring, and configuration.
 */

// Config generator
export {
  generateTenantConfig,
  generateTenantToken,
  writeConfigToFile,
  generateAndWriteConfig,
  getConfigPath,
  getTenantBasePath,
  type GeneratedConfig,
} from "./config-generator.js";

// Credential vault
export {
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
} from "./credential-vault.js";

// Gateway manager
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
  type GatewayProcess,
  type GatewayInfo,
  type GatewayStatus,
} from "./gateway-manager.js";

// Gateway health monitor
export {
  startHealthMonitor,
  stopHealthMonitor,
  isHealthMonitorRunning,
  checkGatewayHealth,
  triggerHealthCheck,
  getBackoffInfo,
  clearBackoff,
} from "./gateway-health.js";

// Port allocator
export {
  PortAllocator,
  createPortAllocator,
  PORT_RANGE,
  TOTAL_PORTS,
  type PortAllocatorOptions,
  type AllocatedPort,
} from "./port-allocator.js";

// Router
export {
  extractSubdomain,
  getOrganizationBySlug,
  getTenantGateway,
  resolveTenant,
  tenantContextMiddleware,
  createTenantProxy,
  getTenantContext,
  TENANT_ID_HEADER,
  type TenantContext,
  type TenantRequest,
} from "./router.js";

// WebSocket proxy
export { setupWebSocketProxy } from "./ws-proxy.js";
