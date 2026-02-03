/**
 * Cron Trigger
 *
 * Schedule-based workflow execution using node-cron.
 * Reference: docs/IMPLEMENTATION-PLAN-PHASE7.md §7.2
 */

import type { Workflow, TriggerNodeConfig, WorkflowDefinition, WorkflowNode } from "../types.js";

// =============================================================================
// TYPES
// =============================================================================

export interface CronJob {
  workflowId: string;
  expression: string;
  timezone?: string;
  stop: () => void;
}

export interface CronScheduler {
  schedule(
    expression: string,
    callback: () => void | Promise<void>,
    options?: { timezone?: string },
  ): { stop: () => void };
  validate(expression: string): boolean;
}

export interface WorkflowRepository {
  getActiveWorkflowsWithCronTrigger(): Promise<Workflow[]>;
  getWorkflow(workflowId: string): Promise<Workflow | null>;
}

export interface ExecutionQueue {
  enqueue(executionId: string, nodeId: string): Promise<void>;
}

export interface ExecutionService {
  createExecution(params: {
    workflowId: string;
    triggeredBy: string;
    inputs: Record<string, unknown>;
  }): Promise<{ id: string }>;
}

// =============================================================================
// CRON REGISTRY
// =============================================================================

/**
 * In-memory registry of active cron jobs.
 */
class CronRegistry {
  private jobs: Map<string, CronJob> = new Map();

  register(job: CronJob): void {
    // Stop existing job if any
    const existing = this.jobs.get(job.workflowId);
    if (existing) {
      existing.stop();
    }
    this.jobs.set(job.workflowId, job);
  }

  unregister(workflowId: string): boolean {
    const job = this.jobs.get(workflowId);
    if (job) {
      job.stop();
      this.jobs.delete(workflowId);
      return true;
    }
    return false;
  }

  get(workflowId: string): CronJob | undefined {
    return this.jobs.get(workflowId);
  }

  getAll(): CronJob[] {
    return Array.from(this.jobs.values());
  }

  clear(): void {
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
  }

  size(): number {
    return this.jobs.size;
  }
}

// Global registry instance
const cronRegistry = new CronRegistry();

// =============================================================================
// CRON EXPRESSION VALIDATION
// =============================================================================

/**
 * Validates a cron expression format.
 * Standard cron format: minute hour day-of-month month day-of-week
 */
export function validateCronExpression(expression: string): {
  valid: boolean;
  error?: string;
} {
  if (!expression || typeof expression !== "string") {
    return { valid: false, error: "Expression must be a non-empty string" };
  }

  const trimmed = expression.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length !== 5 && parts.length !== 6) {
    return {
      valid: false,
      error: `Expected 5 or 6 parts, got ${parts.length}`,
    };
  }

  // Basic regex validation for each part
  const patterns = [
    /^(\*|([0-9]|[1-5][0-9])([-,/]([0-9]|[1-5][0-9]))*)$/, // minute (0-59)
    /^(\*|([0-9]|1[0-9]|2[0-3])([-,/]([0-9]|1[0-9]|2[0-3]))*)$/, // hour (0-23)
    /^(\*|([1-9]|[12][0-9]|3[01])([-,/]([1-9]|[12][0-9]|3[01]))*)$/, // day of month (1-31)
    /^(\*|([1-9]|1[0-2])([-,/]([1-9]|1[0-2]))*)$/, // month (1-12)
    /^(\*|[0-6]([-,/][0-6])*)$/, // day of week (0-6)
  ];

  for (let i = 0; i < 5; i++) {
    // Skip seconds field if present (6 parts)
    const partIndex = parts.length === 6 ? i + 1 : i;
    const part = parts[partIndex];

    // Allow wildcards and step values
    if (part === "*" || part.includes("/")) {
      continue;
    }

    // For ranges and lists, we just do basic structure validation
    if (part.includes("-") || part.includes(",")) {
      continue;
    }

    // Check numeric values
    if (!patterns[i].test(part)) {
      // Relaxed validation - just check it's a number or *
      if (!/^(\*|\d+)$/.test(part)) {
        return {
          valid: false,
          error: `Invalid format in part ${i + 1}: ${part}`,
        };
      }
    }
  }

  return { valid: true };
}

// =============================================================================
// TIMEZONE VALIDATION
// =============================================================================

/**
 * Validates a timezone string.
 */
export function validateTimezone(timezone: string): boolean {
  try {
    // Use Intl API to validate timezone
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// CRON TRIGGER FUNCTIONS
// =============================================================================

/**
 * Registers a cron trigger for a workflow.
 */
export function registerCronTrigger(
  workflowId: string,
  expression: string,
  timezone: string | undefined,
  scheduler: CronScheduler,
  onTrigger: (workflowId: string) => void | Promise<void>,
): CronJob {
  // Validate expression
  const validation = validateCronExpression(expression);
  if (!validation.valid) {
    throw new CronTriggerError(
      `Invalid cron expression: ${validation.error}`,
      "INVALID_EXPRESSION",
    );
  }

  // Validate timezone if provided
  if (timezone && !validateTimezone(timezone)) {
    throw new CronTriggerError(`Invalid timezone: ${timezone}`, "INVALID_TIMEZONE");
  }

  // Schedule the job
  const task = scheduler.schedule(
    expression,
    async () => {
      try {
        await onTrigger(workflowId);
      } catch (error) {
        console.error(`[CronTrigger] Error executing workflow ${workflowId}:`, error);
      }
    },
    timezone ? { timezone } : undefined,
  );

  const job: CronJob = {
    workflowId,
    expression,
    timezone,
    stop: () => task.stop(),
  };

  cronRegistry.register(job);
  return job;
}

/**
 * Unregisters a cron trigger for a workflow.
 */
export function unregisterCronTrigger(workflowId: string): boolean {
  return cronRegistry.unregister(workflowId);
}

/**
 * Gets a registered cron job.
 */
export function getCronJob(workflowId: string): CronJob | undefined {
  return cronRegistry.get(workflowId);
}

/**
 * Gets all registered cron jobs.
 */
export function getAllCronJobs(): CronJob[] {
  return cronRegistry.getAll();
}

/**
 * Clears all cron jobs.
 */
export function clearAllCronJobs(): void {
  cronRegistry.clear();
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initializes cron triggers for all active workflows on startup.
 */
export async function initCronTriggers(
  repository: WorkflowRepository,
  scheduler: CronScheduler,
  executionService: ExecutionService,
  queue: ExecutionQueue,
): Promise<{ registered: number; errors: string[] }> {
  const errors: string[] = [];
  let registered = 0;

  // Clear existing jobs
  clearAllCronJobs();

  // Load active workflows with cron triggers
  const workflows = await repository.getActiveWorkflowsWithCronTrigger();

  for (const workflow of workflows) {
    try {
      const triggerConfig = workflow.triggerConfig as TriggerNodeConfig | null;
      if (!triggerConfig?.cronExpression) {
        continue;
      }

      // Create trigger callback
      const onTrigger = async (workflowId: string) => {
        const wf = await repository.getWorkflow(workflowId);
        if (!wf || wf.status !== "ACTIVE") {
          console.log(`[CronTrigger] Skipping execution for inactive workflow ${workflowId}`);
          return;
        }

        const execution = await executionService.createExecution({
          workflowId,
          triggeredBy: "cron",
          inputs: {},
        });

        // Find trigger node and queue
        const definition = wf.definition as unknown as WorkflowDefinition | null;
        const triggerNode = definition?.nodes?.find((n: WorkflowNode) => n.type === "trigger");
        if (triggerNode) {
          await queue.enqueue(execution.id, triggerNode.id);
        }
      };

      registerCronTrigger(
        workflow.id,
        triggerConfig.cronExpression,
        triggerConfig.timezone,
        scheduler,
        onTrigger,
      );

      registered++;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Unknown error for workflow ${workflow.id}`;
      errors.push(`${workflow.id}: ${message}`);
    }
  }

  return { registered, errors };
}

// =============================================================================
// ERROR CLASS
// =============================================================================

export class CronTriggerError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_EXPRESSION" | "INVALID_TIMEZONE" | "SCHEDULER_ERROR",
  ) {
    super(message);
    this.name = "CronTriggerError";
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { cronRegistry as __testing_registry };
