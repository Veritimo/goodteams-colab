/**
 * Microsoft Outlook Mail Operations
 *
 * Email operations via Microsoft Graph API.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
 */

import type { Client } from "@microsoft/microsoft-graph-client";
import type {
  Message,
  Attachment,
  MailFolder,
  ListMessagesOptions,
  NewMessage,
  PagedResponse,
} from "./types.js";

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

/** Default fields to select for messages */
const DEFAULT_MESSAGE_SELECT = [
  "id",
  "subject",
  "bodyPreview",
  "from",
  "toRecipients",
  "ccRecipients",
  "receivedDateTime",
  "sentDateTime",
  "hasAttachments",
  "isRead",
  "isDraft",
  "importance",
  "conversationId",
];

/** Default number of items to return */
const DEFAULT_TOP = 10;

// =============================================================================
// MESSAGE OPERATIONS
// =============================================================================

/**
 * List messages from a mail folder
 *
 * @param client - Authenticated Graph client
 * @param options - Query options (folder, pagination, filters)
 * @returns Array of messages
 *
 * @example
 * ```typescript
 * // List unread messages
 * const messages = await listMessages(client, {
 *   filter: "isRead eq false",
 *   top: 25,
 * });
 *
 * // Search messages
 * const results = await listMessages(client, {
 *   search: "project update",
 * });
 * ```
 */
export async function listMessages(
  client: Client,
  options: ListMessagesOptions = {},
): Promise<Message[]> {
  const {
    folderId = "inbox",
    top = DEFAULT_TOP,
    skip,
    filter,
    search,
    select = DEFAULT_MESSAGE_SELECT,
    orderBy = "receivedDateTime desc",
  } = options;

  let request = client
    .api(`/me/mailFolders/${folderId}/messages`)
    .select(select)
    .top(top)
    .orderby(orderBy);

  if (skip !== undefined) {
    request = request.skip(skip);
  }

  if (filter) {
    request = request.filter(filter);
  }

  if (search) {
    request = request.search(`"${search}"`);
  }

  const response: PagedResponse<Message> = await request.get();
  return response.value;
}

/**
 * Get a single message with full body content
 *
 * @param client - Authenticated Graph client
 * @param messageId - Message ID
 * @returns Full message with body
 *
 * @example
 * ```typescript
 * const message = await getMessage(client, "AAMkAGI2...");
 * console.log(message.body?.content);
 * ```
 */
export async function getMessage(client: Client, messageId: string): Promise<Message> {
  return client
    .api(`/me/messages/${messageId}`)
    .select([...DEFAULT_MESSAGE_SELECT, "body", "bccRecipients"])
    .get();
}

/**
 * Get attachments for a message
 *
 * @param client - Authenticated Graph client
 * @param messageId - Message ID
 * @returns Array of attachments (without content bytes)
 *
 * @example
 * ```typescript
 * const attachments = await getAttachments(client, messageId);
 * for (const att of attachments) {
 *   console.log(`${att.name} (${att.size} bytes)`);
 * }
 * ```
 */
export async function getAttachments(client: Client, messageId: string): Promise<Attachment[]> {
  const response: PagedResponse<Attachment> = await client
    .api(`/me/messages/${messageId}/attachments`)
    .select(["id", "name", "contentType", "size", "isInline", "contentId"])
    .get();

  return response.value;
}

/**
 * Download a specific attachment with content
 *
 * @param client - Authenticated Graph client
 * @param messageId - Message ID
 * @param attachmentId - Attachment ID
 * @returns Attachment with contentBytes (base64 encoded)
 *
 * @example
 * ```typescript
 * const attachment = await downloadAttachment(client, messageId, attachmentId);
 * const content = Buffer.from(attachment.contentBytes!, "base64");
 * ```
 */
export async function downloadAttachment(
  client: Client,
  messageId: string,
  attachmentId: string,
): Promise<Attachment> {
  return client.api(`/me/messages/${messageId}/attachments/${attachmentId}`).get();
}

// =============================================================================
// SEND OPERATIONS
// =============================================================================

/**
 * Send an email message
 *
 * @param client - Authenticated Graph client
 * @param message - Message to send
 *
 * @example
 * ```typescript
 * await sendMail(client, {
 *   subject: "Hello",
 *   body: { contentType: "text", content: "Hello World!" },
 *   toRecipients: [{ emailAddress: { address: "user@example.com" } }],
 * });
 * ```
 */
export async function sendMail(client: Client, message: NewMessage): Promise<void> {
  const { saveToSentItems = true, ...messageBody } = message;

  // Convert attachments to Graph format
  const attachments = messageBody.attachments?.map((att) => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: att.name,
    contentType: att.contentType,
    contentBytes: att.contentBytes,
  }));

  await client.api("/me/sendMail").post({
    message: {
      ...messageBody,
      attachments,
    },
    saveToSentItems,
  });
}

/**
 * Reply to a message
 *
 * @param client - Authenticated Graph client
 * @param messageId - ID of message to reply to
 * @param body - Reply body content (HTML supported)
 * @param replyAll - Reply to all recipients (default: false)
 *
 * @example
 * ```typescript
 * await replyToMessage(client, messageId, "Thanks for your message!");
 * await replyToMessage(client, messageId, "<p>Noted.</p>", true);
 * ```
 */
export async function replyToMessage(
  client: Client,
  messageId: string,
  body: string,
  replyAll = false,
): Promise<void> {
  const action = replyAll ? "replyAll" : "reply";

  await client.api(`/me/messages/${messageId}/${action}`).post({
    comment: body,
  });
}

/**
 * Forward a message to other recipients
 *
 * @param client - Authenticated Graph client
 * @param messageId - ID of message to forward
 * @param to - Recipients to forward to (email addresses)
 * @param comment - Optional comment to add above forwarded content
 *
 * @example
 * ```typescript
 * await forwardMessage(client, messageId, ["colleague@example.com"], "FYI");
 * ```
 */
export async function forwardMessage(
  client: Client,
  messageId: string,
  to: string[],
  comment?: string,
): Promise<void> {
  const toRecipients = to.map((address) => ({
    emailAddress: { address },
  }));

  await client.api(`/me/messages/${messageId}/forward`).post({
    comment: comment || "",
    toRecipients,
  });
}

// =============================================================================
// MESSAGE MANAGEMENT
// =============================================================================

/**
 * Delete a message (moves to Deleted Items)
 *
 * @param client - Authenticated Graph client
 * @param messageId - Message ID to delete
 *
 * @example
 * ```typescript
 * await deleteMessage(client, messageId);
 * ```
 */
export async function deleteMessage(client: Client, messageId: string): Promise<void> {
  await client.api(`/me/messages/${messageId}`).delete();
}

/**
 * Move a message to a different folder
 *
 * @param client - Authenticated Graph client
 * @param messageId - Message ID to move
 * @param folderId - Destination folder ID
 * @returns Updated message
 *
 * @example
 * ```typescript
 * // Move to archive folder
 * await moveMessage(client, messageId, "archive");
 *
 * // Move to custom folder
 * await moveMessage(client, messageId, "AAMkAGI2...");
 * ```
 */
export async function moveMessage(
  client: Client,
  messageId: string,
  folderId: string,
): Promise<Message> {
  return client.api(`/me/messages/${messageId}/move`).post({
    destinationId: folderId,
  });
}

/**
 * Mark a message as read or unread
 *
 * @param client - Authenticated Graph client
 * @param messageId - Message ID
 * @param isRead - Read status to set
 * @returns Updated message
 */
export async function markAsRead(
  client: Client,
  messageId: string,
  isRead: boolean,
): Promise<Message> {
  return client.api(`/me/messages/${messageId}`).patch({
    isRead,
  });
}

// =============================================================================
// FOLDER OPERATIONS
// =============================================================================

/**
 * List mail folders
 *
 * @param client - Authenticated Graph client
 * @returns Array of mail folders
 *
 * @example
 * ```typescript
 * const folders = await listFolders(client);
 * for (const folder of folders) {
 *   console.log(`${folder.displayName}: ${folder.unreadItemCount} unread`);
 * }
 * ```
 */
export async function listFolders(client: Client): Promise<MailFolder[]> {
  const response: PagedResponse<MailFolder> = await client
    .api("/me/mailFolders")
    .select([
      "id",
      "displayName",
      "parentFolderId",
      "childFolderCount",
      "unreadItemCount",
      "totalItemCount",
    ])
    .get();

  return response.value;
}

/**
 * Get a specific mail folder by ID
 *
 * @param client - Authenticated Graph client
 * @param folderId - Folder ID (or well-known name like "inbox", "drafts")
 * @returns Mail folder
 */
export async function getFolder(client: Client, folderId: string): Promise<MailFolder> {
  return client
    .api(`/me/mailFolders/${folderId}`)
    .select([
      "id",
      "displayName",
      "parentFolderId",
      "childFolderCount",
      "unreadItemCount",
      "totalItemCount",
    ])
    .get();
}

/**
 * Create a new mail folder
 *
 * @param client - Authenticated Graph client
 * @param displayName - Name for the new folder
 * @param parentFolderId - Parent folder ID (optional, defaults to root)
 * @returns Created folder
 */
export async function createFolder(
  client: Client,
  displayName: string,
  parentFolderId?: string,
): Promise<MailFolder> {
  const endpoint = parentFolderId
    ? `/me/mailFolders/${parentFolderId}/childFolders`
    : "/me/mailFolders";

  return client.api(endpoint).post({
    displayName,
  });
}
