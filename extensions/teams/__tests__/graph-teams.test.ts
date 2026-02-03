import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listTeams,
  getTeam,
  searchTeams,
  listChannels,
  getChannel,
  getPrimaryChannel,
  searchChannels,
  listChannelMessages,
  getChannelMessage,
  listChannelMessageReplies,
  listChats,
  getChat,
  listChatMessages,
  getChatMessage,
  findTeamByName,
  findChannelByName,
  resolveTeamAndChannel,
  buildChannelMessageUrl,
  buildChatUrl,
  extractMessageText,
  isUserMentioned,
  isGraphError,
} from "../graph-teams.js";
import type { GraphClient, GraphRequest, Team, TeamsChannel, TeamsMessage, TeamsChat } from "../types.js";

// Mock Graph client factory
function createMockClient() {
  const mockGet = vi.fn();
  const mockTop = vi.fn().mockReturnThis();
  const mockFilter = vi.fn().mockReturnThis();
  const mockOrderby = vi.fn().mockReturnThis();

  const mockRequest: GraphRequest = {
    get: mockGet,
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    header: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    expand: vi.fn().mockReturnThis(),
    filter: mockFilter,
    top: mockTop,
    orderby: mockOrderby,
  };

  const client: GraphClient = {
    api: vi.fn().mockReturnValue(mockRequest),
  };

  return { client, mockGet, mockTop, mockFilter, mockOrderby };
}

describe("graph-teams", () => {
  describe("listTeams", () => {
    it("lists all joined teams", async () => {
      const { client, mockGet } = createMockClient();
      const teams: Team[] = [
        { id: "team1", displayName: "Team 1", name: "team1", webUrl: "https://teams.microsoft.com" },
        { id: "team2", displayName: "Team 2", name: "team2", webUrl: "https://teams.microsoft.com" },
      ];
      mockGet.mockResolvedValue({ value: teams });

      const result = await listTeams(client);

      expect(client.api).toHaveBeenCalledWith("/me/joinedTeams");
      expect(result).toHaveLength(2);
      expect(result[0]?.displayName).toBe("Team 1");
    });

    it("handles pagination", async () => {
      const { client, mockGet } = createMockClient();
      mockGet
        .mockResolvedValueOnce({
          value: [{ id: "t1", displayName: "Team 1", name: "t1", webUrl: "" }],
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/joinedTeams?$skiptoken=abc",
        })
        .mockResolvedValueOnce({
          value: [{ id: "t2", displayName: "Team 2", name: "t2", webUrl: "" }],
        });

      const result = await listTeams(client);

      expect(result).toHaveLength(2);
    });
  });

  describe("getTeam", () => {
    it("gets a specific team", async () => {
      const { client, mockGet } = createMockClient();
      const team: Team = { id: "team1", displayName: "My Team", name: "myteam", webUrl: "" };
      mockGet.mockResolvedValue(team);

      const result = await getTeam(client, "team1");

      expect(client.api).toHaveBeenCalledWith("/teams/team1");
      expect(result.displayName).toBe("My Team");
    });
  });

  describe("searchTeams", () => {
    it("filters teams by name", async () => {
      const { client, mockGet } = createMockClient();
      const teams: Team[] = [
        { id: "t1", displayName: "Engineering", name: "eng", webUrl: "" },
        { id: "t2", displayName: "Marketing", name: "mkt", webUrl: "" },
      ];
      mockGet.mockResolvedValue({ value: teams });

      const result = await searchTeams(client, "eng");

      expect(result).toHaveLength(1);
      expect(result[0]?.displayName).toBe("Engineering");
    });

    it("searches in description too", async () => {
      const { client, mockGet } = createMockClient();
      const teams: Team[] = [
        { id: "t1", displayName: "Team A", name: "a", description: "Engineering team", webUrl: "" },
      ];
      mockGet.mockResolvedValue({ value: teams });

      const result = await searchTeams(client, "engineering");

      expect(result).toHaveLength(1);
    });
  });

  describe("listChannels", () => {
    it("lists channels in a team", async () => {
      const { client, mockGet } = createMockClient();
      const channels: TeamsChannel[] = [
        { id: "ch1", displayName: "General" },
        { id: "ch2", displayName: "Random" },
      ];
      mockGet.mockResolvedValue({ value: channels });

      const result = await listChannels(client, "team1");

      expect(client.api).toHaveBeenCalledWith("/teams/team1/channels");
      expect(result).toHaveLength(2);
    });
  });

  describe("getChannel", () => {
    it("gets a specific channel", async () => {
      const { client, mockGet } = createMockClient();
      const channel: TeamsChannel = { id: "ch1", displayName: "General" };
      mockGet.mockResolvedValue(channel);

      const result = await getChannel(client, "team1", "ch1");

      expect(client.api).toHaveBeenCalledWith("/teams/team1/channels/ch1");
      expect(result.displayName).toBe("General");
    });
  });

  describe("getPrimaryChannel", () => {
    it("gets the primary channel", async () => {
      const { client, mockGet } = createMockClient();
      const channel: TeamsChannel = { id: "primary", displayName: "General" };
      mockGet.mockResolvedValue(channel);

      const result = await getPrimaryChannel(client, "team1");

      expect(client.api).toHaveBeenCalledWith("/teams/team1/primaryChannel");
      expect(result).toEqual(channel);
    });
  });

  describe("searchChannels", () => {
    it("filters channels by name", async () => {
      const { client, mockGet } = createMockClient();
      const channels: TeamsChannel[] = [
        { id: "ch1", displayName: "General" },
        { id: "ch2", displayName: "Announcements" },
      ];
      mockGet.mockResolvedValue({ value: channels });

      const result = await searchChannels(client, "team1", "announce");

      expect(result).toHaveLength(1);
      expect(result[0]?.displayName).toBe("Announcements");
    });
  });

  describe("listChannelMessages", () => {
    it("lists messages in a channel", async () => {
      const { client, mockGet } = createMockClient();
      const messages: TeamsMessage[] = [
        { id: "m1", messageType: "message", createdDateTime: "2024-01-01", body: { contentType: "text", content: "Hello" } },
        { id: "m2", messageType: "message", createdDateTime: "2024-01-02", body: { contentType: "text", content: "World" } },
      ];
      mockGet.mockResolvedValue({ value: messages });

      const result = await listChannelMessages(client, "team1", "ch1");

      expect(client.api).toHaveBeenCalledWith("/teams/team1/channels/ch1/messages");
      expect(result).toHaveLength(2);
    });

    it("applies options", async () => {
      const { client, mockGet, mockTop, mockFilter, mockOrderby } = createMockClient();
      mockGet.mockResolvedValue({ value: [] });

      await listChannelMessages(client, "team1", "ch1", {
        top: 10,
        filter: "from/user/id eq 'user1'",
        orderBy: "createdDateTime desc",
      });

      expect(mockTop).toHaveBeenCalledWith(10);
      expect(mockFilter).toHaveBeenCalledWith("from/user/id eq 'user1'");
      expect(mockOrderby).toHaveBeenCalledWith("createdDateTime desc");
    });
  });

  describe("getChannelMessage", () => {
    it("gets a specific message", async () => {
      const { client, mockGet } = createMockClient();
      const message: TeamsMessage = {
        id: "m1",
        messageType: "message",
        createdDateTime: "2024-01-01",
        body: { contentType: "text", content: "Hello" },
      };
      mockGet.mockResolvedValue(message);

      const result = await getChannelMessage(client, "team1", "ch1", "m1");

      expect(client.api).toHaveBeenCalledWith("/teams/team1/channels/ch1/messages/m1");
      expect(result.id).toBe("m1");
    });
  });

  describe("listChats", () => {
    it("lists all chats", async () => {
      const { client, mockGet } = createMockClient();
      const chats: TeamsChat[] = [
        { id: "chat1", chatType: "oneOnOne" },
        { id: "chat2", chatType: "group" },
      ];
      mockGet.mockResolvedValue({ value: chats });

      const result = await listChats(client);

      expect(client.api).toHaveBeenCalledWith("/me/chats");
      expect(result).toHaveLength(2);
    });
  });

  describe("getChat", () => {
    it("gets a specific chat", async () => {
      const { client, mockGet } = createMockClient();
      const chat: TeamsChat = { id: "chat1", chatType: "oneOnOne" };
      mockGet.mockResolvedValue(chat);

      const result = await getChat(client, "chat1");

      expect(client.api).toHaveBeenCalledWith("/chats/chat1");
      expect(result.chatType).toBe("oneOnOne");
    });
  });

  describe("findTeamByName", () => {
    it("finds team by exact name (case-insensitive)", async () => {
      const { client, mockGet } = createMockClient();
      const teams: Team[] = [
        { id: "t1", displayName: "Engineering", name: "eng", webUrl: "" },
        { id: "t2", displayName: "Marketing", name: "mkt", webUrl: "" },
      ];
      mockGet.mockResolvedValue({ value: teams });

      const result = await findTeamByName(client, "ENGINEERING");

      expect(result?.id).toBe("t1");
    });

    it("returns undefined when not found", async () => {
      const { client, mockGet } = createMockClient();
      mockGet.mockResolvedValue({ value: [] });

      const result = await findTeamByName(client, "NonExistent");

      expect(result).toBeUndefined();
    });
  });

  describe("findChannelByName", () => {
    it("finds channel by exact name (case-insensitive)", async () => {
      const { client, mockGet } = createMockClient();
      const channels: TeamsChannel[] = [
        { id: "ch1", displayName: "General" },
        { id: "ch2", displayName: "Random" },
      ];
      mockGet.mockResolvedValue({ value: channels });

      const result = await findChannelByName(client, "team1", "general");

      expect(result?.id).toBe("ch1");
    });
  });

  describe("resolveTeamAndChannel", () => {
    it("resolves team/channel path", async () => {
      const { client, mockGet } = createMockClient();
      const teams: Team[] = [{ id: "t1", displayName: "Engineering", name: "eng", webUrl: "" }];
      const channels: TeamsChannel[] = [{ id: "ch1", displayName: "General" }];
      mockGet
        .mockResolvedValueOnce({ value: teams })
        .mockResolvedValueOnce({ value: channels });

      const result = await resolveTeamAndChannel(client, "Engineering/General");

      expect(result.team.id).toBe("t1");
      expect(result.channel.id).toBe("ch1");
    });

    it("uses primary channel when no channel specified", async () => {
      const { client, mockGet } = createMockClient();
      const teams: Team[] = [{ id: "t1", displayName: "Engineering", name: "eng", webUrl: "" }];
      const primaryChannel: TeamsChannel = { id: "primary", displayName: "General" };
      mockGet
        .mockResolvedValueOnce({ value: teams })
        .mockResolvedValueOnce(primaryChannel);

      const result = await resolveTeamAndChannel(client, "Engineering");

      expect(result.channel.id).toBe("primary");
    });

    it("throws error for missing team", async () => {
      const { client, mockGet } = createMockClient();
      mockGet.mockResolvedValue({ value: [] });

      await expect(resolveTeamAndChannel(client, "NonExistent/Channel")).rejects.toThrow(
        'Team "NonExistent" not found',
      );
    });
  });

  describe("buildChannelMessageUrl", () => {
    it("builds URL for channel", () => {
      const url = buildChannelMessageUrl("team1", "channel1");
      expect(url).toContain("teams.microsoft.com");
      expect(url).toContain("channel1");
      expect(url).toContain("groupId=team1");
    });

    it("includes message ID when provided", () => {
      const url = buildChannelMessageUrl("team1", "channel1", "msg1");
      expect(url).toContain("messageId=msg1");
    });
  });

  describe("buildChatUrl", () => {
    it("builds URL for chat", () => {
      const url = buildChatUrl("chat123");
      expect(url).toContain("teams.microsoft.com");
      expect(url).toContain("chat123");
    });
  });

  describe("extractMessageText", () => {
    it("extracts text content", () => {
      const message: TeamsMessage = {
        id: "m1",
        messageType: "message",
        createdDateTime: "2024-01-01",
        body: { contentType: "text", content: "Hello world" },
      };
      expect(extractMessageText(message)).toBe("Hello world");
    });

    it("strips HTML from html content", () => {
      const message: TeamsMessage = {
        id: "m1",
        messageType: "message",
        createdDateTime: "2024-01-01",
        body: { contentType: "html", content: "<p>Hello <strong>world</strong></p>" },
      };
      expect(extractMessageText(message)).toBe("Hello world");
    });

    it("strips mention tags", () => {
      const message: TeamsMessage = {
        id: "m1",
        messageType: "message",
        createdDateTime: "2024-01-01",
        body: { contentType: "html", content: "<at>@Bot</at> Hello" },
      };
      expect(extractMessageText(message)).toBe("Hello");
    });
  });

  describe("isUserMentioned", () => {
    it("returns true when user is mentioned", () => {
      const message: TeamsMessage = {
        id: "m1",
        messageType: "message",
        createdDateTime: "2024-01-01",
        body: { contentType: "text", content: "Hello" },
        mentions: [{ id: 0, mentioned: { id: "user123" } }],
      };
      expect(isUserMentioned(message, "user123")).toBe(true);
    });

    it("returns false when user is not mentioned", () => {
      const message: TeamsMessage = {
        id: "m1",
        messageType: "message",
        createdDateTime: "2024-01-01",
        body: { contentType: "text", content: "Hello" },
        mentions: [{ id: 0, mentioned: { id: "other" } }],
      };
      expect(isUserMentioned(message, "user123")).toBe(false);
    });

    it("returns false when no mentions", () => {
      const message: TeamsMessage = {
        id: "m1",
        messageType: "message",
        createdDateTime: "2024-01-01",
        body: { contentType: "text", content: "Hello" },
      };
      expect(isUserMentioned(message, "user123")).toBe(false);
    });
  });

  describe("isGraphError", () => {
    it("identifies Graph API error format", () => {
      const error = { error: { code: "NotFound", message: "Not found" } };
      expect(isGraphError(error)).toBe(true);
    });

    it("checks for specific error code", () => {
      const error = { error: { code: "NotFound", message: "Not found" } };
      expect(isGraphError(error, "NotFound")).toBe(true);
      expect(isGraphError(error, "BadRequest")).toBe(false);
    });

    it("returns false for non-errors", () => {
      expect(isGraphError(null)).toBe(false);
      expect(isGraphError("string")).toBe(false);
      expect(isGraphError({})).toBe(false);
    });
  });
});
