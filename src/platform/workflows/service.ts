/**
 * Workflow Service
 *
 * CRUD operations for workflows and workflow executions.
 * Handles validation, tenant isolation, and execution management.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §4
 */

import type {
  Workflow,
  WorkflowExecution,
  WorkflowStatus,
  ExecutionStatus,
  TriggerType,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import type {
  WorkflowDefinition,
  ExecutionContext,
  ExecutionLogEntry,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  ListWorkflowsFilters,
  CreateExecutionInput,
  UpdateExecutionInput,
  PaginatedResponse,
} from "./types.js";
import { prisma } from "../db/client.js";
import { validateDefinition, validateVariableReferences } from "./validation.js";

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Error thrown when a workflow is not found
 */
export class WorkflowNotFoundError extends Error {
  constructor(id: string) {
    super(`Workflow not found: ${id}`);
    this.name = "WorkflowNotFoundError";
  }
}

/**
 * Error thrown when a workflow with the same name exists in the organization
 */
export class WorkflowAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Workflow with name '${name}' already exists in this organization`);
    this.name = "WorkflowAlreadyExistsError";
  }
}

/**
 * Error thrown when workflow validation fails
 */
export class WorkflowValidationError extends Error {
  public readonly errors: Array<{ code: string; message: string; path?: string }>;

  constructor(errors: Array<{ code: string; message: string; path?: string }>) {
    const message = errors.map((e) => e.message).join("; ");
    super(`Workflow validation failed: ${message}`);
    this.name = "WorkflowValidationError";
    this.errors = errors;
  }
}

/**
 * Error thrown when an execution is not found
 */
export class ExecutionNotFoundError extends Error {
  constructor(id: string) {
    super(`Workflow execution not found: ${id}`);
    this.name = "ExecutionNotFoundError";
  }
}

/**
 * Error thrown when trying to execute a non-active workflow
 */
export class WorkflowNotActiveError extends Error {
  constructor(id: string, status: WorkflowStatus) {
    super(`Cannot execute workflow ${id} - status is ${status}, must be ACTIVE`);
    this.name = "WorkflowNotActiveError";
  }
}

/**
 * Error thrown for tenant access violations
 */
export class WorkflowAccessDeniedError extends Error {
  constructor() {
    super("Access denied: workflow belongs to a different organization");
    this.name = "WorkflowAccessDeniedError";
  }
}

// =============================================================================
// TYPE HELPERS
// =============================================================================

/**
 * Workflow with typed definition and executions
 */
export interface WorkflowWithDefinition extends Omit<Workflow, "definition" | "triggerConfig"> {
  definition: WorkflowDefinition;
  triggerConfig: Record<string, unknown> | null;
}

/**
 * Workflow with executions included
 */
export interface WorkflowWithExecutions extends WorkflowWithDefinition {
  executions: WorkflowExecutionWithContext[];
}

/**
 * Execution with typed context and logs
 */
export interface WorkflowExecutionWithContext extends Omit<WorkflowExecution, "context" | "logs"> {
  context: ExecutionContext;
  logs: ExecutionLogEntry[];
}

// =============================================================================
// WORKFLOW CRUD
// =============================================================================

/**
 * Create a new workflow
 *
 * @param organizationId - Organization ID (tenant)
 * @param userId - User creating the workflow
 * @param input - Workflow creation data
 * @returns Created workflow
 * @throws WorkflowValidationError if definition is invalid
 * @throws WorkflowAlreadyExistsError if name already exists
 */
export async function createWorkflow(
  organizationId: string,
  userId: string,
  input: CreateWorkflowInput,
): Promise<WorkflowWithDefinition> {
  // Validate the definition
  const validation = validateDefinition(input.definition);
  if (!validation.valid) {
    throw new WorkflowValidationError(validation.errors);
  }

  // Also validate variable references
  const refErrors = validateVariableReferences(input.definition);
  if (refErrors.length > 0) {
    throw new WorkflowValidationError(refErrors);
  }

  try {
    const workflow = await prisma.workflow.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description ?? null,
        definition: input.definition as unknown as Prisma.InputJsonValue,
        status: "DRAFT",
        triggerType: input.triggerType ?? null,
        triggerConfig: input.triggerConfig
          ? (input.triggerConfig as Prisma.InputJsonValue)
          : Prisma.DbNull,
        createdBy: userId,
      },
    });

    return {
      ...workflow,
      definition: workflow.definition as unknown as WorkflowDefinition,
      triggerConfig: workflow.triggerConfig as Record<string, unknown> | null,
    };
  } catch (error) {
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes("Unique constraint failed")) {
      throw new WorkflowAlreadyExistsError(input.name);
    }
    throw error;
  }
}

/**
 * Get a workflow by ID with tenant isolation
 *
 * @param id - Workflow ID
 * @param organizationId - Organization ID for tenant check (optional for internal use)
 * @returns Workflow or throws if not found
 * @throws WorkflowNotFoundError if workflow doesn't exist
 * @throws WorkflowAccessDeniedError if tenant mismatch
 */
export async function getWorkflow(
  id: string,
  organizationId?: string,
): Promise<WorkflowWithDefinition> {
  const workflow = await prisma.workflow.findUnique({
    where: { id },
  });

  if (!workflow) {
    throw new WorkflowNotFoundError(id);
  }

  // Tenant isolation check
  if (organizationId && workflow.organizationId !== organizationId) {
    throw new WorkflowAccessDeniedError();
  }

  return {
    ...workflow,
    definition: workflow.definition as unknown as WorkflowDefinition,
    triggerConfig: workflow.triggerConfig as Record<string, unknown> | null,
  };
}

/**
 * Get a workflow with its executions
 *
 * @param id - Workflow ID
 * @param organizationId - Organization ID for tenant check
 * @param executionLimit - Maximum number of executions to include (default 10)
 * @returns Workflow with executions
 */
export async function getWorkflowWithExecutions(
  id: string,
  organizationId?: string,
  executionLimit = 10,
): Promise<WorkflowWithExecutions> {
  const workflow = await prisma.workflow.findUnique({
    where: { id },
    include: {
      executions: {
        orderBy: { startedAt: "desc" },
        take: executionLimit,
      },
    },
  });

  if (!workflow) {
    throw new WorkflowNotFoundError(id);
  }

  if (organizationId && workflow.organizationId !== organizationId) {
    throw new WorkflowAccessDeniedError();
  }

  return {
    ...workflow,
    definition: workflow.definition as unknown as WorkflowDefinition,
    triggerConfig: workflow.triggerConfig as Record<string, unknown> | null,
    executions: workflow.executions.map((exec) => ({
      ...exec,
      context: exec.context as unknown as ExecutionContext,
      logs: exec.logs as unknown as ExecutionLogEntry[],
    })),
  };
}

/**
 * List workflows for an organization with filtering and pagination
 *
 * @param organizationId - Organization ID
 * @param filters - Optional filters
 * @returns Paginated list of workflows
 */
export async function listWorkflows(
  organizationId: string,
  filters: ListWorkflowsFilters = {},
): Promise<PaginatedResponse<WorkflowWithDefinition>> {
  const { status, triggerType, search, limit = 20, offset = 0 } = filters;

  // Build where clause
  const where: Record<string, unknown> = {
    organizationId,
  };

  if (status) {
    where.status = status;
  }

  if (triggerType) {
    where.triggerType = triggerType;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  // Execute query with count
  const [workflows, total] = await Promise.all([
    prisma.workflow.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.workflow.count({ where }),
  ]);

  return {
    items: workflows.map((w) => ({
      ...w,
      definition: w.definition as unknown as WorkflowDefinition,
      triggerConfig: w.triggerConfig as Record<string, unknown> | null,
    })),
    total,
    limit,
    offset,
  };
}

/**
 * Update an existing workflow
 *
 * @param id - Workflow ID
 * @param organizationId - Organization ID for tenant check
 * @param input - Update data
 * @returns Updated workflow
 * @throws WorkflowNotFoundError if not found
 * @throws WorkflowAccessDeniedError if tenant mismatch
 * @throws WorkflowValidationError if definition is invalid
 */
export async function updateWorkflow(
  id: string,
  organizationId: string,
  input: UpdateWorkflowInput,
): Promise<WorkflowWithDefinition> {
  // First verify the workflow exists and belongs to the org
  const existing = await getWorkflow(id, organizationId);

  // Validate new definition if provided
  if (input.definition) {
    const validation = validateDefinition(input.definition);
    if (!validation.valid) {
      throw new WorkflowValidationError(validation.errors);
    }

    const refErrors = validateVariableReferences(input.definition);
    if (refErrors.length > 0) {
      throw new WorkflowValidationError(refErrors);
    }
  }

  // Build update data
  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.definition !== undefined) updateData.definition = input.definition;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.triggerType !== undefined) updateData.triggerType = input.triggerType;
  if (input.triggerConfig !== undefined) updateData.triggerConfig = input.triggerConfig;

  try {
    const workflow = await prisma.workflow.update({
      where: { id },
      data: updateData,
    });

    return {
      ...workflow,
      definition: workflow.definition as unknown as WorkflowDefinition,
      triggerConfig: workflow.triggerConfig as Record<string, unknown> | null,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint failed")) {
      throw new WorkflowAlreadyExistsError(input.name ?? "");
    }
    throw error;
  }
}

/**
 * Delete (archive) a workflow
 *
 * Performs a soft delete by setting status to ARCHIVED.
 *
 * @param id - Workflow ID
 * @param organizationId - Organization ID for tenant check
 * @returns Archived workflow
 */
export async function deleteWorkflow(
  id: string,
  organizationId: string,
): Promise<WorkflowWithDefinition> {
  // Verify access
  await getWorkflow(id, organizationId);

  const workflow = await prisma.workflow.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  return {
    ...workflow,
    definition: workflow.definition as unknown as WorkflowDefinition,
    triggerConfig: workflow.triggerConfig as Record<string, unknown> | null,
  };
}

/**
 * Permanently delete a workflow and all its executions
 *
 * Use with caution - this cannot be undone.
 *
 * @param id - Workflow ID
 * @param organizationId - Organization ID for tenant check
 */
export async function hardDeleteWorkflow(id: string, organizationId: string): Promise<void> {
  // Verify access
  await getWorkflow(id, organizationId);

  await prisma.workflow.delete({
    where: { id },
  });
}

// =============================================================================
// WORKFLOW EXECUTION CRUD
// =============================================================================

/**
 * Create a new workflow execution
 *
 * @param workflowId - Workflow ID
 * @param input - Execution input data
 * @returns Created execution
 * @throws WorkflowNotFoundError if workflow doesn't exist
 * @throws WorkflowNotActiveError if workflow is not active
 */
export async function createExecution(
  workflowId: string,
  input: CreateExecutionInput = {},
): Promise<WorkflowExecutionWithContext> {
  // Get the workflow (internal - no org check needed for queue workers)
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    throw new WorkflowNotFoundError(workflowId);
  }

  // Check workflow is active (allow DRAFT for testing)
  if (workflow.status !== "ACTIVE" && workflow.status !== "DRAFT") {
    throw new WorkflowNotActiveError(workflowId, workflow.status);
  }

  // Create initial context
  const context: ExecutionContext = {
    inputs: input.inputs ?? {},
    nodeOutputs: {},
    globalVariables: {},
  };

  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId,
      status: "PENDING",
      context: context as unknown as Prisma.InputJsonValue,
      logs: [] as Prisma.InputJsonValue,
      triggeredBy: input.triggeredBy ?? null,
    },
  });

  return {
    ...execution,
    context: execution.context as unknown as ExecutionContext,
    logs: execution.logs as unknown as ExecutionLogEntry[],
  };
}

/**
 * Get an execution by ID
 *
 * @param id - Execution ID
 * @param organizationId - Organization ID for tenant check (optional)
 * @returns Execution details
 */
export async function getExecution(
  id: string,
  organizationId?: string,
): Promise<WorkflowExecutionWithContext & { workflow: WorkflowWithDefinition }> {
  const execution = await prisma.workflowExecution.findUnique({
    where: { id },
    include: { workflow: true },
  });

  if (!execution) {
    throw new ExecutionNotFoundError(id);
  }

  // Tenant check
  if (organizationId && execution.workflow.organizationId !== organizationId) {
    throw new WorkflowAccessDeniedError();
  }

  return {
    ...execution,
    context: execution.context as unknown as ExecutionContext,
    logs: execution.logs as unknown as ExecutionLogEntry[],
    workflow: {
      ...execution.workflow,
      definition: execution.workflow.definition as unknown as WorkflowDefinition,
      triggerConfig: execution.workflow.triggerConfig as Record<string, unknown> | null,
    },
  };
}

/**
 * List executions for a workflow
 *
 * @param workflowId - Workflow ID
 * @param organizationId - Organization ID for tenant check
 * @param options - Pagination options
 * @returns Paginated list of executions
 */
export async function listExecutions(
  workflowId: string,
  organizationId: string,
  options: { limit?: number; offset?: number; status?: ExecutionStatus } = {},
): Promise<PaginatedResponse<WorkflowExecutionWithContext>> {
  const { limit = 20, offset = 0, status } = options;

  // Verify workflow access
  await getWorkflow(workflowId, organizationId);

  const where: Record<string, unknown> = { workflowId };
  if (status) where.status = status;

  const [executions, total] = await Promise.all([
    prisma.workflowExecution.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.workflowExecution.count({ where }),
  ]);

  return {
    items: executions.map((e) => ({
      ...e,
      context: e.context as unknown as ExecutionContext,
      logs: e.logs as unknown as ExecutionLogEntry[],
    })),
    total,
    limit,
    offset,
  };
}

/**
 * Update an execution's status, context, or logs
 *
 * @param id - Execution ID
 * @param input - Update data
 * @returns Updated execution
 */
export async function updateExecution(
  id: string,
  input: UpdateExecutionInput,
): Promise<WorkflowExecutionWithContext> {
  const existing = await prisma.workflowExecution.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ExecutionNotFoundError(id);
  }

  const updateData: Record<string, unknown> = {};

  if (input.status !== undefined) updateData.status = input.status;
  if (input.context !== undefined) updateData.context = input.context;
  if (input.logs !== undefined) updateData.logs = input.logs;
  if (input.error !== undefined) updateData.error = input.error;
  if (input.finishedAt !== undefined) updateData.finishedAt = input.finishedAt;

  const execution = await prisma.workflowExecution.update({
    where: { id },
    data: updateData,
  });

  return {
    ...execution,
    context: execution.context as unknown as ExecutionContext,
    logs: execution.logs as unknown as ExecutionLogEntry[],
  };
}

/**
 * Append a log entry to an execution
 *
 * @param id - Execution ID
 * @param entry - Log entry to append
 * @returns Updated execution
 */
export async function appendExecutionLog(
  id: string,
  entry: ExecutionLogEntry,
): Promise<WorkflowExecutionWithContext> {
  const existing = await prisma.workflowExecution.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ExecutionNotFoundError(id);
  }

  const currentLogs = existing.logs as unknown as ExecutionLogEntry[];
  const newLogs = [...currentLogs, entry];

  const execution = await prisma.workflowExecution.update({
    where: { id },
    data: { logs: newLogs as unknown as Prisma.InputJsonValue },
  });

  return {
    ...execution,
    context: execution.context as unknown as ExecutionContext,
    logs: execution.logs as unknown as ExecutionLogEntry[],
  };
}

/**
 * Update node output in execution context
 *
 * @param id - Execution ID
 * @param nodeId - Node ID
 * @param output - Node output
 * @returns Updated execution
 */
export async function setNodeOutput(
  id: string,
  nodeId: string,
  output: unknown,
): Promise<WorkflowExecutionWithContext> {
  const existing = await prisma.workflowExecution.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ExecutionNotFoundError(id);
  }

  const context = existing.context as unknown as ExecutionContext;
  context.nodeOutputs[nodeId] = output;

  const execution = await prisma.workflowExecution.update({
    where: { id },
    data: { context: context as unknown as Prisma.InputJsonValue },
  });

  return {
    ...execution,
    context: execution.context as unknown as ExecutionContext,
    logs: execution.logs as unknown as ExecutionLogEntry[],
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a workflow exists
 *
 * @param id - Workflow ID
 * @returns true if workflow exists
 */
export async function workflowExists(id: string): Promise<boolean> {
  const count = await prisma.workflow.count({ where: { id } });
  return count > 0;
}

/**
 * Get workflows with a specific trigger type that are active
 *
 * Useful for initializing cron jobs or webhook handlers.
 *
 * @param triggerType - Trigger type to filter by
 * @returns Array of active workflows with the trigger type
 */
export async function getActiveWorkflowsByTrigger(
  triggerType: TriggerType,
): Promise<WorkflowWithDefinition[]> {
  const workflows = await prisma.workflow.findMany({
    where: {
      triggerType,
      status: "ACTIVE",
    },
  });

  return workflows.map((w) => ({
    ...w,
    definition: w.definition as unknown as WorkflowDefinition,
    triggerConfig: w.triggerConfig as Record<string, unknown> | null,
  }));
}

/**
 * Count executions for a workflow by status
 *
 * @param workflowId - Workflow ID
 * @returns Object with counts per status
 */
export async function getExecutionStats(
  workflowId: string,
): Promise<Record<ExecutionStatus, number>> {
  const results = await prisma.workflowExecution.groupBy({
    by: ["status"],
    where: { workflowId },
    _count: true,
  });

  const stats: Record<ExecutionStatus, number> = {
    PENDING: 0,
    RUNNING: 0,
    COMPLETED: 0,
    FAILED: 0,
    WAITING_FOR_INPUT: 0,
  };

  for (const result of results) {
    stats[result.status] = result._count;
  }

  return stats;
}

/**
 * Get a workflow by its webhook path
 *
 * Used by the webhook endpoint to find the workflow to trigger.
 * Searches the triggerConfig JSON for the webhookPath field.
 *
 * @param webhookPath - The unique webhook path
 * @returns Workflow if found, null otherwise
 */
export async function getWorkflowByWebhookPath(
  webhookPath: string,
): Promise<WorkflowWithDefinition | null> {
  // Query workflows where triggerConfig contains the webhookPath
  const workflow = await prisma.workflow.findFirst({
    where: {
      triggerType: "WEBHOOK",
      triggerConfig: {
        path: ["webhookPath"],
        equals: webhookPath,
      },
    },
  });

  if (!workflow) {
    return null;
  }

  return {
    ...workflow,
    definition: workflow.definition as unknown as WorkflowDefinition,
    triggerConfig: workflow.triggerConfig as Record<string, unknown> | null,
  };
}
