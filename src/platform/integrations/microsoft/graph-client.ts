/**
 * Microsoft Graph API Client
 *
 * Provides authenticated access to Microsoft Graph API:
 * - Token management with auto-refresh
 * - Rate limit handling
 * - Custom auth provider for @microsoft/microsoft-graph-client
 *
 * @see https://learn.microsoft.com/en-us/graph/overview
 * @see docs/MICROSOFT-365-AUTH-ARCHITECTURE.md
 */

import {
  Client,
  type AuthenticationProvider,
  type ClientOptions,
  ResponseType,
} from "@microsoft/microsoft-graph-client";
import { getValidAccessToken, getValidUserTokens } from "../../auth/entra/token-store.js";
import {
  RateLimiter,
  createRateLimiter,
  getGlobalRateLimiter,
  type RateLimitResource,
} from "./rate-limiter.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for creating a Graph client
 */
export interface GraphClientOptions {
  /** Organization/tenant ID for the client */
  organizationId: string;
  /** User ID for user-delegated permissions (optional for app-only) */
  userId?: string;
  /** Custom rate limiter (uses global if not provided) */
  rateLimiter?: RateLimiter;
  /** Token refresh buffer in minutes (default: 5) */
  refreshBufferMinutes?: number;
  /** Custom base URL (default: https://graph.microsoft.com/v1.0) */
  baseUrl?: string;
}

/**
 * Graph client with metadata
 */
export interface GraphClient {
  /** The Microsoft Graph SDK client */
  client: Client;
  /** Organization ID */
  organizationId: string;
  /** User ID (if user-delegated) */
  userId?: string;
  /** Rate limiter instance */
  rateLimiter: RateLimiter;
}

/**
 * Options for Graph API requests
 */
export interface GraphRequestOptions {
  /** HTTP method (default: GET) */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Request body */
  body?: unknown;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Response type (default: json) */
  responseType?: "json" | "text" | "blob" | "arraybuffer" | "stream";
  /** Query parameters */
  query?: Record<string, string | number>;
  /** Retry on rate limit (default: true) */
  retryOnThrottle?: boolean;
  /** Maximum retry attempts for rate limiting (default: 3) */
  maxRetries?: number;
}

/**
 * Graph API error with additional context
 */
export class GraphApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly requestId?: string,
    public readonly innerError?: unknown,
  ) {
    super(message);
    this.name = "GraphApiError";
  }

  /**
   * Check if this is a rate limit error
   */
  isThrottled(): boolean {
    return this.statusCode === 429;
  }

  /**
   * Check if this is an authentication error
   */
  isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  /**
   * Check if this is a not found error
   */
  isNotFound(): boolean {
    return this.statusCode === 404;
  }
}

// =============================================================================
// AUTH PROVIDER
// =============================================================================

/**
 * Custom authentication provider for the Graph client
 *
 * Handles token retrieval and auto-refresh before expiry.
 */
class GoodTeamsAuthProvider implements AuthenticationProvider {
  constructor(
    private readonly organizationId: string,
    private readonly userId?: string,
    private readonly refreshBufferMinutes: number = 5,
  ) {}

  async getAccessToken(): Promise<string> {
    if (!this.userId) {
      throw new GraphApiError(
        "User ID required for user-delegated authentication",
        401,
        "NoUserId",
      );
    }

    const token = await getValidAccessToken(this.userId, this.refreshBufferMinutes);

    if (!token) {
      throw new GraphApiError(
        "No valid access token available. User may need to re-authenticate.",
        401,
        "TokenUnavailable",
      );
    }

    return token;
  }
}

// =============================================================================
// CLIENT CREATION
// =============================================================================

/**
 * Create an authenticated Microsoft Graph client
 *
 * Uses tokens from Entra auth with automatic refresh before expiry.
 *
 * @example
 * ```typescript
 * const graphClient = await createGraphClient({
 *   organizationId: org.id,
 *   userId: user.id,
 * });
 *
 * // Make requests
 * const profile = await graphRequest<User>(graphClient, '/me');
 * const messages = await graphRequest<MessageCollection>(graphClient, '/me/messages', {
 *   query: { $top: 10 },
 * });
 * ```
 */
export async function createGraphClient(options: GraphClientOptions): Promise<GraphClient> {
  const { organizationId, userId, refreshBufferMinutes = 5 } = options;

  // Validate that we can get a token (if user-based auth)
  if (userId) {
    const tokens = await getValidUserTokens(userId);
    if (!tokens) {
      throw new GraphApiError(
        `No tokens available for user ${userId}. User needs to authenticate with Microsoft.`,
        401,
        "NoTokens",
      );
    }
  }

  const authProvider = new GoodTeamsAuthProvider(organizationId, userId, refreshBufferMinutes);

  const clientOptions: ClientOptions = {
    authProvider,
    baseUrl: options.baseUrl,
  };

  const client = Client.initWithMiddleware(clientOptions);
  const rateLimiter = options.rateLimiter ?? getGlobalRateLimiter();

  return {
    client,
    organizationId,
    userId,
    rateLimiter,
  };
}

/**
 * Create a Graph client for testing with a static token
 *
 * ONLY FOR TESTING - do not use in production.
 */
export function createTestGraphClient(
  accessToken: string,
  options?: { baseUrl?: string },
): GraphClient {
  const authProvider: AuthenticationProvider = {
    getAccessToken: async () => accessToken,
  };

  const client = Client.initWithMiddleware({
    authProvider,
    baseUrl: options?.baseUrl,
  });

  return {
    client,
    organizationId: "test-org",
    userId: "test-user",
    rateLimiter: createRateLimiter(),
  };
}

// =============================================================================
// REQUEST HELPER
// =============================================================================

/**
 * Make a request to the Microsoft Graph API
 *
 * Handles rate limiting, retries, and error mapping.
 *
 * @example
 * ```typescript
 * // GET request
 * const user = await graphRequest<User>(client, '/me');
 *
 * // GET with query params
 * const messages = await graphRequest<MessageCollection>(client, '/me/messages', {
 *   query: { $top: 10, $select: 'subject,from' },
 * });
 *
 * // POST request
 * const event = await graphRequest<Event>(client, '/me/events', {
 *   method: 'POST',
 *   body: { subject: 'Meeting', start: {...}, end: {...} },
 * });
 * ```
 */
export async function graphRequest<T>(
  graphClient: GraphClient,
  path: string,
  options: GraphRequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    responseType = "json",
    query,
    retryOnThrottle = true,
    maxRetries = 3,
  } = options;

  const { client, rateLimiter } = graphClient;
  const resource = RateLimiter.getResourceFromPath(path);

  let lastError: Error | null = null;
  let retries = 0;

  while (retries <= maxRetries) {
    // Check rate limiter before request
    const waitTime = rateLimiter.getWaitTime(resource);
    if (waitTime > 0) {
      if (!retryOnThrottle || retries >= maxRetries) {
        throw new GraphApiError(
          `Rate limited for ${resource}. Wait ${Math.ceil(waitTime / 1000)}s.`,
          429,
          "Throttled",
        );
      }
      await delay(waitTime);
    }

    try {
      // Build the request
      let request = client.api(path);

      // Add query parameters
      if (query) {
        for (const [key, value] of Object.entries(query)) {
          request = request.query({ [key]: value });
        }
      }

      // Add headers
      for (const [key, value] of Object.entries(headers)) {
        request = request.header(key, value);
      }

      // Set response type
      const sdkResponseType = mapResponseType(responseType);
      if (sdkResponseType) {
        request = request.responseType(sdkResponseType);
      }

      // Execute request
      let result: T;
      switch (method) {
        case "GET":
          result = await request.get();
          break;
        case "POST":
          result = await request.post(body);
          break;
        case "PUT":
          result = await request.put(body);
          break;
        case "PATCH":
          result = await request.patch(body);
          break;
        case "DELETE":
          result = await request.delete();
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      // Record successful response
      rateLimiter.recordResponse(resource, 200);

      return result;
    } catch (error) {
      const graphError = mapToGraphError(error);

      // Record the response for rate limiting
      rateLimiter.recordResponse(resource, graphError.statusCode);

      // Handle rate limiting with retry
      if (graphError.isThrottled() && retryOnThrottle && retries < maxRetries) {
        retries++;
        lastError = graphError;
        // Wait will happen at start of next loop iteration
        continue;
      }

      throw graphError;
    }
  }

  // Should not reach here, but just in case
  throw lastError ?? new GraphApiError("Request failed after retries", 500);
}

/**
 * Make a raw request that returns response headers alongside data
 */
export async function graphRequestWithHeaders<T>(
  graphClient: GraphClient,
  path: string,
  options: GraphRequestOptions = {},
): Promise<{ data: T; headers: Headers }> {
  // Note: The MS Graph SDK doesn't easily expose headers
  // This is a simplified implementation
  const data = await graphRequest<T>(graphClient, path, options);
  return { data, headers: new Headers() };
}

// =============================================================================
// PAGINATION HELPER
// =============================================================================

/**
 * Graph API collection response with pagination
 */
export interface GraphCollection<T> {
  value: T[];
  "@odata.nextLink"?: string;
  "@odata.count"?: number;
}

/**
 * Fetch all pages of a paginated Graph API response
 *
 * @example
 * ```typescript
 * const allMessages = await graphRequestAllPages<Message>(client, '/me/messages', {
 *   query: { $select: 'subject,from' },
 * });
 * ```
 */
export async function graphRequestAllPages<T>(
  graphClient: GraphClient,
  path: string,
  options: GraphRequestOptions = {},
  maxPages = 100,
): Promise<T[]> {
  const results: T[] = [];
  let currentPath = path;
  let pageCount = 0;

  while (currentPath && pageCount < maxPages) {
    const response = await graphRequest<GraphCollection<T>>(graphClient, currentPath, options);

    if (response.value) {
      results.push(...response.value);
    }

    // Get next page URL
    const nextLink = response["@odata.nextLink"];
    if (nextLink) {
      // Extract path from full URL
      const url = new URL(nextLink);
      currentPath = url.pathname.replace("/v1.0", "") + url.search;
    } else {
      currentPath = "";
    }

    pageCount++;
    // Clear query params for subsequent requests (they're in nextLink)
    options = { ...options, query: undefined };
  }

  return results;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map response type to SDK enum
 */
function mapResponseType(type: string): ResponseType | undefined {
  switch (type) {
    case "blob":
      return ResponseType.BLOB;
    case "arraybuffer":
      return ResponseType.ARRAYBUFFER;
    case "stream":
      return ResponseType.STREAM;
    case "text":
      return ResponseType.TEXT;
    case "json":
    default:
      return ResponseType.JSON;
  }
}

/**
 * Map SDK errors to GraphApiError
 */
function mapToGraphError(error: unknown): GraphApiError {
  if (error instanceof GraphApiError) {
    return error;
  }

  // Handle MS Graph SDK errors
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;

    // Check for statusCode property
    const statusCode = (err.statusCode as number) || (err.code as number) || 500;

    // Extract error details from Graph API response
    const body = err.body as Record<string, unknown> | undefined;
    const graphError = body?.error as Record<string, unknown> | undefined;

    const message =
      (graphError?.message as string) || (err.message as string) || "Unknown Graph API error";
    const code = (graphError?.code as string) || (err.code as string);
    const requestId = err.requestId as string | undefined;

    return new GraphApiError(message, statusCode, code, requestId, error);
  }

  if (error instanceof Error) {
    return new GraphApiError(error.message, 500, undefined, undefined, error);
  }

  return new GraphApiError("Unknown error", 500);
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
