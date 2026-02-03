/**
 * Teams Message Sender
 *
 * Functions for sending messages to Microsoft Teams channels and chats
 * via the Microsoft Graph API.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/channel-post-messages
 * @see https://learn.microsoft.com/en-us/graph/api/chat-post-messages
 */

import type {
  GraphClient,
  TeamsMessage,
  TeamsMessageBody,
  SendMessageOptions,
  AdaptiveCard,
  TeamsAttachment,
} from "./types.js";
import { ADAPTIVE_CARD_CONTENT_TYPE, cardToAttachment } from "./cards.js";

// =============================================================================
// MESSAGE BODY BUILDING
// =============================================================================

/**
 * Create a message body for sending
 */
export function createMessageBody(
  content: string,
  contentType: "text" | "html" = "html",
): TeamsMessageBody {
  return {
    contentType,
    content,
  };
}

/**
 * Convert markdown to Teams-compatible HTML
 *
 * Teams supports a subset of HTML. This converts common markdown patterns.
 */
export function markdownToTeamsHtml(markdown: string): string {
  let html = markdown;

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Strikethrough: ~~text~~
  html = html.replace(/~~(.+?)~~/g, "<strike>$1</strike>");

  // Code: `text`
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");

  // Links: [text](url)
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  // Line breaks
  html = html.replace(/\n/g, "<br>");

  // Bullet lists: - item or * item
  html = html.replace(/^[\-\*]\s+(.+)$/gm, "<li>$1</li>");
  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li>.*?<\/li>)+/g, "<ul>$&</ul>");

  // Numbered lists: 1. item
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

  return html;
}

/**
 * Create an @mention HTML tag
 */
export function createMentionHtml(userId: string, displayName: string): string {
  return `<at id="${userId}">${displayName}</at>`;
}

/**
 * Create a mention entity for the mentions array
 */
export function createMentionEntity(
  mentionId: number,
  userId: string,
  displayName: string,
): SendMessageOptions["mentions"] extends (infer T)[] | undefined ? T : never {
  return {
    id: mentionId,
    mentionText: displayName,
    mentioned: {
      user: {
        id: userId,
        displayName,
        userIdentityType: "aadUser",
      },
    },
  };
}

// =============================================================================
// CHANNEL MESSAGE SENDING
// =============================================================================

/**
 * Send a message to a Teams channel
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @param channelId - Channel ID
 * @param message - Message content (text or HTML)
 * @param options - Additional message options
 * @returns The sent message
 */
export async function sendToChannel(
  client: GraphClient,
  teamId: string,
  channelId: string,
  message: string,
  options?: SendMessageOptions,
): Promise<TeamsMessage> {
  const body = buildMessagePayload(message, options);

  const response = await client
    .api(`/teams/${teamId}/channels/${channelId}/messages`)
    .post<TeamsMessage>(body);

  return response;
}

/**
 * Reply to a message in a Teams channel (creates a thread reply)
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @param channelId - Channel ID
 * @param messageId - Parent message ID to reply to
 * @param message - Reply content
 * @param options - Additional message options
 * @returns The sent reply
 */
export async function replyToMessage(
  client: GraphClient,
  teamId: string,
  channelId: string,
  messageId: string,
  message: string,
  options?: Omit<SendMessageOptions, "replyToId">,
): Promise<TeamsMessage> {
  const body = buildMessagePayload(message, options);

  const response = await client
    .api(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`)
    .post<TeamsMessage>(body);

  return response;
}

// =============================================================================
// CHAT MESSAGE SENDING
// =============================================================================

/**
 * Send a message to a Teams chat (1:1 or group chat)
 *
 * @param client - Microsoft Graph client
 * @param chatId - Chat ID
 * @param message - Message content (text or HTML)
 * @param options - Additional message options
 * @returns The sent message
 */
export async function sendToChat(
  client: GraphClient,
  chatId: string,
  message: string,
  options?: SendMessageOptions,
): Promise<TeamsMessage> {
  const body = buildMessagePayload(message, options);

  const response = await client
    .api(`/chats/${chatId}/messages`)
    .post<TeamsMessage>(body);

  return response;
}

/**
 * Reply to a message in a chat
 *
 * Note: Chat replies don't create threads like channels do.
 * This sends a new message with a reference to the original.
 *
 * @param client - Microsoft Graph client
 * @param chatId - Chat ID
 * @param message - Reply content
 * @param options - Additional message options
 * @returns The sent message
 */
export async function replyToChat(
  client: GraphClient,
  chatId: string,
  message: string,
  options?: SendMessageOptions,
): Promise<TeamsMessage> {
  // Chat messages don't have threaded replies like channels
  // Just send a normal message
  return sendToChat(client, chatId, message, options);
}

// =============================================================================
// ADAPTIVE CARD SENDING
// =============================================================================

/**
 * Send an Adaptive Card to a channel
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @param channelId - Channel ID
 * @param card - Adaptive Card object
 * @param options - Additional message options
 * @returns The sent message
 */
export async function sendCardToChannel(
  client: GraphClient,
  teamId: string,
  channelId: string,
  card: AdaptiveCard,
  options?: Omit<SendMessageOptions, "attachments">,
): Promise<TeamsMessage> {
  const attachment = cardToAttachment(card);
  const body = buildMessagePayload("", {
    ...options,
    attachments: [
      {
        id: "card1",
        contentType: attachment.contentType,
        content: JSON.stringify(attachment.content),
      },
    ],
  });

  const response = await client
    .api(`/teams/${teamId}/channels/${channelId}/messages`)
    .post<TeamsMessage>(body);

  return response;
}

/**
 * Send an Adaptive Card to a chat
 *
 * @param client - Microsoft Graph client
 * @param chatId - Chat ID
 * @param card - Adaptive Card object
 * @param options - Additional message options
 * @returns The sent message
 */
export async function sendCardToChat(
  client: GraphClient,
  chatId: string,
  card: AdaptiveCard,
  options?: Omit<SendMessageOptions, "attachments">,
): Promise<TeamsMessage> {
  const attachment = cardToAttachment(card);
  const body = buildMessagePayload("", {
    ...options,
    attachments: [
      {
        id: "card1",
        contentType: attachment.contentType,
        content: JSON.stringify(attachment.content),
      },
    ],
  });

  const response = await client
    .api(`/chats/${chatId}/messages`)
    .post<TeamsMessage>(body);

  return response;
}

/**
 * Send an Adaptive Card as a reply to a channel message
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @param channelId - Channel ID
 * @param messageId - Parent message ID
 * @param card - Adaptive Card object
 * @returns The sent reply
 */
export async function replyWithCard(
  client: GraphClient,
  teamId: string,
  channelId: string,
  messageId: string,
  card: AdaptiveCard,
): Promise<TeamsMessage> {
  const attachment = cardToAttachment(card);
  const body = buildMessagePayload("", {
    attachments: [
      {
        id: "card1",
        contentType: attachment.contentType,
        content: JSON.stringify(attachment.content),
      },
    ],
  });

  const response = await client
    .api(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`)
    .post<TeamsMessage>(body);

  return response;
}

// =============================================================================
// MESSAGE WITH MENTIONS
// =============================================================================

/**
 * Send a message with @mentions to a channel
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @param channelId - Channel ID
 * @param message - Message content
 * @param mentions - Array of users to mention
 * @returns The sent message
 */
export async function sendToChannelWithMentions(
  client: GraphClient,
  teamId: string,
  channelId: string,
  message: string,
  mentions: Array<{ userId: string; displayName: string }>,
): Promise<TeamsMessage> {
  // Build mention entities
  const mentionEntities: NonNullable<SendMessageOptions["mentions"]> = [];
  let contentWithMentions = message;

  mentions.forEach((mention, index) => {
    const mentionHtml = createMentionHtml(String(index), mention.displayName);
    contentWithMentions = contentWithMentions.replace(
      new RegExp(`@${mention.displayName}`, "gi"),
      mentionHtml,
    );

    mentionEntities.push(createMentionEntity(index, mention.userId, mention.displayName));
  });

  return sendToChannel(client, teamId, channelId, contentWithMentions, {
    mentions: mentionEntities,
  });
}

/**
 * Send a message with @mentions to a chat
 *
 * @param client - Microsoft Graph client
 * @param chatId - Chat ID
 * @param message - Message content
 * @param mentions - Array of users to mention
 * @returns The sent message
 */
export async function sendToChatWithMentions(
  client: GraphClient,
  chatId: string,
  message: string,
  mentions: Array<{ userId: string; displayName: string }>,
): Promise<TeamsMessage> {
  const mentionEntities: NonNullable<SendMessageOptions["mentions"]> = [];
  let contentWithMentions = message;

  mentions.forEach((mention, index) => {
    const mentionHtml = createMentionHtml(String(index), mention.displayName);
    contentWithMentions = contentWithMentions.replace(
      new RegExp(`@${mention.displayName}`, "gi"),
      mentionHtml,
    );

    mentionEntities.push(createMentionEntity(index, mention.userId, mention.displayName));
  });

  return sendToChat(client, chatId, contentWithMentions, {
    mentions: mentionEntities,
  });
}

// =============================================================================
// UNIFIED SEND FUNCTION
// =============================================================================

/**
 * Target specification for sending messages
 */
export type SendTarget =
  | { type: "channel"; teamId: string; channelId: string; replyToId?: string }
  | { type: "chat"; chatId: string };

/**
 * Send a message to any Teams target (channel or chat)
 *
 * @param client - Microsoft Graph client
 * @param target - Target specification
 * @param message - Message content
 * @param options - Additional options
 * @returns The sent message
 */
export async function send(
  client: GraphClient,
  target: SendTarget,
  message: string,
  options?: SendMessageOptions,
): Promise<TeamsMessage> {
  if (target.type === "channel") {
    if (target.replyToId) {
      return replyToMessage(
        client,
        target.teamId,
        target.channelId,
        target.replyToId,
        message,
        options,
      );
    }
    return sendToChannel(client, target.teamId, target.channelId, message, options);
  }

  return sendToChat(client, target.chatId, message, options);
}

/**
 * Send an Adaptive Card to any Teams target
 *
 * @param client - Microsoft Graph client
 * @param target - Target specification
 * @param card - Adaptive Card to send
 * @returns The sent message
 */
export async function sendCard(
  client: GraphClient,
  target: SendTarget,
  card: AdaptiveCard,
): Promise<TeamsMessage> {
  if (target.type === "channel") {
    if (target.replyToId) {
      return replyWithCard(
        client,
        target.teamId,
        target.channelId,
        target.replyToId,
        card,
      );
    }
    return sendCardToChannel(client, target.teamId, target.channelId, card);
  }

  return sendCardToChat(client, target.chatId, card);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build the message payload for the Graph API
 */
function buildMessagePayload(
  content: string,
  options?: SendMessageOptions,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    body: {
      contentType: "html",
      content: content || "&nbsp;", // Teams requires non-empty content
    },
  };

  if (options?.importance) {
    payload.importance = options.importance;
  }

  if (options?.subject) {
    payload.subject = options.subject;
  }

  if (options?.attachments && options.attachments.length > 0) {
    payload.attachments = options.attachments.map((att) => ({
      id: att.id ?? "attachment",
      contentType: att.contentType,
      contentUrl: att.contentUrl,
      content: att.content,
      name: att.name,
    }));
  }

  if (options?.mentions && options.mentions.length > 0) {
    payload.mentions = options.mentions;
  }

  return payload;
}

/**
 * Parse a target string into a SendTarget
 *
 * Formats:
 * - "channel:teamId/channelId" -> channel target
 * - "channel:teamId/channelId:replyToId" -> channel reply target
 * - "chat:chatId" -> chat target
 * - Just a conversation ID starting with "19:" -> channel or chat based on content
 *
 * @param target - Target string
 * @returns Parsed SendTarget or null
 */
export function parseTarget(target: string): SendTarget | null {
  const trimmed = target.trim();

  // Channel format: channel:teamId/channelId or channel:teamId/channelId:replyToId
  if (trimmed.startsWith("channel:")) {
    const rest = trimmed.slice("channel:".length);
    const [teamChannel, replyToId] = rest.split(":", 2) as [string, string | undefined];
    const [teamId, channelId] = teamChannel.split("/", 2) as [string, string | undefined];

    if (!teamId || !channelId) {
      return null;
    }

    return {
      type: "channel",
      teamId,
      channelId,
      ...(replyToId ? { replyToId } : {}),
    };
  }

  // Chat format: chat:chatId
  if (trimmed.startsWith("chat:")) {
    const chatId = trimmed.slice("chat:".length);
    if (!chatId) {
      return null;
    }
    return { type: "chat", chatId };
  }

  // Legacy conversation ID format
  if (trimmed.includes("@thread.tacv2") || trimmed.includes("@thread.skype")) {
    // This looks like a channel conversation ID
    // Without team info, we can't use it directly
    return null;
  }

  // Assume it's a chat ID
  if (trimmed.length > 0) {
    return { type: "chat", chatId: trimmed };
  }

  return null;
}

/**
 * Format a target as a string
 *
 * @param target - SendTarget object
 * @returns Formatted target string
 */
export function formatTarget(target: SendTarget): string {
  if (target.type === "channel") {
    const base = `channel:${target.teamId}/${target.channelId}`;
    return target.replyToId ? `${base}:${target.replyToId}` : base;
  }
  return `chat:${target.chatId}`;
}

/**
 * Estimate the length of a message for rate limiting purposes
 */
export function estimateMessageLength(message: string, card?: AdaptiveCard): number {
  let length = message.length;

  if (card) {
    length += JSON.stringify(card).length;
  }

  return length;
}

/**
 * Split a long message into chunks
 *
 * @param message - Message to split
 * @param maxLength - Maximum length per chunk (default 4000)
 * @returns Array of message chunks
 */
export function splitMessage(message: string, maxLength = 4000): string[] {
  if (message.length <= maxLength) {
    return [message];
  }

  const chunks: string[] = [];
  let remaining = message;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a natural break point
    let splitIndex = maxLength;

    // Look for line break
    const lineBreak = remaining.lastIndexOf("\n", maxLength);
    if (lineBreak > maxLength * 0.5) {
      splitIndex = lineBreak + 1;
    } else {
      // Look for sentence end
      const sentenceEnd = remaining.lastIndexOf(". ", maxLength);
      if (sentenceEnd > maxLength * 0.5) {
        splitIndex = sentenceEnd + 2;
      } else {
        // Look for space
        const space = remaining.lastIndexOf(" ", maxLength);
        if (space > maxLength * 0.5) {
          splitIndex = space + 1;
        }
      }
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}
