/**
 * Gmail Parser Tests
 */

import { describe, it, expect } from "vitest";
import type { MessagePart, MessageHeader, GmailApiMessage, GmailMessage } from "../types.js";
import {
  base64UrlEncode,
  base64UrlDecode,
  base64UrlEncodeBuffer,
  base64UrlDecodeBuffer,
  getHeader,
  parseEmailAddresses,
  parseEmailAddress,
  formatEmailAddress,
  parseEmailDate,
  extractBodyFromParts,
  parseAttachments,
  parseEmailMessage,
  decodeEncodedWord,
  generateBoundary,
  buildEmailMessage,
  encodeSubject,
  parseGmailApiMessage,
  buildReplyMessage,
} from "../parser.js";

// =============================================================================
// BASE64 UTILITIES TESTS
// =============================================================================

describe("base64UrlEncode", () => {
  it("should encode a simple string", () => {
    const result = base64UrlEncode("Hello World");
    expect(result).toBe("SGVsbG8gV29ybGQ");
  });

  it("should handle URL-safe encoding", () => {
    // This string produces + and / in standard base64
    const result = base64UrlEncode("subjects?type=all");
    expect(result).not.toContain("+");
    expect(result).not.toContain("/");
    expect(result).not.toContain("=");
  });

  it("should handle UTF-8 characters", () => {
    const result = base64UrlEncode("Hello 日本語");
    const decoded = base64UrlDecode(result);
    expect(decoded).toBe("Hello 日本語");
  });
});

describe("base64UrlDecode", () => {
  it("should decode a simple string", () => {
    const result = base64UrlDecode("SGVsbG8gV29ybGQ");
    expect(result).toBe("Hello World");
  });

  it("should handle strings without padding", () => {
    const result = base64UrlDecode("SGVsbG8");
    expect(result).toBe("Hello");
  });
});

describe("base64UrlEncodeBuffer", () => {
  it("should encode a buffer", () => {
    const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    const result = base64UrlEncodeBuffer(buffer);
    expect(result).toBe("SGVsbG8");
  });
});

describe("base64UrlDecodeBuffer", () => {
  it("should decode to a buffer", () => {
    const result = base64UrlDecodeBuffer("SGVsbG8");
    expect(result.toString()).toBe("Hello");
  });
});

// =============================================================================
// HEADER PARSING TESTS
// =============================================================================

describe("getHeader", () => {
  const headers: MessageHeader[] = [
    { name: "From", value: "sender@example.com" },
    { name: "To", value: "recipient@example.com" },
    { name: "Subject", value: "Test Subject" },
  ];

  it("should get header by exact name", () => {
    expect(getHeader(headers, "From")).toBe("sender@example.com");
  });

  it("should get header case-insensitively", () => {
    expect(getHeader(headers, "from")).toBe("sender@example.com");
    expect(getHeader(headers, "FROM")).toBe("sender@example.com");
  });

  it("should return undefined for missing header", () => {
    expect(getHeader(headers, "Cc")).toBeUndefined();
  });

  it("should handle undefined headers array", () => {
    expect(getHeader(undefined, "From")).toBeUndefined();
  });
});

describe("parseEmailAddresses", () => {
  it("should parse simple email address", () => {
    const result = parseEmailAddresses("user@example.com");
    expect(result).toEqual(["user@example.com"]);
  });

  it("should parse email with name", () => {
    const result = parseEmailAddresses("John Doe <john@example.com>");
    expect(result).toEqual(["john@example.com"]);
  });

  it("should parse multiple addresses", () => {
    const result = parseEmailAddresses("user1@example.com, user2@example.com");
    expect(result).toEqual(["user1@example.com", "user2@example.com"]);
  });

  it("should parse mixed formats", () => {
    const result = parseEmailAddresses(
      'John Doe <john@example.com>, jane@example.com, "Jane Smith" <jane.smith@example.com>',
    );
    expect(result).toEqual(["john@example.com", "jane@example.com", "jane.smith@example.com"]);
  });

  it("should handle empty string", () => {
    expect(parseEmailAddresses("")).toEqual([]);
  });

  it("should handle undefined", () => {
    expect(parseEmailAddresses(undefined)).toEqual([]);
  });
});

describe("parseEmailAddress", () => {
  it("should return first address from list", () => {
    const result = parseEmailAddress("user@example.com, other@example.com");
    expect(result).toBe("user@example.com");
  });

  it("should return empty string for undefined", () => {
    expect(parseEmailAddress(undefined)).toBe("");
  });
});

describe("formatEmailAddress", () => {
  it("should format plain email", () => {
    const result = formatEmailAddress("user@example.com");
    expect(result).toBe("user@example.com");
  });

  it("should format email with name", () => {
    const result = formatEmailAddress("user@example.com", "John Doe");
    expect(result).toBe('"John Doe" <user@example.com>');
  });

  it("should escape quotes in name", () => {
    const result = formatEmailAddress("user@example.com", 'John "Jack" Doe');
    expect(result).toBe('"John \\"Jack\\" Doe" <user@example.com>');
  });
});

describe("parseEmailDate", () => {
  it("should parse valid date string", () => {
    const result = parseEmailDate("Mon, 01 Jan 2024 12:00:00 +0000");
    expect(result).toBeInstanceOf(Date);
    expect(result?.getUTCFullYear()).toBe(2024);
  });

  it("should return undefined for invalid date", () => {
    expect(parseEmailDate("not a date")).toBeUndefined();
  });

  it("should return undefined for undefined input", () => {
    expect(parseEmailDate(undefined)).toBeUndefined();
  });
});

// =============================================================================
// MIME PARSING TESTS
// =============================================================================

describe("extractBodyFromParts", () => {
  it("should extract text body", () => {
    const parts: MessagePart[] = [
      {
        mimeType: "text/plain",
        body: { data: base64UrlEncode("Hello World") },
      },
    ];
    const result = extractBodyFromParts(parts);
    expect(result.text).toBe("Hello World");
    expect(result.html).toBeUndefined();
  });

  it("should extract HTML body", () => {
    const parts: MessagePart[] = [
      {
        mimeType: "text/html",
        body: { data: base64UrlEncode("<p>Hello</p>") },
      },
    ];
    const result = extractBodyFromParts(parts);
    expect(result.html).toBe("<p>Hello</p>");
  });

  it("should extract both text and HTML from multipart", () => {
    const parts: MessagePart[] = [
      {
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/plain", body: { data: base64UrlEncode("Hello") } },
          { mimeType: "text/html", body: { data: base64UrlEncode("<p>Hello</p>") } },
        ],
      },
    ];
    const result = extractBodyFromParts(parts);
    expect(result.text).toBe("Hello");
    expect(result.html).toBe("<p>Hello</p>");
  });

  it("should handle empty parts array", () => {
    const result = extractBodyFromParts([]);
    expect(result.text).toBe("");
    expect(result.html).toBeUndefined();
  });

  it("should handle undefined parts", () => {
    const result = extractBodyFromParts(undefined);
    expect(result.text).toBe("");
  });
});

describe("parseAttachments", () => {
  it("should parse attachment from parts", () => {
    const parts: MessagePart[] = [
      {
        filename: "document.pdf",
        mimeType: "application/pdf",
        body: {
          attachmentId: "att123",
          size: 1024,
        },
      },
    ];
    const result = parseAttachments(parts);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      attachmentId: "att123",
      filename: "document.pdf",
      mimeType: "application/pdf",
      size: 1024,
      contentId: undefined,
    });
  });

  it("should parse nested attachments", () => {
    const parts: MessagePart[] = [
      {
        mimeType: "multipart/mixed",
        parts: [
          { mimeType: "text/plain", body: { data: "test" } },
          {
            filename: "image.png",
            mimeType: "image/png",
            body: { attachmentId: "img123", size: 2048 },
            headers: [{ name: "Content-ID", value: "<image001>" }],
          },
        ],
      },
    ];
    const result = parseAttachments(parts);
    expect(result).toHaveLength(1);
    expect(result[0].contentId).toBe("image001");
  });

  it("should handle parts without attachments", () => {
    const parts: MessagePart[] = [{ mimeType: "text/plain", body: { data: "test" } }];
    const result = parseAttachments(parts);
    expect(result).toHaveLength(0);
  });
});

// =============================================================================
// MESSAGE PARSING TESTS
// =============================================================================

describe("decodeEncodedWord", () => {
  it("should decode base64 encoded word", () => {
    const encoded = "=?UTF-8?B?SGVsbG8gV29ybGQ=?=";
    const result = decodeEncodedWord(encoded);
    expect(result).toBe("Hello World");
  });

  it("should decode quoted-printable encoded word", () => {
    const encoded = "=?UTF-8?Q?Hello_World?=";
    const result = decodeEncodedWord(encoded);
    expect(result).toBe("Hello World");
  });

  it("should handle plain text", () => {
    const result = decodeEncodedWord("Plain Subject");
    expect(result).toBe("Plain Subject");
  });
});

describe("parseEmailMessage", () => {
  it("should parse simple email message", () => {
    const raw = base64UrlEncode(
      "From: sender@example.com\r\n" +
        "To: recipient@example.com\r\n" +
        "Subject: Test\r\n" +
        "\r\n" +
        "Hello World",
    );
    const result = parseEmailMessage(raw);
    expect(result.from).toBe("sender@example.com");
    expect(result.to).toEqual(["recipient@example.com"]);
    expect(result.subject).toBe("Test");
    expect(result.body).toBe("Hello World");
  });
});

// =============================================================================
// MESSAGE BUILDING TESTS
// =============================================================================

describe("generateBoundary", () => {
  it("should generate unique boundaries", () => {
    const b1 = generateBoundary();
    const b2 = generateBoundary();
    expect(b1).not.toBe(b2);
  });

  it("should start with expected prefix", () => {
    const boundary = generateBoundary();
    expect(boundary).toMatch(/^----=_Part_/);
  });
});

describe("encodeSubject", () => {
  it("should not encode ASCII subject", () => {
    const result = encodeSubject("Hello World");
    expect(result).toBe("Hello World");
  });

  it("should encode non-ASCII subject", () => {
    const result = encodeSubject("Hello 日本語");
    expect(result).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
  });
});

describe("buildEmailMessage", () => {
  it("should build simple text email", () => {
    const raw = buildEmailMessage({
      to: "recipient@example.com",
      subject: "Test",
      body: "Hello World",
    });
    const decoded = base64UrlDecode(raw);
    expect(decoded).toContain("To: recipient@example.com");
    expect(decoded).toContain("Subject: Test");
    expect(decoded).toContain("Content-Type: text/plain");
  });

  it("should build email with multiple recipients", () => {
    const raw = buildEmailMessage({
      to: ["user1@example.com", "user2@example.com"],
      cc: ["cc@example.com"],
      subject: "Test",
      body: "Hello",
    });
    const decoded = base64UrlDecode(raw);
    expect(decoded).toContain("To: user1@example.com, user2@example.com");
    expect(decoded).toContain("Cc: cc@example.com");
  });

  it("should build email with HTML body", () => {
    const raw = buildEmailMessage({
      to: "recipient@example.com",
      subject: "Test",
      body: "Hello",
      htmlBody: "<p>Hello</p>",
    });
    const decoded = base64UrlDecode(raw);
    expect(decoded).toContain("multipart/alternative");
    expect(decoded).toContain("text/plain");
    expect(decoded).toContain("text/html");
  });

  it("should build email with attachments", () => {
    const raw = buildEmailMessage({
      to: "recipient@example.com",
      subject: "Test",
      body: "See attached",
      attachments: [
        {
          filename: "test.txt",
          content: Buffer.from("Test content"),
          mimeType: "text/plain",
        },
      ],
    });
    const decoded = base64UrlDecode(raw);
    expect(decoded).toContain("multipart/mixed");
    expect(decoded).toContain('filename="test.txt"');
  });

  it("should include threading headers", () => {
    const raw = buildEmailMessage({
      to: "recipient@example.com",
      subject: "Re: Test",
      body: "Reply",
      inReplyTo: "msg123",
      references: "<original@example.com>",
    });
    const decoded = base64UrlDecode(raw);
    expect(decoded).toContain("In-Reply-To: <msg123>");
    expect(decoded).toContain("References: <original@example.com>");
  });
});

// =============================================================================
// API RESPONSE PARSING TESTS
// =============================================================================

describe("parseGmailApiMessage", () => {
  it("should parse API message with payload", () => {
    const apiMessage: GmailApiMessage = {
      id: "msg123",
      threadId: "thread123",
      labelIds: ["INBOX", "UNREAD"],
      snippet: "Hello...",
      internalDate: "1704067200000",
      payload: {
        headers: [
          { name: "From", value: "sender@example.com" },
          { name: "To", value: "recipient@example.com" },
          { name: "Subject", value: "Test Subject" },
          { name: "Date", value: "Mon, 01 Jan 2024 00:00:00 +0000" },
        ],
        mimeType: "text/plain",
        body: { data: base64UrlEncode("Hello World") },
      },
    };

    const result = parseGmailApiMessage(apiMessage);
    expect(result.id).toBe("msg123");
    expect(result.threadId).toBe("thread123");
    expect(result.from).toBe("sender@example.com");
    expect(result.to).toEqual(["recipient@example.com"]);
    expect(result.subject).toBe("Test Subject");
    expect(result.body).toBe("Hello World");
    expect(result.labelIds).toEqual(["INBOX", "UNREAD"]);
  });

  it("should parse message with multipart content", () => {
    const apiMessage: GmailApiMessage = {
      id: "msg456",
      threadId: "thread456",
      payload: {
        mimeType: "multipart/alternative",
        headers: [
          { name: "Subject", value: "Test" },
          { name: "From", value: "test@example.com" },
        ],
        parts: [
          { mimeType: "text/plain", body: { data: base64UrlEncode("Plain text") } },
          { mimeType: "text/html", body: { data: base64UrlEncode("<p>HTML text</p>") } },
        ],
      },
    };

    const result = parseGmailApiMessage(apiMessage);
    expect(result.body).toBe("Plain text");
    expect(result.htmlBody).toBe("<p>HTML text</p>");
  });

  it("should handle message with no subject", () => {
    const apiMessage: GmailApiMessage = {
      id: "msg789",
      threadId: "thread789",
      payload: {
        headers: [{ name: "From", value: "test@example.com" }],
      },
    };

    const result = parseGmailApiMessage(apiMessage);
    expect(result.subject).toBe("(No Subject)");
  });
});

describe("buildReplyMessage", () => {
  const originalMessage: GmailMessage = {
    id: "msg123",
    threadId: "thread123",
    labelIds: ["INBOX"],
    snippet: "Original message...",
    from: "sender@example.com",
    to: ["me@example.com"],
    cc: ["cc@example.com"],
    subject: "Original Subject",
    body: "Original body",
    date: new Date("2024-01-01"),
    messageIdHeader: "original-msg-id",
  };

  it("should build reply to sender only", () => {
    const result = buildReplyMessage(originalMessage, "Reply body");
    expect(result.to).toEqual(["sender@example.com"]);
    expect(result.subject).toBe("Re: Original Subject");
    expect(result.inReplyTo).toBe("original-msg-id");
    expect(result.threadId).toBe("thread123");
  });

  it("should build reply all", () => {
    const result = buildReplyMessage(originalMessage, "Reply body", undefined, true);
    expect(result.to).toContain("sender@example.com");
    expect(result.to).toContain("me@example.com");
    expect(result.to).toContain("cc@example.com");
  });

  it("should not duplicate Re: prefix", () => {
    const msgWithRe: GmailMessage = {
      ...originalMessage,
      subject: "Re: Already has prefix",
    };
    const result = buildReplyMessage(msgWithRe, "Reply");
    expect(result.subject).toBe("Re: Already has prefix");
  });

  it("should add additional recipients", () => {
    const result = buildReplyMessage(originalMessage, "Reply", undefined, false, [
      "extra@example.com",
    ]);
    expect(result.to).toContain("extra@example.com");
  });
});
