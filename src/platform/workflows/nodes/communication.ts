/**
 * Communication Node Executor
 *
 * Sends notifications via email, Teams, or chat.
 */

import type {
  CommunicationNodeConfig,
  CommunicationNodeOutput,
  ExecutionContext,
  NodeExecutor,
  EmailSender,
  TeamsClient,
  ChatClient,
} from "./types.js";
import { NodeExecutionError } from "./types.js";

/** Variable injection pattern */
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * Default communication clients
 * Can be overridden for testing or to use different providers
 */
let defaultEmailSender: EmailSender | undefined;
let defaultTeamsClient: TeamsClient | undefined;
let defaultChatClient: ChatClient | undefined;

/**
 * Set the default email sender
 */
export function setDefaultEmailSender(sender: EmailSender): void {
  defaultEmailSender = sender;
}

/**
 * Set the default Teams client
 */
export function setDefaultTeamsClient(client: TeamsClient): void {
  defaultTeamsClient = client;
}

/**
 * Set the default chat client
 */
export function setDefaultChatClient(client: ChatClient): void {
  defaultChatClient = client;
}

/**
 * Get the current email sender
 */
export function getEmailSender(): EmailSender | undefined {
  return defaultEmailSender;
}

/**
 * Get the current Teams client
 */
export function getTeamsClient(): TeamsClient | undefined {
  return defaultTeamsClient;
}

/**
 * Get the current chat client
 */
export function getChatClient(): ChatClient | undefined {
  return defaultChatClient;
}

/**
 * Communication client options for dependency injection
 */
export interface CommunicationClients {
  emailSender?: EmailSender;
  teamsClient?: TeamsClient;
  chatClient?: ChatClient;
}

/**
 * Execute a communication node
 *
 * @param config - Communication node configuration
 * @param context - Current execution context
 * @param clients - Optional client overrides
 * @returns Communication output with send status
 */
export async function executeCommunicationNode(
  config: CommunicationNodeConfig,
  context: ExecutionContext,
  clients?: CommunicationClients,
): Promise<CommunicationNodeOutput> {
  if (!config.method) {
    throw new NodeExecutionError("communication", "Missing 'method' in configuration");
  }

  if (!config.body) {
    throw new NodeExecutionError("communication", "Missing 'body' in configuration");
  }

  // Resolve variables in body and other fields
  const resolvedBody = resolveVariables(config.body, context);
  const resolvedSubject = config.subject ? resolveVariables(config.subject, context) : undefined;
  const resolvedTo = config.to ? resolveVariables(config.to, context) : undefined;

  switch (config.method) {
    case "email":
      return sendEmail(config, resolvedBody, resolvedSubject, resolvedTo, context, clients);

    case "teams":
      return sendTeamsMessage(config, resolvedBody, context, clients);

    case "chat":
      return sendChatMessage(config, resolvedBody, context, clients);

    default:
      throw new NodeExecutionError(
        "communication",
        `Unsupported communication method: ${config.method}`,
      );
  }
}

/**
 * Send an email
 */
async function sendEmail(
  config: CommunicationNodeConfig,
  body: string,
  subject: string | undefined,
  to: string | undefined,
  context: ExecutionContext,
  clients?: CommunicationClients,
): Promise<CommunicationNodeOutput> {
  const emailSender = clients?.emailSender ?? defaultEmailSender;

  if (!emailSender) {
    throw new NodeExecutionError(
      "communication",
      "Email sender not configured. Call setDefaultEmailSender() or pass a sender directly.",
    );
  }

  if (!to) {
    throw new NodeExecutionError("communication", "Missing 'to' for email communication");
  }

  // Resolve from address
  const fromName = config.fromName ?? "Workflow Notification";
  const fromEmail = config.fromEmail ?? "noreply@example.com";

  try {
    await emailSender.send({
      to,
      subject: subject ?? "Workflow Notification",
      body,
      html: textToHtml(body),
      from: { name: fromName, email: fromEmail },
    });

    return {
      sent: true,
      method: "email",
      timestamp: new Date(),
      to,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new NodeExecutionError(
      "communication",
      `Failed to send email: ${message}`,
      error as Error,
    );
  }
}

/**
 * Send a Teams message
 */
async function sendTeamsMessage(
  config: CommunicationNodeConfig,
  body: string,
  context: ExecutionContext,
  clients?: CommunicationClients,
): Promise<CommunicationNodeOutput> {
  const teamsClient = clients?.teamsClient ?? defaultTeamsClient;

  if (!teamsClient) {
    throw new NodeExecutionError(
      "communication",
      "Teams client not configured. Call setDefaultTeamsClient() or pass a client directly.",
    );
  }

  const teamId = config.teamId ?? config.to;
  const channelId = config.channelId ?? config.subject;

  if (!teamId) {
    throw new NodeExecutionError(
      "communication",
      "Missing 'teamId' (or 'to') for Teams communication",
    );
  }

  if (!channelId) {
    throw new NodeExecutionError(
      "communication",
      "Missing 'channelId' (or 'subject') for Teams communication",
    );
  }

  try {
    await teamsClient.sendMessage({
      teamId,
      channelId,
      message: body,
    });

    return {
      sent: true,
      method: "teams",
      timestamp: new Date(),
      teamId,
      channelId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new NodeExecutionError(
      "communication",
      `Failed to send Teams message: ${message}`,
      error as Error,
    );
  }
}

/**
 * Send a chat message
 */
async function sendChatMessage(
  config: CommunicationNodeConfig,
  body: string,
  context: ExecutionContext,
  clients?: CommunicationClients,
): Promise<CommunicationNodeOutput> {
  const chatClient = clients?.chatClient ?? defaultChatClient;

  if (!chatClient) {
    throw new NodeExecutionError(
      "communication",
      "Chat client not configured. Call setDefaultChatClient() or pass a client directly.",
    );
  }

  const conversationId = config.conversationId;

  if (!conversationId) {
    throw new NodeExecutionError(
      "communication",
      "Missing 'conversationId' for chat communication",
    );
  }

  try {
    await chatClient.sendMessage({
      conversationId,
      message: body,
    });

    return {
      sent: true,
      method: "chat",
      timestamp: new Date(),
      conversationId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new NodeExecutionError(
      "communication",
      `Failed to send chat message: ${message}`,
      error as Error,
    );
  }
}

/**
 * Resolve variables in a string
 */
function resolveVariables(template: string, context: ExecutionContext): string {
  return template.replace(VARIABLE_PATTERN, (match, path) => {
    const value = resolvePath(path.trim(), context);
    if (value === undefined) {
      console.warn(`[CommunicationNode] Variable not found: ${path}`);
      return match;
    }
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
 * Convert plain text to basic HTML
 */
function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

/**
 * Validate communication node configuration
 */
export function validateCommunicationConfig(config: CommunicationNodeConfig): string[] {
  const errors: string[] = [];

  if (!config.method) {
    errors.push("Method is required");
  } else {
    const validMethods = ["email", "teams", "chat"];
    if (!validMethods.includes(config.method)) {
      errors.push(`Invalid method '${config.method}'. Must be one of: ${validMethods.join(", ")}`);
    }
  }

  if (!config.body) {
    errors.push("Body is required");
  }

  // Method-specific validation
  if (config.method === "email" && !config.to) {
    errors.push("'to' is required for email communication");
  }

  if (config.method === "teams") {
    if (!config.teamId && !config.to) {
      errors.push("'teamId' or 'to' is required for Teams communication");
    }
    if (!config.channelId && !config.subject) {
      errors.push("'channelId' or 'subject' is required for Teams communication");
    }
  }

  if (config.method === "chat" && !config.conversationId) {
    errors.push("'conversationId' is required for chat communication");
  }

  return errors;
}

/**
 * Create a stub email sender for testing/development
 */
export function createStubEmailSender(): EmailSender {
  return {
    async send(options) {
      console.log("═".repeat(60));
      console.log("[EMAIL STUB] Sending email");
      console.log("─".repeat(60));
      console.log(`  To:      ${options.to}`);
      console.log(`  From:    ${options.from?.name} <${options.from?.email}>`);
      console.log(`  Subject: ${options.subject}`);
      console.log("─".repeat(60));
      console.log(`  Body:\n${options.body}`);
      console.log("═".repeat(60));
    },
  };
}

/**
 * Create a stub Teams client for testing/development
 */
export function createStubTeamsClient(): TeamsClient {
  return {
    async sendMessage(options) {
      console.log("═".repeat(60));
      console.log("[TEAMS STUB] Sending Teams message");
      console.log("─".repeat(60));
      console.log(`  Team:    ${options.teamId}`);
      console.log(`  Channel: ${options.channelId}`);
      console.log("─".repeat(60));
      console.log(`  Message:\n${options.message}`);
      console.log("═".repeat(60));
    },
  };
}

/**
 * Create a stub chat client for testing/development
 */
export function createStubChatClient(): ChatClient {
  return {
    async sendMessage(options) {
      console.log("═".repeat(60));
      console.log("[CHAT STUB] Sending chat message");
      console.log("─".repeat(60));
      console.log(`  Conversation: ${options.conversationId}`);
      console.log("─".repeat(60));
      console.log(`  Message:\n${options.message}`);
      console.log("═".repeat(60));
    },
  };
}

/**
 * Node executor function that matches the standard signature
 */
export const executeCommunicationNodeExecutor: NodeExecutor<
  CommunicationNodeConfig,
  CommunicationNodeOutput
> = (config, context) => executeCommunicationNode(config, context);
