/**
 * Trigger Node Executor
 *
 * Pass-through executor for workflow start.
 * Extracts trigger payload into context inputs.
 */

import type {
  TriggerNodeConfig,
  TriggerNodeOutput,
  ExecutionContext,
  NodeExecutor,
} from "./types.js";
import { NodeExecutionError } from "./types.js";

/**
 * Execute a trigger node
 *
 * The trigger node is the starting point of a workflow.
 * It passes through the trigger payload and sets up the initial context.
 *
 * @param config - Trigger node configuration
 * @param context - Current execution context
 * @returns Trigger output with timestamp and type
 */
export const executeTriggerNode: NodeExecutor<TriggerNodeConfig, TriggerNodeOutput> = async (
  config,
  context,
) => {
  if (!config.triggerType) {
    throw new NodeExecutionError("trigger", "Missing 'triggerType' in configuration");
  }

  const validTriggerTypes = ["manual", "cron", "webhook", "chat", "email"];
  if (!validTriggerTypes.includes(config.triggerType)) {
    throw new NodeExecutionError(
      "trigger",
      `Invalid trigger type '${config.triggerType}'. Must be one of: ${validTriggerTypes.join(", ")}`,
    );
  }

  // Extract payload from context inputs (set by the trigger system)
  const payload = extractPayload(config.triggerType, context);

  return {
    triggered: true,
    timestamp: new Date(),
    triggerType: config.triggerType,
    payload,
  };
};

/**
 * Extract trigger payload from context based on trigger type
 */
function extractPayload(
  triggerType: TriggerNodeConfig["triggerType"],
  context: ExecutionContext,
): Record<string, unknown> | undefined {
  const inputs = context.inputs;

  switch (triggerType) {
    case "webhook":
      // Webhook payloads are passed as-is
      return inputs._webhookPayload
        ? (inputs._webhookPayload as Record<string, unknown>)
        : Object.fromEntries(Object.entries(inputs).filter(([key]) => !key.startsWith("_")));

    case "chat":
      // Chat triggers include message context
      return {
        message: inputs.message,
        conversationId: inputs.conversationId,
        userId: inputs.userId,
        ...(inputs._chatContext as Record<string, unknown>),
      };

    case "email":
      // Email triggers include email metadata
      return {
        from: inputs.from,
        subject: inputs.subject,
        body: inputs.body,
        attachments: inputs.attachments,
        ...(inputs._emailContext as Record<string, unknown>),
      };

    case "cron":
      // Cron triggers include schedule info
      return {
        scheduledTime: inputs._scheduledTime,
        cronExpression: inputs._cronExpression,
      };

    case "manual":
      // Manual triggers pass through all non-system inputs
      return Object.fromEntries(Object.entries(inputs).filter(([key]) => !key.startsWith("_")));

    default:
      return undefined;
  }
}

/**
 * Validate trigger configuration
 *
 * Used during workflow validation to ensure trigger config is valid.
 */
export function validateTriggerConfig(config: TriggerNodeConfig): string[] {
  const errors: string[] = [];

  if (!config.triggerType) {
    errors.push("Trigger type is required");
  }

  const validTriggerTypes = ["manual", "cron", "webhook", "chat", "email"];
  if (config.triggerType && !validTriggerTypes.includes(config.triggerType)) {
    errors.push(
      `Invalid trigger type '${config.triggerType}'. Must be one of: ${validTriggerTypes.join(", ")}`,
    );
  }

  // Validate cron-specific config
  if (config.triggerType === "cron") {
    if (!config.cronExpression) {
      errors.push("Cron expression is required for cron triggers");
    } else if (!isValidCronExpression(config.cronExpression)) {
      errors.push(`Invalid cron expression: ${config.cronExpression}`);
    }
  }

  // Validate chat-specific config
  if (config.triggerType === "chat" && !config.triggerPhrase) {
    // triggerPhrase is optional but recommended
  }

  return errors;
}

/**
 * Basic cron expression validation
 * Validates standard 5-field cron expressions (minute hour day month weekday)
 */
function isValidCronExpression(expression: string): boolean {
  const parts = expression.trim().split(/\s+/);

  // Standard cron has 5 fields, some systems support 6 (with seconds)
  if (parts.length < 5 || parts.length > 6) {
    return false;
  }

  // Basic validation - check for allowed characters
  const allowedChars = /^[\d,\-*/]+$/;
  for (const part of parts) {
    if (!allowedChars.test(part)) {
      return false;
    }
  }

  return true;
}
