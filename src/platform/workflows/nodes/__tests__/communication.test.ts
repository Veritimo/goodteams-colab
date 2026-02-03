/**
 * Communication Node Executor Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  EmailSender,
  TeamsClient,
  ChatClient,
  ExecutionContext,
  CommunicationNodeConfig,
} from "../types.js";
import {
  executeCommunicationNode,
  validateCommunicationConfig,
  setDefaultEmailSender,
  setDefaultTeamsClient,
  setDefaultChatClient,
  getEmailSender,
  getTeamsClient,
  getChatClient,
  createStubEmailSender,
  createStubTeamsClient,
  createStubChatClient,
} from "../communication.js";
import { NodeExecutionError } from "../types.js";

// Helper to create execution context
function createContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    inputs: {},
    nodeOutputs: {},
    globalVariables: {},
    ...overrides,
  };
}

// Create mock email sender
function createMockEmailSender(): EmailSender {
  return {
    send: vi.fn().mockResolvedValue(undefined),
  };
}

// Create mock Teams client
function createMockTeamsClient(): TeamsClient {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
  };
}

// Create mock chat client
function createMockChatClient(): ChatClient {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Communication Node Executor", () => {
  let originalEmailSender: EmailSender | undefined;
  let originalTeamsClient: TeamsClient | undefined;
  let originalChatClient: ChatClient | undefined;

  beforeEach(() => {
    originalEmailSender = getEmailSender();
    originalTeamsClient = getTeamsClient();
    originalChatClient = getChatClient();
  });

  afterEach(() => {
    if (originalEmailSender) setDefaultEmailSender(originalEmailSender);
    if (originalTeamsClient) setDefaultTeamsClient(originalTeamsClient);
    if (originalChatClient) setDefaultChatClient(originalChatClient);
  });

  describe("Email Communication", () => {
    it("should send email successfully", async () => {
      const mockSender = createMockEmailSender();
      const config: CommunicationNodeConfig = {
        method: "email",
        to: "test@example.com",
        subject: "Test Subject",
        body: "Hello, World!",
      };
      const context = createContext();

      const result = await executeCommunicationNode(config, context, {
        emailSender: mockSender,
      });

      expect(result.sent).toBe(true);
      expect(result.method).toBe("email");
      expect(result.to).toBe("test@example.com");
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(mockSender.send).toHaveBeenCalledWith({
        to: "test@example.com",
        subject: "Test Subject",
        body: "Hello, World!",
        html: "Hello, World!",
        from: { name: "Workflow Notification", email: "noreply@example.com" },
      });
    });

    it("should resolve variables in email body", async () => {
      const mockSender = createMockEmailSender();
      const config: CommunicationNodeConfig = {
        method: "email",
        to: "test@example.com",
        subject: "Report for {{inputs.region}}",
        body: "Status: {{nodes.report.status}}",
      };
      const context = createContext({
        inputs: { region: "West" },
        nodeOutputs: { report: { status: "Complete" } },
      });

      await executeCommunicationNode(config, context, { emailSender: mockSender });

      expect(mockSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Report for West",
          body: "Status: Complete",
        }),
      );
    });

    it("should use custom from address when provided", async () => {
      const mockSender = createMockEmailSender();
      const config: CommunicationNodeConfig = {
        method: "email",
        to: "test@example.com",
        body: "Test",
        fromName: "Custom Sender",
        fromEmail: "custom@example.com",
      };
      const context = createContext();

      await executeCommunicationNode(config, context, { emailSender: mockSender });

      expect(mockSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: { name: "Custom Sender", email: "custom@example.com" },
        }),
      );
    });

    it("should throw error when email sender not configured", async () => {
      const config: CommunicationNodeConfig = {
        method: "email",
        to: "test@example.com",
        body: "Test",
      };
      const context = createContext();

      await expect(executeCommunicationNode(config, context)).rejects.toThrow(
        "Email sender not configured",
      );
    });

    it("should throw error when 'to' is missing for email", async () => {
      const mockSender = createMockEmailSender();
      const config: CommunicationNodeConfig = {
        method: "email",
        body: "Test",
      };
      const context = createContext();

      await expect(
        executeCommunicationNode(config, context, { emailSender: mockSender }),
      ).rejects.toThrow("Missing 'to' for email communication");
    });

    it("should handle email sending errors", async () => {
      const mockSender: EmailSender = {
        send: vi.fn().mockRejectedValue(new Error("SMTP connection failed")),
      };
      const config: CommunicationNodeConfig = {
        method: "email",
        to: "test@example.com",
        body: "Test",
      };
      const context = createContext();

      await expect(
        executeCommunicationNode(config, context, { emailSender: mockSender }),
      ).rejects.toThrow("Failed to send email: SMTP connection failed");
    });
  });

  describe("Teams Communication", () => {
    it("should send Teams message successfully", async () => {
      const mockClient = createMockTeamsClient();
      const config: CommunicationNodeConfig = {
        method: "teams",
        teamId: "team-123",
        channelId: "channel-456",
        body: "Hello from workflow!",
      };
      const context = createContext();

      const result = await executeCommunicationNode(config, context, {
        teamsClient: mockClient,
      });

      expect(result.sent).toBe(true);
      expect(result.method).toBe("teams");
      expect(result.teamId).toBe("team-123");
      expect(result.channelId).toBe("channel-456");
      expect(mockClient.sendMessage).toHaveBeenCalledWith({
        teamId: "team-123",
        channelId: "channel-456",
        message: "Hello from workflow!",
      });
    });

    it("should use 'to' and 'subject' as fallbacks for teamId and channelId", async () => {
      const mockClient = createMockTeamsClient();
      const config: CommunicationNodeConfig = {
        method: "teams",
        to: "team-123", // fallback for teamId
        subject: "channel-456", // fallback for channelId
        body: "Test message",
      };
      const context = createContext();

      await executeCommunicationNode(config, context, { teamsClient: mockClient });

      expect(mockClient.sendMessage).toHaveBeenCalledWith({
        teamId: "team-123",
        channelId: "channel-456",
        message: "Test message",
      });
    });

    it("should throw error when Teams client not configured", async () => {
      const config: CommunicationNodeConfig = {
        method: "teams",
        teamId: "team-123",
        channelId: "channel-456",
        body: "Test",
      };
      const context = createContext();

      await expect(executeCommunicationNode(config, context)).rejects.toThrow(
        "Teams client not configured",
      );
    });

    it("should throw error when teamId is missing", async () => {
      const mockClient = createMockTeamsClient();
      const config: CommunicationNodeConfig = {
        method: "teams",
        channelId: "channel-456",
        body: "Test",
      };
      const context = createContext();

      await expect(
        executeCommunicationNode(config, context, { teamsClient: mockClient }),
      ).rejects.toThrow("Missing 'teamId'");
    });

    it("should throw error when channelId is missing", async () => {
      const mockClient = createMockTeamsClient();
      const config: CommunicationNodeConfig = {
        method: "teams",
        teamId: "team-123",
        body: "Test",
      };
      const context = createContext();

      await expect(
        executeCommunicationNode(config, context, { teamsClient: mockClient }),
      ).rejects.toThrow("Missing 'channelId'");
    });

    it("should handle Teams sending errors", async () => {
      const mockClient: TeamsClient = {
        sendMessage: vi.fn().mockRejectedValue(new Error("Teams API error")),
      };
      const config: CommunicationNodeConfig = {
        method: "teams",
        teamId: "team-123",
        channelId: "channel-456",
        body: "Test",
      };
      const context = createContext();

      await expect(
        executeCommunicationNode(config, context, { teamsClient: mockClient }),
      ).rejects.toThrow("Failed to send Teams message: Teams API error");
    });
  });

  describe("Chat Communication", () => {
    it("should send chat message successfully", async () => {
      const mockClient = createMockChatClient();
      const config: CommunicationNodeConfig = {
        method: "chat",
        conversationId: "conv-123",
        body: "Hello from workflow!",
      };
      const context = createContext();

      const result = await executeCommunicationNode(config, context, {
        chatClient: mockClient,
      });

      expect(result.sent).toBe(true);
      expect(result.method).toBe("chat");
      expect(result.conversationId).toBe("conv-123");
      expect(mockClient.sendMessage).toHaveBeenCalledWith({
        conversationId: "conv-123",
        message: "Hello from workflow!",
      });
    });

    it("should throw error when chat client not configured", async () => {
      const config: CommunicationNodeConfig = {
        method: "chat",
        conversationId: "conv-123",
        body: "Test",
      };
      const context = createContext();

      await expect(executeCommunicationNode(config, context)).rejects.toThrow(
        "Chat client not configured",
      );
    });

    it("should throw error when conversationId is missing", async () => {
      const mockClient = createMockChatClient();
      const config: CommunicationNodeConfig = {
        method: "chat",
        body: "Test",
      };
      const context = createContext();

      await expect(
        executeCommunicationNode(config, context, { chatClient: mockClient }),
      ).rejects.toThrow("Missing 'conversationId'");
    });
  });

  describe("Common Behavior", () => {
    it("should throw error when method is missing", async () => {
      const config = { body: "Test" } as CommunicationNodeConfig;
      const context = createContext();

      await expect(executeCommunicationNode(config, context)).rejects.toThrow("Missing 'method'");
    });

    it("should throw error when body is missing", async () => {
      const config = { method: "email", to: "test@example.com" } as CommunicationNodeConfig;
      const context = createContext();

      await expect(executeCommunicationNode(config, context)).rejects.toThrow("Missing 'body'");
    });

    it("should throw error for unsupported method", async () => {
      const config = {
        method: "sms" as any,
        body: "Test",
      } as CommunicationNodeConfig;
      const context = createContext();

      await expect(executeCommunicationNode(config, context)).rejects.toThrow(
        "Unsupported communication method: sms",
      );
    });
  });

  describe("validateCommunicationConfig", () => {
    it("should return empty array for valid email config", () => {
      const config: CommunicationNodeConfig = {
        method: "email",
        to: "test@example.com",
        body: "Test",
      };
      expect(validateCommunicationConfig(config)).toEqual([]);
    });

    it("should require method", () => {
      const config = { body: "Test" } as CommunicationNodeConfig;
      expect(validateCommunicationConfig(config)).toContain("Method is required");
    });

    it("should require body", () => {
      const config = { method: "email", to: "test@example.com" } as CommunicationNodeConfig;
      expect(validateCommunicationConfig(config)).toContain("Body is required");
    });

    it("should require 'to' for email", () => {
      const config: CommunicationNodeConfig = { method: "email", body: "Test" };
      expect(validateCommunicationConfig(config)).toContain(
        "'to' is required for email communication",
      );
    });

    it("should require teamId for teams", () => {
      const config: CommunicationNodeConfig = {
        method: "teams",
        channelId: "channel",
        body: "Test",
      };
      expect(validateCommunicationConfig(config)).toContain(
        "'teamId' or 'to' is required for Teams communication",
      );
    });

    it("should require channelId for teams", () => {
      const config: CommunicationNodeConfig = {
        method: "teams",
        teamId: "team",
        body: "Test",
      };
      expect(validateCommunicationConfig(config)).toContain(
        "'channelId' or 'subject' is required for Teams communication",
      );
    });

    it("should require conversationId for chat", () => {
      const config: CommunicationNodeConfig = { method: "chat", body: "Test" };
      expect(validateCommunicationConfig(config)).toContain(
        "'conversationId' is required for chat communication",
      );
    });

    it("should reject invalid method", () => {
      const config = { method: "invalid" as any, body: "Test" } as CommunicationNodeConfig;
      expect(validateCommunicationConfig(config)).toContain(
        "Invalid method 'invalid'. Must be one of: email, teams, chat",
      );
    });
  });

  describe("Stub Clients", () => {
    it("should create stub email sender", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const sender = createStubEmailSender();

      await sender.send({
        to: "test@example.com",
        subject: "Test",
        body: "Hello",
        from: { name: "Sender", email: "sender@example.com" },
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should create stub Teams client", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const client = createStubTeamsClient();

      await client.sendMessage({
        teamId: "team",
        channelId: "channel",
        message: "Hello",
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should create stub chat client", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const client = createStubChatClient();

      await client.sendMessage({
        conversationId: "conv",
        message: "Hello",
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
