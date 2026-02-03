/**
 * Gmail API Client
 *
 * Provides email operations via Gmail API.
 *
 * @see https://developers.google.com/gmail/api/reference/rest
 */

import type {
  GoogleAuth,
  GmailMessage,
  MessageList,
  MessageListResponse,
  ListMessagesOptions,
  SendEmailOptions,
  ReplyEmailOptions,
  Label,
  ModifyLabelsOptions,
  GmailApiMessage,
  AttachmentContent,
  GmailProfile,
  GmailThread,
  ThreadList,
  GmailDraft,
  DraftList,
  HistoryList,
  GmailApiError,
} from "./types.js";
import {
  parseGmailApiMessage,
  buildEmailMessage,
  buildReplyMessage,
  base64UrlEncode,
} from "./parser.js";

// =============================================================================
// CONSTANTS
// =============================================================================

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";
const DEFAULT_MAX_RESULTS = 100;

// =============================================================================
// CLIENT OPTIONS
// =============================================================================

/**
 * Options for creating a Gmail client
 */
export interface GmailClientOptions {
  /** Authentication client (OAuth2 or Service Account) */
  auth: GoogleAuth;
  /** User email for impersonation (service account mode) */
  userEmail?: string;
}

// =============================================================================
// GMAIL CLIENT CLASS
// =============================================================================

/**
 * Gmail API client for email operations
 *
 * @example
 * ```typescript
 * const client = new GmailClient({ auth: oauthClient });
 *
 * // List unread messages
 * const messages = await client.listMessages({
 *   query: 'is:unread',
 *   maxResults: 10,
 * });
 *
 * // Send an email
 * await client.sendEmail({
 *   to: 'recipient@example.com',
 *   subject: 'Hello',
 *   body: 'Hello World!',
 * });
 * ```
 */
export class GmailClient {
  private auth: GoogleAuth;
  private userId: string;

  constructor(options: GmailClientOptions) {
    this.auth = options.auth;
    // Use "me" for authenticated user, or specific email for impersonation
    this.userId = options.userEmail || "me";
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Get access token from auth client
   */
  private async getAccessToken(): Promise<string> {
    const { token } = await this.auth.getAccessToken();
    if (!token) {
      throw new Error("Failed to obtain access token");
    }
    return token;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const token = await this.getAccessToken();

    // Build URL with query params
    let url = `${GMAIL_API_BASE}/users/${this.userId}${path}`;
    if (queryParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      const gmailError: GmailApiError = {
        code: response.status,
        message: error.error?.message || error.message || "Unknown error",
        errors: error.error?.errors,
      };
      throw gmailError;
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ===========================================================================
  // PROFILE
  // ===========================================================================

  /**
   * Get the authenticated user's Gmail profile
   *
   * @returns Profile with email, message count, etc.
   */
  async getProfile(): Promise<GmailProfile> {
    return this.request<GmailProfile>("GET", "/profile");
  }

  // ===========================================================================
  // MESSAGE OPERATIONS
  // ===========================================================================

  /**
   * List messages matching the specified criteria
   *
   * @param options - Filter options (labels, query, pagination)
   * @returns List of messages with pagination info
   *
   * @example
   * ```typescript
   * // List unread inbox messages
   * const messages = await client.listMessages({
   *   labelIds: ['INBOX'],
   *   query: 'is:unread',
   *   maxResults: 25,
   * });
   *
   * // Search for messages
   * const searchResults = await client.listMessages({
   *   query: 'from:boss@company.com subject:urgent',
   * });
   * ```
   */
  async listMessages(options: ListMessagesOptions = {}): Promise<MessageList> {
    const {
      labelIds,
      query,
      maxResults = DEFAULT_MAX_RESULTS,
      pageToken,
      includeSpamTrash,
    } = options;

    // Build query params
    const params: Record<string, string | number | boolean | undefined> = {
      maxResults,
      pageToken,
      includeSpamTrash,
    };

    if (labelIds && labelIds.length > 0) {
      params.labelIds = labelIds.join(",");
    }
    if (query) {
      params.q = query;
    }

    // Get message IDs
    const listResponse = await this.request<MessageListResponse>(
      "GET",
      "/messages",
      undefined,
      params,
    );

    if (!listResponse.messages || listResponse.messages.length === 0) {
      return {
        messages: [],
        nextPageToken: listResponse.nextPageToken,
        resultSizeEstimate: listResponse.resultSizeEstimate || 0,
      };
    }

    // Fetch full message details in parallel
    const messages = await Promise.all(listResponse.messages.map((msg) => this.getMessage(msg.id)));

    return {
      messages,
      nextPageToken: listResponse.nextPageToken,
      resultSizeEstimate: listResponse.resultSizeEstimate || messages.length,
    };
  }

  /**
   * Get a single message with full content
   *
   * @param messageId - Message ID
   * @param format - Response format (full, metadata, minimal, raw)
   * @returns Full message with headers, body, and attachments info
   *
   * @example
   * ```typescript
   * const message = await client.getMessage('18d5a2b3c4e5f6g7');
   * console.log(message.subject, message.from);
   * console.log(message.body);
   * ```
   */
  async getMessage(
    messageId: string,
    format: "full" | "metadata" | "minimal" | "raw" = "full",
  ): Promise<GmailMessage> {
    const apiMessage = await this.request<GmailApiMessage>(
      "GET",
      `/messages/${messageId}`,
      undefined,
      {
        format,
      },
    );

    return parseGmailApiMessage(apiMessage);
  }

  /**
   * Search messages using Gmail search query syntax
   *
   * @param query - Gmail search query
   * @param maxResults - Maximum results to return
   * @returns List of matching messages
   *
   * @example
   * ```typescript
   * // Search for messages from a specific sender
   * const results = await client.searchMessages('from:support@example.com');
   *
   * // Search with multiple criteria
   * const urgent = await client.searchMessages(
   *   'is:unread has:attachment larger:1M after:2024/01/01'
   * );
   * ```
   */
  async searchMessages(query: string, maxResults = DEFAULT_MAX_RESULTS): Promise<MessageList> {
    return this.listMessages({ query, maxResults });
  }

  /**
   * Delete a message permanently
   *
   * @param messageId - Message ID to delete
   *
   * @example
   * ```typescript
   * await client.deleteMessage('18d5a2b3c4e5f6g7');
   * ```
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.request<void>("DELETE", `/messages/${messageId}`);
  }

  /**
   * Move a message to trash
   *
   * @param messageId - Message ID to trash
   * @returns Updated message
   */
  async trashMessage(messageId: string): Promise<GmailMessage> {
    const apiMessage = await this.request<GmailApiMessage>("POST", `/messages/${messageId}/trash`);
    return parseGmailApiMessage(apiMessage);
  }

  /**
   * Remove a message from trash
   *
   * @param messageId - Message ID to untrash
   * @returns Updated message
   */
  async untrashMessage(messageId: string): Promise<GmailMessage> {
    const apiMessage = await this.request<GmailApiMessage>(
      "POST",
      `/messages/${messageId}/untrash`,
    );
    return parseGmailApiMessage(apiMessage);
  }

  // ===========================================================================
  // SEND OPERATIONS
  // ===========================================================================

  /**
   * Send an email message
   *
   * @param options - Email details (to, subject, body, attachments)
   * @returns Object with the sent message ID
   *
   * @example
   * ```typescript
   * // Send a simple email
   * const result = await client.sendEmail({
   *   to: 'recipient@example.com',
   *   subject: 'Hello',
   *   body: 'Hello World!',
   * });
   *
   * // Send with HTML and attachments
   * const result = await client.sendEmail({
   *   to: ['user1@example.com', 'user2@example.com'],
   *   cc: ['cc@example.com'],
   *   subject: 'Report',
   *   body: 'Please see attached.',
   *   htmlBody: '<p>Please see <strong>attached</strong>.</p>',
   *   attachments: [{
   *     filename: 'report.pdf',
   *     content: pdfBuffer,
   *     mimeType: 'application/pdf',
   *   }],
   * });
   * ```
   */
  async sendEmail(options: SendEmailOptions): Promise<{ messageId: string; threadId: string }> {
    const raw = buildEmailMessage(options);

    const body: { raw: string; threadId?: string } = { raw };
    if (options.threadId) {
      body.threadId = options.threadId;
    }

    const response = await this.request<GmailApiMessage>("POST", "/messages/send", body);

    return {
      messageId: response.id,
      threadId: response.threadId,
    };
  }

  /**
   * Reply to an existing email
   *
   * @param messageId - ID of message to reply to
   * @param body - Reply body text
   * @param options - Additional reply options
   * @returns Object with the sent reply message ID
   *
   * @example
   * ```typescript
   * // Simple reply
   * await client.replyToEmail('18d5a2b3c4e5f6g7', 'Thanks for your message!');
   *
   * // Reply all with HTML
   * await client.replyToEmail('18d5a2b3c4e5f6g7', 'Thanks!', {
   *   htmlBody: '<p>Thanks!</p>',
   *   replyAll: true,
   * });
   * ```
   */
  async replyToEmail(
    messageId: string,
    body: string,
    options: ReplyEmailOptions = {},
  ): Promise<{ messageId: string; threadId: string }> {
    // Get original message for threading info
    const originalMessage = await this.getMessage(messageId);

    // Build reply
    const sendOptions = buildReplyMessage(
      originalMessage,
      body,
      options.htmlBody,
      options.replyAll,
      options.additionalTo,
    );

    // Add attachments if provided
    if (options.attachments) {
      sendOptions.attachments = options.attachments;
    }

    return this.sendEmail(sendOptions);
  }

  /**
   * Forward a message to other recipients
   *
   * @param messageId - ID of message to forward
   * @param to - Recipients to forward to
   * @param comment - Optional comment to add
   * @returns Object with the sent message ID
   */
  async forwardMessage(
    messageId: string,
    to: string | string[],
    comment?: string,
  ): Promise<{ messageId: string; threadId: string }> {
    const original = await this.getMessage(messageId);

    // Build forward subject
    let subject = original.subject;
    if (!subject.toLowerCase().startsWith("fwd:")) {
      subject = `Fwd: ${subject}`;
    }

    // Build forward body with original message
    const forwardHeader = `
---------- Forwarded message ---------
From: ${original.from}
Date: ${original.date.toUTCString()}
Subject: ${original.subject}
To: ${original.to.join(", ")}
`;

    const forwardBody = comment
      ? `${comment}\n\n${forwardHeader}\n${original.body}`
      : `${forwardHeader}\n${original.body}`;

    let forwardHtmlBody: string | undefined;
    if (original.htmlBody) {
      const htmlHeader = `
<br><br>
<div>---------- Forwarded message ---------</div>
<div>From: ${original.from}</div>
<div>Date: ${original.date.toUTCString()}</div>
<div>Subject: ${original.subject}</div>
<div>To: ${original.to.join(", ")}</div>
<br>
`;
      forwardHtmlBody = comment
        ? `<p>${comment}</p>${htmlHeader}${original.htmlBody}`
        : `${htmlHeader}${original.htmlBody}`;
    }

    return this.sendEmail({
      to,
      subject,
      body: forwardBody,
      htmlBody: forwardHtmlBody,
    });
  }

  // ===========================================================================
  // LABEL OPERATIONS
  // ===========================================================================

  /**
   * List all labels for the user
   *
   * @returns Array of labels
   *
   * @example
   * ```typescript
   * const labels = await client.listLabels();
   * for (const label of labels) {
   *   console.log(`${label.name} (${label.type})`);
   * }
   * ```
   */
  async listLabels(): Promise<Label[]> {
    const response = await this.request<{ labels: Label[] }>("GET", "/labels");
    return response.labels || [];
  }

  /**
   * Get a specific label by ID
   *
   * @param labelId - Label ID
   * @returns Label details
   */
  async getLabel(labelId: string): Promise<Label> {
    return this.request<Label>("GET", `/labels/${labelId}`);
  }

  /**
   * Create a new label
   *
   * @param name - Label name
   * @param options - Label options (visibility, color)
   * @returns Created label
   */
  async createLabel(
    name: string,
    options?: {
      messageListVisibility?: "show" | "hide";
      labelListVisibility?: "labelShow" | "labelShowIfUnread" | "labelHide";
      backgroundColor?: string;
      textColor?: string;
    },
  ): Promise<Label> {
    const body: Record<string, unknown> = {
      name,
      messageListVisibility: options?.messageListVisibility,
      labelListVisibility: options?.labelListVisibility,
    };

    if (options?.backgroundColor || options?.textColor) {
      body.color = {
        backgroundColor: options.backgroundColor,
        textColor: options.textColor,
      };
    }

    return this.request<Label>("POST", "/labels", body);
  }

  /**
   * Delete a label
   *
   * @param labelId - Label ID to delete
   */
  async deleteLabel(labelId: string): Promise<void> {
    await this.request<void>("DELETE", `/labels/${labelId}`);
  }

  /**
   * Modify labels on a message
   *
   * @param messageId - Message ID
   * @param addLabelIds - Label IDs to add
   * @param removeLabelIds - Label IDs to remove
   *
   * @example
   * ```typescript
   * // Mark as read (remove UNREAD label)
   * await client.modifyLabels('18d5a2b3c4e5f6g7', [], ['UNREAD']);
   *
   * // Archive (remove INBOX)
   * await client.modifyLabels('18d5a2b3c4e5f6g7', [], ['INBOX']);
   *
   * // Star and move to important
   * await client.modifyLabels('18d5a2b3c4e5f6g7', ['STARRED', 'IMPORTANT'], []);
   * ```
   */
  async modifyLabels(
    messageId: string,
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<void> {
    await this.request<GmailApiMessage>("POST", `/messages/${messageId}/modify`, {
      addLabelIds,
      removeLabelIds,
    });
  }

  /**
   * Mark a message as read
   *
   * @param messageId - Message ID
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.modifyLabels(messageId, [], ["UNREAD"]);
  }

  /**
   * Mark a message as unread
   *
   * @param messageId - Message ID
   */
  async markAsUnread(messageId: string): Promise<void> {
    await this.modifyLabels(messageId, ["UNREAD"], []);
  }

  /**
   * Star a message
   *
   * @param messageId - Message ID
   */
  async starMessage(messageId: string): Promise<void> {
    await this.modifyLabels(messageId, ["STARRED"], []);
  }

  /**
   * Unstar a message
   *
   * @param messageId - Message ID
   */
  async unstarMessage(messageId: string): Promise<void> {
    await this.modifyLabels(messageId, [], ["STARRED"]);
  }

  /**
   * Archive a message (remove from inbox)
   *
   * @param messageId - Message ID
   */
  async archiveMessage(messageId: string): Promise<void> {
    await this.modifyLabels(messageId, [], ["INBOX"]);
  }

  /**
   * Move a message back to inbox
   *
   * @param messageId - Message ID
   */
  async moveToInbox(messageId: string): Promise<void> {
    await this.modifyLabels(messageId, ["INBOX"], []);
  }

  // ===========================================================================
  // ATTACHMENT OPERATIONS
  // ===========================================================================

  /**
   * Get attachment content
   *
   * @param messageId - Message ID
   * @param attachmentId - Attachment ID
   * @returns Attachment content (base64url encoded)
   *
   * @example
   * ```typescript
   * const message = await client.getMessage(messageId);
   * for (const att of message.attachments || []) {
   *   const content = await client.getAttachment(messageId, att.attachmentId);
   *   const buffer = Buffer.from(content.data, 'base64url');
   *   // Save to file, etc.
   * }
   * ```
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<AttachmentContent> {
    return this.request<AttachmentContent>(
      "GET",
      `/messages/${messageId}/attachments/${attachmentId}`,
    );
  }

  // ===========================================================================
  // THREAD OPERATIONS
  // ===========================================================================

  /**
   * List threads
   *
   * @param options - Filter options
   * @returns List of threads
   */
  async listThreads(options: ListMessagesOptions = {}): Promise<ThreadList> {
    const {
      labelIds,
      query,
      maxResults = DEFAULT_MAX_RESULTS,
      pageToken,
      includeSpamTrash,
    } = options;

    const params: Record<string, string | number | boolean | undefined> = {
      maxResults,
      pageToken,
      includeSpamTrash,
    };

    if (labelIds && labelIds.length > 0) {
      params.labelIds = labelIds.join(",");
    }
    if (query) {
      params.q = query;
    }

    const response = await this.request<{
      threads?: Array<{ id: string; snippet?: string; historyId?: string }>;
      nextPageToken?: string;
      resultSizeEstimate?: number;
    }>("GET", "/threads", undefined, params);

    return {
      threads: (response.threads || []).map((t) => ({
        id: t.id,
        snippet: t.snippet || "",
        historyId: t.historyId,
      })),
      nextPageToken: response.nextPageToken,
      resultSizeEstimate: response.resultSizeEstimate || 0,
    };
  }

  /**
   * Get a thread with all messages
   *
   * @param threadId - Thread ID
   * @returns Thread with all messages
   */
  async getThread(threadId: string): Promise<GmailThread> {
    const response = await this.request<{
      id: string;
      snippet?: string;
      historyId?: string;
      messages?: GmailApiMessage[];
    }>("GET", `/threads/${threadId}`, undefined, { format: "full" });

    return {
      id: response.id,
      snippet: response.snippet || "",
      historyId: response.historyId,
      messages: response.messages?.map(parseGmailApiMessage),
    };
  }

  /**
   * Delete a thread permanently
   *
   * @param threadId - Thread ID
   */
  async deleteThread(threadId: string): Promise<void> {
    await this.request<void>("DELETE", `/threads/${threadId}`);
  }

  /**
   * Trash a thread
   *
   * @param threadId - Thread ID
   */
  async trashThread(threadId: string): Promise<void> {
    await this.request<void>("POST", `/threads/${threadId}/trash`);
  }

  /**
   * Modify labels on a thread
   *
   * @param threadId - Thread ID
   * @param addLabelIds - Labels to add
   * @param removeLabelIds - Labels to remove
   */
  async modifyThreadLabels(
    threadId: string,
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<void> {
    await this.request<void>("POST", `/threads/${threadId}/modify`, {
      addLabelIds,
      removeLabelIds,
    });
  }

  // ===========================================================================
  // DRAFT OPERATIONS
  // ===========================================================================

  /**
   * List drafts
   *
   * @param options - Pagination options
   * @returns List of drafts
   */
  async listDrafts(options?: { maxResults?: number; pageToken?: string }): Promise<DraftList> {
    const response = await this.request<{
      drafts?: Array<{ id: string; message: GmailApiMessage }>;
      nextPageToken?: string;
      resultSizeEstimate?: number;
    }>("GET", "/drafts", undefined, {
      maxResults: options?.maxResults || DEFAULT_MAX_RESULTS,
      pageToken: options?.pageToken,
    });

    return {
      drafts: (response.drafts || []).map((d) => ({
        id: d.id,
        message: parseGmailApiMessage(d.message),
      })),
      nextPageToken: response.nextPageToken,
      resultSizeEstimate: response.resultSizeEstimate || 0,
    };
  }

  /**
   * Create a draft
   *
   * @param options - Email content
   * @returns Created draft
   */
  async createDraft(options: SendEmailOptions): Promise<GmailDraft> {
    const raw = buildEmailMessage(options);

    const body: { message: { raw: string; threadId?: string } } = {
      message: { raw },
    };
    if (options.threadId) {
      body.message.threadId = options.threadId;
    }

    const response = await this.request<{ id: string; message: GmailApiMessage }>(
      "POST",
      "/drafts",
      body,
    );

    return {
      id: response.id,
      message: parseGmailApiMessage(response.message),
    };
  }

  /**
   * Send a draft
   *
   * @param draftId - Draft ID to send
   * @returns Sent message info
   */
  async sendDraft(draftId: string): Promise<{ messageId: string; threadId: string }> {
    const response = await this.request<GmailApiMessage>("POST", "/drafts/send", {
      id: draftId,
    });

    return {
      messageId: response.id,
      threadId: response.threadId,
    };
  }

  /**
   * Delete a draft
   *
   * @param draftId - Draft ID
   */
  async deleteDraft(draftId: string): Promise<void> {
    await this.request<void>("DELETE", `/drafts/${draftId}`);
  }

  // ===========================================================================
  // HISTORY (SYNC)
  // ===========================================================================

  /**
   * Get history of changes since a specific history ID
   *
   * @param startHistoryId - History ID to start from
   * @param options - Filter options
   * @returns History records
   */
  async getHistory(
    startHistoryId: string,
    options?: {
      labelId?: string;
      maxResults?: number;
      pageToken?: string;
      historyTypes?: Array<"messageAdded" | "messageDeleted" | "labelAdded" | "labelRemoved">;
    },
  ): Promise<HistoryList> {
    const params: Record<string, string | number | boolean | undefined> = {
      startHistoryId,
      maxResults: options?.maxResults,
      pageToken: options?.pageToken,
      labelId: options?.labelId,
    };

    if (options?.historyTypes) {
      params.historyTypes = options.historyTypes.join(",");
    }

    return this.request<HistoryList>("GET", "/history", undefined, params);
  }

  // ===========================================================================
  // BATCH OPERATIONS
  // ===========================================================================

  /**
   * Batch modify messages (add/remove labels)
   *
   * @param messageIds - Message IDs to modify
   * @param addLabelIds - Labels to add
   * @param removeLabelIds - Labels to remove
   */
  async batchModifyLabels(
    messageIds: string[],
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<void> {
    await this.request<void>("POST", "/messages/batchModify", {
      ids: messageIds,
      addLabelIds,
      removeLabelIds,
    });
  }

  /**
   * Batch delete messages permanently
   *
   * @param messageIds - Message IDs to delete
   */
  async batchDeleteMessages(messageIds: string[]): Promise<void> {
    await this.request<void>("POST", "/messages/batchDelete", {
      ids: messageIds,
    });
  }
}
