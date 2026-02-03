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

// =============================================================================
// CONNECTORS (Phase 6)
// =============================================================================

// Types
export {
  ConnectionType,
  ConnectionStatus,
  type ConnectionConfig,
  type ConnectionCredentials,
  type ConnectorCreateInput,
  type ConnectorUpdateInput,
  type ConnectorWithHints,
  type SchemaTable,
  type SchemaColumn,
  type SchemaRelationship,
  type SchemaHintInput,
  type PooledConnection,
  type HealthCheckResult,
  type HealthCheckOptions,
} from "./connectors/index.js";

// Connector Service
export {
  createConnector,
  getConnector,
  getConnectorWithHints,
  listConnectors,
  updateConnector,
  deleteConnector,
  updateConnectorStatus,
  encryptCredentials,
  decryptCredentials,
  ConnectorNotFoundError,
  ConnectorEncryptionError,
} from "./connectors/index.js";

// Connection Pool
export { ConnectionPool, getConnectionPool } from "./connectors/index.js";

// Health Checker
export { HealthChecker, createHealthChecker } from "./connectors/index.js";

// Schema Hints
export {
  createSchemaHint,
  getSchemaHint,
  listSchemaHints,
  updateSchemaHint,
  deleteSchemaHint,
  deleteAllSchemaHints,
  getSchemaCache,
  updateSchemaCache,
  refreshSchemaCache,
  SchemaHintNotFoundError,
} from "./connectors/schema-hints/index.js";

// Hints Engine
export {
  applyHintsToContext,
  formatHintsForLLM,
  getRelevantHints,
  HintsEngine,
} from "./connectors/schema-hints/index.js";

// =============================================================================
// WORKFLOWS (Phase 7)
// =============================================================================

// Workflow Types
export type {
  NodeId,
  WorkflowNode,
  WorkflowEdge,
  WorkflowDefinition,
  WorkflowGlobalConfig,
  WorkflowNodeType,
  TriggerNodeConfig,
  AgentNodeConfig,
  ToolNodeConfig,
  ConditionNodeConfig,
  CommunicationNodeConfig,
  IteratorNodeConfig,
  ExecutionContext,
  WorkflowStatus,
  ExecutionStatus,
  TriggerType,
  Workflow,
  WorkflowExecution,
  ExecutionLogEntry,
  AgentNodeOutput,
  ConditionNodeOutput,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  ListWorkflowsFilters,
  CreateExecutionInput,
  UpdateExecutionInput,
  PaginatedResponse,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "./workflows/types.js";

// Workflow Validation
export {
  validateDefinition,
  validateNodeConfig,
  extractVariableReferences,
  validateVariableReferences,
  ValidationErrorCodes,
  ValidationWarningCodes,
} from "./workflows/validation.js";

// Workflow Service (CRUD Operations)
export {
  // Workflow CRUD
  createWorkflow,
  getWorkflow,
  getWorkflowWithExecutions,
  listWorkflows,
  updateWorkflow,
  deleteWorkflow,
  hardDeleteWorkflow,
  // Execution CRUD
  createExecution,
  getExecution,
  listExecutions,
  updateExecution,
  appendExecutionLog,
  setNodeOutput,
  // Utility functions
  workflowExists,
  getActiveWorkflowsByTrigger,
  getExecutionStats,
  getWorkflowByWebhookPath,
  // Error classes
  WorkflowNotFoundError,
  WorkflowAlreadyExistsError,
  WorkflowValidationError,
  ExecutionNotFoundError,
  WorkflowNotActiveError,
  WorkflowAccessDeniedError,
} from "./workflows/service.js";
export type {
  WorkflowWithDefinition,
  WorkflowWithExecutions,
  WorkflowExecutionWithContext,
} from "./workflows/service.js";

// Workflow Node Executors
export {
  // Main dispatcher
  executeNode,
  executeTypedNode,
  validateNode,
  isValidNodeType,
  getSupportedNodeTypes,
  registerNodeExecutor,
  unregisterNodeExecutor,
  // Individual executors
  executeTriggerNode,
  executeAgentNode,
  executeAgentNodeExecutor,
  executeToolNode,
  executeToolNodeExecutor,
  executeConditionNode,
  executeCommunicationNode,
  executeCommunicationNodeExecutor,
  executeIteratorNode,
  executeIteratorNodeExecutor,
  // Validation helpers (with aliases to avoid conflicts)
  validateTriggerConfig as validateTriggerNodeConfig,
  validateAgentConfig,
  validateToolConfig as validateToolNodeConfig,
  validateConditionConfig as validateConditionNodeConfig,
  validateCommunicationConfig as validateCommunicationNodeConfig,
  validateIteratorConfig as validateIteratorNodeConfig,
  // Agent node utilities
  resolveVariables,
  setDefaultLLMClient,
  getLLMClient,
  createAnthropicClient,
  // Tool node utilities
  resolveArgsVariables,
  setDefaultToolRegistry,
  getToolRegistry,
  createToolRegistry,
  // Condition node utilities
  evaluateExpression,
  // Communication node utilities
  setDefaultEmailSender,
  setDefaultTeamsClient,
  setDefaultChatClient,
  getEmailSender,
  getTeamsClient,
  getChatClient,
  createStubEmailSender,
  createStubTeamsClient,
  createStubChatClient,
  // Iterator node utilities
  getIterationItems,
  // Error class
  NodeExecutionError,
} from "./workflows/nodes/index.js";
export type {
  NodeType,
  NodeConfig as NodeExecutorConfig,
  NodeOutput,
  NodeExecutor,
  TriggerNodeConfig as NodeTriggerConfig,
  AgentNodeConfig as NodeAgentConfig,
  ToolNodeConfig as NodeToolConfig,
  ConditionNodeConfig as NodeConditionConfig,
  CommunicationNodeConfig as NodeCommunicationConfig,
  IteratorNodeConfig as NodeIteratorConfig,
  TriggerNodeOutput,
  AgentNodeOutput as NodeAgentOutput,
  ConditionNodeOutput as NodeConditionOutput,
  CommunicationNodeOutput as NodeCommunicationOutput,
  IteratorNodeOutput,
  ExecutionContext as NodeExecutionContext,
  ToolRegistry,
  ToolDefinition,
  EmailSender,
  TeamsClient,
  ChatClient,
  LLMClient,
  NodeDependencies,
  CommunicationClients,
  IteratorCallback,
} from "./workflows/nodes/index.js";

// Workflow Tools
export {
  createWorkflowTools,
  executeWorkflowList,
  executeWorkflowGet,
  executeWorkflowCreate,
  executeWorkflowUpdate,
  executeWorkflowExecute,
  executeWorkflowStatus,
  generateWorkflowFromPrompt,
  validateWorkflowDefinition,
  WORKFLOW_TOOL_DEFINITIONS,
  EXAMPLE_WORKFLOWS,
  WorkflowListSchema,
  WorkflowGetSchema,
  WorkflowCreateSchema,
  WorkflowUpdateSchema,
  WorkflowExecuteSchema,
  WorkflowStatusSchema,
} from "./workflows/tools/index.js";
export type {
  WorkflowToolContext,
  WorkflowService,
  WorkflowExecutor,
  WorkflowToolDependencies,
  LLMProvider,
  GeneratorContext,
  GeneratedWorkflow,
  WorkflowListParams,
  WorkflowGetParams,
  WorkflowCreateParams,
  WorkflowUpdateParams,
  WorkflowExecuteParams,
  WorkflowStatusParams,
} from "./workflows/tools/index.js";

// Workflow Triggers
export {
  // Manual Trigger
  executeManualTrigger,
  validateInputs,
  findTriggerNode,
  ManualTriggerError,
  // Cron Trigger
  registerCronTrigger,
  unregisterCronTrigger,
  getCronJob,
  getAllCronJobs,
  clearAllCronJobs,
  initCronTriggers,
  validateCronExpression,
  validateTimezone,
  CronTriggerError,
  // Webhook Trigger
  handleWebhookRequest,
  setupWebhookTrigger,
  regenerateWebhookSecret,
  generateWebhookSecret,
  generateWebhookPath,
  computeSignature,
  verifySignature,
  extractSignature,
  createWebhookRouteHandler,
  WebhookTriggerError,
  // Chat Trigger
  checkChatTriggers,
  executeChatTrigger,
  handleChatMessage,
  matchesTriggerPhrase,
  normalizeText,
  validateTriggerPhrase,
  suggestTriggerPhrase,
  // Trigger Registry
  TRIGGER_REGISTRY,
  getTriggerInfo,
  validateTriggerConfig,
  initializeTriggers,
  shutdownTriggers,
} from "./workflows/triggers/index.js";
export type {
  ManualTriggerInput,
  ManualTriggerResult,
  CronJob,
  CronScheduler,
  WebhookPayload,
  WebhookResult,
  WebhookRouteHandler,
  ChatMessage,
  ChatTriggerMatch,
  ChatTriggerResult,
  TriggerRegistry,
  TriggerDependencies,
  InitializationResult,
} from "./workflows/triggers/index.js";
