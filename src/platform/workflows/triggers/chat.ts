/**
 * Chat Trigger
 *
 * Workflow execution triggered from conversation context.
 * Reference: docs/IMPLEMENTATION-PLAN-PHASE7.md §7.3
 */

import type { Workflow, TriggerNodeConfig, WorkflowDefinition, WorkflowNode } from "../types.js";

// =============================================================================
// TYPES
// =============================================================================

export interface ChatMessage {
  content: string;
  conversationId: string;
  userId?: string;
  channelId?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatTriggerMatch {
  workflow: Workflow;
  confidence: number;
  matchedPhrase: string;
}

export interface ChatTriggerResult {
  executionId: string;
  workflowId: string;
  workflowName: string;
  status: string;
}

export interface WorkflowRepository {
  getActiveWorkflowsWithChatTrigger(tenantId: string): Promise<Workflow[]>;
  getWorkflow(workflowId: string): Promise<Workflow | null>;
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
// PHRASE MATCHING
// =============================================================================

/**
 * Normalizes text for matching (lowercase, trim, collapse whitespace).
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Checks if a message matches a trigger phrase.
 * Supports exact match and prefix match.
 */
export function matchesTriggerPhrase(
  message: string,
  triggerPhrase: string,
): { matches: boolean; confidence: number } {
  const normalizedMessage = normalizeText(message);
  const normalizedPhrase = normalizeText(triggerPhrase);

  if (!normalizedMessage || !normalizedPhrase) {
    return { matches: false, confidence: 0 };
  }

  // Exact match (highest confidence)
  if (normalizedMessage === normalizedPhrase) {
    return { matches: true, confidence: 1.0 };
  }

  // Message starts with phrase (high confidence)
  if (
    normalizedMessage.startsWith(normalizedPhrase + " ") ||
    normalizedMessage.startsWith(normalizedPhrase + ",") ||
    normalizedMessage.startsWith(normalizedPhrase + ".")
  ) {
    return { matches: true, confidence: 0.95 };
  }

  // Phrase appears at start of message
  if (normalizedMessage.startsWith(normalizedPhrase)) {
    return { matches: true, confidence: 0.9 };
  }

  // Phrase appears as complete word(s) in message
  const phraseWords = normalizedPhrase.split(" ");
  const messageWords = normalizedMessage.split(" ");

  for (let i = 0; i <= messageWords.length - phraseWords.length; i++) {
    const slice = messageWords.slice(i, i + phraseWords.length);
    if (slice.join(" ") === normalizedPhrase) {
      // Confidence decreases based on position
      const confidence = 0.8 - i * 0.05;
      return { matches: true, confidence: Math.max(0.5, confidence) };
    }
  }

  // Phrase words appear in order (lower confidence)
  let lastIndex = -1;
  let foundAll = true;
  for (const word of phraseWords) {
    const index = messageWords.indexOf(word, lastIndex + 1);
    if (index === -1) {
      foundAll = false;
      break;
    }
    lastIndex = index;
  }

  if (foundAll) {
    return { matches: true, confidence: 0.4 };
  }

  return { matches: false, confidence: 0 };
}

// =============================================================================
// CHAT TRIGGER FUNCTIONS
// =============================================================================

/**
 * Checks if a message matches any chat trigger.
 */
export async function checkChatTriggers(
  message: ChatMessage,
  tenantId: string,
  repository: WorkflowRepository,
): Promise<ChatTriggerMatch | null> {
  if (!message.content || !message.content.trim()) {
    return null;
  }

  // Get all active workflows with chat triggers
  const workflows = await repository.getActiveWorkflowsWithChatTrigger(tenantId);

  if (workflows.length === 0) {
    return null;
  }

  // Find best matching workflow
  let bestMatch: ChatTriggerMatch | null = null;

  for (const workflow of workflows) {
    const triggerConfig = workflow.triggerConfig as TriggerNodeConfig | null;
    const triggerPhrase = triggerConfig?.triggerPhrase;

    if (!triggerPhrase) {
      continue;
    }

    const result = matchesTriggerPhrase(message.content, triggerPhrase);

    if (result.matches && (!bestMatch || result.confidence > bestMatch.confidence)) {
      bestMatch = {
        workflow,
        confidence: result.confidence,
        matchedPhrase: triggerPhrase,
      };
    }
  }

  return bestMatch;
}

/**
 * Executes a workflow triggered by a chat message.
 */
export async function executeChatTrigger(
  match: ChatTriggerMatch,
  message: ChatMessage,
  executionService: ExecutionService,
  queue: ExecutionQueue,
): Promise<ChatTriggerResult> {
  const { workflow } = match;

  // Build inputs from message context
  const inputs: Record<string, unknown> = {
    message: message.content,
    conversationId: message.conversationId,
    userId: message.userId,
    channelId: message.channelId,
    matchedPhrase: match.matchedPhrase,
    confidence: match.confidence,
    metadata: message.metadata,
  };

  // Create execution
  const execution = await executionService.createExecution({
    workflowId: workflow.id,
    triggeredBy: `chat:${message.userId || "anonymous"}`,
    inputs,
  });

  // Queue first node
  const definition = workflow.definition as unknown as WorkflowDefinition | null;
  const triggerNode = definition?.nodes?.find((n: WorkflowNode) => n.type === "trigger");
  if (triggerNode) {
    await queue.enqueue(execution.id, triggerNode.id);
  }

  return {
    executionId: execution.id,
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: execution.status,
  };
}

/**
 * Handles a chat message, checking for triggers and executing if matched.
 */
export async function handleChatMessage(
  message: ChatMessage,
  tenantId: string,
  repository: WorkflowRepository,
  executionService: ExecutionService,
  queue: ExecutionQueue,
  options?: {
    minConfidence?: number;
  },
): Promise<ChatTriggerResult | null> {
  const minConfidence = options?.minConfidence ?? 0.5;

  // Check for matching triggers
  const match = await checkChatTriggers(message, tenantId, repository);

  if (!match || match.confidence < minConfidence) {
    return null;
  }

  // Execute the workflow
  return executeChatTrigger(match, message, executionService, queue);
}

// =============================================================================
// TRIGGER PHRASE UTILITIES
// =============================================================================

/**
 * Validates a trigger phrase.
 */
export function validateTriggerPhrase(phrase: string): {
  valid: boolean;
  error?: string;
  normalized?: string;
} {
  if (!phrase || typeof phrase !== "string") {
    return { valid: false, error: "Trigger phrase must be a non-empty string" };
  }

  const normalized = normalizeText(phrase);

  if (!normalized) {
    return { valid: false, error: "Trigger phrase cannot be empty after normalization" };
  }

  if (normalized.length < 2) {
    return { valid: false, error: "Trigger phrase must be at least 2 characters" };
  }

  if (normalized.length > 100) {
    return { valid: false, error: "Trigger phrase must be at most 100 characters" };
  }

  // Check for common problematic patterns
  if (/^(the|a|an|is|are|was|were|be|been|being)$/i.test(normalized)) {
    return { valid: false, error: "Trigger phrase is too common" };
  }

  return { valid: true, normalized };
}

/**
 * Suggests improvements for a trigger phrase.
 */
export function suggestTriggerPhrase(phrase: string): string[] {
  const normalized = normalizeText(phrase);
  const suggestions: string[] = [];

  // Suggest adding a verb if not present
  if (!/^(run|start|execute|trigger|do|create|send|get|show|list)/i.test(normalized)) {
    suggestions.push(`run ${normalized}`);
    suggestions.push(`start ${normalized}`);
  }

  // Suggest variations
  if (!normalized.includes("please")) {
    suggestions.push(`please ${normalized}`);
  }

  return suggestions.slice(0, 3);
}
