/**
 * Workflow Node Executors
 *
 * Registry and dispatcher for workflow node execution.
 */

// Types
export * from "./types.js";

// Individual Node Executors
export { executeTriggerNode, validateTriggerConfig } from "./trigger.js";

export {
  executeAgentNode,
  executeAgentNodeExecutor,
  resolveVariables,
  validateAgentConfig,
  setDefaultLLMClient,
  getLLMClient,
  createAnthropicClient,
} from "./agent.js";

export {
  executeToolNode,
  executeToolNodeExecutor,
  resolveArgsVariables,
  validateToolConfig,
  setDefaultToolRegistry,
  getToolRegistry,
  createToolRegistry,
} from "./tool.js";

export { executeConditionNode, evaluateExpression, validateConditionConfig } from "./condition.js";

export {
  executeCommunicationNode,
  executeCommunicationNodeExecutor,
  validateCommunicationConfig,
  setDefaultEmailSender,
  setDefaultTeamsClient,
  setDefaultChatClient,
  getEmailSender,
  getTeamsClient,
  getChatClient,
  createStubEmailSender,
  createStubTeamsClient,
  createStubChatClient,
} from "./communication.js";
export type { CommunicationClients } from "./communication.js";

export {
  executeIteratorNode,
  executeIteratorNodeExecutor,
  validateIteratorConfig,
  getIterationItems,
} from "./iterator.js";
export type { IteratorCallback } from "./iterator.js";

import type {
  NodeType,
  NodeConfig,
  NodeOutput,
  ExecutionContext,
  NodeExecutor,
  TriggerNodeConfig,
  AgentNodeConfig,
  ToolNodeConfig,
  ConditionNodeConfig,
  CommunicationNodeConfig,
  IteratorNodeConfig,
  TriggerNodeOutput,
  AgentNodeOutput,
  ConditionNodeOutput,
  CommunicationNodeOutput,
  IteratorNodeOutput,
} from "./types.js";
import { executeAgentNode, validateAgentConfig } from "./agent.js";
import { executeCommunicationNode, validateCommunicationConfig } from "./communication.js";
import { executeConditionNode, validateConditionConfig } from "./condition.js";
import { executeIteratorNode, validateIteratorConfig } from "./iterator.js";
import { executeToolNode, validateToolConfig } from "./tool.js";
import { executeTriggerNode, validateTriggerConfig } from "./trigger.js";
import { NodeExecutionError } from "./types.js";

/**
 * Node executor registry
 * Maps node type to executor function
 */
const nodeExecutors: Record<NodeType, NodeExecutor<NodeConfig, NodeOutput>> = {
  trigger: executeTriggerNode as NodeExecutor<NodeConfig, NodeOutput>,
  agent: executeAgentNode as NodeExecutor<NodeConfig, NodeOutput>,
  tool: executeToolNode as NodeExecutor<NodeConfig, NodeOutput>,
  condition: executeConditionNode as NodeExecutor<NodeConfig, NodeOutput>,
  communication: executeCommunicationNode as NodeExecutor<NodeConfig, NodeOutput>,
  iterator: executeIteratorNode as NodeExecutor<NodeConfig, NodeOutput>,
};

/**
 * Node validator registry
 * Maps node type to validation function
 */
const nodeValidators: Record<NodeType, (config: NodeConfig) => string[]> = {
  trigger: (config) => validateTriggerConfig(config as TriggerNodeConfig),
  agent: (config) => validateAgentConfig(config as AgentNodeConfig),
  tool: (config) => validateToolConfig(config as ToolNodeConfig),
  condition: (config) => validateConditionConfig(config as ConditionNodeConfig),
  communication: (config) => validateCommunicationConfig(config as CommunicationNodeConfig),
  iterator: (config) => validateIteratorConfig(config as IteratorNodeConfig),
};

/**
 * Execute a node by type
 *
 * @param type - Node type
 * @param config - Node configuration
 * @param context - Execution context
 * @returns Node output
 */
export async function executeNode(
  type: NodeType,
  config: NodeConfig,
  context: ExecutionContext,
): Promise<NodeOutput> {
  const executor = nodeExecutors[type];

  if (!executor) {
    throw new NodeExecutionError(type, `Unknown node type: ${type}`);
  }

  return executor(config, context);
}

/**
 * Execute a node with type-safe config and output
 */
export async function executeTypedNode<T extends NodeType>(
  type: T,
  config: NodeConfigForType<T>,
  context: ExecutionContext,
): Promise<NodeOutputForType<T>> {
  return executeNode(type, config, context) as Promise<NodeOutputForType<T>>;
}

/**
 * Validate a node configuration
 *
 * @param type - Node type
 * @param config - Node configuration
 * @returns Array of validation errors (empty if valid)
 */
export function validateNode(type: NodeType, config: NodeConfig): string[] {
  const validator = nodeValidators[type];

  if (!validator) {
    return [`Unknown node type: ${type}`];
  }

  return validator(config);
}

/**
 * Check if a node type is supported
 */
export function isValidNodeType(type: string): type is NodeType {
  return type in nodeExecutors;
}

/**
 * Get all supported node types
 */
export function getSupportedNodeTypes(): NodeType[] {
  return Object.keys(nodeExecutors) as NodeType[];
}

/**
 * Register a custom node executor
 *
 * @param type - Node type name
 * @param executor - Executor function
 * @param validator - Optional validation function
 */
export function registerNodeExecutor(
  type: string,
  executor: NodeExecutor<NodeConfig, NodeOutput>,
  validator?: (config: NodeConfig) => string[],
): void {
  (nodeExecutors as Record<string, NodeExecutor<NodeConfig, NodeOutput>>)[type] = executor;
  if (validator) {
    (nodeValidators as Record<string, (config: NodeConfig) => string[]>)[type] = validator;
  } else {
    (nodeValidators as Record<string, (config: NodeConfig) => string[]>)[type] = () => [];
  }
}

/**
 * Unregister a custom node executor
 */
export function unregisterNodeExecutor(type: string): boolean {
  const executors = nodeExecutors as Record<string, NodeExecutor<NodeConfig, NodeOutput>>;
  const validators = nodeValidators as Record<string, (config: NodeConfig) => string[]>;

  if (type in executors) {
    delete executors[type];
    delete validators[type];
    return true;
  }
  return false;
}

// Type helpers for type-safe node execution
type NodeConfigForType<T extends NodeType> = T extends "trigger"
  ? TriggerNodeConfig
  : T extends "agent"
    ? AgentNodeConfig
    : T extends "tool"
      ? ToolNodeConfig
      : T extends "condition"
        ? ConditionNodeConfig
        : T extends "communication"
          ? CommunicationNodeConfig
          : T extends "iterator"
            ? IteratorNodeConfig
            : never;

type NodeOutputForType<T extends NodeType> = T extends "trigger"
  ? TriggerNodeOutput
  : T extends "agent"
    ? AgentNodeOutput
    : T extends "tool"
      ? unknown
      : T extends "condition"
        ? ConditionNodeOutput
        : T extends "communication"
          ? CommunicationNodeOutput
          : T extends "iterator"
            ? IteratorNodeOutput
            : never;
