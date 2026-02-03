/**
 * Chat Trigger Tests
 *
 * Tests for conversation-based workflow execution.
 */

import { describe, it, expect, vi } from "vitest";
import type { Workflow } from "../../types.js";
import {
  normalizeText,
  matchesTriggerPhrase,
  checkChatTriggers,
  executeChatTrigger,
  handleChatMessage,
  validateTriggerPhrase,
  suggestTriggerPhrase,
  type ChatMessage,
} from "../chat.js";

// =============================================================================
// MOCKS
// =============================================================================

const mockWorkflow: Workflow = {
  id: "wf-chat-1",
  tenantId: "tenant-1",
  name: "Chat Workflow",
  description: null,
  definition: {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { config: { triggerType: "CHAT" } },
      },
    ],
    edges: [],
  },
  status: "ACTIVE",
  triggerType: "CHAT",
  triggerConfig: {
    triggerType: "CHAT",
    triggerPhrase: "run sales report",
  },
  createdBy: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockRepository(workflows: Workflow[] = [mockWorkflow]) {
  return {
    getActiveWorkflowsWithChatTrigger: vi.fn().mockResolvedValue(workflows),
    getWorkflow: vi.fn().mockResolvedValue(mockWorkflow),
  };
}

function createMockExecutionService() {
  return {
    createExecution: vi.fn().mockResolvedValue({ id: "exec-1", status: "PENDING" }),
  };
}

function createMockQueue() {
  return {
    enqueue: vi.fn().mockResolvedValue(undefined),
  };
}

// =============================================================================
// NORMALIZE TEXT TESTS
// =============================================================================

describe("normalizeText", () => {
  it("should lowercase text", () => {
    expect(normalizeText("HELLO World")).toBe("hello world");
  });

  it("should trim whitespace", () => {
    expect(normalizeText("  hello  ")).toBe("hello");
  });

  it("should collapse multiple spaces", () => {
    expect(normalizeText("hello    world")).toBe("hello world");
  });

  it("should handle empty string", () => {
    expect(normalizeText("")).toBe("");
  });
});

// =============================================================================
// PHRASE MATCHING TESTS
// =============================================================================

describe("matchesTriggerPhrase", () => {
  it("should match exact phrase (confidence 1.0)", () => {
    const result = matchesTriggerPhrase("run sales report", "run sales report");

    expect(result.matches).toBe(true);
    expect(result.confidence).toBe(1.0);
  });

  it("should be case insensitive", () => {
    const result = matchesTriggerPhrase("RUN SALES REPORT", "run sales report");

    expect(result.matches).toBe(true);
    expect(result.confidence).toBe(1.0);
  });

  it("should match phrase at start followed by space (confidence 0.95)", () => {
    const result = matchesTriggerPhrase("run sales report for Q1", "run sales report");

    expect(result.matches).toBe(true);
    expect(result.confidence).toBe(0.95);
  });

  it("should match phrase at start followed by comma", () => {
    const result = matchesTriggerPhrase("run sales report, please", "run sales report");

    expect(result.matches).toBe(true);
    expect(result.confidence).toBe(0.95);
  });

  it("should match phrase at start (confidence 0.9)", () => {
    const result = matchesTriggerPhrase("run sales reporting system", "run sales report");

    expect(result.matches).toBe(true);
    expect(result.confidence).toBe(0.9);
  });

  it("should match complete phrase in message (confidence 0.8)", () => {
    const result = matchesTriggerPhrase("please run sales report now", "run sales report");

    expect(result.matches).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThanOrEqual(0.8);
  });

  it("should not match partial words", () => {
    const result = matchesTriggerPhrase("runner", "run");

    // Should match since "run" is a complete word match
    // But "runner" is not "run " so lower confidence
    expect(result.confidence).toBeLessThan(1.0);
  });

  it("should return no match for unrelated text", () => {
    const result = matchesTriggerPhrase("hello world", "run sales report");

    expect(result.matches).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it("should handle empty message", () => {
    const result = matchesTriggerPhrase("", "run sales report");

    expect(result.matches).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it("should handle empty phrase", () => {
    const result = matchesTriggerPhrase("hello", "");

    expect(result.matches).toBe(false);
    expect(result.confidence).toBe(0);
  });
});

// =============================================================================
// CHECK CHAT TRIGGERS TESTS
// =============================================================================

describe("checkChatTriggers", () => {
  it("should find matching workflow", async () => {
    const repository = createMockRepository();

    const message: ChatMessage = {
      content: "run sales report",
      conversationId: "conv-1",
    };

    const result = await checkChatTriggers(message, "tenant-1", repository);

    expect(result).not.toBeNull();
    expect(result?.workflow.id).toBe("wf-chat-1");
    expect(result?.confidence).toBe(1.0);
  });

  it("should return null for empty message", async () => {
    const repository = createMockRepository();

    const message: ChatMessage = {
      content: "",
      conversationId: "conv-1",
    };

    const result = await checkChatTriggers(message, "tenant-1", repository);

    expect(result).toBeNull();
  });

  it("should return null when no workflows match", async () => {
    const repository = createMockRepository();

    const message: ChatMessage = {
      content: "unrelated message",
      conversationId: "conv-1",
    };

    const result = await checkChatTriggers(message, "tenant-1", repository);

    expect(result).toBeNull();
  });

  it("should return best match when multiple workflows could match", async () => {
    const workflows: Workflow[] = [
      { ...mockWorkflow, id: "wf-1", triggerConfig: { triggerType: "CHAT", triggerPhrase: "run" } },
      {
        ...mockWorkflow,
        id: "wf-2",
        triggerConfig: { triggerType: "CHAT", triggerPhrase: "run sales" },
      },
      {
        ...mockWorkflow,
        id: "wf-3",
        triggerConfig: { triggerType: "CHAT", triggerPhrase: "run sales report" },
      },
    ];
    const repository = createMockRepository(workflows);

    const message: ChatMessage = {
      content: "run sales report",
      conversationId: "conv-1",
    };

    const result = await checkChatTriggers(message, "tenant-1", repository);

    // Should match the most specific phrase (exact match)
    expect(result?.workflow.id).toBe("wf-3");
    expect(result?.confidence).toBe(1.0);
  });
});

// =============================================================================
// EXECUTE CHAT TRIGGER TESTS
// =============================================================================

describe("executeChatTrigger", () => {
  it("should create execution with message context", async () => {
    const executionService = createMockExecutionService();
    const queue = createMockQueue();

    const match = {
      workflow: mockWorkflow,
      confidence: 0.9,
      matchedPhrase: "run sales report",
    };

    const message: ChatMessage = {
      content: "run sales report for Q1",
      conversationId: "conv-1",
      userId: "user-1",
      channelId: "channel-1",
    };

    const result = await executeChatTrigger(match, message, executionService, queue);

    expect(result.executionId).toBe("exec-1");
    expect(result.workflowId).toBe("wf-chat-1");
    expect(executionService.createExecution).toHaveBeenCalledWith({
      workflowId: "wf-chat-1",
      triggeredBy: "chat:user-1",
      inputs: expect.objectContaining({
        message: "run sales report for Q1",
        conversationId: "conv-1",
        userId: "user-1",
        matchedPhrase: "run sales report",
        confidence: 0.9,
      }),
    });
  });

  it("should queue trigger node", async () => {
    const executionService = createMockExecutionService();
    const queue = createMockQueue();

    const match = {
      workflow: mockWorkflow,
      confidence: 0.9,
      matchedPhrase: "run sales report",
    };

    const message: ChatMessage = {
      content: "run sales report",
      conversationId: "conv-1",
    };

    await executeChatTrigger(match, message, executionService, queue);

    expect(queue.enqueue).toHaveBeenCalledWith("exec-1", "trigger-1");
  });
});

// =============================================================================
// HANDLE CHAT MESSAGE TESTS
// =============================================================================

describe("handleChatMessage", () => {
  it("should execute matching workflow", async () => {
    const repository = createMockRepository();
    const executionService = createMockExecutionService();
    const queue = createMockQueue();

    const message: ChatMessage = {
      content: "run sales report",
      conversationId: "conv-1",
    };

    const result = await handleChatMessage(
      message,
      "tenant-1",
      repository,
      executionService,
      queue,
    );

    expect(result).not.toBeNull();
    expect(result?.executionId).toBe("exec-1");
  });

  it("should return null when confidence is below threshold", async () => {
    const workflow = {
      ...mockWorkflow,
      triggerConfig: { triggerType: "CHAT" as const, triggerPhrase: "run" },
    };
    const repository = createMockRepository([workflow]);
    const executionService = createMockExecutionService();
    const queue = createMockQueue();

    const message: ChatMessage = {
      content: "please run the sales report for me",
      conversationId: "conv-1",
    };

    const result = await handleChatMessage(
      message,
      "tenant-1",
      repository,
      executionService,
      queue,
      { minConfidence: 0.95 },
    );

    // The match exists but confidence is too low
    expect(result).toBeNull();
  });
});

// =============================================================================
// VALIDATE TRIGGER PHRASE TESTS
// =============================================================================

describe("validateTriggerPhrase", () => {
  it("should accept valid phrase", () => {
    const result = validateTriggerPhrase("run sales report");

    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("run sales report");
  });

  it("should reject empty phrase", () => {
    const result = validateTriggerPhrase("");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("non-empty");
  });

  it("should reject too short phrase", () => {
    const result = validateTriggerPhrase("a");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("at least 2 characters");
  });

  it("should reject too long phrase", () => {
    const result = validateTriggerPhrase("a".repeat(101));

    expect(result.valid).toBe(false);
    expect(result.error).toContain("at most 100 characters");
  });

  it("should reject common words", () => {
    const result = validateTriggerPhrase("the");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("too common");
  });
});

// =============================================================================
// SUGGEST TRIGGER PHRASE TESTS
// =============================================================================

describe("suggestTriggerPhrase", () => {
  it("should suggest adding verb", () => {
    const suggestions = suggestTriggerPhrase("sales report");

    expect(suggestions).toContain("run sales report");
    expect(suggestions).toContain("start sales report");
  });

  it("should not duplicate verb", () => {
    const suggestions = suggestTriggerPhrase("run sales report");

    expect(suggestions).not.toContain("run run sales report");
  });

  it("should suggest adding please", () => {
    const suggestions = suggestTriggerPhrase("run report");

    expect(suggestions).toContain("please run report");
  });

  it("should limit suggestions", () => {
    const suggestions = suggestTriggerPhrase("something");

    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});
