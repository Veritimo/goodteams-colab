/**
 * Tool Node Executor
 *
 * Direct tool execution without LLM intermediary.
 * Looks up tools from the platform tool registry and executes with resolved args.
 */

import type {
  ToolNodeConfig,
  ToolNodeOutput,
  ExecutionContext,
  NodeExecutor,
  ToolRegistry,
  ToolDefinition,
} from "./types.js";
import { NodeExecutionError } from "./types.js";

/** Variable injection pattern: {{variable}} or {{nodes.nodeId.field}} */
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * Default tool registry
 * Can be overridden for testing or to use different tool sources
 */
let defaultToolRegistry: ToolRegistry | undefined;

/**
 * Set the default tool registry
 */
export function setDefaultToolRegistry(registry: ToolRegistry): void {
  defaultToolRegistry = registry;
}

/**
 * Get the current tool registry
 */
export function getToolRegistry(): ToolRegistry | undefined {
  return defaultToolRegistry;
}

/**
 * Create a simple in-memory tool registry
 */
export function createToolRegistry(tools?: ToolDefinition[]): ToolRegistry {
  const toolMap = new Map<string, ToolDefinition>();

  if (tools) {
    for (const tool of tools) {
      toolMap.set(tool.name, tool);
    }
  }

  return {
    getTool(name: string): ToolDefinition | undefined {
      return toolMap.get(name);
    },
    hasTool(name: string): boolean {
      return toolMap.has(name);
    },
    listTools(): string[] {
      return Array.from(toolMap.keys());
    },
  };
}

/**
 * Execute a tool node
 *
 * @param config - Tool node configuration including toolName and args
 * @param context - Current execution context
 * @param toolRegistry - Optional tool registry override
 * @returns Tool execution result
 */
export async function executeToolNode(
  config: ToolNodeConfig,
  context: ExecutionContext,
  toolRegistry?: ToolRegistry,
): Promise<ToolNodeOutput> {
  const registry = toolRegistry ?? defaultToolRegistry;

  if (!registry) {
    throw new NodeExecutionError(
      "tool",
      "Tool registry not configured. Call setDefaultToolRegistry() or pass a registry directly.",
    );
  }

  const { toolName, ...args } = config;

  if (!toolName) {
    throw new NodeExecutionError("tool", "Missing 'toolName' in configuration");
  }

  // Look up the tool
  const tool = registry.getTool(toolName);
  if (!tool) {
    const availableTools = registry.listTools();
    throw new NodeExecutionError(
      "tool",
      `Tool '${toolName}' not found. Available tools: ${availableTools.join(", ") || "none"}`,
    );
  }

  // Resolve variables in args
  const resolvedArgs = resolveArgsVariables(args, context);

  try {
    const result = await tool.execute(resolvedArgs, context);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new NodeExecutionError(
      "tool",
      `Tool '${toolName}' execution failed: ${message}`,
      error as Error,
    );
  }
}

/**
 * Resolve variables in tool arguments
 * Handles nested objects and arrays
 */
export function resolveArgsVariables(
  args: Record<string, unknown>,
  context: ExecutionContext,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (key === "label") continue; // Skip internal config
    resolved[key] = resolveValue(value, context);
  }

  return resolved;
}

/**
 * Resolve a single value, handling different types
 */
function resolveValue(value: unknown, context: ExecutionContext): unknown {
  if (typeof value === "string") {
    return resolveStringVariables(value, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, context));
  }

  if (value !== null && typeof value === "object") {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveValue(val, context);
    }
    return resolved;
  }

  return value;
}

/**
 * Resolve variables in a string
 */
function resolveStringVariables(template: string, context: ExecutionContext): unknown {
  // Check if the entire string is a single variable reference
  const fullMatch = template.match(/^\{\{([^}]+)\}\}$/);
  if (fullMatch) {
    // Return the raw value (preserves type)
    const value = resolvePath(fullMatch[1].trim(), context);
    return value !== undefined ? value : template;
  }

  // Otherwise, do string interpolation
  return template.replace(VARIABLE_PATTERN, (match, path) => {
    const value = resolvePath(path.trim(), context);
    if (value === undefined) {
      console.warn(`[ToolNode] Variable not found: ${path}`);
      return match;
    }
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

/**
 * Resolve a dot-notation path to a value
 */
function resolvePath(path: string, context: ExecutionContext): unknown {
  const parts = path.split(".");

  // Handle prefixed paths
  if (parts[0] === "inputs") {
    return getNestedValue(context.inputs, parts.slice(1));
  }
  if (parts[0] === "nodes") {
    return getNestedValue(context.nodeOutputs, parts.slice(1));
  }
  if (parts[0] === "globals") {
    return getNestedValue(context.globalVariables, parts.slice(1));
  }

  // Unprefixed paths: check inputs first, then globals
  const inputValue = getNestedValue(context.inputs, parts);
  if (inputValue !== undefined) {
    return inputValue;
  }

  return getNestedValue(context.globalVariables, parts);
}

/**
 * Get a nested value from an object using a path array
 */
function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  if (path.length === 0) return obj;

  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Validate tool node configuration
 */
export function validateToolConfig(config: ToolNodeConfig, registry?: ToolRegistry): string[] {
  const errors: string[] = [];

  if (!config.toolName) {
    errors.push("toolName is required");
  } else if (registry && !registry.hasTool(config.toolName)) {
    errors.push(`Tool '${config.toolName}' not found in registry`);
  }

  return errors;
}

/**
 * Node executor function that matches the standard signature
 */
export const executeToolNodeExecutor: NodeExecutor<ToolNodeConfig, ToolNodeOutput> = (
  config,
  context,
) => executeToolNode(config, context);
