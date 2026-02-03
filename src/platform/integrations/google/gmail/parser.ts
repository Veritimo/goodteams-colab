/**
 * Gmail Email Parsing Utilities
 *
 * Functions for parsing and building RFC 2822 email messages.
 * Handles MIME multipart messages, attachments, and encoding.
 */

import type {
  ParsedEmail,
  SendEmailOptions,
  Attachment,
  AttachmentInfo,
  MessagePart,
  MessageHeader,
  GmailApiMessage,
  GmailMessage,
} from "./types.js";

// =============================================================================
// CONSTANTS
// =============================================================================

const CRLF = "\r\n";
const BOUNDARY_PREFIX = "----=_Part_";

// =============================================================================
// BASE64 UTILITIES
// =============================================================================

/**
 * Encode a string to base64url format (Gmail's encoding)
 */
export function base64UrlEncode(str: string): string {
  // Convert string to UTF-8 bytes, then to base64, then make URL-safe
  const base64 = Buffer.from(str, "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Encode a Buffer to base64url format
 */
export function base64UrlEncodeBuffer(buffer: Buffer): string {
  const base64 = buffer.toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode base64url to string
 */
export function base64UrlDecode(str: string): string {
  // Add padding and convert URL-safe chars back
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Decode base64url to Buffer
 */
export function base64UrlDecodeBuffer(str: string): Buffer {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

// =============================================================================
// HEADER PARSING
// =============================================================================

/**
 * Get header value from headers array
 */
export function getHeader(headers: MessageHeader[] | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value;
}

/**
 * Parse email addresses from header value
 * Handles formats like: "Name <email@example.com>, other@example.com"
 */
export function parseEmailAddresses(value: string | undefined): string[] {
  if (!value) return [];

  const addresses: string[] = [];
  // Split by comma, handling quoted strings
  const parts = value.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Extract email from "Name <email>" format
    const angleMatch = trimmed.match(/<([^>]+)>/);
    if (angleMatch) {
      addresses.push(angleMatch[1].trim());
    } else {
      // Plain email address
      addresses.push(trimmed);
    }
  }

  return addresses;
}

/**
 * Parse a single email address, returning just the address part
 */
export function parseEmailAddress(value: string | undefined): string {
  if (!value) return "";
  const addresses = parseEmailAddresses(value);
  return addresses[0] || "";
}

/**
 * Format email address for header
 */
export function formatEmailAddress(email: string, name?: string): string {
  if (name) {
    // Escape double quotes in name
    const escapedName = name.replace(/"/g, '\\"');
    return `"${escapedName}" <${email}>`;
  }
  return email;
}

/**
 * Parse date from email header
 */
export function parseEmailDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date;
}

// =============================================================================
// MIME PARSING
// =============================================================================

/**
 * Extract body content from message parts
 * Returns { text, html } with decoded content
 */
export function extractBodyFromParts(parts: MessagePart[] | undefined): {
  text: string;
  html?: string;
} {
  let text = "";
  let html: string | undefined;

  if (!parts) {
    return { text, html };
  }

  for (const part of parts) {
    const mimeType = part.mimeType?.toLowerCase();

    if (mimeType === "text/plain" && part.body?.data && !text) {
      text = base64UrlDecode(part.body.data);
    } else if (mimeType === "text/html" && part.body?.data && !html) {
      html = base64UrlDecode(part.body.data);
    } else if (mimeType?.startsWith("multipart/") && part.parts) {
      // Recursively process multipart
      const nested = extractBodyFromParts(part.parts);
      if (nested.text && !text) text = nested.text;
      if (nested.html && !html) html = nested.html;
    }
  }

  return { text, html };
}

/**
 * Parse attachments from message parts
 */
export function parseAttachments(parts: MessagePart[] | undefined): AttachmentInfo[] {
  const attachments: AttachmentInfo[] = [];

  if (!parts) return attachments;

  function processpart(part: MessagePart) {
    // Check if this is an attachment
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
        contentId: getHeader(part.headers, "Content-ID")?.replace(/[<>]/g, ""),
      });
    }

    // Recursively process nested parts
    if (part.parts) {
      for (const nestedPart of part.parts) {
        processpart(nestedPart);
      }
    }
  }

  for (const part of parts) {
    processpart(part);
  }

  return attachments;
}

// =============================================================================
// MESSAGE PARSING
// =============================================================================

/**
 * Parse a raw RFC 2822 email message
 */
export function parseEmailMessage(raw: string): ParsedEmail {
  // Decode if base64url encoded
  let decoded: string;
  try {
    decoded = base64UrlDecode(raw);
  } catch {
    decoded = raw;
  }

  // Split headers and body
  const headerBodySplit = decoded.indexOf("\r\n\r\n");
  const headerSection = headerBodySplit > 0 ? decoded.substring(0, headerBodySplit) : decoded;
  const bodySection = headerBodySplit > 0 ? decoded.substring(headerBodySplit + 4) : "";

  // Parse headers
  const headers: Record<string, string> = {};
  const headerLines = headerSection.split(/\r\n(?=[^\s])/);

  for (const line of headerLines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const name = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line
        .substring(colonIndex + 1)
        .trim()
        .replace(/\r\n\s+/g, " ");
      headers[name] = value;
    }
  }

  // Parse body based on content type
  let textBody = bodySection;
  let htmlBody: string | undefined;
  const contentType = headers["content-type"] || "";

  if (contentType.includes("multipart/")) {
    // Extract boundary
    const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/i);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parsed = parseMultipart(bodySection, boundary);
      textBody = parsed.text;
      htmlBody = parsed.html;
    }
  } else if (contentType.includes("text/html")) {
    htmlBody = bodySection;
    textBody = "";
  }

  return {
    from: parseEmailAddress(headers["from"]),
    to: parseEmailAddresses(headers["to"]),
    cc: headers["cc"] ? parseEmailAddresses(headers["cc"]) : undefined,
    bcc: headers["bcc"] ? parseEmailAddresses(headers["bcc"]) : undefined,
    subject: decodeEncodedWord(headers["subject"] || ""),
    body: textBody,
    htmlBody,
    date: parseEmailDate(headers["date"]),
    messageId: headers["message-id"]?.replace(/[<>]/g, ""),
    inReplyTo: headers["in-reply-to"]?.replace(/[<>]/g, ""),
    references: headers["references"],
  };
}

/**
 * Parse multipart MIME message
 */
function parseMultipart(body: string, boundary: string): { text: string; html?: string } {
  let text = "";
  let html: string | undefined;

  const parts = body.split(`--${boundary}`);

  for (const part of parts) {
    if (part.trim() === "" || part.trim() === "--") continue;

    const partHeaderEnd = part.indexOf("\r\n\r\n");
    if (partHeaderEnd < 0) continue;

    const partHeaders = part.substring(0, partHeaderEnd).toLowerCase();
    const partBody = part
      .substring(partHeaderEnd + 4)
      .replace(/--$/, "")
      .trim();

    if (partHeaders.includes("text/plain") && !text) {
      text = partBody;
    } else if (partHeaders.includes("text/html") && !html) {
      html = partBody;
    }
  }

  return { text, html };
}

/**
 * Decode RFC 2047 encoded words (e.g., =?UTF-8?B?...?=)
 */
export function decodeEncodedWord(str: string): string {
  return str.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_, charset, encoding, encoded) => {
    try {
      if (encoding.toUpperCase() === "B") {
        // Base64 encoding
        return Buffer.from(encoded, "base64").toString("utf-8");
      } else if (encoding.toUpperCase() === "Q") {
        // Quoted-printable encoding
        const decoded = encoded
          .replace(/_/g, " ")
          .replace(/=([0-9A-F]{2})/gi, (_: string, hex: string) => {
            return String.fromCharCode(parseInt(hex, 16));
          });
        return decoded;
      }
    } catch {
      // Return original on error
    }
    return str;
  });
}

// =============================================================================
// MESSAGE BUILDING
// =============================================================================

/**
 * Generate a unique boundary string for multipart messages
 */
export function generateBoundary(): string {
  const random = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  return `${BOUNDARY_PREFIX}${random}_${timestamp}`;
}

/**
 * Build an RFC 2822 email message for sending via Gmail API
 * Returns base64url-encoded raw message
 */
export function buildEmailMessage(options: SendEmailOptions): string {
  const { to, cc, bcc, subject, body, htmlBody, attachments, inReplyTo, references } = options;

  const toAddresses = Array.isArray(to) ? to : [to];
  const hasAttachments = attachments && attachments.length > 0;
  const hasHtml = !!htmlBody;
  const isMultipart = hasHtml || hasAttachments;

  const lines: string[] = [];

  // Required headers
  lines.push(`To: ${toAddresses.join(", ")}`);
  if (cc && cc.length > 0) {
    lines.push(`Cc: ${cc.join(", ")}`);
  }
  if (bcc && bcc.length > 0) {
    lines.push(`Bcc: ${bcc.join(", ")}`);
  }
  lines.push(`Subject: ${encodeSubject(subject)}`);
  lines.push(`Date: ${new Date().toUTCString()}`);
  lines.push("MIME-Version: 1.0");

  // Threading headers
  if (inReplyTo) {
    lines.push(`In-Reply-To: <${inReplyTo}>`);
  }
  if (references) {
    lines.push(`References: ${references}`);
  }

  if (!isMultipart) {
    // Simple text message
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(Buffer.from(body).toString("base64"));
  } else if (hasAttachments) {
    // Mixed multipart (text/html + attachments)
    const mixedBoundary = generateBoundary();
    lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    lines.push("");

    // Body part
    lines.push(`--${mixedBoundary}`);
    if (hasHtml) {
      const altBoundary = generateBoundary();
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      lines.push("");
      lines.push(`--${altBoundary}`);
      lines.push("Content-Type: text/plain; charset=utf-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(Buffer.from(body).toString("base64"));
      lines.push(`--${altBoundary}`);
      lines.push("Content-Type: text/html; charset=utf-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(Buffer.from(htmlBody!).toString("base64"));
      lines.push(`--${altBoundary}--`);
    } else {
      lines.push("Content-Type: text/plain; charset=utf-8");
      lines.push("Content-Transfer-Encoding: base64");
      lines.push("");
      lines.push(Buffer.from(body).toString("base64"));
    }

    // Attachment parts
    for (const attachment of attachments!) {
      lines.push(`--${mixedBoundary}`);
      lines.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`);
      lines.push("Content-Transfer-Encoding: base64");
      if (attachment.inline && attachment.contentId) {
        lines.push(`Content-ID: <${attachment.contentId}>`);
        lines.push("Content-Disposition: inline");
      } else {
        lines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      }
      lines.push("");
      lines.push(attachment.content.toString("base64"));
    }

    lines.push(`--${mixedBoundary}--`);
  } else {
    // Alternative multipart (text + html, no attachments)
    const altBoundary = generateBoundary();
    lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    lines.push("");
    lines.push(`--${altBoundary}`);
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(Buffer.from(body).toString("base64"));
    lines.push(`--${altBoundary}`);
    lines.push("Content-Type: text/html; charset=utf-8");
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(Buffer.from(htmlBody!).toString("base64"));
    lines.push(`--${altBoundary}--`);
  }

  const message = lines.join(CRLF);
  return base64UrlEncode(message);
}

/**
 * Encode subject line for RFC 2822 (handles non-ASCII characters)
 */
export function encodeSubject(subject: string): string {
  // Check if all ASCII
  if (/^[\x20-\x7E]*$/.test(subject)) {
    return subject;
  }
  // Encode as UTF-8 base64
  return `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
}

// =============================================================================
// API RESPONSE PARSING
// =============================================================================

/**
 * Parse Gmail API message response into our GmailMessage type
 */
export function parseGmailApiMessage(apiMessage: GmailApiMessage): GmailMessage {
  const headers = apiMessage.payload?.headers || [];
  const parts = apiMessage.payload?.parts;

  // Extract body from parts or payload directly
  let textBody = "";
  let htmlBody: string | undefined;

  if (parts) {
    const extracted = extractBodyFromParts(parts);
    textBody = extracted.text;
    htmlBody = extracted.html;
  } else if (apiMessage.payload?.body?.data) {
    // Single-part message
    const mimeType = apiMessage.payload.mimeType?.toLowerCase();
    const decoded = base64UrlDecode(apiMessage.payload.body.data);
    if (mimeType === "text/html") {
      htmlBody = decoded;
    } else {
      textBody = decoded;
    }
  } else if (apiMessage.raw) {
    // Raw message format
    const parsed = parseEmailMessage(apiMessage.raw);
    textBody = parsed.body;
    htmlBody = parsed.htmlBody;
  }

  // Parse date
  const dateHeader = getHeader(headers, "Date");
  const date = dateHeader
    ? new Date(dateHeader)
    : new Date(parseInt(apiMessage.internalDate || "0"));

  return {
    id: apiMessage.id,
    threadId: apiMessage.threadId,
    labelIds: apiMessage.labelIds || [],
    snippet: apiMessage.snippet || "",
    from: parseEmailAddress(getHeader(headers, "From")),
    to: parseEmailAddresses(getHeader(headers, "To")),
    cc: parseEmailAddresses(getHeader(headers, "Cc")) || undefined,
    bcc: parseEmailAddresses(getHeader(headers, "Bcc")) || undefined,
    subject: decodeEncodedWord(getHeader(headers, "Subject") || "(No Subject)"),
    body: textBody,
    htmlBody,
    date,
    messageIdHeader: getHeader(headers, "Message-ID")?.replace(/[<>]/g, ""),
    inReplyTo: getHeader(headers, "In-Reply-To")?.replace(/[<>]/g, ""),
    references: getHeader(headers, "References"),
    attachments: parseAttachments(parts),
    sizeEstimate: apiMessage.sizeEstimate,
    historyId: apiMessage.historyId,
    internalDate: apiMessage.internalDate,
  };
}

/**
 * Build reply message preserving threading
 */
export function buildReplyMessage(
  originalMessage: GmailMessage,
  body: string,
  htmlBody?: string,
  replyAll = false,
  additionalTo?: string[],
): SendEmailOptions {
  // Determine recipients
  const to: string[] = [originalMessage.from];

  if (replyAll) {
    // Add original To recipients (excluding self - we don't know self here)
    to.push(...originalMessage.to.filter((addr) => addr !== originalMessage.from));
    // Add CC recipients
    if (originalMessage.cc) {
      to.push(...originalMessage.cc);
    }
  }

  if (additionalTo) {
    to.push(...additionalTo);
  }

  // Build subject with Re: prefix if not already present
  let subject = originalMessage.subject;
  if (!subject.toLowerCase().startsWith("re:")) {
    subject = `Re: ${subject}`;
  }

  // Build references header
  let references = originalMessage.messageIdHeader || originalMessage.id;
  if (originalMessage.references) {
    references = `${originalMessage.references} <${references}>`;
  } else {
    references = `<${references}>`;
  }

  return {
    to,
    subject,
    body,
    htmlBody,
    inReplyTo: originalMessage.messageIdHeader || originalMessage.id,
    references,
    threadId: originalMessage.threadId,
  };
}
