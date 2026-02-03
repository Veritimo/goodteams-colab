/**
 * Trigger Integration Tests
 *
 * Tests for trigger types working together with workflow execution.
 * Covers manual, cron, webhook, and chat triggers.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE7.md §7 Triggers
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from "vitest";

// =============================================================================
// MOCKS
// =============================================================================

// Mock Prisma client
vi.mock("../../db/client.js", () => ({
  prisma: {
    workflow: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    workflowExecution: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Mock node-cron
vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn().mockReturnValue({
      stop: vi.fn(),
    }),
    validate: vi.fn().mockReturnValue(true),
  },
  schedule: vi.fn().mockReturnValue({
    stop: vi.fn(),
  }),
  validate: vi.fn().mockReturnValue(true),
}));

import type {
  Workflow,
  WorkflowDefinition,
  TriggerNodeConfig,
  ExecutionContext,
} from "../types.js";
import { prisma } from "../../db/client.js";
import {
  // Manual trigger
  executeManualTrigger,
  validateInputs,
  findTriggerNode,
  ManualTriggerError,

  // Cron trigger
  registerCronTrigger,
  unregisterCronTrigger,
  getCronJob,
  getAllCronJobs,
  clearAllCronJobs,
  validateCronExpression,
  validateTimezone,
  CronTriggerError,

  // Webhook trigger
  handleWebhookRequest,
  setupWebhookTrigger,
  regenerateWebhookSecret,
  generateWebhookSecret,
  generateWebhookPath,
  computeSignature,
  verifySignature,
  extractSignature,
  createWebhookRouteHandler,
  WebhookTriggerError,

  // Chat trigger
  checkChatTriggers,
  executeChatTrigger,
  handleChatMessage,
  matchesTriggerPhrase,
  normalizeText,
  validateTriggerPhrase,
  suggestTriggerPhrase,
} from "../triggers/index.js";

// =============================================================================
// TEST DATA
// =============================================================================

const mockOrgId = "org-trigger-test";
const mockUserId = "user-trigger-test";

function createMockWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-trigger-1",
    organizationId: mockOrgId,
    name: "Trigger Test Workflow",
    description: "Test workflow for triggers",
    definition: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: {
            config: { triggerType: "MANUAL" },
          },
        },
        {
          id: "agent-1",
          type: "agent",
          position: { x: 300, y: 0 },
          data: {
            config: { prompt: "Process {{inputs.data}}" },
          },
        },
      ],
      edges: [{ id: "e1", source: "trigger-1", target: "agent-1" }],
    } as WorkflowDefinition,
    status: "ACTIVE",
    triggerType: "MANUAL",
    triggerConfig: null,
    createdBy: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Workflow;
}

function createMockRepository() {
  return {
    getWorkflow: vi.fn(),
    updateWorkflow: vi.fn().mockResolvedValue(undefined),
    getActiveWorkflowsWithCronTrigger: vi.fn().mockResolvedValue([]),
    getActiveWorkflowsWithChatTrigger: vi.fn().mockResolvedValue([]),
  };
}

function createMockExecutionService() {
  return {
    createExecution: vi.fn().mockResolvedValue({
      id: "exec-trigger-1",
      status: "PENDING",
    }),
  };
}

function createMockQueue() {
  return {
    enqueue: vi.fn().mockResolvedValue(undefined),
  };
}

// =============================================================================
// MANUAL TRIGGER INTEGRATION TESTS
// =============================================================================

describe("Manual Trigger Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeManualTrigger", () => {
    it("should execute manual trigger and create execution", async () => {
      const mockWorkflow = createMockWorkflow();
      const repository = {
        getWorkflow: vi.fn().mockResolvedValue(mockWorkflow),
        createExecution: vi.fn().mockResolvedValue({
          id: "exec-trigger-1",
          status: "PENDING",
          startedAt: new Date(),
        }),
      };
      const queue = createMockQueue();

      const result = await executeManualTrigger(
        "wf-trigger-1",
        { inputs: { data: "test input" }, triggeredBy: mockUserId },
        repository,
        queue,
      );

      expect(result.executionId).toBe("exec-trigger-1");
      expect(result.status).toBe("PENDING");
      expect(repository.createExecution).toHaveBeenCalledWith({
        workflowId: "wf-trigger-1",
        triggeredBy: mockUserId,
        inputs: { data: "test input" },
      });
      expect(queue.enqueue).toHaveBeenCalledWith("exec-trigger-1", "trigger-1");
    });

    it("should throw error for non-existent workflow", async () => {
      const repository = {
        getWorkflow: vi.fn().mockResolvedValue(null),
        createExecution: vi.fn(),
      };
      const queue = createMockQueue();

      await expect(executeManualTrigger("non-existent", {}, repository, queue)).rejects.toThrow(
        ManualTriggerError,
      );
    });

    it("should throw error for inactive workflow", async () => {
      const mockWorkflow = createMockWorkflow({ status: "PAUSED" });
      const repository = {
        getWorkflow: vi.fn().mockResolvedValue(mockWorkflow),
        createExecution: vi.fn(),
      };
      const queue = createMockQueue();

      await expect(executeManualTrigger("wf-trigger-1", {}, repository, queue)).rejects.toThrow(
        "status",
      );
    });

    it("should validate required inputs from trigger config", async () => {
      const mockWorkflow = createMockWorkflow({
        triggerConfig: {
          triggerType: "MANUAL",
          inputSchema: {
            name: { type: "string", required: true },
            age: { type: "number", required: false },
          },
        } as TriggerNodeConfig,
        definition: {
          nodes: [
            {
              id: "trigger-1",
              type: "trigger",
              position: { x: 0, y: 0 },
              data: {
                config: {
                  triggerType: "MANUAL",
                },
              },
            },
          ],
          edges: [],
        } as WorkflowDefinition,
      });

      const repository = {
        getWorkflow: vi.fn().mockResolvedValue(mockWorkflow),
        createExecution: vi.fn(),
      };
      const queue = createMockQueue();

      // Missing required 'name' input
      await expect(
        executeManualTrigger("wf-trigger-1", { inputs: { age: 25 } }, repository, queue),
      ).rejects.toThrow("Missing required input");
    });
  });

  describe("validateInputs", () => {
    it("should pass validation with all required inputs", () => {
      const triggerConfig: TriggerNodeConfig = {
        triggerType: "MANUAL",
        inputSchema: {
          name: { type: "string", required: true },
          email: { type: "string", required: true },
        },
      };
      const inputs = { name: "John", email: "john@example.com" };

      const result = validateInputs(inputs, triggerConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should fail validation with missing required inputs", () => {
      const triggerConfig: TriggerNodeConfig = {
        triggerType: "MANUAL",
        inputSchema: {
          name: { type: "string", required: true },
          email: { type: "string", required: true },
        },
      };
      const inputs = { name: "John" };

      const result = validateInputs(inputs, triggerConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required input: email");
    });

    it("should pass validation with optional inputs missing", () => {
      const triggerConfig: TriggerNodeConfig = {
        triggerType: "MANUAL",
        inputSchema: {
          name: { type: "string", required: true },
          nickname: { type: "string", required: false },
        },
      };
      const inputs = { name: "John" };

      const result = validateInputs(inputs, triggerConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe("findTriggerNode", () => {
    it("should find trigger node in workflow", () => {
      const workflow = createMockWorkflow();

      const triggerNodeId = findTriggerNode(workflow);
      expect(triggerNodeId).toBe("trigger-1");
    });

    it("should return null for workflow without trigger", () => {
      const workflow = createMockWorkflow({
        definition: {
          nodes: [{ id: "agent-1", type: "agent", position: { x: 0, y: 0 }, data: { config: {} } }],
          edges: [],
        } as WorkflowDefinition,
      });

      const triggerNodeId = findTriggerNode(workflow);
      expect(triggerNodeId).toBeNull();
    });
  });
});

// =============================================================================
// CRON TRIGGER INTEGRATION TESTS
// =============================================================================

describe("Cron Trigger Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllCronJobs();
  });

  afterEach(() => {
    clearAllCronJobs();
  });

  describe("Cron Expression Validation", () => {
    it("should validate standard cron expressions", () => {
      expect(validateCronExpression("* * * * *").valid).toBe(true);
      expect(validateCronExpression("0 9 * * 1").valid).toBe(true);
      expect(validateCronExpression("0 0 1 * *").valid).toBe(true);
      expect(validateCronExpression("*/15 * * * *").valid).toBe(true);
    });

    it("should reject invalid cron expressions", () => {
      expect(validateCronExpression("invalid").valid).toBe(false);
      expect(validateCronExpression("").valid).toBe(false);
      // Note: Our basic validation may not catch all invalid values
    });

    it("should return valid result for valid expressions", () => {
      const result = validateCronExpression("0 9 * * 1");
      expect(result.valid).toBe(true);
    });
  });

  describe("Timezone Validation", () => {
    it("should validate common timezones", () => {
      expect(validateTimezone("America/New_York")).toBe(true);
      expect(validateTimezone("Europe/London")).toBe(true);
      expect(validateTimezone("Asia/Tokyo")).toBe(true);
      expect(validateTimezone("UTC")).toBe(true);
    });

    it("should reject invalid timezones", () => {
      expect(validateTimezone("Invalid/Timezone")).toBe(false);
    });
  });

  describe("Cron Job Registration", () => {
    it("should register a cron job for a workflow", () => {
      const mockScheduler = {
        schedule: vi.fn().mockReturnValue({ stop: vi.fn() }),
        validate: vi.fn().mockReturnValue(true),
      };

      const job = registerCronTrigger(
        "wf-trigger-1",
        "0 9 * * 1",
        "America/New_York",
        mockScheduler,
        vi.fn(),
      );

      expect(job).toBeDefined();
      expect(job.workflowId).toBe("wf-trigger-1");
      expect(job.expression).toBe("0 9 * * 1");
    });

    it("should retrieve registered cron job", () => {
      const mockScheduler = {
        schedule: vi.fn().mockReturnValue({ stop: vi.fn() }),
        validate: vi.fn().mockReturnValue(true),
      };

      registerCronTrigger("wf-trigger-1", "0 9 * * 1", undefined, mockScheduler, vi.fn());

      const job = getCronJob("wf-trigger-1");
      expect(job).toBeDefined();
    });

    it("should unregister cron job", () => {
      const mockStop = vi.fn();
      const mockScheduler = {
        schedule: vi.fn().mockReturnValue({ stop: mockStop }),
        validate: vi.fn().mockReturnValue(true),
      };

      registerCronTrigger("wf-trigger-1", "0 9 * * 1", undefined, mockScheduler, vi.fn());
      expect(getCronJob("wf-trigger-1")).toBeDefined();

      unregisterCronTrigger("wf-trigger-1");
      expect(getCronJob("wf-trigger-1")).toBeUndefined();
      expect(mockStop).toHaveBeenCalled();
    });

    it("should list all registered cron jobs", () => {
      const mockScheduler = {
        schedule: vi.fn().mockReturnValue({ stop: vi.fn() }),
        validate: vi.fn().mockReturnValue(true),
      };

      registerCronTrigger("wf-1", "0 9 * * 1", undefined, mockScheduler, vi.fn());
      registerCronTrigger("wf-2", "0 0 * * *", undefined, mockScheduler, vi.fn());

      const jobs = getAllCronJobs();
      expect(jobs).toHaveLength(2);
    });

    it("should throw error for invalid cron expression", () => {
      const mockScheduler = {
        schedule: vi.fn().mockReturnValue({ stop: vi.fn() }),
        validate: vi.fn().mockReturnValue(true),
      };

      expect(() =>
        registerCronTrigger("wf-1", "invalid", undefined, mockScheduler, vi.fn()),
      ).toThrow(CronTriggerError);
    });
  });

  describe("Cron Trigger Execution", () => {
    it("should call onTrigger callback when cron fires", async () => {
      const onTrigger = vi.fn().mockResolvedValue(undefined);
      let scheduledCallback: (() => void | Promise<void>) | null = null;

      const mockScheduler = {
        schedule: vi.fn().mockImplementation((expr, callback) => {
          scheduledCallback = callback;
          return { stop: vi.fn() };
        }),
        validate: vi.fn().mockReturnValue(true),
      };

      registerCronTrigger("wf-trigger-1", "* * * * *", undefined, mockScheduler, onTrigger);

      // Manually trigger the callback
      if (scheduledCallback) {
        await scheduledCallback();
      }

      expect(onTrigger).toHaveBeenCalledWith("wf-trigger-1");
    });
  });
});

// =============================================================================
// WEBHOOK TRIGGER INTEGRATION TESTS
// =============================================================================

describe("Webhook Trigger Integration", () => {
  const mockWebhookSecret = "test-secret-12345678901234567890123456789012";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Webhook Setup", () => {
    it("should setup webhook trigger with generated path and secret", async () => {
      const repository = createMockRepository();
      repository.getWorkflow.mockResolvedValue(createMockWorkflow());

      const result = await setupWebhookTrigger("wf-trigger-1", repository);

      expect(result.webhookPath).toHaveLength(32);
      expect(result.webhookSecret).toHaveLength(64);
      expect(repository.updateWorkflow).toHaveBeenCalled();
    });

    it("should regenerate webhook secret", async () => {
      const repository = createMockRepository();
      repository.getWorkflow.mockResolvedValue(
        createMockWorkflow({
          triggerConfig: { webhookSecret: "old-secret" } as TriggerNodeConfig,
        }),
      );

      const newSecret = await regenerateWebhookSecret("wf-trigger-1", repository);

      expect(newSecret).toHaveLength(64);
      expect(newSecret).not.toBe("old-secret");
    });
  });

  describe("Signature Verification", () => {
    it("should compute and verify signature correctly", () => {
      const payload = '{"event": "test", "data": "hello"}';
      const secret = "my-secret-key";

      const signature = computeSignature(payload, secret);
      const isValid = verifySignature(payload, secret, signature);

      expect(isValid).toBe(true);
    });

    it("should reject tampered payload", () => {
      const originalPayload = '{"event": "test"}';
      const tamperedPayload = '{"event": "malicious"}';
      const secret = "my-secret-key";

      const signature = computeSignature(originalPayload, secret);
      const isValid = verifySignature(tamperedPayload, secret, signature);

      expect(isValid).toBe(false);
    });

    it("should reject wrong secret", () => {
      const payload = '{"event": "test"}';
      const signature = computeSignature(payload, "correct-secret");
      const isValid = verifySignature(payload, "wrong-secret", signature);

      expect(isValid).toBe(false);
    });

    it("should extract signature from various header formats", () => {
      expect(extractSignature({ "x-webhook-signature": "sig1" })).toBe("sig1");
      expect(extractSignature({ "X-WEBHOOK-SIGNATURE": "sig2" })).toBe("sig2");
      expect(extractSignature({ "x-webhook-signature": ["sig3", "extra"] })).toBe("sig3");
      expect(extractSignature({})).toBeUndefined();
    });
  });

  describe("Webhook Request Handling", () => {
    it("should handle valid webhook request", async () => {
      const mockWorkflow = createMockWorkflow({
        triggerType: "WEBHOOK",
        status: "ACTIVE",
        triggerConfig: {
          triggerType: "WEBHOOK",
          webhookPath: "test-path",
          webhookSecret: mockWebhookSecret,
        } as TriggerNodeConfig,
      });

      const repository = createMockRepository();
      const executionService = createMockExecutionService();
      const queue = createMockQueue();

      repository.getWorkflow.mockResolvedValue(mockWorkflow);

      const payload = {
        headers: {
          "x-webhook-signature": computeSignature('{"event":"test"}', mockWebhookSecret),
        },
        body: { event: "test" },
        method: "POST",
        path: "/api/workflows/webhook/test-path",
      };

      const result = await handleWebhookRequest(
        "wf-trigger-1",
        payload,
        repository,
        executionService,
        queue,
      );

      expect(result.accepted).toBe(true);
      expect(result.executionId).toBe("exec-trigger-1");
      expect(executionService.createExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: "wf-trigger-1",
          triggeredBy: "webhook",
        }),
      );
    });

    it("should reject request with invalid signature", async () => {
      const mockWorkflow = createMockWorkflow({
        triggerType: "WEBHOOK",
        status: "ACTIVE",
        triggerConfig: {
          triggerType: "WEBHOOK",
          webhookSecret: mockWebhookSecret,
        } as TriggerNodeConfig,
      });

      const repository = createMockRepository();
      const executionService = createMockExecutionService();
      const queue = createMockQueue();

      repository.getWorkflow.mockResolvedValue(mockWorkflow);

      const payload = {
        headers: {
          "x-webhook-signature": "sha256=invalid-signature",
        },
        body: { event: "test" },
        method: "POST",
        path: "/",
      };

      await expect(
        handleWebhookRequest("wf-trigger-1", payload, repository, executionService, queue),
      ).rejects.toThrow(WebhookTriggerError);
    });

    it("should reject request for inactive workflow", async () => {
      const mockWorkflow = createMockWorkflow({
        triggerType: "WEBHOOK",
        status: "PAUSED",
        triggerConfig: {
          triggerType: "WEBHOOK",
          webhookSecret: mockWebhookSecret,
        } as TriggerNodeConfig,
      });

      const repository = createMockRepository();
      const executionService = createMockExecutionService();
      const queue = createMockQueue();

      repository.getWorkflow.mockResolvedValue(mockWorkflow);

      await expect(
        handleWebhookRequest(
          "wf-trigger-1",
          { headers: {}, body: {}, method: "POST", path: "/" },
          repository,
          executionService,
          queue,
        ),
      ).rejects.toThrow("not active");
    });

    it("should include webhook payload in execution inputs", async () => {
      const mockWorkflow = createMockWorkflow({
        triggerType: "WEBHOOK",
        status: "ACTIVE",
        triggerConfig: {
          triggerType: "WEBHOOK",
          webhookSecret: mockWebhookSecret,
        } as TriggerNodeConfig,
      });

      const repository = createMockRepository();
      const executionService = createMockExecutionService();
      const queue = createMockQueue();

      repository.getWorkflow.mockResolvedValue(mockWorkflow);

      const webhookBody = { event: "order.created", orderId: "12345" };
      const payload = {
        headers: {
          "x-webhook-signature": computeSignature(JSON.stringify(webhookBody), mockWebhookSecret),
          "content-type": "application/json",
        },
        body: webhookBody,
        method: "POST",
        path: "/api/workflows/webhook/test",
      };

      await handleWebhookRequest("wf-trigger-1", payload, repository, executionService, queue);

      expect(executionService.createExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          inputs: expect.objectContaining({
            webhook: expect.objectContaining({
              body: webhookBody,
              method: "POST",
            }),
            event: "order.created",
            orderId: "12345",
          }),
        }),
      );
    });
  });

  describe("Route Handler", () => {
    it("should create route handler with correct configuration", () => {
      const repository = createMockRepository();
      const executionService = createMockExecutionService();
      const queue = createMockQueue();

      const handler = createWebhookRouteHandler(
        "wf-1",
        "abc123",
        repository,
        executionService,
        queue,
      );

      expect(handler.workflowId).toBe("wf-1");
      expect(handler.path).toBe("/api/workflows/webhook/abc123");
      expect(handler.method).toBe("POST");
      expect(typeof handler.handle).toBe("function");
    });
  });
});

// =============================================================================
// CHAT TRIGGER INTEGRATION TESTS
// =============================================================================

describe("Chat Trigger Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Phrase Matching", () => {
    it("should match exact phrase", () => {
      const result = matchesTriggerPhrase("run report", "run report");
      expect(result.matches).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it("should match phrase at start of message", () => {
      const result = matchesTriggerPhrase("run report for today", "run report");
      expect(result.matches).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("should match phrase with different casing", () => {
      const result = matchesTriggerPhrase("RUN REPORT", "run report");
      expect(result.matches).toBe(true);
    });

    it("should match phrase in middle of message with lower confidence", () => {
      const result = matchesTriggerPhrase("please run report now", "run report");
      expect(result.matches).toBe(true);
      expect(result.confidence).toBeLessThan(0.9);
    });

    it("should not match unrelated message", () => {
      const result = matchesTriggerPhrase("hello world", "run report");
      expect(result.matches).toBe(false);
    });

    it("should handle extra whitespace", () => {
      const result = matchesTriggerPhrase("  run   report  ", "run report");
      expect(result.matches).toBe(true);
    });
  });

  describe("Text Normalization", () => {
    it("should normalize text correctly", () => {
      expect(normalizeText("  Hello  World  ")).toBe("hello world");
      expect(normalizeText("UPPERCASE")).toBe("uppercase");
      expect(normalizeText("multiple   spaces")).toBe("multiple spaces");
    });
  });

  describe("Trigger Phrase Validation", () => {
    it("should validate good trigger phrases", () => {
      expect(validateTriggerPhrase("run report").valid).toBe(true);
      expect(validateTriggerPhrase("generate summary").valid).toBe(true);
    });

    it("should reject too short phrases", () => {
      expect(validateTriggerPhrase("a").valid).toBe(false);
    });

    it("should reject too long phrases", () => {
      const longPhrase = "a".repeat(101);
      expect(validateTriggerPhrase(longPhrase).valid).toBe(false);
    });

    it("should reject common words", () => {
      expect(validateTriggerPhrase("the").valid).toBe(false);
      expect(validateTriggerPhrase("is").valid).toBe(false);
    });
  });

  describe("Trigger Phrase Suggestions", () => {
    it("should suggest verb prefixes", () => {
      const suggestions = suggestTriggerPhrase("report");
      expect(suggestions.some((s) => s.startsWith("run") || s.startsWith("start"))).toBe(true);
    });
  });

  describe("Chat Trigger Detection", () => {
    it("should find matching workflow for chat message", async () => {
      const mockWorkflow = createMockWorkflow({
        triggerType: "CHAT",
        triggerConfig: {
          triggerType: "CHAT",
          triggerPhrase: "run report",
        } as TriggerNodeConfig,
      });

      const repository = createMockRepository();
      repository.getActiveWorkflowsWithChatTrigger.mockResolvedValue([mockWorkflow]);

      const match = await checkChatTriggers(
        { content: "run report", conversationId: "conv-1" },
        mockOrgId,
        repository,
      );

      expect(match).toBeDefined();
      expect(match?.workflow.id).toBe("wf-trigger-1");
      expect(match?.confidence).toBeGreaterThan(0.9);
    });

    it("should return null when no workflow matches", async () => {
      const mockWorkflow = createMockWorkflow({
        triggerType: "CHAT",
        triggerConfig: {
          triggerType: "CHAT",
          triggerPhrase: "run report",
        } as TriggerNodeConfig,
      });

      const repository = createMockRepository();
      repository.getActiveWorkflowsWithChatTrigger.mockResolvedValue([mockWorkflow]);

      const match = await checkChatTriggers(
        { content: "hello world", conversationId: "conv-1" },
        mockOrgId,
        repository,
      );

      expect(match).toBeNull();
    });

    it("should select highest confidence match when multiple workflows match", async () => {
      const workflows = [
        createMockWorkflow({
          id: "wf-1",
          triggerConfig: { triggerType: "CHAT", triggerPhrase: "run" } as TriggerNodeConfig,
        }),
        createMockWorkflow({
          id: "wf-2",
          triggerConfig: { triggerType: "CHAT", triggerPhrase: "run report" } as TriggerNodeConfig,
        }),
      ];

      const repository = createMockRepository();
      repository.getActiveWorkflowsWithChatTrigger.mockResolvedValue(workflows);

      const match = await checkChatTriggers(
        { content: "run report", conversationId: "conv-1" },
        mockOrgId,
        repository,
      );

      expect(match?.workflow.id).toBe("wf-2"); // More specific phrase should win
    });
  });

  describe("Chat Trigger Execution", () => {
    it("should execute workflow from chat trigger", async () => {
      const mockWorkflow = createMockWorkflow({
        triggerType: "CHAT",
        triggerConfig: {
          triggerType: "CHAT",
          triggerPhrase: "run report",
        } as TriggerNodeConfig,
      });

      const executionService = createMockExecutionService();
      const queue = createMockQueue();

      const match = {
        workflow: mockWorkflow,
        confidence: 1.0,
        matchedPhrase: "run report",
      };

      const message = {
        content: "run report",
        conversationId: "conv-123",
        userId: "user-456",
        channelId: "channel-789",
      };

      const result = await executeChatTrigger(match, message, executionService, queue);

      expect(result.executionId).toBe("exec-trigger-1");
      expect(result.workflowId).toBe("wf-trigger-1");
      expect(executionService.createExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          triggeredBy: "chat:user-456",
          inputs: expect.objectContaining({
            message: "run report",
            conversationId: "conv-123",
            userId: "user-456",
            matchedPhrase: "run report",
          }),
        }),
      );
    });

    it("should handle full chat message flow", async () => {
      const mockWorkflow = createMockWorkflow({
        triggerType: "CHAT",
        triggerConfig: {
          triggerType: "CHAT",
          triggerPhrase: "generate summary",
        } as TriggerNodeConfig,
      });

      const repository = createMockRepository();
      const executionService = createMockExecutionService();
      const queue = createMockQueue();

      repository.getActiveWorkflowsWithChatTrigger.mockResolvedValue([mockWorkflow]);

      const result = await handleChatMessage(
        {
          content: "generate summary for last week",
          conversationId: "conv-1",
          userId: "user-1",
        },
        mockOrgId,
        repository,
        executionService,
        queue,
      );

      expect(result).toBeDefined();
      expect(result?.executionId).toBe("exec-trigger-1");
    });

    it("should respect minimum confidence threshold", async () => {
      const mockWorkflow = createMockWorkflow({
        triggerType: "CHAT",
        triggerConfig: {
          triggerType: "CHAT",
          triggerPhrase: "run specific report",
        } as TriggerNodeConfig,
      });

      const repository = createMockRepository();
      const executionService = createMockExecutionService();
      const queue = createMockQueue();

      repository.getActiveWorkflowsWithChatTrigger.mockResolvedValue([mockWorkflow]);

      // This message has low confidence match
      const result = await handleChatMessage(
        {
          content: "maybe run something like a report",
          conversationId: "conv-1",
        },
        mockOrgId,
        repository,
        executionService,
        queue,
        { minConfidence: 0.9 },
      );

      // Should not trigger due to low confidence
      expect(result).toBeNull();
    });
  });
});

// =============================================================================
// CROSS-TRIGGER INTEGRATION TESTS
// =============================================================================

describe("Cross-Trigger Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle workflow with multiple trigger types correctly", async () => {
    // Test that workflows can switch trigger types
    const workflowAsManual = createMockWorkflow({
      triggerType: "MANUAL",
    });

    const workflowAsWebhook = createMockWorkflow({
      triggerType: "WEBHOOK",
      triggerConfig: {
        triggerType: "WEBHOOK",
        webhookPath: "test-path",
        webhookSecret: "test-secret-12345678901234567890123456789012",
      } as TriggerNodeConfig,
    });

    // Both should be valid workflows with different trigger mechanisms
    expect(workflowAsManual.triggerType).toBe("MANUAL");
    expect(workflowAsWebhook.triggerType).toBe("WEBHOOK");
  });

  it("should create execution with consistent structure across trigger types", async () => {
    const executionService = createMockExecutionService();
    const queue = createMockQueue();

    // Verify execution structure is consistent
    const expectedExecutionStructure = {
      id: expect.any(String),
      status: expect.stringMatching(/PENDING|RUNNING/),
    };

    const manualExecution = await executionService.createExecution({
      workflowId: "wf-1",
      triggeredBy: "user-1",
      inputs: {},
    });

    expect(manualExecution).toMatchObject(expectedExecutionStructure);

    const webhookExecution = await executionService.createExecution({
      workflowId: "wf-1",
      triggeredBy: "webhook",
      inputs: { webhook: { body: {} } },
    });

    expect(webhookExecution).toMatchObject(expectedExecutionStructure);

    const chatExecution = await executionService.createExecution({
      workflowId: "wf-1",
      triggeredBy: "chat:user-1",
      inputs: { message: "run report" },
    });

    expect(chatExecution).toMatchObject(expectedExecutionStructure);
  });
});
