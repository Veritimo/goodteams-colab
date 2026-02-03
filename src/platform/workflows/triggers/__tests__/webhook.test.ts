/**
 * Webhook Trigger Tests
 *
 * Tests for HTTP endpoint-based workflow execution.
 */

import { describe, it, expect, vi } from "vitest";
import type { Workflow } from "../../types.js";
import {
  generateWebhookSecret,
  generateWebhookPath,
  computeSignature,
  verifySignature,
  extractSignature,
  handleWebhookRequest,
  setupWebhookTrigger,
  regenerateWebhookSecret,
  createWebhookRouteHandler,
  WebhookTriggerError,
  type WebhookPayload,
} from "../webhook.js";

// =============================================================================
// MOCKS
// =============================================================================

const mockWebhookSecret = "test-secret-12345678901234567890123456789012";

const mockWorkflow: Workflow = {
  id: "wf-webhook-1",
  tenantId: "tenant-1",
  name: "Webhook Workflow",
  description: null,
  definition: {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { config: { triggerType: "WEBHOOK" } },
      },
    ],
    edges: [],
  },
  status: "ACTIVE",
  triggerType: "WEBHOOK",
  triggerConfig: {
    triggerType: "WEBHOOK",
    webhookPath: "abc123",
    webhookSecret: mockWebhookSecret,
  },
  createdBy: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockRepository() {
  return {
    getWorkflow: vi.fn().mockResolvedValue(mockWorkflow),
    updateWorkflow: vi.fn().mockResolvedValue(undefined),
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
// SECRET GENERATION TESTS
// =============================================================================

describe("generateWebhookSecret", () => {
  it("should generate a 64-character hex string", () => {
    const secret = generateWebhookSecret();

    expect(secret).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(secret)).toBe(true);
  });

  it("should generate unique secrets", () => {
    const secrets = new Set<string>();
    for (let i = 0; i < 100; i++) {
      secrets.add(generateWebhookSecret());
    }
    expect(secrets.size).toBe(100);
  });
});

describe("generateWebhookPath", () => {
  it("should generate a 32-character hex string", () => {
    const path = generateWebhookPath();

    expect(path).toHaveLength(32);
    expect(/^[a-f0-9]+$/.test(path)).toBe(true);
  });
});

// =============================================================================
// SIGNATURE TESTS
// =============================================================================

describe("computeSignature", () => {
  it("should compute HMAC-SHA256 signature", () => {
    const signature = computeSignature('{"test": "data"}', "secret");

    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("should produce consistent signatures", () => {
    const sig1 = computeSignature("payload", "secret");
    const sig2 = computeSignature("payload", "secret");

    expect(sig1).toBe(sig2);
  });

  it("should produce different signatures for different payloads", () => {
    const sig1 = computeSignature("payload1", "secret");
    const sig2 = computeSignature("payload2", "secret");

    expect(sig1).not.toBe(sig2);
  });

  it("should produce different signatures for different secrets", () => {
    const sig1 = computeSignature("payload", "secret1");
    const sig2 = computeSignature("payload", "secret2");

    expect(sig1).not.toBe(sig2);
  });
});

describe("verifySignature", () => {
  it("should return true for valid signature", () => {
    const payload = '{"test": "data"}';
    const secret = "my-secret";
    const signature = computeSignature(payload, secret);

    const result = verifySignature(payload, secret, signature);

    expect(result).toBe(true);
  });

  it("should return false for invalid signature", () => {
    const payload = '{"test": "data"}';
    const secret = "my-secret";

    const result = verifySignature(payload, secret, "sha256=invalid");

    expect(result).toBe(false);
  });

  it("should return false for missing signature", () => {
    const result = verifySignature("payload", "secret", undefined);

    expect(result).toBe(false);
  });

  it("should return false for wrong secret", () => {
    const payload = "payload";
    const signature = computeSignature(payload, "correct-secret");

    const result = verifySignature(payload, "wrong-secret", signature);

    expect(result).toBe(false);
  });
});

describe("extractSignature", () => {
  it("should extract signature from headers", () => {
    const headers = { "x-webhook-signature": "sha256=abc123" };

    const result = extractSignature(headers);

    expect(result).toBe("sha256=abc123");
  });

  it("should handle uppercase header", () => {
    const headers = { "X-WEBHOOK-SIGNATURE": "sha256=abc123" };

    const result = extractSignature(headers);

    expect(result).toBe("sha256=abc123");
  });

  it("should handle array header value", () => {
    const headers = { "x-webhook-signature": ["sha256=abc123", "extra"] };

    const result = extractSignature(headers);

    expect(result).toBe("sha256=abc123");
  });

  it("should return undefined for missing header", () => {
    const headers = { "other-header": "value" };

    const result = extractSignature(headers);

    expect(result).toBeUndefined();
  });
});

// =============================================================================
// WEBHOOK SETUP TESTS
// =============================================================================

describe("setupWebhookTrigger", () => {
  it("should set up webhook trigger with new path and secret", async () => {
    const repository = createMockRepository();

    const result = await setupWebhookTrigger("wf-1", repository);

    expect(result.webhookPath).toHaveLength(32);
    expect(result.webhookSecret).toHaveLength(64);
    expect(repository.updateWorkflow).toHaveBeenCalledWith("wf-1", {
      triggerConfig: expect.objectContaining({
        triggerType: "WEBHOOK",
        webhookPath: result.webhookPath,
        webhookSecret: result.webhookSecret,
      }),
    });
  });

  it("should throw error for non-existent workflow", async () => {
    const repository = createMockRepository();
    repository.getWorkflow = vi.fn().mockResolvedValue(null);

    await expect(setupWebhookTrigger("non-existent", repository)).rejects.toThrow(
      WebhookTriggerError,
    );
  });
});

describe("regenerateWebhookSecret", () => {
  it("should generate a new secret", async () => {
    const repository = createMockRepository();

    const newSecret = await regenerateWebhookSecret("wf-1", repository);

    expect(newSecret).toHaveLength(64);
    expect(newSecret).not.toBe(mockWebhookSecret);
    expect(repository.updateWorkflow).toHaveBeenCalled();
  });
});

// =============================================================================
// WEBHOOK HANDLER TESTS
// =============================================================================

describe("handleWebhookRequest", () => {
  it("should handle valid webhook request", async () => {
    const repository = createMockRepository();
    const executionService = createMockExecutionService();
    const queue = createMockQueue();

    const payload: WebhookPayload = {
      headers: {
        "x-webhook-signature": computeSignature('{"event":"test"}', mockWebhookSecret),
      },
      body: { event: "test" },
      method: "POST",
      path: "/api/workflows/webhook/abc123",
    };

    const result = await handleWebhookRequest(
      "wf-webhook-1",
      payload,
      repository,
      executionService,
      queue,
    );

    expect(result.accepted).toBe(true);
    expect(result.executionId).toBe("exec-1");
    expect(executionService.createExecution).toHaveBeenCalledWith({
      workflowId: "wf-webhook-1",
      triggeredBy: "webhook",
      inputs: expect.objectContaining({
        webhook: expect.objectContaining({
          body: { event: "test" },
          method: "POST",
        }),
        event: "test",
      }),
    });
  });

  it("should throw error for non-existent workflow", async () => {
    const repository = createMockRepository();
    repository.getWorkflow = vi.fn().mockResolvedValue(null);
    const executionService = createMockExecutionService();
    const queue = createMockQueue();

    const payload: WebhookPayload = {
      headers: {},
      body: {},
      method: "POST",
      path: "/",
    };

    await expect(
      handleWebhookRequest("non-existent", payload, repository, executionService, queue),
    ).rejects.toThrow(WebhookTriggerError);
  });

  it("should throw error for inactive workflow", async () => {
    const repository = createMockRepository();
    repository.getWorkflow = vi.fn().mockResolvedValue({ ...mockWorkflow, status: "PAUSED" });
    const executionService = createMockExecutionService();
    const queue = createMockQueue();

    const payload: WebhookPayload = {
      headers: {},
      body: {},
      method: "POST",
      path: "/",
    };

    await expect(
      handleWebhookRequest("wf-1", payload, repository, executionService, queue),
    ).rejects.toThrow("not active");
  });

  it("should throw error for invalid signature", async () => {
    const repository = createMockRepository();
    const executionService = createMockExecutionService();
    const queue = createMockQueue();

    const payload: WebhookPayload = {
      headers: { "x-webhook-signature": "sha256=invalid" },
      body: { event: "test" },
      method: "POST",
      path: "/",
    };

    await expect(
      handleWebhookRequest("wf-webhook-1", payload, repository, executionService, queue),
    ).rejects.toThrow("Invalid webhook signature");
  });

  it("should throw error for missing signature", async () => {
    const repository = createMockRepository();
    const executionService = createMockExecutionService();
    const queue = createMockQueue();

    const payload: WebhookPayload = {
      headers: {},
      body: { event: "test" },
      method: "POST",
      path: "/",
    };

    await expect(
      handleWebhookRequest("wf-webhook-1", payload, repository, executionService, queue),
    ).rejects.toThrow("Invalid webhook signature");
  });
});

// =============================================================================
// ROUTE HANDLER TESTS
// =============================================================================

describe("createWebhookRouteHandler", () => {
  it("should create route handler with correct path", () => {
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
  });

  it("should handle requests through route handler", async () => {
    const repository = createMockRepository();
    const executionService = createMockExecutionService();
    const queue = createMockQueue();

    const handler = createWebhookRouteHandler(
      "wf-webhook-1",
      "abc123",
      repository,
      executionService,
      queue,
    );

    const payload: WebhookPayload = {
      headers: {
        "x-webhook-signature": computeSignature('{"event":"test"}', mockWebhookSecret),
      },
      body: { event: "test" },
      method: "POST",
      path: "/api/workflows/webhook/abc123",
    };

    const result = await handler.handle(payload);

    expect(result.accepted).toBe(true);
  });
});
