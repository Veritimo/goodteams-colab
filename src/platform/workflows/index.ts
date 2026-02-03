/**
 * Workflow Module
 *
 * Visual workflow engine with agent-assisted creation.
 * Reference: docs/IMPLEMENTATION-PLAN-PHASE7.md
 */

// =============================================================================
// TYPES
// =============================================================================

export * from "./types.js";

// =============================================================================
// VALIDATION
// =============================================================================

export {
  validateDefinition,
  validateNodeConfig,
  extractVariableReferences,
  validateVariableReferences,
  ValidationErrorCodes,
  ValidationWarningCodes,
} from "./validation.js";

// =============================================================================
// SERVICE (CRUD Operations)
// =============================================================================

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
} from "./service.js";
export type {
  WorkflowWithDefinition,
  WorkflowWithExecutions,
  WorkflowExecutionWithContext,
} from "./service.js";

// =============================================================================
// NODE EXECUTORS
// =============================================================================

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
  // Validation helpers
  validateTriggerConfig as validateTriggerNodeConfig,
  validateAgentConfig,
  validateToolConfig as validateToolNodeConfig,
  validateConditionConfig,
  validateCommunicationConfig,
  validateIteratorConfig,
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
} from "./nodes/index.js";

// Node types
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
} from "./nodes/index.js";

// =============================================================================
// TOOLS (Agent-accessible)
// =============================================================================

export * from "./tools/index.js";

// =============================================================================
// TRIGGERS
// =============================================================================

export * from "./triggers/index.js";
