/**
 * Gmail Integration
 *
 * Email operations via Gmail API.
 *
 * @example
 * ```typescript
 * import { GmailClient } from './gmail';
 *
 * // Create client with OAuth2 auth
 * const client = new GmailClient({ auth: oauth2Client });
 *
 * // List recent unread emails
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
 *
 * // Reply to a message
 * await client.replyToEmail(messageId, 'Thanks for your message!', {
 *   replyAll: true,
 * });
 * ```
 */

// =============================================================================
// CLIENT EXPORT
// =============================================================================

export { GmailClient } from "./client.js";
export type { GmailClientOptions } from "./client.js";

// =============================================================================
// PARSER EXPORTS
// =============================================================================

export {
  // Base64 utilities
  base64UrlEncode,
  base64UrlEncodeBuffer,
  base64UrlDecode,
  base64UrlDecodeBuffer,
  // Header parsing
  getHeader,
  parseEmailAddresses,
  parseEmailAddress,
  formatEmailAddress,
  parseEmailDate,
  // MIME parsing
  extractBodyFromParts,
  parseAttachments,
  // Message parsing
  parseEmailMessage,
  decodeEncodedWord,
  // Message building
  generateBoundary,
  buildEmailMessage,
  encodeSubject,
  // API response parsing
  parseGmailApiMessage,
  buildReplyMessage,
} from "./parser.js";

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  // Auth types
  GoogleAuthClient,
  GoogleServiceAccount,
  GoogleAuth,
  // Message types
  GmailMessage,
  MessageListItem,
  MessageList,
  MessageListResponse,
  ParsedEmail,
  // Label types
  Label,
  LabelColor,
  // Attachment types
  AttachmentInfo,
  Attachment,
  AttachmentContent,
  // Send options
  SendEmailOptions,
  ReplyEmailOptions,
  // List options
  ListMessagesOptions,
  ModifyLabelsOptions,
  // Thread types
  GmailThread,
  ThreadList,
  // Draft types
  GmailDraft,
  DraftList,
  // History types
  HistoryRecord,
  HistoryList,
  // API types
  GmailApiMessage,
  MessagePart,
  MessageHeader,
  GmailProfile,
  // Error types
  GmailError,
  GmailApiError,
} from "./types.js";
