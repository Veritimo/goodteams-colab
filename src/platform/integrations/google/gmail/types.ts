/**
 * Gmail Integration Types
 *
 * TypeScript interfaces for Gmail API operations.
 * Provides simplified types for our integration layer.
 */

// =============================================================================
// AUTH TYPES
// =============================================================================

/**
 * OAuth2 client for user-level authentication
 */
export interface GoogleAuthClient {
  getAccessToken(): Promise<{ token?: string | null }>;
  setCredentials(credentials: { access_token?: string; refresh_token?: string }): void;
}

/**
 * Service account for domain-wide delegation
 */
export interface GoogleServiceAccount {
  getAccessToken(): Promise<{ token?: string | null }>;
  /** Email of user to impersonate */
  subject?: string;
}

/**
 * Combined auth type
 */
export type GoogleAuth = GoogleAuthClient | GoogleServiceAccount;

// =============================================================================
// MESSAGE TYPES
// =============================================================================

/**
 * Gmail message with parsed headers and content
 */
export interface GmailMessage {
  /** Message ID */
  id: string;
  /** Thread ID for conversation grouping */
  threadId: string;
  /** Label IDs applied to this message */
  labelIds: string[];
  /** Short preview of message content */
  snippet: string;
  /** Sender email address */
  from: string;
  /** Recipient email addresses */
  to: string[];
  /** CC email addresses */
  cc?: string[];
  /** BCC email addresses */
  bcc?: string[];
  /** Message subject */
  subject: string;
  /** Plain text body content */
  body: string;
  /** HTML body content if available */
  htmlBody?: string;
  /** Message date */
  date: Date;
  /** Message-ID header for threading */
  messageIdHeader?: string;
  /** In-Reply-To header */
  inReplyTo?: string;
  /** References header for thread tracking */
  references?: string;
  /** Attachment information */
  attachments?: AttachmentInfo[];
  /** Size in bytes (estimated) */
  sizeEstimate?: number;
  /** History ID for sync */
  historyId?: string;
  /** Internal date (Gmail's timestamp) */
  internalDate?: string;
}

/**
 * Minimal message info from list operations
 */
export interface MessageListItem {
  /** Message ID */
  id: string;
  /** Thread ID */
  threadId: string;
}

/**
 * Paginated list of messages
 */
export interface MessageList {
  /** Full message objects (when fetched with details) */
  messages: GmailMessage[];
  /** Token for next page of results */
  nextPageToken?: string;
  /** Estimated total number of results */
  resultSizeEstimate: number;
}

/**
 * Raw message list response from API
 */
export interface MessageListResponse {
  /** Minimal message references */
  messages?: MessageListItem[];
  /** Token for next page */
  nextPageToken?: string;
  /** Estimated result count */
  resultSizeEstimate?: number;
}

// =============================================================================
// LABEL TYPES
// =============================================================================

/**
 * Gmail label
 */
export interface Label {
  /** Label ID */
  id: string;
  /** Label display name */
  name: string;
  /** Label type: system or user-created */
  type: "system" | "user";
  /** Message list visibility */
  messageListVisibility?: "show" | "hide";
  /** Label list visibility */
  labelListVisibility?: "labelShow" | "labelShowIfUnread" | "labelHide";
  /** Number of messages with this label */
  messagesTotal?: number;
  /** Number of unread messages */
  messagesUnread?: number;
  /** Number of threads with this label */
  threadsTotal?: number;
  /** Number of unread threads */
  threadsUnread?: number;
  /** Label color settings */
  color?: LabelColor;
}

/**
 * Label color configuration
 */
export interface LabelColor {
  /** Text color hex code */
  textColor?: string;
  /** Background color hex code */
  backgroundColor?: string;
}

// =============================================================================
// ATTACHMENT TYPES
// =============================================================================

/**
 * Attachment metadata (from message)
 */
export interface AttachmentInfo {
  /** Attachment ID for downloading */
  attachmentId: string;
  /** File name */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Size in bytes */
  size: number;
  /** Content ID for inline attachments */
  contentId?: string;
}

/**
 * Attachment for sending emails
 */
export interface Attachment {
  /** File name */
  filename: string;
  /** Binary content */
  content: Buffer;
  /** MIME type */
  mimeType: string;
  /** Content ID for inline images */
  contentId?: string;
  /** Whether attachment is inline */
  inline?: boolean;
}

/**
 * Downloaded attachment with content
 */
export interface AttachmentContent {
  /** Size in bytes */
  size: number;
  /** Base64url-encoded content */
  data: string;
}

// =============================================================================
// SEND OPTIONS
// =============================================================================

/**
 * Options for sending an email
 */
export interface SendEmailOptions {
  /** Recipient email address(es) */
  to: string | string[];
  /** CC recipients */
  cc?: string[];
  /** BCC recipients */
  bcc?: string[];
  /** Email subject */
  subject: string;
  /** Plain text body */
  body: string;
  /** HTML body (optional) */
  htmlBody?: string;
  /** File attachments */
  attachments?: Attachment[];
  /** In-Reply-To message ID (for replies) */
  inReplyTo?: string;
  /** References header (for threading) */
  references?: string;
  /** Thread ID to add this message to */
  threadId?: string;
}

/**
 * Options for replying to an email
 */
export interface ReplyEmailOptions {
  /** Plain text body */
  body: string;
  /** HTML body (optional) */
  htmlBody?: string;
  /** Reply to all recipients */
  replyAll?: boolean;
  /** Additional recipients to add */
  additionalTo?: string[];
  /** File attachments */
  attachments?: Attachment[];
}

// =============================================================================
// LIST OPTIONS
// =============================================================================

/**
 * Options for listing messages
 */
export interface ListMessagesOptions {
  /** Label IDs to filter by (messages must have ALL labels) */
  labelIds?: string[];
  /** Gmail search query */
  query?: string;
  /** Maximum number of results (default: 100, max: 500) */
  maxResults?: number;
  /** Page token for pagination */
  pageToken?: string;
  /** Include spam and trash in results */
  includeSpamTrash?: boolean;
}

/**
 * Options for label modifications
 */
export interface ModifyLabelsOptions {
  /** Label IDs to add */
  addLabelIds?: string[];
  /** Label IDs to remove */
  removeLabelIds?: string[];
}

// =============================================================================
// THREAD TYPES
// =============================================================================

/**
 * Gmail thread (conversation)
 */
export interface GmailThread {
  /** Thread ID */
  id: string;
  /** Thread snippet */
  snippet: string;
  /** History ID */
  historyId?: string;
  /** Messages in the thread */
  messages?: GmailMessage[];
}

/**
 * Thread list response
 */
export interface ThreadList {
  /** Threads */
  threads: GmailThread[];
  /** Next page token */
  nextPageToken?: string;
  /** Estimated result count */
  resultSizeEstimate: number;
}

// =============================================================================
// DRAFT TYPES
// =============================================================================

/**
 * Gmail draft
 */
export interface GmailDraft {
  /** Draft ID */
  id: string;
  /** Underlying message */
  message: GmailMessage;
}

/**
 * Draft list response
 */
export interface DraftList {
  /** Drafts */
  drafts: GmailDraft[];
  /** Next page token */
  nextPageToken?: string;
  /** Estimated result count */
  resultSizeEstimate: number;
}

// =============================================================================
// HISTORY TYPES
// =============================================================================

/**
 * History record for sync
 */
export interface HistoryRecord {
  /** History ID */
  id: string;
  /** Messages added */
  messagesAdded?: Array<{ message: MessageListItem }>;
  /** Messages deleted */
  messagesDeleted?: Array<{ message: MessageListItem }>;
  /** Labels added */
  labelsAdded?: Array<{ message: MessageListItem; labelIds: string[] }>;
  /** Labels removed */
  labelsRemoved?: Array<{ message: MessageListItem; labelIds: string[] }>;
}

/**
 * History list response
 */
export interface HistoryList {
  /** History records */
  history?: HistoryRecord[];
  /** Next page token */
  nextPageToken?: string;
  /** Current history ID */
  historyId?: string;
}

// =============================================================================
// PARSED EMAIL TYPES
// =============================================================================

/**
 * Parsed email message from RFC 2822 format
 */
export interface ParsedEmail {
  /** Sender */
  from: string;
  /** Recipients */
  to: string[];
  /** CC recipients */
  cc?: string[];
  /** BCC recipients */
  bcc?: string[];
  /** Subject line */
  subject: string;
  /** Plain text body */
  body: string;
  /** HTML body */
  htmlBody?: string;
  /** Message date */
  date?: Date;
  /** Message-ID header */
  messageId?: string;
  /** In-Reply-To header */
  inReplyTo?: string;
  /** References header */
  references?: string;
  /** Parsed attachments */
  attachments?: AttachmentInfo[];
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Raw Gmail API message response
 */
export interface GmailApiMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  sizeEstimate?: number;
  raw?: string;
  payload?: MessagePart;
}

/**
 * Message part (for MIME parsing)
 */
export interface MessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: MessageHeader[];
  body?: {
    size?: number;
    data?: string;
    attachmentId?: string;
  };
  parts?: MessagePart[];
}

/**
 * Message header
 */
export interface MessageHeader {
  name: string;
  value: string;
}

/**
 * Gmail profile response
 */
export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Gmail API error
 */
export interface GmailError {
  code: number;
  message: string;
  errors?: Array<{
    message: string;
    domain: string;
    reason: string;
  }>;
}

/**
 * Wrapped Gmail API error
 */
export class GmailApiError extends Error {
  code: number;
  errors?: GmailError["errors"];

  constructor(error: GmailError) {
    super(error.message);
    this.name = "GmailApiError";
    this.code = error.code;
    this.errors = error.errors;
  }
}
