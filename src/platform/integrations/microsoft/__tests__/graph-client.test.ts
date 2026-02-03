/**
 * Graph Client Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createGraphClient,
  createTestGraphClient,
  graphRequest,
  graphRequestAllPages,
  GraphApiError,
  type GraphClient,
  type GraphCollection,
} from "../graph-client.js";
import { createRateLimiter, resetGlobalRateLimiter } from "../rate-limiter.js";

// Mock the token store
vi.mock("../../../auth/entra/token-store.js", () => ({
  getValidAccessToken: vi.fn(),
  getValidUserTokens: vi.fn(),
}));

// Mock the @microsoft/microsoft-graph-client
vi.mock("@microsoft/microsoft-graph-client", () => {
  const mockRequest = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    query: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    responseType: vi.fn().mockReturnThis(),
  };

  return {
    Client: {
      initWithMiddleware: vi.fn(() => ({
        api: vi.fn(() => mockRequest),
      })),
    },
    ResponseType: {
      JSON: "json",
      TEXT: "text",
      BLOB: "blob",
      ARRAYBUFFER: "arraybuffer",
      STREAM: "stream",
    },
  };
});

import { Client } from "@microsoft/microsoft-graph-client";
import { getValidAccessToken, getValidUserTokens } from "../../../auth/entra/token-store.js";

const mockGetValidAccessToken = vi.mocked(getValidAccessToken);
const mockGetValidUserTokens = vi.mocked(getValidUserTokens);

describe("GraphApiError", () => {
  describe("constructor", () => {
    it("should create error with all properties", () => {
      const error = new GraphApiError("Test error", 404, "NotFound", "req-123", { inner: true });

      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("NotFound");
      expect(error.requestId).toBe("req-123");
      expect(error.innerError).toEqual({ inner: true });
      expect(error.name).toBe("GraphApiError");
    });

    it("should be instanceof Error", () => {
      const error = new GraphApiError("Test", 500);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(GraphApiError);
    });
  });

  describe("isThrottled", () => {
    it("should return true for 429", () => {
      expect(new GraphApiError("Throttled", 429).isThrottled()).toBe(true);
    });

    it("should return false for other codes", () => {
      expect(new GraphApiError("Error", 500).isThrottled()).toBe(false);
      expect(new GraphApiError("Error", 401).isThrottled()).toBe(false);
    });
  });

  describe("isAuthError", () => {
    it("should return true for 401", () => {
      expect(new GraphApiError("Unauthorized", 401).isAuthError()).toBe(true);
    });

    it("should return true for 403", () => {
      expect(new GraphApiError("Forbidden", 403).isAuthError()).toBe(true);
    });

    it("should return false for other codes", () => {
      expect(new GraphApiError("Error", 500).isAuthError()).toBe(false);
      expect(new GraphApiError("Error", 404).isAuthError()).toBe(false);
    });
  });

  describe("isNotFound", () => {
    it("should return true for 404", () => {
      expect(new GraphApiError("Not Found", 404).isNotFound()).toBe(true);
    });

    it("should return false for other codes", () => {
      expect(new GraphApiError("Error", 500).isNotFound()).toBe(false);
      expect(new GraphApiError("Error", 401).isNotFound()).toBe(false);
    });
  });
});

describe("createGraphClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalRateLimiter();
  });

  it("should create client when user has valid tokens", async () => {
    mockGetValidUserTokens.mockResolvedValue({
      accessToken: "test-token",
      expiresOn: new Date(Date.now() + 3600000),
      microsoftId: "ms-123",
      tenantId: "tenant-123",
      scopes: ["User.Read"],
    });

    const client = await createGraphClient({
      organizationId: "org-123",
      userId: "user-123",
    });

    expect(client).toBeDefined();
    expect(client.organizationId).toBe("org-123");
    expect(client.userId).toBe("user-123");
    expect(client.rateLimiter).toBeDefined();
  });

  it("should throw when user has no tokens", async () => {
    mockGetValidUserTokens.mockResolvedValue(null);

    await expect(
      createGraphClient({
        organizationId: "org-123",
        userId: "user-123",
      }),
    ).rejects.toThrow(GraphApiError);
  });

  it("should use custom rate limiter when provided", async () => {
    mockGetValidUserTokens.mockResolvedValue({
      accessToken: "test-token",
      expiresOn: new Date(Date.now() + 3600000),
      microsoftId: "ms-123",
      tenantId: "tenant-123",
      scopes: ["User.Read"],
    });

    const customLimiter = createRateLimiter({ baseBackoffMs: 5000 });

    const client = await createGraphClient({
      organizationId: "org-123",
      userId: "user-123",
      rateLimiter: customLimiter,
    });

    expect(client.rateLimiter).toBe(customLimiter);
  });
});

describe("createTestGraphClient", () => {
  it("should create client with static token", () => {
    const client = createTestGraphClient("static-test-token");

    expect(client).toBeDefined();
    expect(client.organizationId).toBe("test-org");
    expect(client.userId).toBe("test-user");
    expect(client.rateLimiter).toBeDefined();
  });

  it("should accept custom base URL", () => {
    const client = createTestGraphClient("token", {
      baseUrl: "https://graph.microsoft.com/beta",
    });

    expect(client).toBeDefined();
  });
});

describe("graphRequest", () => {
  let testClient: GraphClient;
  let mockApi: ReturnType<typeof vi.fn>;
  let mockRequest: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalRateLimiter();

    mockRequest = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      query: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      responseType: vi.fn().mockReturnThis(),
    };

    mockApi = vi.fn(() => mockRequest);

    testClient = {
      client: { api: mockApi } as unknown as ReturnType<(typeof Client)["initWithMiddleware"]>,
      organizationId: "org-123",
      userId: "user-123",
      rateLimiter: createRateLimiter(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("GET requests", () => {
    it("should make GET request", async () => {
      const mockResponse = { id: "123", displayName: "Test User" };
      mockRequest.get.mockResolvedValue(mockResponse);

      const result = await graphRequest(testClient, "/me");

      expect(mockApi).toHaveBeenCalledWith("/me");
      expect(mockRequest.get).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it("should add query parameters", async () => {
      mockRequest.get.mockResolvedValue({ value: [] });

      await graphRequest(testClient, "/me/messages", {
        query: { $top: 10, $select: "subject,from" },
      });

      expect(mockRequest.query).toHaveBeenCalledWith({ $top: 10 });
      expect(mockRequest.query).toHaveBeenCalledWith({ $select: "subject,from" });
    });

    it("should add custom headers", async () => {
      mockRequest.get.mockResolvedValue({});

      await graphRequest(testClient, "/me", {
        headers: { Prefer: 'outlook.body-content-type="text"' },
      });

      expect(mockRequest.header).toHaveBeenCalledWith("Prefer", 'outlook.body-content-type="text"');
    });
  });

  describe("POST requests", () => {
    it("should make POST request with body", async () => {
      const body = { subject: "Test", body: { content: "Hello" } };
      mockRequest.post.mockResolvedValue({ id: "msg-123" });

      const result = await graphRequest(testClient, "/me/messages", {
        method: "POST",
        body,
      });

      expect(mockRequest.post).toHaveBeenCalledWith(body);
      expect(result).toEqual({ id: "msg-123" });
    });
  });

  describe("PUT requests", () => {
    it("should make PUT request", async () => {
      mockRequest.put.mockResolvedValue({});

      await graphRequest(testClient, "/me/drive/items/123/content", {
        method: "PUT",
        body: "file content",
      });

      expect(mockRequest.put).toHaveBeenCalledWith("file content");
    });
  });

  describe("PATCH requests", () => {
    it("should make PATCH request", async () => {
      const updates = { displayName: "Updated Name" };
      mockRequest.patch.mockResolvedValue({ ...updates, id: "123" });

      await graphRequest(testClient, "/me", {
        method: "PATCH",
        body: updates,
      });

      expect(mockRequest.patch).toHaveBeenCalledWith(updates);
    });
  });

  describe("DELETE requests", () => {
    it("should make DELETE request", async () => {
      mockRequest.delete.mockResolvedValue(undefined);

      await graphRequest(testClient, "/me/messages/123", {
        method: "DELETE",
      });

      expect(mockRequest.delete).toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should throw GraphApiError on failure", async () => {
      mockRequest.get.mockRejectedValue({
        statusCode: 404,
        message: "Resource not found",
      });

      await expect(graphRequest(testClient, "/me/unknown")).rejects.toThrow(GraphApiError);
    });

    it("should map error properties correctly", async () => {
      mockRequest.get.mockRejectedValue({
        statusCode: 400,
        body: {
          error: {
            code: "BadRequest",
            message: "Invalid request",
          },
        },
      });

      try {
        await graphRequest(testClient, "/invalid");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(GraphApiError);
        const graphError = error as GraphApiError;
        expect(graphError.statusCode).toBe(400);
        expect(graphError.code).toBe("BadRequest");
      }
    });
  });

  describe("Rate limiting", () => {
    it("should record successful response", async () => {
      mockRequest.get.mockResolvedValue({});

      await graphRequest(testClient, "/me/messages");

      // Rate limiter should not be throttling after success
      expect(testClient.rateLimiter.shouldThrottle("mail")).toBe(false);
    });

    it("should record 429 response and throw", async () => {
      mockRequest.get.mockRejectedValue({ statusCode: 429 });

      await expect(
        graphRequest(testClient, "/me/messages", {
          retryOnThrottle: false,
        }),
      ).rejects.toThrow();

      expect(testClient.rateLimiter.shouldThrottle("mail")).toBe(true);
    });

    it("should wait when rate limited before request", async () => {
      vi.useFakeTimers();

      // Pre-throttle the resource
      testClient.rateLimiter.recordResponse("mail", 429, "1");

      mockRequest.get.mockResolvedValue({ value: [] });

      const promise = graphRequest(testClient, "/me/messages", {
        retryOnThrottle: true,
        maxRetries: 1,
      });

      // Advance past throttle period
      await vi.advanceTimersByTimeAsync(1500);

      const result = await promise;
      expect(result).toEqual({ value: [] });
    });
  });
});

describe("graphRequestAllPages", () => {
  let testClient: GraphClient;
  let mockApi: ReturnType<typeof vi.fn>;
  let mockRequest: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalRateLimiter();

    mockRequest = {
      get: vi.fn(),
      query: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      responseType: vi.fn().mockReturnThis(),
    };

    mockApi = vi.fn(() => mockRequest);

    testClient = {
      client: { api: mockApi } as unknown as ReturnType<(typeof Client)["initWithMiddleware"]>,
      organizationId: "org-123",
      userId: "user-123",
      rateLimiter: createRateLimiter(),
    };
  });

  it("should fetch single page without nextLink", async () => {
    mockRequest.get.mockResolvedValue({
      value: [{ id: "1" }, { id: "2" }],
    });

    const results = await graphRequestAllPages<{ id: string }>(testClient, "/me/messages");

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("1");
  });

  it("should fetch multiple pages", async () => {
    mockRequest.get
      .mockResolvedValueOnce({
        value: [{ id: "1" }],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/messages?$skip=1",
      })
      .mockResolvedValueOnce({
        value: [{ id: "2" }],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/messages?$skip=2",
      })
      .mockResolvedValueOnce({
        value: [{ id: "3" }],
      });

    const results = await graphRequestAllPages<{ id: string }>(testClient, "/me/messages");

    expect(results).toHaveLength(3);
    expect(mockRequest.get).toHaveBeenCalledTimes(3);
  });

  it("should respect maxPages limit", async () => {
    // Return nextLink on every call
    mockRequest.get.mockImplementation(() =>
      Promise.resolve({
        value: [{ id: "item" }],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/messages?$skip=1",
      }),
    );

    const results = await graphRequestAllPages<{ id: string }>(
      testClient,
      "/me/messages",
      {},
      3, // maxPages
    );

    expect(results).toHaveLength(3);
    expect(mockRequest.get).toHaveBeenCalledTimes(3);
  });

  it("should handle empty response", async () => {
    mockRequest.get.mockResolvedValue({
      value: [],
    });

    const results = await graphRequestAllPages<{ id: string }>(testClient, "/me/messages");

    expect(results).toHaveLength(0);
  });
});
