/**
 * Graph Batch Request Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createBatch,
  addRequest,
  addRequests,
  getBatchSize,
  isBatchEmpty,
  isBatchFull,
  clearBatch,
  executeBatch,
  executeBatchStrict,
  chunkIntoBatches,
  executeAllBatches,
  MAX_BATCH_SIZE,
  type Batch,
} from "../graph-batch.js";
import { GraphApiError, type GraphClient } from "../graph-client.js";
import { createRateLimiter } from "../rate-limiter.js";

describe("createBatch", () => {
  it("should create empty batch", () => {
    const batch = createBatch();
    expect(batch.requests).toEqual([]);
  });
});

describe("addRequest", () => {
  let batch: Batch;

  beforeEach(() => {
    batch = createBatch();
  });

  it("should add GET request", () => {
    addRequest(batch, "user", "GET", "/me");

    expect(batch.requests).toHaveLength(1);
    expect(batch.requests[0]).toEqual({
      id: "user",
      method: "GET",
      url: "/me",
      body: undefined,
      headers: undefined,
      dependsOn: undefined,
    });
  });

  it("should add POST request with body", () => {
    const body = { subject: "Test", body: { content: "Hello" } };
    addRequest(batch, "send", "POST", "/me/sendMail", body);

    expect(batch.requests[0].method).toBe("POST");
    expect(batch.requests[0].body).toEqual(body);
  });

  it("should add request with headers", () => {
    addRequest(batch, "photo", "GET", "/me/photo/$value", undefined, {
      headers: { "Content-Type": "image/jpeg" },
    });

    expect(batch.requests[0].headers).toEqual({ "Content-Type": "image/jpeg" });
  });

  it("should add request with dependsOn", () => {
    addRequest(batch, "first", "GET", "/me");
    addRequest(batch, "second", "GET", "/me/photo", undefined, {
      dependsOn: ["first"],
    });

    expect(batch.requests[1].dependsOn).toEqual(["first"]);
  });

  it("should normalize URL with leading slash", () => {
    addRequest(batch, "test", "GET", "me/messages");

    expect(batch.requests[0].url).toBe("/me/messages");
  });

  it("should strip v1.0 prefix from URL", () => {
    addRequest(batch, "test", "GET", "/v1.0/me/messages");

    expect(batch.requests[0].url).toBe("/me/messages");
  });

  it("should strip full Graph URL", () => {
    addRequest(batch, "test", "GET", "https://graph.microsoft.com/v1.0/me/messages?$top=5");

    expect(batch.requests[0].url).toBe("/me/messages?$top=5");
  });

  it("should throw on duplicate ID", () => {
    addRequest(batch, "user", "GET", "/me");

    expect(() => addRequest(batch, "user", "GET", "/me/photo")).toThrow("Duplicate request ID");
  });

  it("should throw on invalid dependsOn reference", () => {
    expect(() =>
      addRequest(batch, "second", "GET", "/me/photo", undefined, {
        dependsOn: ["nonexistent"],
      }),
    ).toThrow("dependsOn references unknown request ID");
  });

  it("should throw when batch is full", () => {
    // Fill the batch
    for (let i = 0; i < MAX_BATCH_SIZE; i++) {
      addRequest(batch, `req-${i}`, "GET", `/me/item${i}`);
    }

    expect(() => addRequest(batch, "overflow", "GET", "/overflow")).toThrow("Batch is full");
  });

  it("should return batch for chaining", () => {
    const result = addRequest(batch, "test", "GET", "/me");
    expect(result).toBe(batch);
  });
});

describe("addRequests", () => {
  it("should add multiple requests", () => {
    const batch = createBatch();

    addRequests(batch, [
      { id: "user", method: "GET", url: "/me" },
      { id: "mail", method: "GET", url: "/me/messages" },
      { id: "calendar", method: "GET", url: "/me/calendar" },
    ]);

    expect(batch.requests).toHaveLength(3);
    expect(batch.requests.map((r) => r.id)).toEqual(["user", "mail", "calendar"]);
  });
});

describe("getBatchSize", () => {
  it("should return 0 for empty batch", () => {
    const batch = createBatch();
    expect(getBatchSize(batch)).toBe(0);
  });

  it("should return correct count", () => {
    const batch = createBatch();
    addRequest(batch, "a", "GET", "/a");
    addRequest(batch, "b", "GET", "/b");
    expect(getBatchSize(batch)).toBe(2);
  });
});

describe("isBatchEmpty", () => {
  it("should return true for new batch", () => {
    expect(isBatchEmpty(createBatch())).toBe(true);
  });

  it("should return false after adding request", () => {
    const batch = createBatch();
    addRequest(batch, "test", "GET", "/test");
    expect(isBatchEmpty(batch)).toBe(false);
  });
});

describe("isBatchFull", () => {
  it("should return false for empty batch", () => {
    expect(isBatchFull(createBatch())).toBe(false);
  });

  it("should return false when not at limit", () => {
    const batch = createBatch();
    addRequest(batch, "test", "GET", "/test");
    expect(isBatchFull(batch)).toBe(false);
  });

  it("should return true at limit", () => {
    const batch = createBatch();
    for (let i = 0; i < MAX_BATCH_SIZE; i++) {
      addRequest(batch, `req-${i}`, "GET", `/item${i}`);
    }
    expect(isBatchFull(batch)).toBe(true);
  });
});

describe("clearBatch", () => {
  it("should remove all requests", () => {
    const batch = createBatch();
    addRequest(batch, "a", "GET", "/a");
    addRequest(batch, "b", "GET", "/b");

    clearBatch(batch);

    expect(batch.requests).toHaveLength(0);
  });
});

describe("executeBatch", () => {
  let mockClient: GraphClient;
  let mockPost: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPost = vi.fn();

    mockClient = {
      client: {
        api: vi.fn(() => ({
          post: mockPost,
        })),
      } as unknown as GraphClient["client"],
      organizationId: "org-123",
      userId: "user-123",
      rateLimiter: createRateLimiter(),
    };
  });

  it("should throw on empty batch", async () => {
    const batch = createBatch();

    await expect(executeBatch(mockClient, batch)).rejects.toThrow("Cannot execute empty batch");
  });

  it("should execute batch and return results", async () => {
    const batch = createBatch();
    addRequest(batch, "user", "GET", "/me");
    addRequest(batch, "mail", "GET", "/me/messages");

    mockPost.mockResolvedValue({
      responses: [
        { id: "user", status: 200, body: { displayName: "Test User" } },
        { id: "mail", status: 200, body: { value: [] } },
      ],
    });

    const result = await executeBatch(mockClient, batch);

    expect(result.allSucceeded()).toBe(true);
    expect(result.get("user")?.body).toEqual({ displayName: "Test User" });
    expect(result.get("mail")?.body).toEqual({ value: [] });
  });

  it("should handle partial failures", async () => {
    const batch = createBatch();
    addRequest(batch, "good", "GET", "/me");
    addRequest(batch, "bad", "GET", "/nonexistent");

    mockPost.mockResolvedValue({
      responses: [
        { id: "good", status: 200, body: { id: "123" } },
        { id: "bad", status: 404, body: { error: { code: "NotFound" } } },
      ],
    });

    const result = await executeBatch(mockClient, batch);

    expect(result.allSucceeded()).toBe(false);
    expect(result.hasFailures()).toBe(true);
    expect(result.getSuccessful()).toHaveLength(1);
    expect(result.getFailed()).toHaveLength(1);
  });

  it("should call $batch endpoint", async () => {
    const batch = createBatch();
    addRequest(batch, "test", "GET", "/me");

    mockPost.mockResolvedValue({
      responses: [{ id: "test", status: 200, body: {} }],
    });

    await executeBatch(mockClient, batch);

    expect(mockClient.client.api).toHaveBeenCalledWith("/$batch");
  });

  it("should include Content-Type header in requests", async () => {
    const batch = createBatch();
    addRequest(batch, "test", "POST", "/me/messages", { subject: "Test" });

    mockPost.mockResolvedValue({
      responses: [{ id: "test", status: 201, body: { id: "msg-1" } }],
    });

    await executeBatch(mockClient, batch);

    const postCall = mockPost.mock.calls[0][0];
    expect(postCall.requests[0].headers["Content-Type"]).toBe("application/json");
  });

  it("should handle API error", async () => {
    const batch = createBatch();
    addRequest(batch, "test", "GET", "/me");

    mockPost.mockRejectedValue({
      statusCode: 503,
      message: "Service unavailable",
    });

    await expect(executeBatch(mockClient, batch)).rejects.toThrow(GraphApiError);
  });
});

describe("executeBatchStrict", () => {
  let mockClient: GraphClient;
  let mockPost: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPost = vi.fn();

    mockClient = {
      client: {
        api: vi.fn(() => ({
          post: mockPost,
        })),
      } as unknown as GraphClient["client"],
      organizationId: "org-123",
      userId: "user-123",
      rateLimiter: createRateLimiter(),
    };
  });

  it("should succeed when all requests succeed", async () => {
    const batch = createBatch();
    addRequest(batch, "a", "GET", "/a");
    addRequest(batch, "b", "GET", "/b");

    mockPost.mockResolvedValue({
      responses: [
        { id: "a", status: 200, body: {} },
        { id: "b", status: 200, body: {} },
      ],
    });

    const result = await executeBatchStrict(mockClient, batch);
    expect(result.allSucceeded()).toBe(true);
  });

  it("should throw on any failure", async () => {
    const batch = createBatch();
    addRequest(batch, "good", "GET", "/good");
    addRequest(batch, "bad", "GET", "/bad");

    mockPost.mockResolvedValue({
      responses: [
        { id: "good", status: 200, body: {} },
        { id: "bad", status: 404, body: { error: "Not found" } },
      ],
    });

    await expect(executeBatchStrict(mockClient, batch)).rejects.toThrow(GraphApiError);
  });
});

describe("chunkIntoBatches", () => {
  it("should return single batch for small request list", () => {
    const requests = [
      { id: "1", method: "GET" as const, url: "/1" },
      { id: "2", method: "GET" as const, url: "/2" },
    ];

    const batches = chunkIntoBatches(requests);

    expect(batches).toHaveLength(1);
    expect(batches[0].requests).toHaveLength(2);
  });

  it("should split into multiple batches at limit", () => {
    const requests = Array.from({ length: 45 }, (_, i) => ({
      id: `req-${i}`,
      method: "GET" as const,
      url: `/item/${i}`,
    }));

    const batches = chunkIntoBatches(requests);

    expect(batches).toHaveLength(3);
    expect(batches[0].requests).toHaveLength(20);
    expect(batches[1].requests).toHaveLength(20);
    expect(batches[2].requests).toHaveLength(5);
  });

  it("should handle empty request list", () => {
    const batches = chunkIntoBatches([]);
    expect(batches).toHaveLength(0);
  });

  it("should handle exactly MAX_BATCH_SIZE requests", () => {
    const requests = Array.from({ length: MAX_BATCH_SIZE }, (_, i) => ({
      id: `req-${i}`,
      method: "GET" as const,
      url: `/item/${i}`,
    }));

    const batches = chunkIntoBatches(requests);

    expect(batches).toHaveLength(1);
    expect(batches[0].requests).toHaveLength(MAX_BATCH_SIZE);
  });
});

describe("executeAllBatches", () => {
  let mockClient: GraphClient;
  let mockPost: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPost = vi.fn();

    mockClient = {
      client: {
        api: vi.fn(() => ({
          post: mockPost,
        })),
      } as unknown as GraphClient["client"],
      organizationId: "org-123",
      userId: "user-123",
      rateLimiter: createRateLimiter(),
    };
  });

  it("should execute multiple batches in sequence", async () => {
    const batches = [createBatch(), createBatch()];
    addRequest(batches[0], "a", "GET", "/a");
    addRequest(batches[1], "b", "GET", "/b");

    mockPost
      .mockResolvedValueOnce({
        responses: [{ id: "a", status: 200, body: { result: "a" } }],
      })
      .mockResolvedValueOnce({
        responses: [{ id: "b", status: 200, body: { result: "b" } }],
      });

    const results = await executeAllBatches(mockClient, batches);

    expect(results).toHaveLength(2);
    expect(results[0].get("a")?.body).toEqual({ result: "a" });
    expect(results[1].get("b")?.body).toEqual({ result: "b" });
    expect(mockPost).toHaveBeenCalledTimes(2);
  });
});

describe("BatchExecutionResult", () => {
  let mockClient: GraphClient;
  let mockPost: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPost = vi.fn();

    mockClient = {
      client: {
        api: vi.fn(() => ({
          post: mockPost,
        })),
      } as unknown as GraphClient["client"],
      organizationId: "org-123",
      userId: "user-123",
      rateLimiter: createRateLimiter(),
    };
  });

  it("should provide typed access via get()", async () => {
    interface TestTypes {
      user: { displayName: string };
      messages: { value: Array<{ id: string }> };
    }

    const batch = createBatch();
    addRequest(batch, "user", "GET", "/me");
    addRequest(batch, "messages", "GET", "/me/messages");

    mockPost.mockResolvedValue({
      responses: [
        { id: "user", status: 200, body: { displayName: "Test" } },
        { id: "messages", status: 200, body: { value: [{ id: "1" }] } },
      ],
    });

    const result = await executeBatch<TestTypes>(mockClient, batch);

    const user = result.get("user");
    expect(user?.body?.displayName).toBe("Test");

    const messages = result.get("messages");
    expect(messages?.body?.value).toHaveLength(1);
  });

  it("should return undefined for unknown ID", async () => {
    const batch = createBatch();
    addRequest(batch, "test", "GET", "/test");

    mockPost.mockResolvedValue({
      responses: [{ id: "test", status: 200, body: {} }],
    });

    const result = await executeBatch(mockClient, batch);

    expect(result.get("nonexistent" as never)).toBeUndefined();
  });
});
