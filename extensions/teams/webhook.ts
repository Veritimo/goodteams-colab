/**
 * Teams Webhook Handler
 *
 * Handles incoming webhook payloads from Microsoft Teams (Bot Framework format).
 * Parses activities and converts them to normalized OpenClaw messages.
 *
 * @see https://learn.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference
 */

import type {
  TeamsActivity,
  TeamsChannelAccount,
  TeamsConversationAccount,
  TeamsEntity,
  TeamsChannelData,
  NormalizedTeamsMessage,
} from "./types.js";

// =============================================================================
// WEBHOOK PAYLOAD PARSING
// =============================================================================

/**
 * Parse a raw webhook payload into a TeamsActivity
 *
 * @param payload - Raw webhook payload (JSON parsed or string)
 * @returns Parsed TeamsActivity or null if invalid
 */
export function parseWebhookPayload(payload: unknown): TeamsActivity | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const activity = payload as Record<string, unknown>;

  // Validate required fields
  if (typeof activity.type !== "string") {
    return null;
  }

  return activity as TeamsActivity;
}

/**
 * Parse a JSON string into a TeamsActivity
 *
 * @param json - JSON string
 * @returns Parsed TeamsActivity or null if invalid
 */
export function parseWebhookJson(json: string): TeamsActivity | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    return parseWebhookPayload(parsed);
  } catch {
    return null;
  }
}

// =============================================================================
// ACTIVITY TYPE CHECKING
// =============================================================================

/**
 * Check if activity is a message activity
 */
export function isMessageActivity(activity: TeamsActivity): boolean {
  return activity.type === "message";
}

/**
 * Check if activity is a conversation update (member added/removed)
 */
export function isConversationUpdateActivity(activity: TeamsActivity): boolean {
  return activity.type === "conversationUpdate";
}

/**
 * Check if activity is an invoke activity (card actions, etc.)
 */
export function isInvokeActivity(activity: TeamsActivity): boolean {
  return activity.type === "invoke";
}

/**
 * Check if activity is a message reaction
 */
export function isMessageReactionActivity(activity: TeamsActivity): boolean {
  return activity.type === "messageReaction";
}

/**
 * Check if activity is a typing indicator
 */
export function isTypingActivity(activity: TeamsActivity): boolean {
  return activity.type === "typing";
}

// =============================================================================
// SENDER EXTRACTION
// =============================================================================

/**
 * Extract sender information from an activity
 *
 * @param activity - Teams activity
 * @returns Sender info or null
 */
export function extractSender(
  activity: TeamsActivity,
): { id: string; name?: string; email?: string; aadObjectId?: string } | null {
  const from = activity.from;
  if (!from?.id) {
    return null;
  }

  return {
    id: from.id,
    name: from.name ?? undefined,
    email: from.email ?? undefined,
    aadObjectId: from.aadObjectId ?? undefined,
  };
}

/**
 * Extract the sender's display name (with fallback to ID)
 */
export function getSenderDisplayName(activity: TeamsActivity): string {
  const sender = extractSender(activity);
  return sender?.name ?? sender?.id ?? "Unknown";
}

/**
 * Check if the sender is a bot
 */
export function isSenderBot(activity: TeamsActivity): boolean {
  return activity.from?.role === "bot";
}

// =============================================================================
// CONVERSATION EXTRACTION
// =============================================================================

/**
 * Extract conversation information from an activity
 */
export function extractConversation(activity: TeamsActivity): {
  id: string;
  isGroup: boolean;
  conversationType: "personal" | "groupChat" | "channel";
  tenantId?: string;
} | null {
  const conversation = activity.conversation;
  if (!conversation?.id) {
    return null;
  }

  // Determine conversation type from various signals
  let conversationType: "personal" | "groupChat" | "channel" = "personal";

  if (conversation.conversationType) {
    conversationType = conversation.conversationType;
  } else if (conversation.isGroup) {
    // If isGroup but no conversationType, check for channel indicators
    const channelData = activity.channelData as TeamsChannelData | undefined;
    if (channelData?.channel?.id) {
      conversationType = "channel";
    } else {
      conversationType = "groupChat";
    }
  }

  return {
    id: conversation.id,
    isGroup: conversation.isGroup ?? conversationType !== "personal",
    conversationType,
    tenantId: conversation.tenantId ?? undefined,
  };
}

/**
 * Extract team and channel information from channel data
 */
export function extractTeamChannel(activity: TeamsActivity): {
  teamId?: string;
  teamName?: string;
  channelId?: string;
  channelName?: string;
  tenantId?: string;
} {
  const channelData = activity.channelData as TeamsChannelData | undefined;

  return {
    teamId: channelData?.team?.id ?? undefined,
    teamName: channelData?.team?.name ?? undefined,
    channelId: channelData?.channel?.id ?? undefined,
    channelName: channelData?.channel?.name ?? undefined,
    tenantId: channelData?.tenant?.id ?? undefined,
  };
}

// =============================================================================
// MESSAGE TEXT EXTRACTION
// =============================================================================

/**
 * Extract and clean the message text from an activity
 *
 * @param activity - Teams activity
 * @param options - Processing options
 * @returns Cleaned message text
 */
export function extractMessageText(
  activity: TeamsActivity,
  options?: {
    /** Whether to strip @mentions from the text */
    stripMentions?: boolean;
    /** Bot ID to strip from mentions (if not provided, strips all mentions) */
    botId?: string;
  },
): string {
  let text = activity.text ?? "";

  if (!text) {
    return "";
  }

  // Strip mentions if requested
  if (options?.stripMentions !== false) {
    text = stripMentions(text, activity.entities, options?.botId);
  }

  // Clean up extra whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Strip @mention tags from message text
 *
 * @param text - Raw message text
 * @param entities - Activity entities (contains mention info)
 * @param botId - Optional specific bot ID to strip
 * @returns Text with mentions removed
 */
export function stripMentions(
  text: string,
  entities?: TeamsEntity[],
  botId?: string,
): string {
  if (!text) {
    return "";
  }

  // Remove <at>...</at> HTML tags
  let cleaned = text.replace(/<at[^>]*>.*?<\/at>/gi, "");

  // If we have entities with mention text, also remove those
  if (entities) {
    for (const entity of entities) {
      if (entity.type !== "mention") {
        continue;
      }

      // If botId specified, only strip that specific mention
      if (botId && entity.mentioned?.id !== botId) {
        continue;
      }

      if (entity.text) {
        // Escape special regex characters in the mention text
        const escaped = entity.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        cleaned = cleaned.replace(new RegExp(escaped, "gi"), "");
      }
    }
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

/**
 * Get the raw message text without any processing
 */
export function getRawMessageText(activity: TeamsActivity): string {
  return activity.text ?? "";
}

// =============================================================================
// MENTION DETECTION
// =============================================================================

/**
 * Check if the bot was mentioned in the activity
 *
 * @param activity - Teams activity
 * @param botId - Bot's user ID (optional, uses recipient.id if not provided)
 * @returns True if bot was mentioned
 */
export function wasBotMentioned(activity: TeamsActivity, botId?: string): boolean {
  const targetId = botId ?? activity.recipient?.id;
  if (!targetId) {
    return false;
  }

  const entities = activity.entities;
  if (!entities || entities.length === 0) {
    return false;
  }

  return entities.some(
    (entity) => entity.type === "mention" && entity.mentioned?.id === targetId,
  );
}

/**
 * Get all mentions from an activity
 *
 * @param activity - Teams activity
 * @returns Array of mentioned users
 */
export function getAllMentions(
  activity: TeamsActivity,
): Array<{ id: string; name?: string; text?: string }> {
  const entities = activity.entities;
  if (!entities || entities.length === 0) {
    return [];
  }

  return entities
    .filter((entity) => entity.type === "mention" && entity.mentioned?.id)
    .map((entity) => ({
      id: entity.mentioned!.id,
      name: entity.mentioned!.name,
      text: entity.text,
    }));
}

/**
 * Get mentions excluding the bot
 *
 * @param activity - Teams activity
 * @param botId - Bot's user ID
 * @returns Array of mentioned users (excluding bot)
 */
export function getMentionsExcludingBot(
  activity: TeamsActivity,
  botId?: string,
): Array<{ id: string; name?: string; text?: string }> {
  const targetId = botId ?? activity.recipient?.id;
  const mentions = getAllMentions(activity);

  if (!targetId) {
    return mentions;
  }

  return mentions.filter((mention) => mention.id !== targetId);
}

// =============================================================================
// CONVERSATION REFERENCE
// =============================================================================

/**
 * Build a conversation reference from an activity (for proactive messaging)
 */
export function buildConversationReference(activity: TeamsActivity): {
  activityId?: string;
  user?: TeamsChannelAccount;
  bot?: TeamsChannelAccount;
  conversation?: TeamsConversationAccount;
  channelId?: string;
  locale?: string;
  serviceUrl?: string;
} {
  return {
    activityId: activity.id,
    user: activity.from,
    bot: activity.recipient,
    conversation: activity.conversation,
    channelId: activity.channelId,
    locale: activity.locale,
    serviceUrl: activity.serviceUrl,
  };
}

// =============================================================================
// REPLY CONTEXT
// =============================================================================

/**
 * Extract reply context from an activity
 */
export function extractReplyContext(activity: TeamsActivity): {
  replyToId?: string;
  conversationId: string;
  serviceUrl?: string;
} | null {
  const conversation = activity.conversation;
  if (!conversation?.id) {
    return null;
  }

  return {
    replyToId: activity.replyToId ?? activity.id,
    conversationId: conversation.id,
    serviceUrl: activity.serviceUrl,
  };
}

// =============================================================================
// NORMALIZED MESSAGE CONVERSION
// =============================================================================

/**
 * Convert a Teams activity to a normalized OpenClaw message format
 *
 * @param activity - Teams activity
 * @param options - Conversion options
 * @returns Normalized message or null if not a valid message
 */
export function normalizeActivity(
  activity: TeamsActivity,
  options?: {
    /** Bot ID for mention stripping */
    botId?: string;
    /** Whether to strip bot mentions from text */
    stripBotMention?: boolean;
  },
): NormalizedTeamsMessage | null {
  // Only process message activities
  if (!isMessageActivity(activity)) {
    return null;
  }

  // Skip bot messages
  if (isSenderBot(activity)) {
    return null;
  }

  const sender = extractSender(activity);
  if (!sender) {
    return null;
  }

  const conversation = extractConversation(activity);
  if (!conversation) {
    return null;
  }

  const teamChannel = extractTeamChannel(activity);
  const botId = options?.botId ?? activity.recipient?.id;
  const botMentioned = wasBotMentioned(activity, botId);

  // Extract text (strip bot mentions by default)
  const stripMentions = options?.stripBotMention !== false;
  const text = extractMessageText(activity, {
    stripMentions,
    botId: stripMentions ? botId : undefined,
  });

  // Map conversation type to chat type
  let chatType: "direct" | "channel" | "groupChat";
  switch (conversation.conversationType) {
    case "personal":
      chatType = "direct";
      break;
    case "channel":
      chatType = "channel";
      break;
    case "groupChat":
      chatType = "groupChat";
      break;
    default:
      chatType = "direct";
  }

  return {
    id: activity.id ?? `${Date.now()}`,
    channel: "teams",
    sender: {
      id: sender.id,
      name: sender.name,
      email: sender.email,
    },
    text,
    rawText: getRawMessageText(activity),
    chatType,
    conversationId: conversation.id,
    teamId: teamChannel.teamId,
    channelId: teamChannel.channelId,
    threadId: activity.replyToId,
    botMentioned,
    timestamp: activity.timestamp ?? new Date().toISOString(),
    serviceUrl: activity.serviceUrl,
    activity,
  };
}

// =============================================================================
// INVOKE HANDLING
// =============================================================================

/**
 * Extract invoke action data from an activity
 */
export function extractInvokeData(activity: TeamsActivity): {
  name?: string;
  value?: unknown;
} | null {
  if (!isInvokeActivity(activity)) {
    return null;
  }

  return {
    name: activity.name,
    value: activity.value,
  };
}

/**
 * Check if this is a card action invoke
 */
export function isCardActionInvoke(activity: TeamsActivity): boolean {
  return isInvokeActivity(activity) && activity.name === "adaptiveCard/action";
}

/**
 * Extract card action data from an invoke activity
 */
export function extractCardActionData(activity: TeamsActivity): {
  action?: {
    type?: string;
    verb?: string;
    data?: unknown;
  };
} | null {
  if (!isCardActionInvoke(activity)) {
    return null;
  }

  const value = activity.value as Record<string, unknown> | undefined;
  return {
    action: value?.action as { type?: string; verb?: string; data?: unknown } | undefined,
  };
}

// =============================================================================
// CONVERSATION UPDATE HANDLING
// =============================================================================

/**
 * Extract members added from a conversation update activity
 */
export function getMembersAdded(activity: TeamsActivity): TeamsChannelAccount[] {
  if (!isConversationUpdateActivity(activity)) {
    return [];
  }
  return activity.membersAdded ?? [];
}

/**
 * Extract members removed from a conversation update activity
 */
export function getMembersRemoved(activity: TeamsActivity): TeamsChannelAccount[] {
  if (!isConversationUpdateActivity(activity)) {
    return [];
  }
  return activity.membersRemoved ?? [];
}

/**
 * Check if the bot was added to the conversation
 */
export function wasBotAdded(activity: TeamsActivity, botId?: string): boolean {
  const targetId = botId ?? activity.recipient?.id;
  if (!targetId) {
    return false;
  }

  const added = getMembersAdded(activity);
  return added.some((member) => member.id === targetId);
}

/**
 * Check if the bot was removed from the conversation
 */
export function wasBotRemoved(activity: TeamsActivity, botId?: string): boolean {
  const targetId = botId ?? activity.recipient?.id;
  if (!targetId) {
    return false;
  }

  const removed = getMembersRemoved(activity);
  return removed.some((member) => member.id === targetId);
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate that an activity has the minimum required fields
 */
export function isValidActivity(activity: unknown): activity is TeamsActivity {
  if (!activity || typeof activity !== "object") {
    return false;
  }

  const act = activity as Record<string, unknown>;
  return typeof act.type === "string";
}

/**
 * Validate that an activity is a processable message
 * (message type, has text or attachments, not from a bot)
 */
export function isProcessableMessage(activity: TeamsActivity): boolean {
  if (!isMessageActivity(activity)) {
    return false;
  }

  if (isSenderBot(activity)) {
    return false;
  }

  // Must have text or attachments
  const hasText = Boolean(activity.text?.trim());
  const hasAttachments = Array.isArray(activity.attachments) && activity.attachments.length > 0;

  return hasText || hasAttachments;
}
