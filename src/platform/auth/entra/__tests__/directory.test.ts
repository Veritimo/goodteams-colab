/**
 * Tests for Entra directory search
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  searchUsers,
  getUserById,
  getUserByEmail,
  getCurrentUser,
  listUsers,
  DirectorySearchError,
} from "../directory.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Entra Directory", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe("searchUsers", () => {
    test("returns empty array for empty query", async () => {
      const result = await searchUsers("test-token", "");
      expect(result.users).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("returns empty array for whitespace query", async () => {
      const result = await searchUsers("test-token", "   ");
      expect(result.users).toEqual([]);
    });

    test("makes correct API call", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: "user-1",
              displayName: "John Doe",
              mail: "john@example.com",
              userPrincipalName: "john@example.onmicrosoft.com",
            },
          ],
          "@odata.count": 1,
        }),
      });

      const result = await searchUsers("test-token", "john");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("https://graph.microsoft.com/v1.0/users");
      // URL is percent-encoded, so check for the decoded components
      const decodedUrl = decodeURIComponent(url as string);
      expect(decodedUrl).toContain("startswith(displayName,'john')");
      expect(options.headers.Authorization).toBe("Bearer test-token");
      expect(options.headers.ConsistencyLevel).toBe("eventual");

      expect(result.users).toHaveLength(1);
      expect(result.users[0].displayName).toBe("John Doe");
      expect(result.totalCount).toBe(1);
    });

    test("sanitizes query to prevent injection", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      await searchUsers("test-token", "john'\"\\");

      const [url] = mockFetch.mock.calls[0];
      // URL is percent-encoded
      const decodedUrl = decodeURIComponent(url as string);
      expect(decodedUrl).toContain("startswith(displayName,'john')");
      // Injection characters should have been stripped - the quotes and backslash are removed
      // The query "john'\"\" should become just "john"
      expect(decodedUrl).not.toContain("john'\""); // No injection chars after the name
      expect(decodedUrl).not.toContain("john\\"); // No backslash after the name
    });

    test("respects limit option", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      await searchUsers("test-token", "test", { limit: 25 });

      const [url] = mockFetch.mock.calls[0];
      const decodedUrl = decodeURIComponent(url as string);
      expect(decodedUrl).toContain("$top=25");
    });

    test("caps limit at 50", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      await searchUsers("test-token", "test", { limit: 100 });

      const [url] = mockFetch.mock.calls[0];
      const decodedUrl = decodeURIComponent(url as string);
      expect(decodedUrl).toContain("$top=50");
    });

    test("throws DirectorySearchError on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "Forbidden" } }),
      });

      await expect(searchUsers("test-token", "john")).rejects.toThrow(DirectorySearchError);
    });
  });

  describe("getUserById", () => {
    test("returns user when found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "user-123",
          displayName: "Jane Doe",
          mail: "jane@example.com",
          userPrincipalName: "jane@example.onmicrosoft.com",
        }),
      });

      const result = await getUserById("test-token", "user-123");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("user-123");
      expect(result?.displayName).toBe("Jane Doe");
    });

    test("returns null when not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await getUserById("test-token", "unknown-user");
      expect(result).toBeNull();
    });

    test("throws on other errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(getUserById("test-token", "user-123")).rejects.toThrow(DirectorySearchError);
    });
  });

  describe("getUserByEmail", () => {
    test("returns user when found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: "user-123",
              displayName: "Jane Doe",
              mail: "jane@example.com",
              userPrincipalName: "jane@example.onmicrosoft.com",
            },
          ],
        }),
      });

      const result = await getUserByEmail("test-token", "jane@example.com");

      expect(result).not.toBeNull();
      expect(result?.mail).toBe("jane@example.com");
    });

    test("returns null when not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      const result = await getUserByEmail("test-token", "unknown@example.com");
      expect(result).toBeNull();
    });

    test("returns null for empty email", async () => {
      const result = await getUserByEmail("test-token", "");
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("getCurrentUser", () => {
    test("returns current user", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "me-123",
          displayName: "Current User",
          mail: "me@example.com",
          userPrincipalName: "me@example.onmicrosoft.com",
        }),
      });

      const result = await getCurrentUser("test-token");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/me");
      expect(result.id).toBe("me-123");
    });

    test("throws on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      await expect(getCurrentUser("test-token")).rejects.toThrow(DirectorySearchError);
    });
  });

  describe("listUsers", () => {
    test("lists users with pagination", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: "user-1",
              displayName: "User 1",
              mail: null,
              userPrincipalName: "user1@example.com",
            },
            {
              id: "user-2",
              displayName: "User 2",
              mail: null,
              userPrincipalName: "user2@example.com",
            },
          ],
          "@odata.count": 100,
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/users?$skiptoken=xxx",
        }),
      });

      const result = await listUsers("test-token");

      expect(result.users).toHaveLength(2);
      expect(result.totalCount).toBe(100);
      expect(result.nextLink).toContain("$skiptoken");
    });

    test("uses nextLink for pagination", async () => {
      const nextLink = "https://graph.microsoft.com/v1.0/users?$skiptoken=abc";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      await listUsers("test-token", { nextLink });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(nextLink);
    });
  });

  describe("DirectorySearchError", () => {
    test("identifies permission errors", () => {
      const error = new DirectorySearchError("Forbidden", 403);
      expect(error.isPermissionError()).toBe(true);
      expect(error.isAuthError()).toBe(false);
      expect(error.isRateLimited()).toBe(false);
    });

    test("identifies auth errors", () => {
      const error = new DirectorySearchError("Unauthorized", 401);
      expect(error.isAuthError()).toBe(true);
      expect(error.isPermissionError()).toBe(false);
    });

    test("identifies rate limiting", () => {
      const error = new DirectorySearchError("Too Many Requests", 429);
      expect(error.isRateLimited()).toBe(true);
    });
  });
});
