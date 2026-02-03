import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createMessageBody,
  markdownToTeamsHtml,
  createMentionHtml,
  createMentionEntity,
  sendToChannel,
  replyToMessage,
  sendToChat,
  sendCardToChannel,
  sendCardToChat,
  send,
  sendCard,
  parseTarget,
  formatTarget,
  estimateMessageLength,
  splitMessage,
} from "../sender.js";
import { createTextCard } from "../cards.js";
import type { GraphClient, GraphRequest, TeamsMessage } from "../types.js";

// Mock Graph client factory
function createMockClient(): {
  client: GraphClient;
  mockPost: ReturnType<typeof vi.fn>;
} {
  const mockPost = vi.fn();
  const mockRequest: GraphRequest = {
    get: vi.fn(),
    post: mockPost,
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    header: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    expand: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    top: vi.fn().mockReturnThis(),
    orderby: vi.fn().mockReturnThis(),
  };

  const client: GraphClient = {
    api: vi.fn().mockReturnValue(mockRequest),
  };

  return { client, mockPost };
}

describe("sender", () => {
  describe("createMessageBody", () => {
    it("creates text message body", () => {
      const body = createMessageBody("Hello world", "text");
      expect(body).toEqual({
        contentType: "text",
        content: "Hello world",
      });
    });

    it("defaults to html content type", () => {
      const body = createMessageBody("Hello world");
      expect(body.contentType).toBe("html");
    });
  });

  describe("markdownToTeamsHtml", () => {
    it("converts bold text", () => {
      expect(markdownToTeamsHtml("**bold**")).toBe("<strong>bold</strong>");
      expect(markdownToTeamsHtml("__bold__")).toBe("<strong>bold</strong>");
    });

    it("converts italic text", () => {
      expect(markdownToTeamsHtml("*italic*")).toBe("<em>italic</em>");
      expect(markdownToTeamsHtml("_italic_")).toBe("<em>italic</em>");
    });

    it("converts strikethrough", () => {
      expect(markdownToTeamsHtml("~~strike~~")).toBe("<strike>strike</strike>");
    });

    it("converts inline code", () => {
      expect(markdownToTeamsHtml("`code`")).toBe("<code>code</code>");
    });

    it("converts links", () => {
      expect(markdownToTeamsHtml("[text](https://example.com)")).toBe(
        '<a href="https://example.com">text</a>',
      );
    });

    it("converts line breaks", () => {
      expect(markdownToTeamsHtml("line1\nline2")).toBe("line1<br>line2");
    });

    it("handles combined formatting", () => {
      const result = markdownToTeamsHtml("**bold** and *italic*");
      expect(result).toBe("<strong>bold</strong> and <em>italic</em>");
    });
  });

  describe("createMentionHtml", () => {
    it("creates mention HTML tag", () => {
      const html = createMentionHtml("user123", "John Doe");
      expect(html).toBe('<at id="user123">John Doe</at>');
    });
  });

  describe("createMentionEntity", () => {
    it("creates mention entity for Graph API", () => {
      const entity = createMentionEntity(0, "user123", "John Doe");
      expect(entity).toEqual({
        id: 0,
        mentionText: "John Doe",
        mentioned: {
          user: {
            id: "user123",
            displayName: "John Doe",
            userIdentityType: "aadUser",
          },
        },
      });
    });
  });

  describe("sendToChannel", () => {
    it("sends message to channel", async () => {
      const { client, mockPost } = createMockClient();
      const mockResponse: TeamsMessage = {
        id: "msg123",
        messageType: "message",
        createdDateTime: "2024-01-01T00:00:00Z",
        body: { contentType: "html", content: "Hello" },
      };
      mockPost.mockResolvedValue(mockResponse);

      const result = await sendToChannel(client, "team123", "channel123", "Hello");

      expect(client.api).toHaveBeenCalledWith("/teams/team123/channels/channel123/messages");
      expect(mockPost).toHaveBeenCalled();
      expect(result.id).toBe("msg123");
    });

    it("includes importance when specified", async () => {
      const { client, mockPost } = createMockClient();
      mockPost.mockResolvedValue({ id: "msg123" });

      await sendToChannel(client, "team123", "channel123", "Urgent!", {
        importance: "urgent",
      });

      const call = mockPost.mock.calls[0];
      expect(call[0]).toHaveProperty("importance", "urgent");
    });
  });

  describe("replyToMessage", () => {
    it("sends reply to message thread", async () => {
      const { client, mockPost } = createMockClient();
      mockPost.mockResolvedValue({ id: "reply123" });

      const result = await replyToMessage(
        client,
        "team123",
        "channel123",
        "parentMsg123",
        "Reply text",
      );

      expect(client.api).toHaveBeenCalledWith(
        "/teams/team123/channels/channel123/messages/parentMsg123/replies",
      );
      expect(result.id).toBe("reply123");
    });
  });

  describe("sendToChat", () => {
    it("sends message to chat", async () => {
      const { client, mockPost } = createMockClient();
      mockPost.mockResolvedValue({ id: "msg123" });

      const result = await sendToChat(client, "chat123", "Hello from chat");

      expect(client.api).toHaveBeenCalledWith("/chats/chat123/messages");
      expect(mockPost).toHaveBeenCalled();
      expect(result.id).toBe("msg123");
    });
  });

  describe("sendCardToChannel", () => {
    it("sends adaptive card to channel", async () => {
      const { client, mockPost } = createMockClient();
      mockPost.mockResolvedValue({ id: "msg123" });

      const card = createTextCard("Card content");
      const result = await sendCardToChannel(client, "team123", "channel123", card);

      expect(client.api).toHaveBeenCalledWith("/teams/team123/channels/channel123/messages");
      const call = mockPost.mock.calls[0];
      expect(call[0]).toHaveProperty("attachments");
      expect(result.id).toBe("msg123");
    });
  });

  describe("sendCardToChat", () => {
    it("sends adaptive card to chat", async () => {
      const { client, mockPost } = createMockClient();
      mockPost.mockResolvedValue({ id: "msg123" });

      const card = createTextCard("Card content");
      const result = await sendCardToChat(client, "chat123", card);

      expect(client.api).toHaveBeenCalledWith("/chats/chat123/messages");
      expect(result.id).toBe("msg123");
    });
  });

  describe("send (unified function)", () => {
    it("sends to channel target", async () => {
      const { client, mockPost } = createMockClient();
      mockPost.mockResolvedValue({ id: "msg123" });

      const result = await send(
        client,
        { type: "channel", teamId: "team1", channelId: "ch1" },
        "Hello",
      );

      expect(client.api).toHaveBeenCalledWith("/teams/team1/channels/ch1/messages");
      expect(result.id).toBe("msg123");
    });

    it("sends reply to channel target with replyToId", async () => {
      const { client, mockPost } = createMockClient();
      mockPost.mockResolvedValue({ id: "reply123" });

      await send(
        client,
        { type: "channel", teamId: "team1", channelId: "ch1", replyToId: "parent123" },
        "Reply",
      );

      expect(client.api).toHaveBeenCalledWith(
        "/teams/team1/channels/ch1/messages/parent123/replies",
      );
    });

    it("sends to chat target", async () => {
      const { client, mockPost } = createMockClient();
      mockPost.mockResolvedValue({ id: "msg123" });

      await send(client, { type: "chat", chatId: "chat1" }, "Hello");

      expect(client.api).toHaveBeenCalledWith("/chats/chat1/messages");
    });
  });

  describe("sendCard (unified function)", () => {
    it("sends card to channel", async () => {
      const { client, mockPost } = createMockClient();
      mockPost.mockResolvedValue({ id: "msg123" });

      const card = createTextCard("Test");
      await sendCard(client, { type: "channel", teamId: "t1", channelId: "c1" }, card);

      expect(client.api).toHaveBeenCalledWith("/teams/t1/channels/c1/messages");
    });

    it("sends card to chat", async () => {
      const { client, mockPost } = createMockClient();
      mockPost.mockResolvedValue({ id: "msg123" });

      const card = createTextCard("Test");
      await sendCard(client, { type: "chat", chatId: "chat1" }, card);

      expect(client.api).toHaveBeenCalledWith("/chats/chat1/messages");
    });
  });

  describe("parseTarget", () => {
    it("parses channel target", () => {
      const target = parseTarget("channel:team123/channel456");
      expect(target).toEqual({
        type: "channel",
        teamId: "team123",
        channelId: "channel456",
      });
    });

    it("parses channel target with reply ID", () => {
      const target = parseTarget("channel:team123/channel456:msg789");
      expect(target).toEqual({
        type: "channel",
        teamId: "team123",
        channelId: "channel456",
        replyToId: "msg789",
      });
    });

    it("parses chat target", () => {
      const target = parseTarget("chat:chat123");
      expect(target).toEqual({
        type: "chat",
        chatId: "chat123",
      });
    });

    it("returns null for invalid channel format", () => {
      expect(parseTarget("channel:teamOnly")).toBeNull();
      expect(parseTarget("channel:")).toBeNull();
    });

    it("returns null for empty input", () => {
      expect(parseTarget("")).toBeNull();
    });

    it("assumes chat for unknown format", () => {
      const target = parseTarget("some-chat-id");
      expect(target).toEqual({
        type: "chat",
        chatId: "some-chat-id",
      });
    });
  });

  describe("formatTarget", () => {
    it("formats channel target", () => {
      const result = formatTarget({ type: "channel", teamId: "t1", channelId: "c1" });
      expect(result).toBe("channel:t1/c1");
    });

    it("formats channel target with reply ID", () => {
      const result = formatTarget({
        type: "channel",
        teamId: "t1",
        channelId: "c1",
        replyToId: "m1",
      });
      expect(result).toBe("channel:t1/c1:m1");
    });

    it("formats chat target", () => {
      const result = formatTarget({ type: "chat", chatId: "chat123" });
      expect(result).toBe("chat:chat123");
    });
  });

  describe("estimateMessageLength", () => {
    it("estimates text length", () => {
      expect(estimateMessageLength("Hello")).toBe(5);
    });

    it("includes card in estimate", () => {
      const card = createTextCard("Card");
      const length = estimateMessageLength("Text", card);
      expect(length).toBeGreaterThan(4);
    });
  });

  describe("splitMessage", () => {
    it("returns single chunk for short messages", () => {
      const chunks = splitMessage("Hello world");
      expect(chunks).toEqual(["Hello world"]);
    });

    it("splits at natural break points", () => {
      const longMessage = "A".repeat(3000) + "\n" + "B".repeat(2000);
      const chunks = splitMessage(longMessage, 4000);
      expect(chunks.length).toBe(2);
    });

    it("splits at sentences when no line break", () => {
      const longMessage = "A".repeat(2500) + ". " + "B".repeat(2500);
      const chunks = splitMessage(longMessage, 4000);
      expect(chunks.length).toBe(2);
    });

    it("splits at spaces as fallback", () => {
      const longMessage = "word ".repeat(1000);
      const chunks = splitMessage(longMessage, 100);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(100);
      });
    });

    it("handles custom max length", () => {
      const message = "A".repeat(100);
      const chunks = splitMessage(message, 50);
      expect(chunks.length).toBe(2);
    });
  });
});
