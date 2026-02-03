/**
 * Mail Operations Tests
 */

import type { Client } from "@microsoft/microsoft-graph-client";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listMessages,
  getMessage,
  getAttachments,
  downloadAttachment,
  sendMail,
  replyToMessage,
  forwardMessage,
  deleteMessage,
  moveMessage,
  markAsRead,
  listFolders,
  getFolder,
  createFolder,
} from "../mail.js";

// =============================================================================
// MOCK SETUP
// =============================================================================

function createMockClient(): Client {
  const mockRequest = {
    select: vi.fn().mockReturnThis(),
    top: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    orderby: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    search: vi.fn().mockReturnThis(),
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };

  return {
    api: vi.fn().mockReturnValue(mockRequest),
  } as unknown as Client;
}

// =============================================================================
// LIST MESSAGES TESTS
// =============================================================================

describe("listMessages", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should list messages from inbox with default options", async () => {
    const mockMessages = [
      { id: "msg1", subject: "Test 1" },
      { id: "msg2", subject: "Test 2" },
    ];

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: mockMessages });

    const result = await listMessages(client);

    expect(client.api).toHaveBeenCalledWith("/me/mailFolders/inbox/messages");
    expect(mockRequest.select).toHaveBeenCalled();
    expect(mockRequest.top).toHaveBeenCalledWith(10);
    expect(mockRequest.orderby).toHaveBeenCalledWith("receivedDateTime desc");
    expect(result).toEqual(mockMessages);
  });

  it("should list messages from a specific folder", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await listMessages(client, { folderId: "sentitems" });

    expect(client.api).toHaveBeenCalledWith("/me/mailFolders/sentitems/messages");
  });

  it("should apply pagination options", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await listMessages(client, { top: 25, skip: 50 });

    expect(mockRequest.top).toHaveBeenCalledWith(25);
    expect(mockRequest.skip).toHaveBeenCalledWith(50);
  });

  it("should apply filter expression", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await listMessages(client, { filter: "isRead eq false" });

    expect(mockRequest.filter).toHaveBeenCalledWith("isRead eq false");
  });

  it("should apply search query", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await listMessages(client, { search: "project update" });

    expect(mockRequest.search).toHaveBeenCalledWith('"project update"');
  });

  it("should use custom select fields", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await listMessages(client, { select: ["id", "subject"] });

    expect(mockRequest.select).toHaveBeenCalledWith(["id", "subject"]);
  });

  it("should use custom sort order", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await listMessages(client, { orderBy: "subject asc" });

    expect(mockRequest.orderby).toHaveBeenCalledWith("subject asc");
  });
});

// =============================================================================
// GET MESSAGE TESTS
// =============================================================================

describe("getMessage", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should get a single message with body", async () => {
    const mockMessage = {
      id: "msg1",
      subject: "Test",
      body: { contentType: "html", content: "<p>Hello</p>" },
    };

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue(mockMessage);

    const result = await getMessage(client, "msg1");

    expect(client.api).toHaveBeenCalledWith("/me/messages/msg1");
    expect(result).toEqual(mockMessage);
  });
});

// =============================================================================
// ATTACHMENT TESTS
// =============================================================================

describe("getAttachments", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should list attachments for a message", async () => {
    const mockAttachments = [
      { id: "att1", name: "file.pdf", size: 1024 },
      { id: "att2", name: "image.png", size: 2048 },
    ];

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: mockAttachments });

    const result = await getAttachments(client, "msg1");

    expect(client.api).toHaveBeenCalledWith("/me/messages/msg1/attachments");
    expect(result).toEqual(mockAttachments);
  });
});

describe("downloadAttachment", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should download attachment with content bytes", async () => {
    const mockAttachment = {
      id: "att1",
      name: "file.pdf",
      contentBytes: "SGVsbG8gV29ybGQ=", // base64 "Hello World"
    };

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue(mockAttachment);

    const result = await downloadAttachment(client, "msg1", "att1");

    expect(client.api).toHaveBeenCalledWith("/me/messages/msg1/attachments/att1");
    expect(result.contentBytes).toBe("SGVsbG8gV29ybGQ=");
  });
});

// =============================================================================
// SEND MAIL TESTS
// =============================================================================

describe("sendMail", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should send a simple email", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(undefined);

    await sendMail(client, {
      subject: "Hello",
      body: { contentType: "text", content: "Hello World!" },
      toRecipients: [{ emailAddress: { address: "user@example.com" } }],
    });

    expect(client.api).toHaveBeenCalledWith("/me/sendMail");
    expect(mockRequest.post).toHaveBeenCalledWith({
      message: {
        subject: "Hello",
        body: { contentType: "text", content: "Hello World!" },
        toRecipients: [{ emailAddress: { address: "user@example.com" } }],
        attachments: undefined,
      },
      saveToSentItems: true,
    });
  });

  it("should send email with attachments", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(undefined);

    await sendMail(client, {
      subject: "With Attachment",
      body: { contentType: "text", content: "See attached" },
      toRecipients: [{ emailAddress: { address: "user@example.com" } }],
      attachments: [
        {
          name: "file.txt",
          contentType: "text/plain",
          contentBytes: "SGVsbG8=",
        },
      ],
    });

    const call = mockRequest.post.mock.calls[0][0];
    expect(call.message.attachments).toHaveLength(1);
    expect(call.message.attachments[0]["@odata.type"]).toBe("#microsoft.graph.fileAttachment");
  });

  it("should not save to sent items when specified", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(undefined);

    await sendMail(client, {
      subject: "Test",
      body: { contentType: "text", content: "Test" },
      toRecipients: [{ emailAddress: { address: "user@example.com" } }],
      saveToSentItems: false,
    });

    expect(mockRequest.post).toHaveBeenCalledWith(
      expect.objectContaining({ saveToSentItems: false }),
    );
  });
});

// =============================================================================
// REPLY AND FORWARD TESTS
// =============================================================================

describe("replyToMessage", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should reply to a message", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(undefined);

    await replyToMessage(client, "msg1", "Thanks!");

    expect(client.api).toHaveBeenCalledWith("/me/messages/msg1/reply");
    expect(mockRequest.post).toHaveBeenCalledWith({ comment: "Thanks!" });
  });

  it("should reply all when specified", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(undefined);

    await replyToMessage(client, "msg1", "Thanks everyone!", true);

    expect(client.api).toHaveBeenCalledWith("/me/messages/msg1/replyAll");
  });
});

describe("forwardMessage", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should forward a message", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(undefined);

    await forwardMessage(client, "msg1", ["user@example.com"], "FYI");

    expect(client.api).toHaveBeenCalledWith("/me/messages/msg1/forward");
    expect(mockRequest.post).toHaveBeenCalledWith({
      comment: "FYI",
      toRecipients: [{ emailAddress: { address: "user@example.com" } }],
    });
  });

  it("should forward to multiple recipients", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(undefined);

    await forwardMessage(client, "msg1", ["user1@example.com", "user2@example.com"]);

    const call = mockRequest.post.mock.calls[0][0];
    expect(call.toRecipients).toHaveLength(2);
  });
});

// =============================================================================
// MESSAGE MANAGEMENT TESTS
// =============================================================================

describe("deleteMessage", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should delete a message", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.delete.mockResolvedValue(undefined);

    await deleteMessage(client, "msg1");

    expect(client.api).toHaveBeenCalledWith("/me/messages/msg1");
    expect(mockRequest.delete).toHaveBeenCalled();
  });
});

describe("moveMessage", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should move a message to another folder", async () => {
    const movedMessage = { id: "msg1", parentFolderId: "archive" };
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(movedMessage);

    const result = await moveMessage(client, "msg1", "archive");

    expect(client.api).toHaveBeenCalledWith("/me/messages/msg1/move");
    expect(mockRequest.post).toHaveBeenCalledWith({ destinationId: "archive" });
    expect(result).toEqual(movedMessage);
  });
});

describe("markAsRead", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should mark a message as read", async () => {
    const updatedMessage = { id: "msg1", isRead: true };
    const mockRequest = (client.api as any)();
    mockRequest.patch.mockResolvedValue(updatedMessage);

    const result = await markAsRead(client, "msg1", true);

    expect(client.api).toHaveBeenCalledWith("/me/messages/msg1");
    expect(mockRequest.patch).toHaveBeenCalledWith({ isRead: true });
    expect(result.isRead).toBe(true);
  });

  it("should mark a message as unread", async () => {
    const updatedMessage = { id: "msg1", isRead: false };
    const mockRequest = (client.api as any)();
    mockRequest.patch.mockResolvedValue(updatedMessage);

    const result = await markAsRead(client, "msg1", false);

    expect(mockRequest.patch).toHaveBeenCalledWith({ isRead: false });
    expect(result.isRead).toBe(false);
  });
});

// =============================================================================
// FOLDER TESTS
// =============================================================================

describe("listFolders", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should list mail folders", async () => {
    const mockFolders = [
      { id: "inbox", displayName: "Inbox", unreadItemCount: 5 },
      { id: "sent", displayName: "Sent Items", unreadItemCount: 0 },
    ];

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: mockFolders });

    const result = await listFolders(client);

    expect(client.api).toHaveBeenCalledWith("/me/mailFolders");
    expect(result).toEqual(mockFolders);
  });
});

describe("getFolder", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should get a specific folder", async () => {
    const mockFolder = { id: "inbox", displayName: "Inbox", unreadItemCount: 3 };
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue(mockFolder);

    const result = await getFolder(client, "inbox");

    expect(client.api).toHaveBeenCalledWith("/me/mailFolders/inbox");
    expect(result).toEqual(mockFolder);
  });
});

describe("createFolder", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should create a mail folder at root", async () => {
    const mockFolder = { id: "new-folder", displayName: "Archive" };
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(mockFolder);

    const result = await createFolder(client, "Archive");

    expect(client.api).toHaveBeenCalledWith("/me/mailFolders");
    expect(mockRequest.post).toHaveBeenCalledWith({ displayName: "Archive" });
    expect(result).toEqual(mockFolder);
  });

  it("should create a subfolder", async () => {
    const mockFolder = { id: "subfolder", displayName: "Subfolder" };
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(mockFolder);

    const result = await createFolder(client, "Subfolder", "parent-id");

    expect(client.api).toHaveBeenCalledWith("/me/mailFolders/parent-id/childFolders");
    expect(result).toEqual(mockFolder);
  });
});
