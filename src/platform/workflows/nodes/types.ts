/**
 * Workflow Node Types and Interfaces
 *
 * Type definitions for workflow node executors.
 */

export type NodeId = string;

/**
 * Node types supported by the workflow engine
 */
export type NodeType = "trigger" | "agent" | "tool" | "condition" | "communication" | "iterator";

/**
 * Base configuration shared by all nodes
 */
export interface BaseNodeConfig {
  label?: string;
}

/**
 * Trigger node configuration
 */
export interface TriggerNodeConfig extends BaseNodeConfig {
  triggerType: "manual" | "cron" | "webhook" | "chat" | "email";
  cronExpression?: string;
  timezone?: string;
  webhookPath?: string;
  webhookSecret?: string;
  triggerPhrase?: string;
}

/**
 * Agent node configuration
 */
export interface AgentNodeConfig extends BaseNodeConfig {
  systemPrompt?: string;
  prompt: string;
  model?: string;
  temperature?: number;
  tools?: string[];
  maxTokens?: number;
}

/**
 * Tool node configuration
 */
export interface ToolNodeConfig extends BaseNodeConfig {
  toolName: string;
  [key: string]: unknown;
}

/**
 * Condition node configuration
 */
export interface ConditionNodeConfig extends BaseNodeConfig {
  expression: string;
}

/**
 * Communication node configuration
 */
export interface CommunicationNodeConfig extends BaseNodeConfig {
  method: "email" | "teams" | "chat";
  to?: string;
  subject?: string;
  body: string;
  teamId?: string;
  channelId?: string;
  conversationId?: string;
  fromName?: string;
  fromEmail?: string;
}

/**
 * Iterator node configuration
 */
export interface IteratorNodeConfig extends BaseNodeConfig {
  collection: string;
  itemVariable: string;
  maxConcurrency?: number;
}

/**
 * Union of all node configurations
 */
export type NodeConfig =
  | TriggerNodeConfig
  | AgentNodeConfig
  | ToolNodeConfig
  | ConditionNodeConfig
  | CommunicationNodeConfig
  | IteratorNodeConfig;

/**
 * Execution context passed to node executors
 */
export interface ExecutionContext {
  /** Input variables passed to workflow */
  inputs: Record<string, unknown>;
  /** Outputs from previously executed nodes, keyed by node ID */
  nodeOutputs: Record<NodeId, unknown>;
  /** Global variables available throughout workflow */
  globalVariables: Record<string, unknown>;
  /** Current workflow execution ID */
  executionId?: string;
  /** Current workflow ID */
  workflowId?: string;
  /** ID of the organization/tenant */
  organizationId?: string;
  /** ID of the user who triggered the workflow */
  triggeredBy?: string;
}

/**
 * Trigger node output
 */
export interface TriggerNodeOutput {
  triggered: true;
  timestamp: Date;
  triggerType: TriggerNodeConfig["triggerType"];
  payload?: Record<string, unknown>;
}

/**
 * Agent node output
 */
export interface AgentNodeOutput {
  text: string;
  toolCalls?: Array<{ name: string; args: unknown; result: unknown }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens?: number;
  };
}

/**
 * Tool node output - varies based on tool
 */
export type ToolNodeOutput = unknown;

/**
 * Condition node output
 */
export interface ConditionNodeOutput {
  result: boolean;
  nextHandle: "true" | "false";
  evaluatedExpression: string;
}

/**
 * Communication node output
 */
export interface CommunicationNodeOutput {
  sent: true;
  method: CommunicationNodeConfig["method"];
  timestamp: Date;
  to?: string;
  teamId?: string;
  channelId?: string;
  conversationId?: string;
}

/**
 * Iterator node output
 */
export interface IteratorNodeOutput {
  iterations: number;
  results: unknown[];
  errors: Array<{ index: number; item: unknown; error: string }>;
}

/**
 * Union of all node outputs
 */
export type NodeOutput =
  | TriggerNodeOutput
  | AgentNodeOutput
  | ToolNodeOutput
  | ConditionNodeOutput
  | CommunicationNodeOutput
  | IteratorNodeOutput;

/**
 * Node executor function signature
 */
export type NodeExecutor<C = NodeConfig, O = NodeOutput> = (
  config: C,
  context: ExecutionContext,
) => Promise<O>;

/**
 * Tool registry interface for tool node executor
 */
export interface ToolRegistry {
  getTool(name: string): ToolDefinition | undefined;
  hasTool(name: string): boolean;
  listTools(): string[];
}

/**
 * Tool definition
 */
export interface ToolDefinition {
  name: string;
  description?: string;
  execute: (args: Record<string, unknown>, context: ExecutionContext) => Promise<unknown>;
}

/**
 * Email sender interface for communication node
 */
export interface EmailSender {
  send(options: {
    to: string;
    subject: string;
    body: string;
    html?: string;
    from?: { name: string; email: string };
  }): Promise<void>;
}

/**
 * Teams client interface for communication node
 */
export interface TeamsClient {
  sendMessage(options: { teamId: string; channelId: string; message: string }): Promise<void>;
}

/**
 * Chat client interface for communication node
 */
export interface ChatClient {
  sendMessage(options: { conversationId: string; message: string }): Promise<void>;
}

/**
 * LLM client interface for agent node
 */
export interface LLMClient {
  generateText(options: {
    model?: string;
    systemPrompt?: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
    tools?: string[];
  }): Promise<{
    text: string;
    toolCalls?: Array<{ name: string; args: unknown; result: unknown }>;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens?: number;
    };
  }>;
}

/**
 * Dependencies that can be injected into node executors
 */
export interface NodeDependencies {
  llmClient?: LLMClient;
  toolRegistry?: ToolRegistry;
  emailSender?: EmailSender;
  teamsClient?: TeamsClient;
  chatClient?: ChatClient;
}

/**
 * Error thrown by node executors
 */
export class NodeExecutionError extends Error {
  constructor(
    public nodeType: NodeType,
    message: string,
    public cause?: Error,
  ) {
    super(`[${nodeType}] ${message}`);
    this.name = "NodeExecutionError";
  }
}
