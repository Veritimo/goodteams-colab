/**
 * Manual Trigger
 *
 * API-initiated workflow execution.
 * Reference: docs/IMPLEMENTATION-PLAN-PHASE7.md §7.1
 */

import type {
  Workflow,
  WorkflowExecution,
  ExecutionContext,
  TriggerNodeConfig,
  WorkflowDefinition,
  WorkflowNode,
} from "../types.js";

// =============================================================================
// TYPES
// =============================================================================

export interface ManualTriggerInput {
  inputs?: Record<string, unknown>;
  triggeredBy?: string;
  metadata?: Record<string, unknown>;
}

export interface ManualTriggerResult {
  executionId: string;
  status: string;
  startedAt: Date;
}

export interface WorkflowRepository {
  getWorkflow(workflowId: string): Promise<Workflow | null>;
  createExecution(params: {
    workflowId: string;
    triggeredBy: string;
    inputs: Record<string, unknown>;
  }): Promise<WorkflowExecution>;
}

export interface ExecutionQueue {
  enqueue(executionId: string, nodeId: string): Promise<void>;
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * Validates workflow inputs against the trigger's input schema (if defined).
 */
export function validateInputs(
  inputs: Record<string, unknown>,
  triggerConfig?: TriggerNodeConfig | null,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!triggerConfig?.inputSchema) {
    // No schema defined - all inputs are valid
    return { valid: true, errors: [] };
  }

  const schema = triggerConfig.inputSchema as Record<
    string,
    {
      type?: string;
      required?: boolean;
      pattern?: string;
      minimum?: number;
      maximum?: number;
    }
  >;

  for (const [key, spec] of Object.entries(schema)) {
    const value = inputs[key];

    // Check required
    if (spec.required && (value === undefined || value === null)) {
      errors.push(`Missing required input: ${key}`);
      continue;
    }

    // Skip type checking if value is not provided and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Check type
    if (spec.type) {
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (actualType !== spec.type) {
        errors.push(`Input '${key}' must be of type ${spec.type}, got ${actualType}`);
      }
    }

    // Check string pattern
    if (spec.pattern && typeof value === "string") {
      const regex = new RegExp(spec.pattern);
      if (!regex.test(value)) {
        errors.push(`Input '${key}' does not match pattern: ${spec.pattern}`);
      }
    }

    // Check number range
    if (typeof value === "number") {
      if (spec.minimum !== undefined && value < spec.minimum) {
        errors.push(`Input '${key}' must be >= ${spec.minimum}`);
      }
      if (spec.maximum !== undefined && value > spec.maximum) {
        errors.push(`Input '${key}' must be <= ${spec.maximum}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// FIND TRIGGER NODE
// =============================================================================

/**
 * Finds the trigger node in the workflow definition.
 */
export function findTriggerNode(workflow: Workflow): string | null {
  const definition = workflow.definition as unknown as WorkflowDefinition | null;
  if (!definition?.nodes) {
    return null;
  }

  const triggerNode = definition.nodes.find((node: WorkflowNode) => node.type === "trigger");
  return triggerNode?.id ?? null;
}

// =============================================================================
// MANUAL TRIGGER
// =============================================================================

/**
 * Executes a manual trigger for a workflow.
 */
export async function executeManualTrigger(
  workflowId: string,
  input: ManualTriggerInput,
  repository: WorkflowRepository,
  queue: ExecutionQueue,
): Promise<ManualTriggerResult> {
  // 1. Get workflow
  const workflow = await repository.getWorkflow(workflowId);

  if (!workflow) {
    throw new ManualTriggerError(`Workflow not found: ${workflowId}`, "WORKFLOW_NOT_FOUND");
  }

  // 2. Check workflow status
  if (workflow.status !== "ACTIVE" && workflow.status !== "DRAFT") {
    throw new ManualTriggerError(
      `Cannot execute workflow with status: ${workflow.status}`,
      "WORKFLOW_NOT_ACTIVE",
    );
  }

  // 3. Validate inputs
  const inputs = input.inputs ?? {};
  const triggerConfig = workflow.triggerConfig as unknown as TriggerNodeConfig | null;
  const validation = validateInputs(inputs, triggerConfig);

  if (!validation.valid) {
    throw new ManualTriggerError(
      `Invalid inputs: ${validation.errors.join("; ")}`,
      "INVALID_INPUTS",
    );
  }

  // 4. Find trigger node
  const triggerNodeId = findTriggerNode(workflow);

  if (!triggerNodeId) {
    throw new ManualTriggerError("Workflow has no trigger node", "NO_TRIGGER_NODE");
  }

  // 5. Create execution
  const execution = await repository.createExecution({
    workflowId,
    triggeredBy: input.triggeredBy ?? "manual",
    inputs,
  });

  // 6. Queue first node for execution
  await queue.enqueue(execution.id, triggerNodeId);

  return {
    executionId: execution.id,
    status: execution.status,
    startedAt: execution.startedAt,
  };
}

// =============================================================================
// ERROR CLASS
// =============================================================================

export class ManualTriggerError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "WORKFLOW_NOT_FOUND"
      | "WORKFLOW_NOT_ACTIVE"
      | "INVALID_INPUTS"
      | "NO_TRIGGER_NODE",
  ) {
    super(message);
    this.name = "ManualTriggerError";
  }
}
