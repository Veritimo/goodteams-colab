/**
 * Workflow Triggers
 *
 * Registry and initialization for workflow trigger types.
 * Reference: docs/IMPLEMENTATION-PLAN-PHASE7.md §7
 */

import type { Workflow, TriggerType, TriggerNodeConfig } from "../types.js";

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Manual Trigger
export {
  executeManualTrigger,
  validateInputs,
  findTriggerNode,
  ManualTriggerError,
  type ManualTriggerInput,
  type ManualTriggerResult,
} from "./manual.js";

// Cron Trigger
export {
  registerCronTrigger,
  unregisterCronTrigger,
  getCronJob,
  getAllCronJobs,
  clearAllCronJobs,
  initCronTriggers,
  validateCronExpression,
  validateTimezone,
  CronTriggerError,
  type CronJob,
  type CronScheduler,
} from "./cron.js";

// Webhook Trigger
export {
  handleWebhookRequest,
  setupWebhookTrigger,
  regenerateWebhookSecret,
  generateWebhookSecret,
  generateWebhookPath,
  computeSignature,
  verifySignature,
  extractSignature,
  createWebhookRouteHandler,
  WebhookTriggerError,
  type WebhookPayload,
  type WebhookResult,
  type WebhookRouteHandler,
} from "./webhook.js";

// Chat Trigger
export {
  checkChatTriggers,
  executeChatTrigger,
  handleChatMessage,
  matchesTriggerPhrase,
  normalizeText,
  validateTriggerPhrase,
  suggestTriggerPhrase,
  type ChatMessage,
  type ChatTriggerMatch,
  type ChatTriggerResult,
} from "./chat.js";

// =============================================================================
// TYPES
// =============================================================================

export interface TriggerRegistry {
  manual: {
    type: "MANUAL";
    requiresConfig: false;
  };
  cron: {
    type: "CRON";
    requiresConfig: true;
    configFields: ["cronExpression", "timezone"];
  };
  webhook: {
    type: "WEBHOOK";
    requiresConfig: true;
    configFields: ["webhookPath", "webhookSecret"];
  };
  chat: {
    type: "CHAT";
    requiresConfig: true;
    configFields: ["triggerPhrase"];
  };
  email: {
    type: "EMAIL";
    requiresConfig: true;
    configFields: ["emailAddress", "subjectPattern"];
  };
}

export interface InitializationResult {
  success: boolean;
  cronTriggers: {
    registered: number;
    errors: string[];
  };
  webhookRoutes: number;
  chatTriggers: number;
}

// =============================================================================
// TRIGGER REGISTRY
// =============================================================================

/**
 * Registry of available trigger types and their configurations.
 */
export const TRIGGER_REGISTRY: TriggerRegistry = {
  manual: {
    type: "MANUAL",
    requiresConfig: false,
  },
  cron: {
    type: "CRON",
    requiresConfig: true,
    configFields: ["cronExpression", "timezone"],
  },
  webhook: {
    type: "WEBHOOK",
    requiresConfig: true,
    configFields: ["webhookPath", "webhookSecret"],
  },
  chat: {
    type: "CHAT",
    requiresConfig: true,
    configFields: ["triggerPhrase"],
  },
  email: {
    type: "EMAIL",
    requiresConfig: true,
    configFields: ["emailAddress", "subjectPattern"],
  },
};

/**
 * Gets trigger info from registry.
 */
export function getTriggerInfo(
  triggerType: TriggerType,
): TriggerRegistry[keyof TriggerRegistry] | undefined {
  const key = triggerType.toLowerCase() as keyof TriggerRegistry;
  return TRIGGER_REGISTRY[key];
}

/**
 * Validates trigger configuration.
 */
export function validateTriggerConfig(
  triggerType: TriggerType,
  config: TriggerNodeConfig | null | undefined,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const info = getTriggerInfo(triggerType);

  if (!info) {
    return { valid: false, errors: [`Unknown trigger type: ${triggerType}`] };
  }

  if (!info.requiresConfig) {
    return { valid: true, errors: [] };
  }

  if (!config) {
    return { valid: false, errors: ["Trigger configuration required"] };
  }

  // Check required fields
  const configFields = (info as { configFields?: string[] }).configFields || [];
  for (const field of configFields) {
    // Some fields are auto-generated (webhookPath, webhookSecret)
    if (field === "webhookPath" || field === "webhookSecret") {
      continue;
    }

    const value = config[field as keyof TriggerNodeConfig];
    if (value === undefined || value === null || value === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Type-specific validation
  if (triggerType === "CRON" && config.cronExpression) {
    // Import dynamically to avoid circular dependency
    import("./cron.js").then(({ validateCronExpression }) => {
      const result = validateCronExpression(config.cronExpression!);
      if (!result.valid) {
        errors.push(`Invalid cron expression: ${result.error}`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// INITIALIZATION
// =============================================================================

export interface TriggerDependencies {
  cronScheduler: {
    schedule(
      expression: string,
      callback: () => void | Promise<void>,
      options?: { timezone?: string },
    ): { stop: () => void };
    validate(expression: string): boolean;
  };
  workflowRepository: {
    getActiveWorkflowsWithCronTrigger(): Promise<Workflow[]>;
    getActiveWorkflowsWithChatTrigger(tenantId: string): Promise<Workflow[]>;
    getWorkflow(workflowId: string): Promise<Workflow | null>;
  };
  executionService: {
    createExecution(params: {
      workflowId: string;
      triggeredBy: string;
      inputs: Record<string, unknown>;
    }): Promise<{ id: string; status: string }>;
  };
  executionQueue: {
    enqueue(executionId: string, nodeId: string): Promise<void>;
  };
}

/**
 * Initializes all trigger types.
 */
export async function initializeTriggers(
  dependencies: TriggerDependencies,
): Promise<InitializationResult> {
  const result: InitializationResult = {
    success: true,
    cronTriggers: { registered: 0, errors: [] },
    webhookRoutes: 0,
    chatTriggers: 0,
  };

  try {
    // Initialize cron triggers
    const { initCronTriggers } = await import("./cron.js");
    const cronResult = await initCronTriggers(
      dependencies.workflowRepository,
      dependencies.cronScheduler,
      dependencies.executionService,
      dependencies.executionQueue,
    );
    result.cronTriggers = cronResult;

    // Count webhook-enabled workflows (routes are set up on-demand)
    // This is informational only

    // Count chat-trigger-enabled workflows (checked on each message)
    // This is informational only

    if (cronResult.errors.length > 0) {
      console.warn(
        `[Triggers] ${cronResult.errors.length} cron trigger errors:`,
        cronResult.errors,
      );
    }

    console.log(`[Triggers] Initialized: ${cronResult.registered} cron triggers`);
  } catch (error) {
    result.success = false;
    console.error("[Triggers] Initialization failed:", error);
  }

  return result;
}

/**
 * Shuts down all triggers cleanly.
 */
export async function shutdownTriggers(): Promise<void> {
  const { clearAllCronJobs } = await import("./cron.js");
  clearAllCronJobs();
  console.log("[Triggers] Shutdown complete");
}
