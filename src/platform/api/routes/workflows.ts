/**
 * Workflow Routes for Platform API
 *
 * Handles workflow CRUD and execution management.
 *
 * Endpoints:
 * - GET    /api/platform/workflows             - List workflows for org
 * - POST   /api/platform/workflows             - Create workflow
 * - GET    /api/platform/workflows/:id         - Get workflow
 * - PUT    /api/platform/workflows/:id         - Update workflow
 * - DELETE /api/platform/workflows/:id         - Archive workflow
 * - POST   /api/platform/workflows/:id/execute - Start execution
 * - GET    /api/platform/workflows/:id/executions - List executions
 * - GET    /api/platform/executions/:id        - Get execution details
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §4
 */

import type { WorkflowStatus, TriggerType, ExecutionStatus } from "@prisma/client";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  WorkflowDefinition,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  ListWorkflowsFilters,
} from "../../workflows/types.js";
import type { RequestContext } from "../middleware/context.js";
import {
  createWorkflow,
  getWorkflow,
  getWorkflowWithExecutions,
  listWorkflows,
  updateWorkflow,
  deleteWorkflow,
  createExecution,
  getExecution,
  listExecutions,
  WorkflowNotFoundError,
  WorkflowAlreadyExistsError,
  WorkflowValidationError,
  ExecutionNotFoundError,
  WorkflowNotActiveError,
  WorkflowAccessDeniedError,
  type WorkflowWithDefinition,
  type WorkflowExecutionWithContext,
} from "../../workflows/service.js";
import { sendError, handleError } from "../middleware/errors.js";
import {
  requireAuth,
  requireOrganization,
  composeMiddleware,
} from "../middleware/require-permission.js";
import { sendJson, parseBody, type RouteHandler } from "./utils.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Workflow creation request body
 */
interface CreateWorkflowRequest {
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  triggerType?: TriggerType;
  triggerConfig?: Record<string, unknown>;
}

/**
 * Workflow update request body
 */
interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  definition?: WorkflowDefinition;
  status?: WorkflowStatus;
  triggerType?: TriggerType;
  triggerConfig?: Record<string, unknown>;
}

/**
 * Workflow execution request body
 */
interface ExecuteWorkflowRequest {
  inputs?: Record<string, unknown>;
}

/**
 * Workflow response (JSON-serialized)
 */
interface WorkflowResponse {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  definition: WorkflowDefinition;
  status: WorkflowStatus;
  triggerType: TriggerType | null;
  triggerConfig: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Execution response (JSON-serialized)
 */
interface ExecutionResponse {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  context: Record<string, unknown>;
  logs: Array<{
    timestamp: string;
    nodeId: string | null;
    message: string;
    level: string;
    data?: Record<string, unknown>;
  }>;
  triggeredBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}

/**
 * Workflows list response
 */
interface WorkflowsListResponse {
  workflows: WorkflowResponse[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Executions list response
 */
interface ExecutionsListResponse {
  executions: ExecutionResponse[];
  total: number;
  limit: number;
  offset: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert workflow to response format
 */
function toWorkflowResponse(workflow: WorkflowWithDefinition): WorkflowResponse {
  return {
    id: workflow.id,
    organizationId: workflow.organizationId,
    name: workflow.name,
    description: workflow.description,
    definition: workflow.definition,
    status: workflow.status,
    triggerType: workflow.triggerType,
    triggerConfig: workflow.triggerConfig,
    createdBy: workflow.createdBy,
    createdAt: workflow.createdAt.toISOString(),
    updatedAt: workflow.updatedAt.toISOString(),
  };
}

/**
 * Convert execution to response format
 */
function toExecutionResponse(execution: WorkflowExecutionWithContext): ExecutionResponse {
  return {
    id: execution.id,
    workflowId: execution.workflowId,
    status: execution.status,
    context: execution.context as unknown as Record<string, unknown>,
    logs: execution.logs.map((log) => ({
      timestamp: log.timestamp,
      nodeId: log.nodeId,
      message: log.message,
      level: log.level,
      data: log.data,
    })),
    triggeredBy: execution.triggeredBy,
    startedAt: execution.startedAt.toISOString(),
    finishedAt: execution.finishedAt?.toISOString() ?? null,
    error: execution.error,
  };
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * Handle workflow routes
 */
export const handleWorkflows: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  try {
    // POST /api/platform/webhooks/:webhookPath - Webhook trigger endpoint (no auth required)
    const webhookMatch = path.match(/^\/api\/platform\/webhooks\/([^/]+)$/);
    if (webhookMatch && method === "POST") {
      const webhookPath = webhookMatch[1];
      await handleWebhookTrigger(req, res, ctx, webhookPath);
      return;
    }

    // POST /api/platform/workflows/:id/execute - Execute workflow
    const executeMatch = path.match(/^\/api\/platform\/workflows\/([^/]+)\/execute$/);
    if (executeMatch && method === "POST") {
      const workflowId = executeMatch[1];
      await handleExecuteWorkflow(req, res, ctx, workflowId);
      return;
    }

    // GET /api/platform/workflows/:id/executions - List executions for workflow
    const execListMatch = path.match(/^\/api\/platform\/workflows\/([^/]+)\/executions$/);
    if (execListMatch && method === "GET") {
      const workflowId = execListMatch[1];
      await handleListExecutions(req, res, ctx, workflowId, url);
      return;
    }

    // GET /api/platform/executions/:id - Get execution details
    const execMatch = path.match(/^\/api\/platform\/executions\/([^/]+)$/);
    if (execMatch && method === "GET") {
      const executionId = execMatch[1];
      await handleGetExecution(req, res, ctx, executionId);
      return;
    }

    // GET /api/platform/workflows/:id - Get workflow
    // PUT /api/platform/workflows/:id - Update workflow
    // DELETE /api/platform/workflows/:id - Archive workflow
    const idMatch = path.match(/^\/api\/platform\/workflows\/([^/]+)$/);
    if (idMatch) {
      const workflowId = idMatch[1];
      switch (method) {
        case "GET":
          await handleGetWorkflow(req, res, ctx, workflowId);
          return;
        case "PUT":
          await handleUpdateWorkflow(req, res, ctx, workflowId);
          return;
        case "DELETE":
          await handleDeleteWorkflow(req, res, ctx, workflowId);
          return;
        default:
          sendError(res, "METHOD_NOT_ALLOWED", `Method ${method} not allowed`, {
            allowed: ["GET", "PUT", "DELETE"],
          });
          return;
      }
    }

    // GET /api/platform/workflows - List workflows
    // POST /api/platform/workflows - Create workflow
    if (path === "/api/platform/workflows") {
      switch (method) {
        case "GET":
          await handleListWorkflows(req, res, ctx, url);
          return;
        case "POST":
          await handleCreateWorkflow(req, res, ctx);
          return;
        default:
          sendError(res, "METHOD_NOT_ALLOWED", `Method ${method} not allowed`, {
            allowed: ["GET", "POST"],
          });
          return;
      }
    }

    // Route not found
    sendError(res, "NOT_FOUND", "Route not found");
  } catch (error) {
    handleError(res, error);
  }
};

// =============================================================================
// WORKFLOW HANDLERS
// =============================================================================

/**
 * List workflows for organization
 * GET /api/platform/workflows
 */
async function handleListWorkflows(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  url: URL,
): Promise<void> {
  // Auth check
  const authMiddleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await authMiddleware(ctx, res))) return;

  const orgId = ctx.user!.orgId;

  // Parse query parameters
  const filters: ListWorkflowsFilters = {
    status: url.searchParams.get("status") as WorkflowStatus | undefined,
    triggerType: url.searchParams.get("triggerType") as TriggerType | undefined,
    search: url.searchParams.get("search") ?? undefined,
    limit: url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 20,
    offset: url.searchParams.get("offset") ? parseInt(url.searchParams.get("offset")!, 10) : 0,
  };

  const result = await listWorkflows(orgId, filters);

  const response: WorkflowsListResponse = {
    workflows: result.items.map(toWorkflowResponse),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };

  sendJson(res, response);
}

/**
 * Create a new workflow
 * POST /api/platform/workflows
 */
async function handleCreateWorkflow(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  // Auth check
  const authMiddleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await authMiddleware(ctx, res))) return;

  const orgId = ctx.user!.orgId;
  const userId = ctx.user!.id;

  // Parse body
  const bodyResult = await parseBody<CreateWorkflowRequest>(req);
  if (!bodyResult.ok) {
    sendError(res, "BAD_REQUEST", bodyResult.error);
    return;
  }

  const body = bodyResult.value;

  // Validate required fields
  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    sendError(res, "BAD_REQUEST", "name is required");
    return;
  }

  if (!body.definition || typeof body.definition !== "object") {
    sendError(res, "BAD_REQUEST", "definition is required and must be an object");
    return;
  }

  try {
    const input: CreateWorkflowInput = {
      name: body.name.trim(),
      description: body.description?.trim(),
      definition: body.definition,
      triggerType: body.triggerType,
      triggerConfig: body.triggerConfig,
    };

    const workflow = await createWorkflow(orgId, userId, input);

    sendJson(res, toWorkflowResponse(workflow), 201);
  } catch (error) {
    if (error instanceof WorkflowValidationError) {
      sendError(res, "UNPROCESSABLE_ENTITY", error.message, { errors: error.errors });
      return;
    }
    if (error instanceof WorkflowAlreadyExistsError) {
      sendError(res, "CONFLICT", error.message);
      return;
    }
    throw error;
  }
}

/**
 * Get a workflow by ID
 * GET /api/platform/workflows/:id
 */
async function handleGetWorkflow(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  workflowId: string,
): Promise<void> {
  // Auth check
  const authMiddleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await authMiddleware(ctx, res))) return;

  const orgId = ctx.user!.orgId;

  // Check if executions should be included
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const includeExecutions = url.searchParams.get("includeExecutions") === "true";

  try {
    if (includeExecutions) {
      const limit = url.searchParams.get("executionLimit")
        ? parseInt(url.searchParams.get("executionLimit")!, 10)
        : 10;
      const workflow = await getWorkflowWithExecutions(workflowId, orgId, limit);
      sendJson(res, {
        ...toWorkflowResponse(workflow),
        executions: workflow.executions.map(toExecutionResponse),
      });
    } else {
      const workflow = await getWorkflow(workflowId, orgId);
      sendJson(res, toWorkflowResponse(workflow));
    }
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      sendError(res, "NOT_FOUND", error.message);
      return;
    }
    if (error instanceof WorkflowAccessDeniedError) {
      sendError(res, "FORBIDDEN", error.message);
      return;
    }
    throw error;
  }
}

/**
 * Update a workflow
 * PUT /api/platform/workflows/:id
 */
async function handleUpdateWorkflow(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  workflowId: string,
): Promise<void> {
  // Auth check
  const authMiddleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await authMiddleware(ctx, res))) return;

  const orgId = ctx.user!.orgId;

  // Parse body
  const bodyResult = await parseBody<UpdateWorkflowRequest>(req);
  if (!bodyResult.ok) {
    sendError(res, "BAD_REQUEST", bodyResult.error);
    return;
  }

  const body = bodyResult.value;

  try {
    const input: UpdateWorkflowInput = {};

    if (body.name !== undefined) input.name = body.name.trim();
    if (body.description !== undefined) input.description = body.description?.trim();
    if (body.definition !== undefined) input.definition = body.definition;
    if (body.status !== undefined) input.status = body.status;
    if (body.triggerType !== undefined) input.triggerType = body.triggerType;
    if (body.triggerConfig !== undefined) input.triggerConfig = body.triggerConfig;

    const workflow = await updateWorkflow(workflowId, orgId, input);

    sendJson(res, toWorkflowResponse(workflow));
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      sendError(res, "NOT_FOUND", error.message);
      return;
    }
    if (error instanceof WorkflowAccessDeniedError) {
      sendError(res, "FORBIDDEN", error.message);
      return;
    }
    if (error instanceof WorkflowValidationError) {
      sendError(res, "UNPROCESSABLE_ENTITY", error.message, { errors: error.errors });
      return;
    }
    if (error instanceof WorkflowAlreadyExistsError) {
      sendError(res, "CONFLICT", error.message);
      return;
    }
    throw error;
  }
}

/**
 * Archive (soft delete) a workflow
 * DELETE /api/platform/workflows/:id
 */
async function handleDeleteWorkflow(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  workflowId: string,
): Promise<void> {
  // Auth check
  const authMiddleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await authMiddleware(ctx, res))) return;

  const orgId = ctx.user!.orgId;

  try {
    const workflow = await deleteWorkflow(workflowId, orgId);
    sendJson(res, toWorkflowResponse(workflow));
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      sendError(res, "NOT_FOUND", error.message);
      return;
    }
    if (error instanceof WorkflowAccessDeniedError) {
      sendError(res, "FORBIDDEN", error.message);
      return;
    }
    throw error;
  }
}

// =============================================================================
// EXECUTION HANDLERS
// =============================================================================

/**
 * Execute a workflow
 * POST /api/platform/workflows/:id/execute
 */
async function handleExecuteWorkflow(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  workflowId: string,
): Promise<void> {
  // Auth check
  const authMiddleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await authMiddleware(ctx, res))) return;

  const orgId = ctx.user!.orgId;
  const userId = ctx.user!.id;

  // Verify workflow exists and belongs to org
  try {
    await getWorkflow(workflowId, orgId);
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      sendError(res, "NOT_FOUND", error.message);
      return;
    }
    if (error instanceof WorkflowAccessDeniedError) {
      sendError(res, "FORBIDDEN", error.message);
      return;
    }
    throw error;
  }

  // Parse body
  const bodyResult = await parseBody<ExecuteWorkflowRequest>(req);
  if (!bodyResult.ok) {
    sendError(res, "BAD_REQUEST", bodyResult.error);
    return;
  }

  const body = bodyResult.value;

  try {
    const execution = await createExecution(workflowId, {
      inputs: body.inputs,
      triggeredBy: userId,
    });

    // TODO: Queue the execution for processing (Week 36)
    // await queueWorkflowExecution(execution.id);

    sendJson(res, toExecutionResponse(execution), 201);
  } catch (error) {
    if (error instanceof WorkflowNotActiveError) {
      sendError(res, "UNPROCESSABLE_ENTITY", error.message);
      return;
    }
    throw error;
  }
}

/**
 * List executions for a workflow
 * GET /api/platform/workflows/:id/executions
 */
async function handleListExecutions(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  workflowId: string,
  url: URL,
): Promise<void> {
  // Auth check
  const authMiddleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await authMiddleware(ctx, res))) return;

  const orgId = ctx.user!.orgId;

  // Parse query parameters
  const options = {
    status: url.searchParams.get("status") as ExecutionStatus | undefined,
    limit: url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 20,
    offset: url.searchParams.get("offset") ? parseInt(url.searchParams.get("offset")!, 10) : 0,
  };

  try {
    const result = await listExecutions(workflowId, orgId, options);

    const response: ExecutionsListResponse = {
      executions: result.items.map(toExecutionResponse),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    };

    sendJson(res, response);
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      sendError(res, "NOT_FOUND", error.message);
      return;
    }
    if (error instanceof WorkflowAccessDeniedError) {
      sendError(res, "FORBIDDEN", error.message);
      return;
    }
    throw error;
  }
}

/**
 * Get execution details
 * GET /api/platform/executions/:id
 */
async function handleGetExecution(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  executionId: string,
): Promise<void> {
  // Auth check
  const authMiddleware = composeMiddleware(requireAuth(), requireOrganization());
  if (!(await authMiddleware(ctx, res))) return;

  const orgId = ctx.user!.orgId;

  try {
    const execution = await getExecution(executionId, orgId);

    sendJson(res, {
      ...toExecutionResponse(execution),
      workflow: {
        id: execution.workflow.id,
        name: execution.workflow.name,
      },
    });
  } catch (error) {
    if (error instanceof ExecutionNotFoundError) {
      sendError(res, "NOT_FOUND", error.message);
      return;
    }
    if (error instanceof WorkflowAccessDeniedError) {
      sendError(res, "FORBIDDEN", error.message);
      return;
    }
    throw error;
  }
}

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

/**
 * Handle webhook trigger for workflow execution
 * POST /api/platform/webhooks/:webhookPath
 *
 * Note: This endpoint does NOT require authentication - it validates via
 * the unique webhook path and optional signature verification.
 */
async function handleWebhookTrigger(
  req: IncomingMessage,
  res: ServerResponse,
  _ctx: RequestContext,
  webhookPath: string,
): Promise<void> {
  // Parse body for webhook payload
  const bodyResult = await parseBody<Record<string, unknown>>(req);
  if (!bodyResult.ok) {
    sendError(res, "BAD_REQUEST", bodyResult.error);
    return;
  }

  const payload = bodyResult.value;

  try {
    // Import getWorkflowByWebhookPath dynamically to avoid circular deps
    const { getWorkflowByWebhookPath } = await import("../../workflows/service.js");

    // Look up workflow by webhook path
    const workflow = await getWorkflowByWebhookPath(webhookPath);

    if (!workflow) {
      sendError(res, "NOT_FOUND", `No workflow found for webhook path: ${webhookPath}`);
      return;
    }

    // Verify workflow is active
    if (workflow.status !== "ACTIVE") {
      sendError(res, "UNPROCESSABLE_ENTITY", "Workflow is not active");
      return;
    }

    // Verify workflow has WEBHOOK trigger type
    if (workflow.triggerType !== "WEBHOOK") {
      sendError(res, "UNPROCESSABLE_ENTITY", "Workflow is not configured for webhook triggers");
      return;
    }

    // TODO: Verify webhook signature if webhookSecret is configured
    // const signature = req.headers['x-webhook-signature'];
    // if (workflow.triggerConfig?.webhookSecret) {
    //   if (!verifyWebhookSignature(payload, signature, workflow.triggerConfig.webhookSecret)) {
    //     sendError(res, "UNAUTHORIZED", "Invalid webhook signature");
    //     return;
    //   }
    // }

    // Create execution with webhook payload as inputs
    const execution = await createExecution(workflow.id, {
      inputs: {
        webhook: {
          path: webhookPath,
          payload,
          headers: {
            contentType: req.headers["content-type"],
            userAgent: req.headers["user-agent"],
          },
          timestamp: new Date().toISOString(),
        },
      },
      triggeredBy: "webhook",
    });

    // TODO: Queue the execution for processing
    // await queueWorkflowExecution(execution.id);

    sendJson(
      res,
      {
        success: true,
        executionId: execution.id,
        workflowId: workflow.id,
        status: execution.status,
      },
      202,
    );
  } catch (error) {
    if (error instanceof WorkflowNotActiveError) {
      sendError(res, "UNPROCESSABLE_ENTITY", error.message);
      return;
    }
    throw error;
  }
}
