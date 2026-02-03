/**
 * Webhook Trigger
 *
 * HTTP endpoint-based workflow execution with HMAC signature verification.
 * Reference: docs/IMPLEMENTATION-PLAN-PHASE7.md §7.3
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Workflow, TriggerNodeConfig, WorkflowDefinition, WorkflowNode } from "../types.js";

// =============================================================================
// TYPES
// =============================================================================

export interface WebhookPayload {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  method: string;
  path: string;
}

export interface WebhookResult {
  executionId: string;
  status: string;
  accepted: boolean;
}

export interface WorkflowRepository {
  getWorkflow(workflowId: string): Promise<Workflow | null>;
  updateWorkflow(
    workflowId: string,
    updates: { triggerConfig: Record<string, unknown> },
  ): Promise<void>;
}

export interface ExecutionService {
  createExecution(params: {
    workflowId: string;
    triggeredBy: string;
    inputs: Record<string, unknown>;
  }): Promise<{ id: string; status: string }>;
}

export interface ExecutionQueue {
  enqueue(executionId: string, nodeId: string): Promise<void>;
}

// =============================================================================
// SIGNATURE CONSTANTS
// =============================================================================

const SIGNATURE_HEADER = "x-webhook-signature";
const SIGNATURE_ALGORITHM = "sha256";
const SECRET_LENGTH = 32;

// =============================================================================
// SECRET GENERATION
// =============================================================================

/**
 * Generates a unique webhook secret.
 */
export function generateWebhookSecret(): string {
  return randomBytes(SECRET_LENGTH).toString("hex");
}

/**
 * Generates a unique webhook path.
 */
export function generateWebhookPath(): string {
  return randomBytes(16).toString("hex");
}

// =============================================================================
// SIGNATURE VERIFICATION
// =============================================================================

/**
 * Computes HMAC signature for a payload.
 */
export function computeSignature(payload: string | Buffer, secret: string): string {
  const hmac = createHmac(SIGNATURE_ALGORITHM, secret);
  hmac.update(typeof payload === "string" ? payload : payload.toString("utf8"));
  return `${SIGNATURE_ALGORITHM}=${hmac.digest("hex")}`;
}

/**
 * Verifies HMAC signature against expected value.
 */
export function verifySignature(
  payload: string | Buffer,
  secret: string,
  signature: string | undefined,
): boolean {
  if (!signature) {
    return false;
  }

  const expected = computeSignature(payload, secret);

  // Use timing-safe comparison to prevent timing attacks
  try {
    const sigBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Extracts signature from headers.
 */
export function extractSignature(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const value = headers[SIGNATURE_HEADER] ?? headers[SIGNATURE_HEADER.toUpperCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

// =============================================================================
// WEBHOOK SETUP
// =============================================================================

/**
 * Sets up a webhook trigger for a workflow.
 */
export async function setupWebhookTrigger(
  workflowId: string,
  repository: WorkflowRepository,
): Promise<{ webhookPath: string; webhookSecret: string }> {
  const workflow = await repository.getWorkflow(workflowId);

  if (!workflow) {
    throw new WebhookTriggerError(`Workflow not found: ${workflowId}`, "WORKFLOW_NOT_FOUND");
  }

  const webhookPath = generateWebhookPath();
  const webhookSecret = generateWebhookSecret();

  const existingConfig = (workflow.triggerConfig || {}) as Record<string, unknown>;
  const triggerConfig: Record<string, unknown> = {
    ...existingConfig,
    triggerType: "WEBHOOK",
    webhookPath,
    webhookSecret,
  };

  await repository.updateWorkflow(workflowId, {
    triggerConfig: triggerConfig as unknown as Record<string, unknown>,
  });

  return { webhookPath, webhookSecret };
}

/**
 * Regenerates the webhook secret for a workflow.
 */
export async function regenerateWebhookSecret(
  workflowId: string,
  repository: WorkflowRepository,
): Promise<string> {
  const workflow = await repository.getWorkflow(workflowId);

  if (!workflow) {
    throw new WebhookTriggerError(`Workflow not found: ${workflowId}`, "WORKFLOW_NOT_FOUND");
  }

  const newSecret = generateWebhookSecret();

  const existingConfig2 = (workflow.triggerConfig || {}) as Record<string, unknown>;
  const triggerConfig: Record<string, unknown> = {
    ...existingConfig2,
    triggerType: "WEBHOOK",
    webhookSecret: newSecret,
  };

  await repository.updateWorkflow(workflowId, {
    triggerConfig: triggerConfig as unknown as Record<string, unknown>,
  });

  return newSecret;
}

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

/**
 * Handles an incoming webhook request.
 */
export async function handleWebhookRequest(
  workflowId: string,
  payload: WebhookPayload,
  repository: WorkflowRepository,
  executionService: ExecutionService,
  queue: ExecutionQueue,
): Promise<WebhookResult> {
  // 1. Get workflow
  const workflow = await repository.getWorkflow(workflowId);

  if (!workflow) {
    throw new WebhookTriggerError(`Workflow not found: ${workflowId}`, "WORKFLOW_NOT_FOUND");
  }

  // 2. Check workflow status
  if (workflow.status !== "ACTIVE") {
    throw new WebhookTriggerError(
      `Workflow is not active: ${workflow.status}`,
      "WORKFLOW_NOT_ACTIVE",
    );
  }

  // 3. Check trigger type
  if (workflow.triggerType !== "WEBHOOK") {
    throw new WebhookTriggerError(
      `Workflow does not have webhook trigger: ${workflow.triggerType}`,
      "INVALID_TRIGGER_TYPE",
    );
  }

  // 4. Get secret and verify signature
  const triggerConfig = workflow.triggerConfig as TriggerNodeConfig | null;
  const secret = triggerConfig?.webhookSecret;

  if (!secret) {
    throw new WebhookTriggerError("Webhook secret not configured", "NO_SECRET");
  }

  const signature = extractSignature(payload.headers);
  const bodyString = typeof payload.body === "string" ? payload.body : JSON.stringify(payload.body);

  if (!verifySignature(bodyString, secret, signature)) {
    throw new WebhookTriggerError("Invalid webhook signature", "INVALID_SIGNATURE");
  }

  // 5. Create execution
  const inputs: Record<string, unknown> = {
    webhook: {
      body: payload.body,
      headers: payload.headers,
      method: payload.method,
      path: payload.path,
    },
    ...(typeof payload.body === "object" && payload.body !== null ? payload.body : {}),
  };

  const execution = await executionService.createExecution({
    workflowId,
    triggeredBy: "webhook",
    inputs,
  });

  // 6. Queue first node
  const definition = workflow.definition as unknown as WorkflowDefinition | null;
  const triggerNode = definition?.nodes?.find((n: WorkflowNode) => n.type === "trigger");
  if (triggerNode) {
    await queue.enqueue(execution.id, triggerNode.id);
  }

  return {
    executionId: execution.id,
    status: execution.status,
    accepted: true,
  };
}

// =============================================================================
// ROUTE HANDLER FACTORY
// =============================================================================

export interface WebhookRouteHandler {
  workflowId: string;
  method: "POST" | "PUT";
  path: string;
  handle: (payload: WebhookPayload) => Promise<WebhookResult>;
}

/**
 * Creates a route handler for a workflow's webhook.
 */
export function createWebhookRouteHandler(
  workflowId: string,
  webhookPath: string,
  repository: WorkflowRepository,
  executionService: ExecutionService,
  queue: ExecutionQueue,
): WebhookRouteHandler {
  return {
    workflowId,
    method: "POST",
    path: `/api/workflows/webhook/${webhookPath}`,
    handle: async (payload: WebhookPayload) => {
      return handleWebhookRequest(workflowId, payload, repository, executionService, queue);
    },
  };
}

// =============================================================================
// ERROR CLASS
// =============================================================================

export class WebhookTriggerError extends Error {
  public readonly statusCode: number;

  constructor(
    message: string,
    public readonly code:
      | "WORKFLOW_NOT_FOUND"
      | "WORKFLOW_NOT_ACTIVE"
      | "INVALID_TRIGGER_TYPE"
      | "NO_SECRET"
      | "INVALID_SIGNATURE",
  ) {
    super(message);
    this.name = "WebhookTriggerError";

    // Map error codes to HTTP status codes
    switch (code) {
      case "WORKFLOW_NOT_FOUND":
        this.statusCode = 404;
        break;
      case "INVALID_SIGNATURE":
        this.statusCode = 401;
        break;
      case "WORKFLOW_NOT_ACTIVE":
      case "INVALID_TRIGGER_TYPE":
      case "NO_SECRET":
        this.statusCode = 400;
        break;
      default:
        this.statusCode = 500;
    }
  }
}
