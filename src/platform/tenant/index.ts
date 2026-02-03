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

// Config templates
export {
  getDefaultConfig,
  getPlanFeatures,
  getPlanLimits,
  isFeatureEnabled,
  mergeFeatures,
  mergeLimits,
  isValidPlan,
  PLAN_MODELS,
  PLAN_FEATURES,
  PLAN_LIMITS,
  DEFAULT_AGENT_SETTINGS,
  type Plan,
  type PlanFeatures,
  type PlanLimits,
  type DefaultTenantConfig,
} from "./config-templates.js";

// Gateway provisioner
export {
  GatewayProvisioner,
  createGatewayProvisioner,
  provisionTenant,
  deprovisionTenant,
  getProvisioningStatus,
  restartTenant,
  ProvisioningError,
  TENANTS_BASE_PATH,
  HEALTH_CHECK_CONFIG,
  type ProvisioningResult,
  type DeprovisioningResult,
  type ProvisioningStatus,
  type ProvisionOptions,
  type DeprovisionOptions,
} from "./gateway-provisioner.js";

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
