/**
 * Workflow Definition Validation
 *
 * Validates workflow definitions for structural correctness,
 * cycle detection, and node-specific configuration requirements.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §4
 */

import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  NodeId,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  TriggerNodeConfig,
  AgentNodeConfig,
  ToolNodeConfig,
  ConditionNodeConfig,
  CommunicationNodeConfig,
  IteratorNodeConfig,
} from "./types.js";

// =============================================================================
// VALIDATION ERROR CODES
// =============================================================================

export const ValidationErrorCodes = {
  // Structure errors
  EMPTY_DEFINITION: "EMPTY_DEFINITION",
  INVALID_NODE_STRUCTURE: "INVALID_NODE_STRUCTURE",
  INVALID_EDGE_STRUCTURE: "INVALID_EDGE_STRUCTURE",
  DUPLICATE_NODE_ID: "DUPLICATE_NODE_ID",
  DUPLICATE_EDGE_ID: "DUPLICATE_EDGE_ID",

  // Graph errors
  CYCLE_DETECTED: "CYCLE_DETECTED",
  ORPHAN_NODE: "ORPHAN_NODE",
  MISSING_TRIGGER: "MISSING_TRIGGER",
  MULTIPLE_TRIGGERS: "MULTIPLE_TRIGGERS",
  DANGLING_EDGE: "DANGLING_EDGE",
  MISSING_CONDITION_BRANCHES: "MISSING_CONDITION_BRANCHES",

  // Node config errors
  INVALID_NODE_TYPE: "INVALID_NODE_TYPE",
  MISSING_REQUIRED_CONFIG: "MISSING_REQUIRED_CONFIG",
  INVALID_CONFIG_VALUE: "INVALID_CONFIG_VALUE",
  INVALID_VARIABLE_REFERENCE: "INVALID_VARIABLE_REFERENCE",
} as const;

export const ValidationWarningCodes = {
  UNUSED_NODE_OUTPUT: "UNUSED_NODE_OUTPUT",
  DEEP_NESTING: "DEEP_NESTING",
  LARGE_WORKFLOW: "LARGE_WORKFLOW",
  NO_TERMINAL_NODE: "NO_TERMINAL_NODE",
} as const;

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Validate a complete workflow definition
 *
 * @param definition - The workflow definition to validate
 * @returns Validation result with errors and warnings
 */
export function validateDefinition(definition: WorkflowDefinition): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Basic structure validation
  if (!definition || typeof definition !== "object") {
    errors.push({
      code: ValidationErrorCodes.EMPTY_DEFINITION,
      message: "Workflow definition must be an object",
    });
    return { valid: false, errors, warnings };
  }

  const { nodes = [], edges = [] } = definition;

  // Validate nodes array
  if (!Array.isArray(nodes)) {
    errors.push({
      code: ValidationErrorCodes.INVALID_NODE_STRUCTURE,
      message: "Nodes must be an array",
      path: "nodes",
    });
    return { valid: false, errors, warnings };
  }

  // Validate edges array
  if (!Array.isArray(edges)) {
    errors.push({
      code: ValidationErrorCodes.INVALID_EDGE_STRUCTURE,
      message: "Edges must be an array",
      path: "edges",
    });
    return { valid: false, errors, warnings };
  }

  // Empty workflow is valid but warn
  if (nodes.length === 0) {
    return { valid: true, errors, warnings };
  }

  // Validate individual nodes
  const nodeIds = new Set<string>();
  const nodeMap = new Map<string, WorkflowNode>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodeErrors = validateNode(node, i);
    errors.push(...nodeErrors);

    if (node?.id) {
      if (nodeIds.has(node.id)) {
        errors.push({
          code: ValidationErrorCodes.DUPLICATE_NODE_ID,
          message: `Duplicate node ID: ${node.id}`,
          path: `nodes[${i}].id`,
          nodeId: node.id,
        });
      } else {
        nodeIds.add(node.id);
        nodeMap.set(node.id, node);
      }
    }
  }

  // Validate node configurations
  for (const node of nodes) {
    if (node?.id && node?.type && node?.data?.config) {
      const configErrors = validateNodeConfig(node);
      errors.push(...configErrors);
    }
  }

  // Validate edges
  const edgeIds = new Set<string>();
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const edgeErrors = validateEdge(edge, i, nodeIds);
    errors.push(...edgeErrors);

    if (edge?.id) {
      if (edgeIds.has(edge.id)) {
        errors.push({
          code: ValidationErrorCodes.DUPLICATE_EDGE_ID,
          message: `Duplicate edge ID: ${edge.id}`,
          path: `edges[${i}].id`,
        });
      } else {
        edgeIds.add(edge.id);
      }
    }
  }

  // Stop here if basic validation failed
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // Graph structure validation
  const graphErrors = validateGraphStructure(nodes, edges, nodeMap);
  errors.push(...graphErrors.errors);
  warnings.push(...graphErrors.warnings);

  // Check for cycles
  const cycleError = detectCycles(nodes, edges);
  if (cycleError) {
    errors.push(cycleError);
  }

  // Validate condition node branches
  const conditionErrors = validateConditionBranches(nodes, edges);
  errors.push(...conditionErrors);

  // Add warnings for large workflows
  if (nodes.length > 50) {
    warnings.push({
      code: ValidationWarningCodes.LARGE_WORKFLOW,
      message: `Workflow has ${nodes.length} nodes. Consider breaking into smaller workflows.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// NODE VALIDATION
// =============================================================================

/**
 * Validate a single node's structure
 */
function validateNode(node: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `nodes[${index}]`;

  if (!node || typeof node !== "object") {
    errors.push({
      code: ValidationErrorCodes.INVALID_NODE_STRUCTURE,
      message: "Node must be an object",
      path,
    });
    return errors;
  }

  const n = node as Record<string, unknown>;

  // Required: id
  if (typeof n.id !== "string" || n.id.trim() === "") {
    errors.push({
      code: ValidationErrorCodes.INVALID_NODE_STRUCTURE,
      message: "Node must have a string id",
      path: `${path}.id`,
    });
  }

  // Required: type
  const validTypes: WorkflowNodeType[] = [
    "trigger",
    "agent",
    "tool",
    "condition",
    "communication",
    "iterator",
  ];
  if (typeof n.type !== "string" || !validTypes.includes(n.type as WorkflowNodeType)) {
    errors.push({
      code: ValidationErrorCodes.INVALID_NODE_TYPE,
      message: `Node type must be one of: ${validTypes.join(", ")}`,
      path: `${path}.type`,
      nodeId: n.id as string,
    });
  }

  // Required: position
  if (!n.position || typeof n.position !== "object") {
    errors.push({
      code: ValidationErrorCodes.INVALID_NODE_STRUCTURE,
      message: "Node must have a position object",
      path: `${path}.position`,
      nodeId: n.id as string,
    });
  } else {
    const pos = n.position as Record<string, unknown>;
    if (typeof pos.x !== "number" || typeof pos.y !== "number") {
      errors.push({
        code: ValidationErrorCodes.INVALID_NODE_STRUCTURE,
        message: "Node position must have numeric x and y",
        path: `${path}.position`,
        nodeId: n.id as string,
      });
    }
  }

  // Required: data.config
  if (!n.data || typeof n.data !== "object") {
    errors.push({
      code: ValidationErrorCodes.INVALID_NODE_STRUCTURE,
      message: "Node must have a data object",
      path: `${path}.data`,
      nodeId: n.id as string,
    });
  } else {
    const data = n.data as Record<string, unknown>;
    if (!data.config || typeof data.config !== "object") {
      errors.push({
        code: ValidationErrorCodes.INVALID_NODE_STRUCTURE,
        message: "Node data must have a config object",
        path: `${path}.data.config`,
        nodeId: n.id as string,
      });
    }
  }

  return errors;
}

/**
 * Validate node configuration based on node type
 */
export function validateNodeConfig(node: WorkflowNode): ValidationError[] {
  const errors: ValidationError[] = [];
  const { id, type, data } = node;
  const config = data.config;
  const path = `nodes.${id}.data.config`;

  switch (type) {
    case "trigger":
      errors.push(...validateTriggerConfig(config as TriggerNodeConfig, path, id));
      break;
    case "agent":
      errors.push(...validateAgentConfig(config as AgentNodeConfig, path, id));
      break;
    case "tool":
      errors.push(...validateToolConfig(config as ToolNodeConfig, path, id));
      break;
    case "condition":
      errors.push(...validateConditionConfig(config as ConditionNodeConfig, path, id));
      break;
    case "communication":
      errors.push(...validateCommunicationConfig(config as CommunicationNodeConfig, path, id));
      break;
    case "iterator":
      errors.push(...validateIteratorConfig(config as IteratorNodeConfig, path, id));
      break;
  }

  return errors;
}

/**
 * Validate trigger node configuration
 */
function validateTriggerConfig(
  config: TriggerNodeConfig,
  path: string,
  nodeId: NodeId,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.triggerType) {
    errors.push({
      code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
      message: "Trigger node requires triggerType",
      path: `${path}.triggerType`,
      nodeId,
    });
    return errors;
  }

  // Cron-specific validation
  if (config.triggerType === "CRON") {
    if (!config.cronExpression) {
      errors.push({
        code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
        message: "Cron trigger requires cronExpression",
        path: `${path}.cronExpression`,
        nodeId,
      });
    } else if (!isValidCronExpression(config.cronExpression)) {
      errors.push({
        code: ValidationErrorCodes.INVALID_CONFIG_VALUE,
        message: "Invalid cron expression",
        path: `${path}.cronExpression`,
        nodeId,
      });
    }
  }

  return errors;
}

/**
 * Validate agent node configuration
 */
function validateAgentConfig(
  config: AgentNodeConfig,
  path: string,
  nodeId: NodeId,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.prompt || typeof config.prompt !== "string" || config.prompt.trim() === "") {
    errors.push({
      code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
      message: "Agent node requires a non-empty prompt",
      path: `${path}.prompt`,
      nodeId,
    });
  }

  if (config.temperature !== undefined) {
    if (
      typeof config.temperature !== "number" ||
      config.temperature < 0 ||
      config.temperature > 2
    ) {
      errors.push({
        code: ValidationErrorCodes.INVALID_CONFIG_VALUE,
        message: "Temperature must be a number between 0 and 2",
        path: `${path}.temperature`,
        nodeId,
      });
    }
  }

  if (config.maxTokens !== undefined) {
    if (typeof config.maxTokens !== "number" || config.maxTokens < 1) {
      errors.push({
        code: ValidationErrorCodes.INVALID_CONFIG_VALUE,
        message: "maxTokens must be a positive number",
        path: `${path}.maxTokens`,
        nodeId,
      });
    }
  }

  if (config.tools !== undefined && !Array.isArray(config.tools)) {
    errors.push({
      code: ValidationErrorCodes.INVALID_CONFIG_VALUE,
      message: "tools must be an array of tool names",
      path: `${path}.tools`,
      nodeId,
    });
  }

  return errors;
}

/**
 * Validate tool node configuration
 */
function validateToolConfig(
  config: ToolNodeConfig,
  path: string,
  nodeId: NodeId,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.toolName || typeof config.toolName !== "string" || config.toolName.trim() === "") {
    errors.push({
      code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
      message: "Tool node requires a toolName",
      path: `${path}.toolName`,
      nodeId,
    });
  }

  return errors;
}

/**
 * Validate condition node configuration
 */
function validateConditionConfig(
  config: ConditionNodeConfig,
  path: string,
  nodeId: NodeId,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (
    !config.expression ||
    typeof config.expression !== "string" ||
    config.expression.trim() === ""
  ) {
    errors.push({
      code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
      message: "Condition node requires an expression",
      path: `${path}.expression`,
      nodeId,
    });
  }

  return errors;
}

/**
 * Validate communication node configuration
 */
function validateCommunicationConfig(
  config: CommunicationNodeConfig,
  path: string,
  nodeId: NodeId,
): ValidationError[] {
  const errors: ValidationError[] = [];

  const validMethods = ["email", "teams", "chat", "webhook"];
  if (!config.method || !validMethods.includes(config.method)) {
    errors.push({
      code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
      message: `Communication node requires method (${validMethods.join(", ")})`,
      path: `${path}.method`,
      nodeId,
    });
    return errors;
  }

  if (!config.body || typeof config.body !== "string") {
    errors.push({
      code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
      message: "Communication node requires a body",
      path: `${path}.body`,
      nodeId,
    });
  }

  // Method-specific validation
  if (config.method === "email") {
    if (!config.to) {
      errors.push({
        code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
        message: "Email communication requires 'to' address",
        path: `${path}.to`,
        nodeId,
      });
    }
  }

  if (config.method === "teams") {
    if (!config.teamId || !config.channelId) {
      errors.push({
        code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
        message: "Teams communication requires teamId and channelId",
        path: `${path}`,
        nodeId,
      });
    }
  }

  if (config.method === "webhook") {
    if (!config.webhookUrl) {
      errors.push({
        code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
        message: "Webhook communication requires webhookUrl",
        path: `${path}.webhookUrl`,
        nodeId,
      });
    }
  }

  return errors;
}

/**
 * Validate iterator node configuration
 */
function validateIteratorConfig(
  config: IteratorNodeConfig,
  path: string,
  nodeId: NodeId,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.collection || typeof config.collection !== "string") {
    errors.push({
      code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
      message: "Iterator node requires a collection path",
      path: `${path}.collection`,
      nodeId,
    });
  }

  if (!config.itemVariable || typeof config.itemVariable !== "string") {
    errors.push({
      code: ValidationErrorCodes.MISSING_REQUIRED_CONFIG,
      message: "Iterator node requires an itemVariable name",
      path: `${path}.itemVariable`,
      nodeId,
    });
  }

  if (config.maxIterations !== undefined) {
    if (typeof config.maxIterations !== "number" || config.maxIterations < 1) {
      errors.push({
        code: ValidationErrorCodes.INVALID_CONFIG_VALUE,
        message: "maxIterations must be a positive number",
        path: `${path}.maxIterations`,
        nodeId,
      });
    }
  }

  return errors;
}

// =============================================================================
// EDGE VALIDATION
// =============================================================================

/**
 * Validate a single edge's structure
 */
function validateEdge(edge: unknown, index: number, nodeIds: Set<string>): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `edges[${index}]`;

  if (!edge || typeof edge !== "object") {
    errors.push({
      code: ValidationErrorCodes.INVALID_EDGE_STRUCTURE,
      message: "Edge must be an object",
      path,
    });
    return errors;
  }

  const e = edge as Record<string, unknown>;

  // Required: id
  if (typeof e.id !== "string" || e.id.trim() === "") {
    errors.push({
      code: ValidationErrorCodes.INVALID_EDGE_STRUCTURE,
      message: "Edge must have a string id",
      path: `${path}.id`,
    });
  }

  // Required: source
  if (typeof e.source !== "string" || e.source.trim() === "") {
    errors.push({
      code: ValidationErrorCodes.INVALID_EDGE_STRUCTURE,
      message: "Edge must have a source node ID",
      path: `${path}.source`,
    });
  } else if (!nodeIds.has(e.source)) {
    errors.push({
      code: ValidationErrorCodes.DANGLING_EDGE,
      message: `Edge source references non-existent node: ${e.source}`,
      path: `${path}.source`,
    });
  }

  // Required: target
  if (typeof e.target !== "string" || e.target.trim() === "") {
    errors.push({
      code: ValidationErrorCodes.INVALID_EDGE_STRUCTURE,
      message: "Edge must have a target node ID",
      path: `${path}.target`,
    });
  } else if (!nodeIds.has(e.target)) {
    errors.push({
      code: ValidationErrorCodes.DANGLING_EDGE,
      message: `Edge target references non-existent node: ${e.target}`,
      path: `${path}.target`,
    });
  }

  return errors;
}

// =============================================================================
// GRAPH STRUCTURE VALIDATION
// =============================================================================

/**
 * Validate the overall graph structure
 */
function validateGraphStructure(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeMap: Map<string, WorkflowNode>,
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Build adjacency lists
  const incomingEdges = new Map<string, WorkflowEdge[]>();
  const outgoingEdges = new Map<string, WorkflowEdge[]>();

  for (const node of nodes) {
    incomingEdges.set(node.id, []);
    outgoingEdges.set(node.id, []);
  }

  for (const edge of edges) {
    incomingEdges.get(edge.target)?.push(edge);
    outgoingEdges.get(edge.source)?.push(edge);
  }

  // Check for trigger nodes
  const triggerNodes = nodes.filter((n) => n.type === "trigger");
  if (triggerNodes.length === 0) {
    errors.push({
      code: ValidationErrorCodes.MISSING_TRIGGER,
      message: "Workflow must have at least one trigger node",
    });
  } else if (triggerNodes.length > 1) {
    errors.push({
      code: ValidationErrorCodes.MULTIPLE_TRIGGERS,
      message: "Workflow should have only one trigger node",
    });
  }

  // Check for orphan nodes (nodes with no incoming edges, except trigger)
  for (const node of nodes) {
    if (node.type !== "trigger") {
      const incoming = incomingEdges.get(node.id) || [];
      if (incoming.length === 0) {
        errors.push({
          code: ValidationErrorCodes.ORPHAN_NODE,
          message: `Node "${node.data.label || node.id}" has no incoming connections`,
          nodeId: node.id,
        });
      }
    }
  }

  // Check for terminal nodes (nodes with no outgoing edges)
  const terminalNodes = nodes.filter((n) => {
    const outgoing = outgoingEdges.get(n.id) || [];
    return outgoing.length === 0 && n.type !== "trigger";
  });

  if (terminalNodes.length === 0 && nodes.length > 1) {
    warnings.push({
      code: ValidationWarningCodes.NO_TERMINAL_NODE,
      message: "Workflow has no terminal nodes - may indicate a cycle",
    });
  }

  return { errors, warnings };
}

/**
 * Detect cycles in the workflow graph using DFS
 */
function detectCycles(nodes: WorkflowNode[], edges: WorkflowEdge[]): ValidationError | null {
  const adjacencyList = new Map<string, string[]>();

  // Initialize adjacency list
  for (const node of nodes) {
    adjacencyList.set(node.id, []);
  }

  // Build adjacency list from edges
  for (const edge of edges) {
    adjacencyList.get(edge.source)?.push(edge.target);
  }

  // DFS state
  const WHITE = 0; // Not visited
  const GRAY = 1; // Currently visiting (in stack)
  const BLACK = 2; // Finished visiting

  const colors = new Map<string, number>();
  for (const node of nodes) {
    colors.set(node.id, WHITE);
  }

  // DFS function
  function hasCycle(nodeId: string, path: string[]): string[] | null {
    colors.set(nodeId, GRAY);
    path.push(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const neighborColor = colors.get(neighbor);

      if (neighborColor === GRAY) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        return path.slice(cycleStart);
      }

      if (neighborColor === WHITE) {
        const cycle = hasCycle(neighbor, [...path]);
        if (cycle) return cycle;
      }
    }

    colors.set(nodeId, BLACK);
    return null;
  }

  // Check each unvisited node
  for (const node of nodes) {
    if (colors.get(node.id) === WHITE) {
      const cycle = hasCycle(node.id, []);
      if (cycle) {
        return {
          code: ValidationErrorCodes.CYCLE_DETECTED,
          message: `Cycle detected: ${cycle.join(" → ")} → ${cycle[0]}`,
        };
      }
    }
  }

  return null;
}

/**
 * Validate that condition nodes have both true and false branches
 */
function validateConditionBranches(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const conditionNodes = nodes.filter((n) => n.type === "condition");

  for (const node of conditionNodes) {
    const outgoingEdges = edges.filter((e) => e.source === node.id);

    const hasTrueBranch = outgoingEdges.some((e) => e.sourceHandle === "true");
    const hasFalseBranch = outgoingEdges.some((e) => e.sourceHandle === "false");

    if (!hasTrueBranch && !hasFalseBranch) {
      // No branches at all - might be intentional terminal condition
      // Just ensure there's at least one outgoing edge
      if (outgoingEdges.length === 0) {
        errors.push({
          code: ValidationErrorCodes.MISSING_CONDITION_BRANCHES,
          message: `Condition node "${node.data.label || node.id}" has no outgoing connections`,
          nodeId: node.id,
        });
      }
    } else if (!hasTrueBranch || !hasFalseBranch) {
      // Has some branches defined but missing one
      const missing = !hasTrueBranch ? "true" : "false";
      errors.push({
        code: ValidationErrorCodes.MISSING_CONDITION_BRANCHES,
        message: `Condition node "${node.data.label || node.id}" is missing the "${missing}" branch`,
        nodeId: node.id,
      });
    }
  }

  return errors;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Basic cron expression validation
 * Validates 5-6 field cron expressions
 */
function isValidCronExpression(expr: string): boolean {
  if (!expr || typeof expr !== "string") return false;

  const parts = expr.trim().split(/\s+/);

  // Standard cron has 5 fields, some implementations have 6
  if (parts.length < 5 || parts.length > 6) {
    return false;
  }

  // Basic pattern check for each field
  const fieldPattern = /^(\*|(\d+(-\d+)?)(,\d+(-\d+)?)*|\*\/\d+|\d+\/\d+)$/;

  for (const part of parts) {
    if (!fieldPattern.test(part)) {
      return false;
    }
  }

  return true;
}

/**
 * Extract variable references from a template string
 * Returns array of variable paths like ["inputs.name", "nodes.query.result"]
 */
export function extractVariableReferences(template: string): string[] {
  const pattern = /\{\{([^}]+)\}\}/g;
  const matches: string[] = [];
  let match;

  while ((match = pattern.exec(template)) !== null) {
    matches.push(match[1].trim());
  }

  return matches;
}

/**
 * Validate that all variable references in the workflow are resolvable
 * This is a helper for runtime validation, not used in static validation
 */
export function validateVariableReferences(definition: WorkflowDefinition): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(definition.nodes.map((n) => n.id));

  for (const node of definition.nodes) {
    const config = node.data.config;
    const configStr = JSON.stringify(config);
    const refs = extractVariableReferences(configStr);

    for (const ref of refs) {
      const parts = ref.split(".");

      // Valid prefixes: inputs, nodes, globalVariables
      const validPrefixes = ["inputs", "nodes", "globalVariables"];
      if (!validPrefixes.includes(parts[0])) {
        errors.push({
          code: ValidationErrorCodes.INVALID_VARIABLE_REFERENCE,
          message: `Invalid variable reference: ${ref}. Must start with: ${validPrefixes.join(", ")}`,
          nodeId: node.id,
        });
        continue;
      }

      // If referencing another node, check it exists
      if (parts[0] === "nodes" && parts.length >= 2) {
        const refNodeId = parts[1];
        if (!nodeIds.has(refNodeId)) {
          errors.push({
            code: ValidationErrorCodes.INVALID_VARIABLE_REFERENCE,
            message: `Reference to non-existent node: ${refNodeId}`,
            nodeId: node.id,
          });
        }
      }
    }
  }

  return errors;
}
