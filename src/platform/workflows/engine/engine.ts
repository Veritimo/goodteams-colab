/**
 * Workflow Engine
 *
 * Core engine for variable resolution and graph traversal.
 * Handles {{variable}} and {variable} syntax for dynamic values.
 */

import type {
  ExecutionContext,
  NodeId,
  WorkflowDefinition,
  WorkflowNode,
  ConditionResult,
} from "../types.js";

/**
 * Regular expression for exact variable match (entire string is a variable reference)
 * Supports both {{path}} and {path} syntax
 * Path format: letters, numbers, underscores, dots, hyphens
 */
const EXACT_VARIABLE_REGEX = /^\{{1,2}([a-zA-Z0-9_.\-]+)\}{1,2}$/;

/**
 * Regular expression for inline variable replacement within strings
 */
const INLINE_VARIABLE_REGEX = /\{{1,2}([a-zA-Z0-9_.\-]+)\}{1,2}/g;

/**
 * WorkflowEngine handles variable resolution and graph traversal
 */
export class WorkflowEngine {
  constructor(
    private definition: WorkflowDefinition,
    private context: ExecutionContext,
  ) {}

  /**
   * Get the workflow definition
   */
  getDefinition(): WorkflowDefinition {
    return this.definition;
  }

  /**
   * Get the execution context
   */
  getContext(): ExecutionContext {
    return this.context;
  }

  /**
   * Update the context (for use when context changes during execution)
   */
  updateContext(context: ExecutionContext): void {
    this.context = context;
  }

  /**
   * Resolve variables in a configuration value.
   *
   * Handles:
   * - Exact variable references: "{{nodes.step1.output}}" returns raw value
   * - Inline variables: "Hello {{inputs.name}}" returns interpolated string
   * - Nested objects and arrays
   * - Both {{...}} and {...} syntax
   *
   * Variable path formats:
   * - inputs.fieldName - Access input values
   * - nodes.nodeId.path - Access node outputs
   * - globalVarName - Access global variables
   */
  resolveVariables(config: unknown): unknown {
    if (typeof config === "string") {
      return this.resolveStringVariables(config);
    }

    if (Array.isArray(config)) {
      return config.map((item) => this.resolveVariables(item));
    }

    if (config !== null && typeof config === "object") {
      const resolved: Record<string, unknown> = {};
      for (const key in config) {
        resolved[key] = this.resolveVariables((config as Record<string, unknown>)[key]);
      }
      return resolved;
    }

    // Primitives (number, boolean, null, undefined) pass through unchanged
    return config;
  }

  /**
   * Resolve variables in a string value
   */
  private resolveStringVariables(value: string): unknown {
    // Check for exact match (entire string is a variable)
    const exactMatch = value.match(EXACT_VARIABLE_REGEX);

    if (exactMatch) {
      const path = exactMatch[1];

      // Safety check: Don't resolve if it looks like JSON
      if (path.includes(":") || path.includes('"')) {
        return value;
      }

      const resolved = this.resolvePath(path);

      // If resolution failed, return original
      if (resolved === undefined) {
        return value;
      }

      return resolved;
    }

    // Inline replacement for string templates
    return value.replace(INLINE_VARIABLE_REGEX, (match, path: string) => {
      const resolved = this.resolvePath(path);

      if (resolved === undefined || resolved === null) {
        return ""; // Empty string for unresolved inline variables
      }

      // Stringify objects/arrays for inline interpolation
      if (typeof resolved === "object") {
        return JSON.stringify(resolved);
      }

      return String(resolved);
    });
  }

  /**
   * Resolve a dot-separated path to a value
   *
   * Supported path formats:
   * - "inputs.fieldName" - input values
   * - "nodes.nodeId.propertyPath" - node outputs
   * - "globalVarName.path" - global variables or direct node output
   */
  private resolvePath(path: string): unknown {
    const parts = path.trim().split(".");
    const source = parts[0];
    const propertyPath = parts.slice(1);

    let value: unknown;
    let activePropertyPath = propertyPath;

    if (source === "inputs") {
      // Access input values: inputs.fieldName
      value = this.context.inputs;
    } else if (source === "nodes" && propertyPath.length > 0) {
      // Access node outputs: nodes.nodeId.path
      const nodeId = propertyPath[0];
      value = this.context.nodeOutputs[nodeId];
      activePropertyPath = propertyPath.slice(1);
    } else if (this.context.nodeOutputs[source] !== undefined) {
      // Direct node reference: nodeId.path
      value = this.context.nodeOutputs[source];
    } else if (this.context.globalVariables[source] !== undefined) {
      // Global variable reference: globalVar.path
      value = this.context.globalVariables[source];
    } else {
      // Unresolved
      return undefined;
    }

    // Navigate the property path
    for (const segment of activePropertyPath) {
      if (value !== undefined && value !== null && typeof value === "object") {
        value = (value as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Find a node by ID
   */
  getNode(nodeId: NodeId): WorkflowNode | undefined {
    return this.definition.nodes.find((n) => n.id === nodeId);
  }

  /**
   * Get the next nodes to execute based on edges and node result.
   *
   * For condition nodes, uses sourceHandle ('true'/'false') to determine path.
   * For other nodes, returns all connected targets.
   */
  getNextNodes(currentNodeId: NodeId, result?: ConditionResult): NodeId[] {
    const node = this.getNode(currentNodeId);
    if (!node) return [];

    // Get all edges from this node
    const edges = this.definition.edges.filter((e) => e.source === currentNodeId);

    // For condition nodes, filter by sourceHandle
    if (node.type === "condition" && result?.nextHandle) {
      return edges.filter((e) => e.sourceHandle === result.nextHandle).map((e) => e.target);
    }

    // For other nodes, return all targets
    return edges.map((e) => e.target);
  }

  /**
   * Get the start nodes (nodes with no incoming edges, typically triggers)
   */
  getStartNodes(): NodeId[] {
    const targetIds = new Set(this.definition.edges.map((e) => e.target));
    return this.definition.nodes.filter((n) => !targetIds.has(n.id)).map((n) => n.id);
  }

  /**
   * Get trigger nodes specifically
   */
  getTriggerNodes(): WorkflowNode[] {
    return this.definition.nodes.filter((n) => n.type === "trigger");
  }

  /**
   * Validate that all edge targets/sources reference existing nodes
   */
  validateEdges(): { valid: boolean; errors: string[] } {
    const nodeIds = new Set(this.definition.nodes.map((n) => n.id));
    const errors: string[] = [];

    for (const edge of this.definition.edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push(`Edge ${edge.id} has invalid source: ${edge.source}`);
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`Edge ${edge.id} has invalid target: ${edge.target}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
