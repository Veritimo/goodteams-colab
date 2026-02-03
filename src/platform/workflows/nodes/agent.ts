/**
 * Agent Node Executor
 *
 * Executes LLM prompts with optional tool access.
 * Supports variable substitution in prompts using {{variable}} syntax.
 */

import type {
  AgentNodeConfig,
  AgentNodeOutput,
  ExecutionContext,
  NodeExecutor,
  LLMClient,
} from "./types.js";
import { NodeExecutionError } from "./types.js";

/** Default model to use if none specified */
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/** Default temperature for LLM calls */
const DEFAULT_TEMPERATURE = 0.7;

/** Default max tokens */
const DEFAULT_MAX_TOKENS = 4096;

/** Variable injection pattern: {{variable}} or {{nodes.nodeId.field}} */
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * Default LLM client - uses Anthropic SDK
 * Can be overridden for testing or to use different providers
 */
let defaultLLMClient: LLMClient | undefined;

/**
 * Set the default LLM client
 */
export function setDefaultLLMClient(client: LLMClient): void {
  defaultLLMClient = client;
}

/**
 * Get the current LLM client
 */
export function getLLMClient(): LLMClient | undefined {
  return defaultLLMClient;
}

/**
 * Execute an agent node
 *
 * @param config - Agent node configuration
 * @param context - Current execution context
 * @param llmClient - Optional LLM client override
 * @returns Agent output with generated text and optional tool calls
 */
export async function executeAgentNode(
  config: AgentNodeConfig,
  context: ExecutionContext,
  llmClient?: LLMClient,
): Promise<AgentNodeOutput> {
  const client = llmClient ?? defaultLLMClient;

  if (!client) {
    throw new NodeExecutionError(
      "agent",
      "LLM client not configured. Call setDefaultLLMClient() or pass a client directly.",
    );
  }

  if (!config.prompt) {
    throw new NodeExecutionError("agent", "Missing 'prompt' in configuration");
  }

  // Resolve variables in prompts
  const resolvedPrompt = resolveVariables(config.prompt, context);
  const resolvedSystemPrompt = config.systemPrompt
    ? resolveVariables(config.systemPrompt, context)
    : undefined;

  // Build the full system prompt with safety guidelines
  const fullSystemPrompt = buildSystemPrompt(resolvedSystemPrompt);

  try {
    const response = await client.generateText({
      model: config.model ?? DEFAULT_MODEL,
      systemPrompt: fullSystemPrompt,
      prompt: resolvedPrompt,
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
      maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      tools: config.tools,
    });

    return {
      text: response.text,
      toolCalls: response.toolCalls,
      usage: response.usage,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new NodeExecutionError("agent", `LLM call failed: ${message}`, error as Error);
  }
}

/**
 * Resolve variables in a string
 *
 * Supports:
 * - {{inputs.varName}} - Input variables
 * - {{nodes.nodeId.field}} - Output from previous nodes
 * - {{globals.varName}} - Global variables
 * - {{varName}} - Searches inputs, then globals
 *
 * @param template - String with {{variable}} placeholders
 * @param context - Execution context with values
 * @returns Resolved string with variables replaced
 */
export function resolveVariables(template: string, context: ExecutionContext): string {
  return template.replace(VARIABLE_PATTERN, (match, path) => {
    const value = resolvePath(path.trim(), context);
    if (value === undefined) {
      // Keep the original placeholder if value not found
      console.warn(`[AgentNode] Variable not found: ${path}`);
      return match;
    }
    // Convert objects to JSON for prompt injection
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

/**
 * Resolve a dot-notation path to a value
 */
function resolvePath(path: string, context: ExecutionContext): unknown {
  const parts = path.split(".");

  // Handle prefixed paths
  if (parts[0] === "inputs") {
    return getNestedValue(context.inputs, parts.slice(1));
  }
  if (parts[0] === "nodes") {
    return getNestedValue(context.nodeOutputs, parts.slice(1));
  }
  if (parts[0] === "globals") {
    return getNestedValue(context.globalVariables, parts.slice(1));
  }

  // Unprefixed paths: check inputs first, then globals
  const inputValue = getNestedValue(context.inputs, parts);
  if (inputValue !== undefined) {
    return inputValue;
  }

  return getNestedValue(context.globalVariables, parts);
}

/**
 * Get a nested value from an object using a path array
 */
function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  if (path.length === 0) return obj;

  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Build the full system prompt with safety guidelines
 */
function buildSystemPrompt(userSystemPrompt?: string): string {
  const basePrompt = userSystemPrompt ?? "You are a professional assistant.";

  const antiHallucinationRules = `
CRITICAL RULES - YOU MUST FOLLOW THESE:
1. NEVER make up, fabricate, or hallucinate data, numbers, statistics, or facts.
2. If data is missing, empty, or an error occurred, clearly state that no data was retrieved.
3. If asked to interpret results but no results are provided, say "I was unable to retrieve the data" or similar.
4. Do NOT invent placeholder numbers or fake breakdowns.
5. Only report information that is explicitly provided in the input data.
`;

  return `${basePrompt}\n${antiHallucinationRules}`;
}

/**
 * Validate agent node configuration
 */
export function validateAgentConfig(config: AgentNodeConfig): string[] {
  const errors: string[] = [];

  if (!config.prompt) {
    errors.push("Prompt is required");
  }

  if (config.temperature !== undefined) {
    if (config.temperature < 0 || config.temperature > 2) {
      errors.push("Temperature must be between 0 and 2");
    }
  }

  if (config.maxTokens !== undefined) {
    if (config.maxTokens < 1 || config.maxTokens > 100000) {
      errors.push("maxTokens must be between 1 and 100000");
    }
  }

  if (config.tools !== undefined && !Array.isArray(config.tools)) {
    errors.push("tools must be an array of tool names");
  }

  return errors;
}

/**
 * Create a simple LLM client wrapper for Anthropic SDK
 * This is a factory function that can be used to create clients
 */
export function createAnthropicClient(apiKey?: string): LLMClient {
  return {
    async generateText(options) {
      // Dynamic import to avoid bundling Anthropic if not used
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey });

      const response = await client.messages.create({
        model: options.model ?? DEFAULT_MODEL,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: options.systemPrompt,
        messages: [{ role: "user", content: options.prompt }],
        temperature: options.temperature,
      });

      // Extract text from content blocks
      const textBlocks = response.content.filter((block) => block.type === "text");
      const text = textBlocks.map((block) => block.text).join("\n");

      return {
        text,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    },
  };
}

/**
 * Node executor function that matches the standard signature
 */
export const executeAgentNodeExecutor: NodeExecutor<AgentNodeConfig, AgentNodeOutput> = (
  config,
  context,
) => executeAgentNode(config, context);
