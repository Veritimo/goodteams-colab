import { describe, expect, it } from "vitest";
import {
  parseWebhookPayload,
  parseWebhookJson,
  isMessageActivity,
  isConversationUpdateActivity,
  isInvokeActivity,
  isTypingActivity,
  extractSender,
  getSenderDisplayName,
  isSenderBot,
  extractConversation,
  extractTeamChannel,
  extractMessageText,
  stripMentions,
  getRawMessageText,
  wasBotMentioned,
  getAllMentions,
  getMentionsExcludingBot,
  buildConversationReference,
  normalizeActivity,
  getMembersAdded,
  getMembersRemoved,
  wasBotAdded,
  wasBotRemoved,
  isValidActivity,
  isProcessableMessage,
  isCardActionInvoke,
  extractCardActionData,
} from "../webhook.js";
import type { TeamsActivity } from "../types.js";

describe("webhook", () => {
  describe("parseWebhookPayload", () => {
    it("parses a valid activity object", () => {
      const payload = { type: "message", text: "hello" };
      const result = parseWebhookPayload(payload);
      expect(result).toEqual(payload);
    });

    it("returns null for non-object payload", () => {
      expect(parseWebhookPayload(null)).toBeNull();
      expect(parseWebhookPayload(undefined)).toBeNull();
      expect(parseWebhookPayload("string")).toBeNull();
      expect(parseWebhookPayload(123)).toBeNull();
    });

    it("returns null for object without type", () => {
      expect(parseWebhookPayload({ text: "hello" })).toBeNull();
    });
  });

  describe("parseWebhookJson", () => {
    it("parses valid JSON", () => {
      const json = JSON.stringify({ type: "message", text: "hello" });
      const result = parseWebhookJson(json);
      expect(result?.type).toBe("message");
      expect(result?.text).toBe("hello");
    });

    it("returns null for invalid JSON", () => {
      expect(parseWebhookJson("not json")).toBeNull();
      expect(parseWebhookJson("")).toBeNull();
    });
  });

  describe("activity type checking", () => {
    it("identifies message activities", () => {
      expect(isMessageActivity({ type: "message" } as TeamsActivity)).toBe(true);
      expect(isMessageActivity({ type: "typing" } as TeamsActivity)).toBe(false);
    });

    it("identifies conversation update activities", () => {
      expect(isConversationUpdateActivity({ type: "conversationUpdate" } as TeamsActivity)).toBe(
        true,
      );
      expect(isConversationUpdateActivity({ type: "message" } as TeamsActivity)).toBe(false);
    });

    it("identifies invoke activities", () => {
      expect(isInvokeActivity({ type: "invoke" } as TeamsActivity)).toBe(true);
      expect(isInvokeActivity({ type: "message" } as TeamsActivity)).toBe(false);
    });

    it("identifies typing activities", () => {
      expect(isTypingActivity({ type: "typing" } as TeamsActivity)).toBe(true);
      expect(isTypingActivity({ type: "message" } as TeamsActivity)).toBe(false);
    });
  });

  describe("extractSender", () => {
    it("extracts sender info", () => {
      const activity: TeamsActivity = {
        type: "message",
        from: {
          id: "user123",
          name: "John Doe",
          email: "john@example.com",
          aadObjectId: "aad123",
        },
      };
      const sender = extractSender(activity);
      expect(sender).toEqual({
        id: "user123",
        name: "John Doe",
        email: "john@example.com",
        aadObjectId: "aad123",
      });
    });

    it("returns null when from is missing", () => {
      const activity: TeamsActivity = { type: "message" };
      expect(extractSender(activity)).toBeNull();
    });
  });

  describe("getSenderDisplayName", () => {
    it("returns name when available", () => {
      const activity: TeamsActivity = {
        type: "message",
        from: { id: "user123", name: "John" },
      };
      expect(getSenderDisplayName(activity)).toBe("John");
    });

    it("returns id when name is missing", () => {
      const activity: TeamsActivity = {
        type: "message",
        from: { id: "user123" },
      };
      expect(getSenderDisplayName(activity)).toBe("user123");
    });

    it("returns Unknown when from is missing", () => {
      const activity: TeamsActivity = { type: "message" };
      expect(getSenderDisplayName(activity)).toBe("Unknown");
    });
  });

  describe("isSenderBot", () => {
    it("returns true for bot senders", () => {
      const activity: TeamsActivity = {
        type: "message",
        from: { id: "bot123", role: "bot" },
      };
      expect(isSenderBot(activity)).toBe(true);
    });

    it("returns false for user senders", () => {
      const activity: TeamsActivity = {
        type: "message",
        from: { id: "user123", role: "user" },
      };
      expect(isSenderBot(activity)).toBe(false);
    });
  });

  describe("extractConversation", () => {
    it("extracts conversation info for personal chat", () => {
      const activity: TeamsActivity = {
        type: "message",
        conversation: {
          id: "conv123",
          isGroup: false,
          conversationType: "personal",
          tenantId: "tenant123",
        },
      };
      const conv = extractConversation(activity);
      expect(conv).toEqual({
        id: "conv123",
        isGroup: false,
        conversationType: "personal",
        tenantId: "tenant123",
      });
    });

    it("extracts conversation info for channel", () => {
      const activity: TeamsActivity = {
        type: "message",
        conversation: {
          id: "19:channel123@thread.tacv2",
          isGroup: true,
          conversationType: "channel",
        },
      };
      const conv = extractConversation(activity);
      expect(conv?.conversationType).toBe("channel");
      expect(conv?.isGroup).toBe(true);
    });

    it("infers channel type from channelData", () => {
      const activity: TeamsActivity = {
        type: "message",
        conversation: {
          id: "19:conv@thread.tacv2",
          isGroup: true,
        },
        channelData: {
          channel: { id: "19:channel@thread.tacv2" },
        },
      };
      const conv = extractConversation(activity);
      expect(conv?.conversationType).toBe("channel");
    });
  });

  describe("extractTeamChannel", () => {
    it("extracts team and channel info", () => {
      const activity: TeamsActivity = {
        type: "message",
        channelData: {
          team: { id: "team123", name: "My Team" },
          channel: { id: "channel123", name: "General" },
          tenant: { id: "tenant123" },
        },
      };
      const result = extractTeamChannel(activity);
      expect(result).toEqual({
        teamId: "team123",
        teamName: "My Team",
        channelId: "channel123",
        channelName: "General",
        tenantId: "tenant123",
      });
    });

    it("returns undefined values when channelData is missing", () => {
      const activity: TeamsActivity = { type: "message" };
      const result = extractTeamChannel(activity);
      expect(result.teamId).toBeUndefined();
      expect(result.channelId).toBeUndefined();
    });
  });

  describe("extractMessageText", () => {
    it("extracts plain text", () => {
      const activity: TeamsActivity = {
        type: "message",
        text: "Hello world",
      };
      expect(extractMessageText(activity)).toBe("Hello world");
    });

    it("strips mentions by default", () => {
      const activity: TeamsActivity = {
        type: "message",
        text: "<at>@Bot</at> Hello world",
        entities: [{ type: "mention", mentioned: { id: "bot123" }, text: "@Bot" }],
      };
      expect(extractMessageText(activity)).toBe("Hello world");
    });

    it("preserves mentions when stripMentions is false", () => {
      const activity: TeamsActivity = {
        type: "message",
        text: "<at>@Bot</at> Hello",
      };
      expect(extractMessageText(activity, { stripMentions: false })).toBe("<at>@Bot</at> Hello");
    });
  });

  describe("stripMentions", () => {
    it("removes at tags", () => {
      expect(stripMentions("<at>@Bot</at> hello")).toBe("hello");
      expect(stripMentions("hi <at>@User</at> there")).toBe("hi there");
    });

    it("removes at tags with attributes", () => {
      expect(stripMentions('<at id="1">Bot</at> hello')).toBe("hello");
    });

    it("handles multiple mentions", () => {
      expect(stripMentions("<at>@A</at> and <at>@B</at> hello")).toBe("and hello");
    });
  });

  describe("wasBotMentioned", () => {
    it("returns true when bot is mentioned", () => {
      const activity: TeamsActivity = {
        type: "message",
        recipient: { id: "bot123" },
        entities: [{ type: "mention", mentioned: { id: "bot123" } }],
      };
      expect(wasBotMentioned(activity)).toBe(true);
    });

    it("returns false when bot is not mentioned", () => {
      const activity: TeamsActivity = {
        type: "message",
        recipient: { id: "bot123" },
        entities: [{ type: "mention", mentioned: { id: "user456" } }],
      };
      expect(wasBotMentioned(activity)).toBe(false);
    });

    it("returns false when no entities", () => {
      const activity: TeamsActivity = {
        type: "message",
        recipient: { id: "bot123" },
      };
      expect(wasBotMentioned(activity)).toBe(false);
    });
  });

  describe("getAllMentions", () => {
    it("returns all mentions", () => {
      const activity: TeamsActivity = {
        type: "message",
        entities: [
          { type: "mention", mentioned: { id: "user1", name: "User One" }, text: "@User One" },
          { type: "mention", mentioned: { id: "user2", name: "User Two" }, text: "@User Two" },
          { type: "other", mentioned: { id: "skip" } },
        ],
      };
      const mentions = getAllMentions(activity);
      expect(mentions).toHaveLength(2);
      expect(mentions[0]).toEqual({ id: "user1", name: "User One", text: "@User One" });
    });
  });

  describe("getMentionsExcludingBot", () => {
    it("filters out bot mention", () => {
      const activity: TeamsActivity = {
        type: "message",
        recipient: { id: "bot123" },
        entities: [
          { type: "mention", mentioned: { id: "bot123" } },
          { type: "mention", mentioned: { id: "user456", name: "User" } },
        ],
      };
      const mentions = getMentionsExcludingBot(activity);
      expect(mentions).toHaveLength(1);
      expect(mentions[0]?.id).toBe("user456");
    });
  });

  describe("normalizeActivity", () => {
    it("normalizes a message activity", () => {
      const activity: TeamsActivity = {
        type: "message",
        id: "msg123",
        text: "<at>@Bot</at> Hello",
        timestamp: "2024-01-01T00:00:00Z",
        from: { id: "user123", name: "John" },
        recipient: { id: "bot123" },
        conversation: {
          id: "conv123",
          conversationType: "personal",
        },
        serviceUrl: "https://smba.trafficmanager.net",
        entities: [{ type: "mention", mentioned: { id: "bot123" }, text: "@Bot" }],
      };

      const normalized = normalizeActivity(activity);
      expect(normalized).not.toBeNull();
      expect(normalized?.id).toBe("msg123");
      expect(normalized?.channel).toBe("teams");
      expect(normalized?.text).toBe("Hello");
      expect(normalized?.rawText).toBe("<at>@Bot</at> Hello");
      expect(normalized?.chatType).toBe("direct");
      expect(normalized?.botMentioned).toBe(true);
      expect(normalized?.sender.id).toBe("user123");
    });

    it("returns null for non-message activities", () => {
      const activity: TeamsActivity = { type: "typing" };
      expect(normalizeActivity(activity)).toBeNull();
    });

    it("returns null for bot messages", () => {
      const activity: TeamsActivity = {
        type: "message",
        from: { id: "bot123", role: "bot" },
        conversation: { id: "conv123" },
      };
      expect(normalizeActivity(activity)).toBeNull();
    });
  });

  describe("conversation update handling", () => {
    it("gets members added", () => {
      const activity: TeamsActivity = {
        type: "conversationUpdate",
        membersAdded: [
          { id: "user1", name: "User 1" },
          { id: "user2", name: "User 2" },
        ],
      };
      const added = getMembersAdded(activity);
      expect(added).toHaveLength(2);
    });

    it("gets members removed", () => {
      const activity: TeamsActivity = {
        type: "conversationUpdate",
        membersRemoved: [{ id: "user1" }],
      };
      const removed = getMembersRemoved(activity);
      expect(removed).toHaveLength(1);
    });

    it("detects when bot was added", () => {
      const activity: TeamsActivity = {
        type: "conversationUpdate",
        recipient: { id: "bot123" },
        membersAdded: [{ id: "bot123" }],
      };
      expect(wasBotAdded(activity)).toBe(true);
    });

    it("detects when bot was removed", () => {
      const activity: TeamsActivity = {
        type: "conversationUpdate",
        recipient: { id: "bot123" },
        membersRemoved: [{ id: "bot123" }],
      };
      expect(wasBotRemoved(activity)).toBe(true);
    });
  });

  describe("validation", () => {
    it("validates activity objects", () => {
      expect(isValidActivity({ type: "message" })).toBe(true);
      expect(isValidActivity(null)).toBe(false);
      expect(isValidActivity({})).toBe(false);
    });

    it("validates processable messages", () => {
      const valid: TeamsActivity = {
        type: "message",
        text: "Hello",
        from: { id: "user123" },
      };
      expect(isProcessableMessage(valid)).toBe(true);

      const botMessage: TeamsActivity = {
        type: "message",
        text: "Hello",
        from: { id: "bot123", role: "bot" },
      };
      expect(isProcessableMessage(botMessage)).toBe(false);

      const noContent: TeamsActivity = {
        type: "message",
        from: { id: "user123" },
      };
      expect(isProcessableMessage(noContent)).toBe(false);
    });
  });

  describe("card action invoke", () => {
    it("identifies card action invokes", () => {
      const activity: TeamsActivity = {
        type: "invoke",
        name: "adaptiveCard/action",
        value: { action: { type: "Action.Execute", verb: "vote" } },
      };
      expect(isCardActionInvoke(activity)).toBe(true);
    });

    it("extracts card action data", () => {
      const activity: TeamsActivity = {
        type: "invoke",
        name: "adaptiveCard/action",
        value: { action: { type: "Action.Execute", verb: "vote", data: { choice: "A" } } },
      };
      const data = extractCardActionData(activity);
      expect(data?.action?.verb).toBe("vote");
      expect(data?.action?.data).toEqual({ choice: "A" });
    });
  });
});
