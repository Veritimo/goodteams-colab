/**
 * Gmail Client Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { GoogleAuth, GmailApiMessage } from "../types.js";
import { GmailClient } from "../client.js";
import { base64UrlEncode } from "../parser.js";

// =============================================================================
// MOCK SETUP
// =============================================================================

function createMockAuth(): GoogleAuth {
  return {
    getAccessToken: vi.fn().mockResolvedValue({ token: "mock-token" }),
  };
}

function createMockMessage(overrides: Partial<GmailApiMessage> = {}): GmailApiMessage {
  return {
    id: "msg123",
    threadId: "thread123",
    labelIds: ["INBOX", "UNREAD"],
    snippet: "Test snippet...",
    internalDate: "1704067200000",
    payload: {
      headers: [
        { name: "From", value: "sender@example.com" },
        { name: "To", value: "recipient@example.com" },
        { name: "Subject", value: "Test Subject" },
        { name: "Date", value: "Mon, 01 Jan 2024 00:00:00 +0000" },
      ],
      mimeType: "text/plain",
      body: { data: base64UrlEncode("Test body content") },
    },
    ...overrides,
  };
}

// Global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

// =============================================================================
// PROFILE TESTS
// =============================================================================

describe("GmailClient - Profile", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should get user profile", async () => {
    const mockProfile = {
      emailAddress: "user@example.com",
      messagesTotal: 1000,
      threadsTotal: 500,
      historyId: "12345",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProfile),
    });

    const result = await client.getProfile();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer mock-token" },
      }),
    );
    expect(result).toEqual(mockProfile);
  });
});

// =============================================================================
// LIST MESSAGES TESTS
// =============================================================================

describe("GmailClient - listMessages", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should list messages with default options", async () => {
    const mockListResponse = {
      messages: [
        { id: "msg1", threadId: "t1" },
        { id: "msg2", threadId: "t2" },
      ],
      resultSizeEstimate: 2,
    };
    const mockMessage1 = createMockMessage({ id: "msg1" });
    const mockMessage2 = createMockMessage({ id: "msg2" });

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockListResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockMessage1) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockMessage2) });

    const result = await client.listMessages();

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result.messages).toHaveLength(2);
    expect(result.resultSizeEstimate).toBe(2);
  });

  it("should handle empty message list", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ resultSizeEstimate: 0 }),
    });

    const result = await client.listMessages();

    expect(result.messages).toEqual([]);
    expect(result.resultSizeEstimate).toBe(0);
  });

  it("should apply label filter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [], resultSizeEstimate: 0 }),
    });

    await client.listMessages({ labelIds: ["INBOX", "UNREAD"] });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("labelIds=INBOX%2CUNREAD"),
      expect.anything(),
    );
  });

  it("should apply query filter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [], resultSizeEstimate: 0 }),
    });

    await client.listMessages({ query: "is:unread from:boss" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("q=is%3Aunread+from%3Aboss"),
      expect.anything(),
    );
  });

  it("should apply maxResults", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [], resultSizeEstimate: 0 }),
    });

    await client.listMessages({ maxResults: 25 });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("maxResults=25"),
      expect.anything(),
    );
  });

  it("should apply pagination token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [], resultSizeEstimate: 0 }),
    });

    await client.listMessages({ pageToken: "next-page-token" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("pageToken=next-page-token"),
      expect.anything(),
    );
  });

  it("should return nextPageToken", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          messages: [{ id: "msg1", threadId: "t1" }],
          nextPageToken: "next-token",
          resultSizeEstimate: 100,
        }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createMockMessage({ id: "msg1" })),
    });

    const result = await client.listMessages();

    expect(result.nextPageToken).toBe("next-token");
  });
});

// =============================================================================
// GET MESSAGE TESTS
// =============================================================================

describe("GmailClient - getMessage", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should get a single message", async () => {
    const mockMessage = createMockMessage();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMessage),
    });

    const result = await client.getMessage("msg123");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg123?format=full",
      expect.anything(),
    );
    expect(result.id).toBe("msg123");
    expect(result.from).toBe("sender@example.com");
    expect(result.subject).toBe("Test Subject");
    expect(result.body).toBe("Test body content");
  });

  it("should get message with specific format", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createMockMessage()),
    });

    await client.getMessage("msg123", "metadata");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("format=metadata"),
      expect.anything(),
    );
  });
});

// =============================================================================
// SEARCH MESSAGES TESTS
// =============================================================================

describe("GmailClient - searchMessages", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should search messages with query", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [], resultSizeEstimate: 0 }),
    });

    await client.searchMessages("from:support@example.com", 50);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("q=from%3Asupport%40example.com"),
      expect.anything(),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("maxResults=50"),
      expect.anything(),
    );
  });
});

// =============================================================================
// SEND EMAIL TESTS
// =============================================================================

describe("GmailClient - sendEmail", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should send a simple email", async () => {
    const mockResponse = { id: "sent123", threadId: "newThread" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await client.sendEmail({
      to: "recipient@example.com",
      subject: "Test",
      body: "Hello World",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    expect(result.messageId).toBe("sent123");
    expect(result.threadId).toBe("newThread");
  });

  it("should send email with multiple recipients", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "sent123", threadId: "t1" }),
    });

    await client.sendEmail({
      to: ["user1@example.com", "user2@example.com"],
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
      subject: "Test",
      body: "Hello",
    });

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.raw).toBeDefined();
  });

  it("should send email with HTML body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "sent123", threadId: "t1" }),
    });

    await client.sendEmail({
      to: "recipient@example.com",
      subject: "Test",
      body: "Plain text",
      htmlBody: "<p>HTML content</p>",
    });

    expect(mockFetch).toHaveBeenCalled();
  });

  it("should send email with attachments", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "sent123", threadId: "t1" }),
    });

    await client.sendEmail({
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

    expect(mockFetch).toHaveBeenCalled();
  });

  it("should send email in existing thread", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "sent123", threadId: "existingThread" }),
    });

    await client.sendEmail({
      to: "recipient@example.com",
      subject: "Re: Test",
      body: "Reply",
      threadId: "existingThread",
    });

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.threadId).toBe("existingThread");
  });
});

// =============================================================================
// REPLY TO EMAIL TESTS
// =============================================================================

describe("GmailClient - replyToEmail", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should reply to an email", async () => {
    const originalMessage = createMockMessage();
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(originalMessage) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "reply123", threadId: "thread123" }),
      });

    const result = await client.replyToEmail("msg123", "Thanks for your message!");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.messageId).toBe("reply123");
    expect(result.threadId).toBe("thread123");
  });

  it("should reply all when specified", async () => {
    const originalMessage = createMockMessage({
      payload: {
        headers: [
          { name: "From", value: "sender@example.com" },
          { name: "To", value: "me@example.com, other@example.com" },
          { name: "Cc", value: "cc@example.com" },
          { name: "Subject", value: "Test" },
        ],
        body: { data: base64UrlEncode("Original") },
      },
    });
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(originalMessage) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "reply123", threadId: "thread123" }),
      });

    await client.replyToEmail("msg123", "Reply to all", { replyAll: true });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should include HTML in reply", async () => {
    const originalMessage = createMockMessage();
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(originalMessage) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "reply123", threadId: "thread123" }),
      });

    await client.replyToEmail("msg123", "Plain reply", {
      htmlBody: "<p>HTML reply</p>",
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// =============================================================================
// FORWARD MESSAGE TESTS
// =============================================================================

describe("GmailClient - forwardMessage", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should forward a message", async () => {
    const originalMessage = createMockMessage();
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(originalMessage) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "fwd123", threadId: "newThread" }),
      });

    const result = await client.forwardMessage("msg123", "forward@example.com", "FYI");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.messageId).toBe("fwd123");
  });

  it("should forward to multiple recipients", async () => {
    const originalMessage = createMockMessage();
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(originalMessage) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "fwd123", threadId: "newThread" }),
      });

    await client.forwardMessage("msg123", ["user1@example.com", "user2@example.com"]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// =============================================================================
// LABEL OPERATIONS TESTS
// =============================================================================

describe("GmailClient - listLabels", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should list all labels", async () => {
    const mockLabels = {
      labels: [
        { id: "INBOX", name: "INBOX", type: "system" },
        { id: "SENT", name: "SENT", type: "system" },
        { id: "Label_1", name: "Custom Label", type: "user" },
      ],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLabels),
    });

    const result = await client.listLabels();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/labels",
      expect.anything(),
    );
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("INBOX");
  });
});

describe("GmailClient - getLabel", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should get a specific label", async () => {
    const mockLabel = { id: "Label_1", name: "Custom", type: "user" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLabel),
    });

    const result = await client.getLabel("Label_1");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/labels/Label_1",
      expect.anything(),
    );
    expect(result.name).toBe("Custom");
  });
});

describe("GmailClient - createLabel", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should create a label", async () => {
    const mockLabel = { id: "Label_new", name: "New Label", type: "user" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLabel),
    });

    const result = await client.createLabel("New Label");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/labels",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.name).toBe("New Label");
  });

  it("should create label with options", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "Label_new", name: "Custom" }),
    });

    await client.createLabel("Custom", {
      messageListVisibility: "show",
      labelListVisibility: "labelShow",
      backgroundColor: "#ff0000",
      textColor: "#ffffff",
    });

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.color.backgroundColor).toBe("#ff0000");
  });
});

describe("GmailClient - deleteLabel", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should delete a label", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await client.deleteLabel("Label_1");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/labels/Label_1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("GmailClient - modifyLabels", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should modify labels on a message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createMockMessage()),
    });

    await client.modifyLabels("msg123", ["STARRED"], ["UNREAD"]);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg123/modify",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.addLabelIds).toEqual(["STARRED"]);
    expect(body.removeLabelIds).toEqual(["UNREAD"]);
  });
});

describe("GmailClient - convenience label methods", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createMockMessage()),
    });
  });

  it("markAsRead should remove UNREAD label", async () => {
    await client.markAsRead("msg123");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.removeLabelIds).toContain("UNREAD");
  });

  it("markAsUnread should add UNREAD label", async () => {
    await client.markAsUnread("msg123");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.addLabelIds).toContain("UNREAD");
  });

  it("starMessage should add STARRED label", async () => {
    await client.starMessage("msg123");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.addLabelIds).toContain("STARRED");
  });

  it("unstarMessage should remove STARRED label", async () => {
    await client.unstarMessage("msg123");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.removeLabelIds).toContain("STARRED");
  });

  it("archiveMessage should remove INBOX label", async () => {
    await client.archiveMessage("msg123");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.removeLabelIds).toContain("INBOX");
  });

  it("moveToInbox should add INBOX label", async () => {
    await client.moveToInbox("msg123");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.addLabelIds).toContain("INBOX");
  });
});

// =============================================================================
// MESSAGE MANAGEMENT TESTS
// =============================================================================

describe("GmailClient - deleteMessage", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should delete a message", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await client.deleteMessage("msg123");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg123",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("GmailClient - trashMessage", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should trash a message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createMockMessage({ labelIds: ["TRASH"] })),
    });

    const result = await client.trashMessage("msg123");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg123/trash",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.labelIds).toContain("TRASH");
  });
});

describe("GmailClient - untrashMessage", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should untrash a message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createMockMessage({ labelIds: ["INBOX"] })),
    });

    await client.untrashMessage("msg123");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg123/untrash",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

// =============================================================================
// ATTACHMENT TESTS
// =============================================================================

describe("GmailClient - getAttachment", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should get attachment content", async () => {
    const mockAttachment = {
      size: 1024,
      data: base64UrlEncode("attachment content"),
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockAttachment),
    });

    const result = await client.getAttachment("msg123", "att456");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg123/attachments/att456",
      expect.anything(),
    );
    expect(result.size).toBe(1024);
  });
});

// =============================================================================
// THREAD TESTS
// =============================================================================

describe("GmailClient - listThreads", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should list threads", async () => {
    const mockResponse = {
      threads: [
        { id: "t1", snippet: "Thread 1..." },
        { id: "t2", snippet: "Thread 2..." },
      ],
      resultSizeEstimate: 2,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await client.listThreads();

    expect(result.threads).toHaveLength(2);
    expect(result.threads[0].id).toBe("t1");
  });
});

describe("GmailClient - getThread", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should get thread with messages", async () => {
    const mockResponse = {
      id: "thread123",
      snippet: "Thread snippet",
      messages: [createMockMessage({ id: "msg1" }), createMockMessage({ id: "msg2" })],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await client.getThread("thread123");

    expect(result.id).toBe("thread123");
    expect(result.messages).toHaveLength(2);
  });
});

// =============================================================================
// DRAFT TESTS
// =============================================================================

describe("GmailClient - listDrafts", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should list drafts", async () => {
    const mockResponse = {
      drafts: [{ id: "d1", message: createMockMessage({ id: "msg1" }) }],
      resultSizeEstimate: 1,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await client.listDrafts();

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].id).toBe("d1");
  });
});

describe("GmailClient - createDraft", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should create a draft", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: "draft123",
          message: createMockMessage(),
        }),
    });

    const result = await client.createDraft({
      to: "recipient@example.com",
      subject: "Draft",
      body: "Draft content",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.id).toBe("draft123");
  });
});

describe("GmailClient - sendDraft", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should send a draft", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "sent123", threadId: "t1" }),
    });

    const result = await client.sendDraft("draft123");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/drafts/send",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.messageId).toBe("sent123");
  });
});

// =============================================================================
// BATCH OPERATIONS TESTS
// =============================================================================

describe("GmailClient - batchModifyLabels", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should batch modify labels", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await client.batchModifyLabels(["msg1", "msg2", "msg3"], ["STARRED"], ["UNREAD"]);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.ids).toEqual(["msg1", "msg2", "msg3"]);
    expect(body.addLabelIds).toEqual(["STARRED"]);
  });
});

describe("GmailClient - batchDeleteMessages", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should batch delete messages", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await client.batchDeleteMessages(["msg1", "msg2"]);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/batchDelete",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.ids).toEqual(["msg1", "msg2"]);
  });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe("GmailClient - error handling", () => {
  let client: GmailClient;
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    client = new GmailClient({ auth });
    mockFetch.mockReset();
  });

  it("should throw error on API failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () =>
        Promise.resolve({
          error: {
            code: 404,
            message: "Requested entity was not found.",
            errors: [{ message: "Not Found", domain: "global", reason: "notFound" }],
          },
        }),
    });

    await expect(client.getMessage("invalid")).rejects.toMatchObject({
      code: 404,
      message: "Requested entity was not found.",
    });
  });

  it("should throw error on auth failure", async () => {
    (auth.getAccessToken as any).mockResolvedValueOnce({ token: null });

    await expect(client.getProfile()).rejects.toThrow("Failed to obtain access token");
  });
});

// =============================================================================
// USER EMAIL IMPERSONATION TESTS
// =============================================================================

describe("GmailClient - impersonation", () => {
  let auth: GoogleAuth;

  beforeEach(() => {
    auth = createMockAuth();
    mockFetch.mockReset();
  });

  it("should use user email for impersonation", async () => {
    const client = new GmailClient({
      auth,
      userEmail: "impersonated@example.com",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ emailAddress: "impersonated@example.com" }),
    });

    await client.getProfile();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/impersonated@example.com/profile",
      expect.anything(),
    );
  });
});
