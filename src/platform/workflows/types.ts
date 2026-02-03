/**
 * Workflow Type Definitions
 *
 * Type definitions for the visual workflow system.
 * Based on React Flow node/edge structure for seamless canvas integration.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §3
 */

import type { WorkflowStatus, ExecutionStatus, TriggerType } from "@prisma/client";

// Re-export Prisma enums for convenience
export type { WorkflowStatus, ExecutionStatus, TriggerType };

// =============================================================================
// NODE TYPES
// =============================================================================

/**
 * Unique identifier for nodes within a workflow
 */
export type NodeId = string;

/**
 * Supported node types in the workflow system
 */
export type WorkflowNodeType =
  | "trigger"
  | "agent"
  | "tool"
  | "condition"
  | "communication"
  | "iterator";

/**
 * Position of a node on the workflow canvas
 */
export interface NodePosition {
  x: number;
  y: number;
}

// =============================================================================
// NODE CONFIGURATIONS
// =============================================================================

/**
 * Trigger node configuration
 * Starting point for workflow execution
 */
export interface TriggerNodeConfig {
  triggerType: TriggerType;
  /** Cron expression for scheduled triggers */
  cronExpression?: string;
  /** Timezone for cron triggers (e.g., "America/New_York") */
  timezone?: string;
  /** Auto-generated unique path for webhook triggers */
  webhookPath?: string;
  /** Secret for webhook signature verification */
  webhookSecret?: string;
  /** Phrase to detect for chat triggers */
  triggerPhrase?: string;
  /** Email filter patterns for email triggers */
  emailFilters?: {
    from?: string;
    subject?: string;
  };
  /** Schema for validating workflow inputs */
  inputSchema?: Record<
    string,
    {
      type?: string;
      required?: boolean;
      pattern?: string;
      minimum?: number;
      maximum?: number;
      description?: string;
    }
  >;
}

/**
 * Agent node configuration
 * LLM execution with optional tool access
 */
export interface AgentNodeConfig {
  /** System prompt for the LLM */
  systemPrompt?: string;
  /** User prompt - supports {{variable}} interpolation */
  prompt: string;
  /** Override the default model */
  model?: string;
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Tool names the agent can use */
  tools?: string[];
  /** Maximum tokens to generate */
  maxTokens?: number;
}

/**
 * Tool node configuration
 * Direct tool execution without LLM
 */
export interface ToolNodeConfig {
  /** Name of the registered tool to execute */
  toolName: string;
  /** Tool-specific arguments - supports {{variable}} interpolation */
  [key: string]: unknown;
}

/**
 * Condition node configuration
 * Branch based on expression evaluation
 */
export interface ConditionNodeConfig {
  /** JavaScript expression to evaluate - supports {{variable}} interpolation */
  expression: string;
}

/**
 * Communication node configuration
 * Send notifications via various channels
 */
export interface CommunicationNodeConfig {
  /** Communication method */
  method: "email" | "teams" | "chat" | "webhook";
  /** Email recipient(s) */
  to?: string | string[];
  /** Email subject */
  subject?: string;
  /** Message body - supports {{variable}} interpolation */
  body: string;
  /** Teams team ID */
  teamId?: string;
  /** Teams channel ID */
  channelId?: string;
  /** Chat conversation ID */
  conversationId?: string;
  /** Webhook URL for outbound webhooks */
  webhookUrl?: string;
}

/**
 * Iterator node configuration
 * Loop over collections
 */
export interface IteratorNodeConfig {
  /** Path to collection - supports {{variable}} interpolation */
  collection: string;
  /** Variable name for current item in each iteration */
  itemVariable: string;
  /** Variable name for current index */
  indexVariable?: string;
  /** Maximum iterations (safety limit) */
  maxIterations?: number;
}

/**
 * Union of all node configuration types
 */
export type NodeConfig =
  | TriggerNodeConfig
  | AgentNodeConfig
  | ToolNodeConfig
  | ConditionNodeConfig
  | CommunicationNodeConfig
  | IteratorNodeConfig;

// =============================================================================
// WORKFLOW NODE
// =============================================================================

/**
 * Data stored on a workflow node
 */
export interface WorkflowNodeData {
  /** Human-readable label for the node */
  label?: string;
  /** Type-specific configuration */
  config: NodeConfig;
}

/**
 * A node in the workflow graph
 */
export interface WorkflowNode {
  /** Unique identifier within the workflow */
  id: NodeId;
  /** Node type */
  type: WorkflowNodeType;
  /** Position on the canvas */
  position: NodePosition;
  /** Node data including config */
  data: WorkflowNodeData;
}

// =============================================================================
// WORKFLOW EDGE
// =============================================================================

/**
 * An edge connecting two nodes in the workflow graph
 */
export interface WorkflowEdge {
  /** Unique identifier for the edge */
  id: string;
  /** Source node ID */
  source: NodeId;
  /** Target node ID */
  target: NodeId;
  /** Source handle for conditional nodes ('true' | 'false') */
  sourceHandle?: string;
  /** Optional label for the edge */
  label?: string;
}

// =============================================================================
// WORKFLOW DEFINITION
// =============================================================================

/**
 * Global configuration for the workflow
 */
export interface WorkflowGlobalConfig {
  /** Maximum execution time in milliseconds */
  maxExecutionTime?: number;
  /** Whether to retry on transient errors */
  retryOnError?: boolean;
  /** Number of retry attempts */
  maxRetries?: number;
  /** Notify on workflow completion */
  notifyOnComplete?: boolean;
  /** Email sender configuration */
  emailSender?: {
    fromName?: string;
    fromEmail?: string;
  };
  /** Default timeout for individual nodes (ms) */
  nodeTimeout?: number;
}

/**
 * Complete workflow definition stored as JSON
 */
export interface WorkflowDefinition {
  /** Nodes in the workflow */
  nodes: WorkflowNode[];
  /** Edges connecting nodes */
  edges: WorkflowEdge[];
  /** Global workflow configuration */
  globalConfig?: WorkflowGlobalConfig;
}

// =============================================================================
// EXECUTION CONTEXT
// =============================================================================

/**
 * Log entry for workflow execution
 */
export interface ExecutionLogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Node that generated this log (null for workflow-level logs) */
  nodeId: NodeId | null;
  /** Log message */
  message: string;
  /** Log level */
  level: "debug" | "info" | "warn" | "error" | "success";
  /** Optional additional data */
  data?: Record<string, unknown>;
}

/**
 * Context maintained during workflow execution
 */
export interface ExecutionContext {
  /** Initial inputs to the workflow */
  inputs: Record<string, unknown>;
  /** Outputs from each completed node, keyed by node ID */
  nodeOutputs: Record<NodeId, unknown>;
  /** Global variables accessible to all nodes */
  globalVariables: Record<string, unknown>;
}

// =============================================================================
// NODE OUTPUTS
// =============================================================================

/**
 * Output from an agent node execution
 */
export interface AgentNodeOutput {
  /** Generated text response */
  text: string;
  /** Tool calls made during execution */
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }>;
  /** Token usage statistics */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Output from a tool node execution
 */
export interface ToolNodeOutput {
  /** Tool execution result */
  result: unknown;
  /** Whether the tool execution succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Output from a condition node evaluation
 */
export interface ConditionNodeOutput {
  /** The evaluated result */
  result: boolean;
  /** The evaluated expression (for debugging) */
  expression: string;
}

/**
 * Output from a communication node
 */
export interface CommunicationNodeOutput {
  /** Whether the message was sent successfully */
  sent: boolean;
  /** Message ID or delivery ID */
  messageId?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Output from an iterator node
 */
export interface IteratorNodeOutput {
  /** Number of iterations completed */
  iterationCount: number;
  /** Results from each iteration */
  results: unknown[];
}

// =============================================================================
// SERVICE TYPES
// =============================================================================

/**
 * Input for creating a new workflow
 */
export interface CreateWorkflowInput {
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  triggerType?: TriggerType;
  triggerConfig?: Record<string, unknown>;
}

/**
 * Input for updating an existing workflow
 */
export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  definition?: WorkflowDefinition;
  status?: WorkflowStatus;
  triggerType?: TriggerType;
  triggerConfig?: Record<string, unknown>;
}

/**
 * Filters for listing workflows
 */
export interface ListWorkflowsFilters {
  status?: WorkflowStatus;
  triggerType?: TriggerType;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Input for creating a workflow execution
 */
export interface CreateExecutionInput {
  inputs?: Record<string, unknown>;
  triggeredBy?: string;
}

/**
 * Input for updating an execution
 */
export interface UpdateExecutionInput {
  status?: ExecutionStatus;
  context?: ExecutionContext;
  logs?: ExecutionLogEntry[];
  error?: string;
  finishedAt?: Date;
}

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Result of workflow definition validation
 */
export interface ValidationResult {
  /** Whether the definition is valid */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings (non-blocking) */
  warnings: ValidationWarning[];
}

/**
 * A validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Path to the problematic element (e.g., "nodes[0].data.config.prompt") */
  path?: string;
  /** ID of the node with the error */
  nodeId?: NodeId;
}

/**
 * A validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Path to the element */
  path?: string;
  /** ID of the node with the warning */
  nodeId?: NodeId;
}

// =============================================================================
// ENGINE TYPES
// =============================================================================

/**
 * Result from condition node evaluation (used by engine)
 */
export interface ConditionResult {
  /** The evaluated result */
  result: boolean;
  /** The handle to use for next node selection */
  nextHandle: "true" | "false";
}

/**
 * Data for a workflow job in the queue
 */
export interface WorkflowJobData {
  /** Execution ID */
  executionId: string;
  /** Node ID to execute */
  nodeId: string;
  /** Optional retry count */
  retryCount?: number;
}

// =============================================================================
// RE-EXPORTS FOR CONVENIENCE
// =============================================================================

// Re-export Prisma model types for consumers who need them
export type { Workflow, WorkflowExecution } from "@prisma/client";
