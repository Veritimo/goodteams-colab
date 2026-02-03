/**
 * Microsoft Graph Batch Request Builder
 *
 * Combines multiple Graph API calls into a single HTTP request using $batch endpoint.
 * This reduces network overhead and helps stay within rate limits.
 *
 * Limitations:
 * - Maximum 20 requests per batch
 * - Each request in batch counts against rate limits
 * - Some requests may succeed while others fail
 *
 * @see https://learn.microsoft.com/en-us/graph/json-batching
 */

import { type GraphClient, GraphApiError } from "./graph-client.js";
import { RateLimiter } from "./rate-limiter.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Individual request in a batch
 */
export interface BatchRequest {
  /** Unique ID for this request within the batch */
  id: string;
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Request URL (relative to Graph API base) */
  url: string;
  /** Request body (for POST/PUT/PATCH) */
  body?: unknown;
  /** Request headers */
  headers?: Record<string, string>;
  /** IDs of requests this one depends on (executed after those complete) */
  dependsOn?: string[];
}

/**
 * Response for an individual request in a batch
 */
export interface BatchResponse<T = unknown> {
  /** Request ID (matches the id in BatchRequest) */
  id: string;
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers?: Record<string, string>;
  /** Response body */
  body?: T;
}

/**
 * Full batch response from Graph API
 */
export interface BatchResult {
  /** Individual responses */
  responses: BatchResponse[];
}

/**
 * Batch builder state
 */
export interface Batch {
  /** Requests in the batch */
  requests: BatchRequest[];
}

/**
 * Typed batch execution result
 */
export interface BatchExecutionResult<T extends Record<string, unknown>> {
  /** All responses, keyed by request ID */
  responses: Map<string, BatchResponse>;
  /** Get a typed response by ID */
  get<K extends keyof T>(id: K): BatchResponse<T[K]> | undefined;
  /** Get all successful responses */
  getSuccessful(): BatchResponse[];
  /** Get all failed responses */
  getFailed(): BatchResponse[];
  /** Check if all requests succeeded */
  allSucceeded(): boolean;
  /** Check if any request failed */
  hasFailures(): boolean;
}

// =============================================================================
// BATCH BUILDER
// =============================================================================

/**
 * Maximum requests per batch (MS Graph limit)
 */
export const MAX_BATCH_SIZE = 20;

/**
 * Create a new batch request builder
 *
 * @example
 * ```typescript
 * const batch = createBatch();
 *
 * addRequest(batch, 'user', 'GET', '/me');
 * addRequest(batch, 'messages', 'GET', '/me/messages?$top=5');
 * addRequest(batch, 'calendar', 'GET', '/me/calendar');
 *
 * const result = await executeBatch(graphClient, batch);
 *
 * const userResponse = result.get('user');
 * if (userResponse?.status === 200) {
 *   console.log(userResponse.body);
 * }
 * ```
 */
export function createBatch(): Batch {
  return {
    requests: [],
  };
}

/**
 * Add a request to the batch
 *
 * @throws Error if batch is full (20 requests max)
 */
export function addRequest(
  batch: Batch,
  id: string,
  method: BatchRequest["method"],
  url: string,
  body?: unknown,
  options?: {
    headers?: Record<string, string>;
    dependsOn?: string[];
  },
): Batch {
  if (batch.requests.length >= MAX_BATCH_SIZE) {
    throw new Error(`Batch is full. Maximum ${MAX_BATCH_SIZE} requests per batch.`);
  }

  // Check for duplicate IDs
  if (batch.requests.some((r) => r.id === id)) {
    throw new Error(`Duplicate request ID: ${id}`);
  }

  // Validate dependsOn references
  if (options?.dependsOn) {
    for (const depId of options.dependsOn) {
      if (!batch.requests.some((r) => r.id === depId)) {
        throw new Error(`dependsOn references unknown request ID: ${depId}`);
      }
    }
  }

  const request: BatchRequest = {
    id,
    method,
    url: normalizeUrl(url),
    body,
    headers: options?.headers,
    dependsOn: options?.dependsOn,
  };

  batch.requests.push(request);
  return batch;
}

/**
 * Add multiple requests to the batch
 */
export function addRequests(
  batch: Batch,
  requests: Array<{
    id: string;
    method: BatchRequest["method"];
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
    dependsOn?: string[];
  }>,
): Batch {
  for (const req of requests) {
    addRequest(batch, req.id, req.method, req.url, req.body, {
      headers: req.headers,
      dependsOn: req.dependsOn,
    });
  }
  return batch;
}

/**
 * Get the number of requests in the batch
 */
export function getBatchSize(batch: Batch): number {
  return batch.requests.length;
}

/**
 * Check if batch is empty
 */
export function isBatchEmpty(batch: Batch): boolean {
  return batch.requests.length === 0;
}

/**
 * Check if batch is full
 */
export function isBatchFull(batch: Batch): boolean {
  return batch.requests.length >= MAX_BATCH_SIZE;
}

/**
 * Clear all requests from the batch
 */
export function clearBatch(batch: Batch): Batch {
  batch.requests = [];
  return batch;
}

// =============================================================================
// BATCH EXECUTION
// =============================================================================

/**
 * Execute a batch of requests against Microsoft Graph
 *
 * Note: Some requests may succeed while others fail. Always check individual
 * response status codes.
 *
 * @example
 * ```typescript
 * const batch = createBatch();
 * addRequest(batch, 'profile', 'GET', '/me');
 * addRequest(batch, 'photo', 'GET', '/me/photo/$value');
 *
 * const result = await executeBatch(graphClient, batch);
 *
 * // Check individual results
 * for (const response of result.responses.values()) {
 *   if (response.status === 200) {
 *     console.log(`${response.id}: Success`);
 *   } else {
 *     console.log(`${response.id}: Failed with ${response.status}`);
 *   }
 * }
 * ```
 */
export async function executeBatch<T extends Record<string, unknown> = Record<string, unknown>>(
  graphClient: GraphClient,
  batch: Batch,
): Promise<BatchExecutionResult<T>> {
  if (batch.requests.length === 0) {
    throw new Error("Cannot execute empty batch");
  }

  const { client, rateLimiter } = graphClient;

  // Check rate limiter for batch endpoint
  const waitTime = rateLimiter.getWaitTime("default");
  if (waitTime > 0) {
    await delay(waitTime);
  }

  // Build batch request body
  const batchBody = {
    requests: batch.requests.map((req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      body: req.body,
      headers: req.headers
        ? { ...req.headers, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" },
      dependsOn: req.dependsOn,
    })),
  };

  try {
    // Execute batch request
    const response: BatchResult = await client.api("/$batch").post(batchBody);

    // Record responses for rate limiting
    for (const resp of response.responses) {
      const resource = RateLimiter.getResourceFromPath(
        batch.requests.find((r) => r.id === resp.id)?.url ?? "",
      );
      rateLimiter.recordResponse(resource, resp.status, resp.headers?.["Retry-After"]);
    }

    return createBatchExecutionResult<T>(response.responses);
  } catch (error) {
    // Record error for rate limiting
    rateLimiter.recordResponse("default", getErrorStatusCode(error));
    throw mapBatchError(error);
  }
}

/**
 * Execute a batch and throw if any request fails
 *
 * Convenience method for when you need all requests to succeed.
 */
export async function executeBatchStrict<T extends Record<string, unknown>>(
  graphClient: GraphClient,
  batch: Batch,
): Promise<BatchExecutionResult<T>> {
  const result = await executeBatch<T>(graphClient, batch);

  if (result.hasFailures()) {
    const failures = result.getFailed();
    const errorMessages = failures.map((f) => `${f.id}: ${f.status} - ${JSON.stringify(f.body)}`);
    throw new GraphApiError(
      `Batch had ${failures.length} failures: ${errorMessages.join("; ")}`,
      failures[0].status,
      "BatchPartialFailure",
    );
  }

  return result;
}

// =============================================================================
// BATCH CHUNKING
// =============================================================================

/**
 * Split requests into multiple batches respecting the 20-request limit
 *
 * @example
 * ```typescript
 * const allRequests = users.map((u, i) => ({
 *   id: `user-${i}`,
 *   method: 'GET' as const,
 *   url: `/users/${u.id}`,
 * }));
 *
 * const batches = chunkIntoBatches(allRequests);
 * for (const batch of batches) {
 *   await executeBatch(client, batch);
 * }
 * ```
 */
export function chunkIntoBatches(
  requests: Array<{
    id: string;
    method: BatchRequest["method"];
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
  }>,
): Batch[] {
  const batches: Batch[] = [];

  for (let i = 0; i < requests.length; i += MAX_BATCH_SIZE) {
    const chunk = requests.slice(i, i + MAX_BATCH_SIZE);
    const batch = createBatch();
    addRequests(batch, chunk);
    batches.push(batch);
  }

  return batches;
}

/**
 * Execute multiple batches sequentially
 */
export async function executeAllBatches<T extends Record<string, unknown>>(
  graphClient: GraphClient,
  batches: Batch[],
): Promise<BatchExecutionResult<T>[]> {
  const results: BatchExecutionResult<T>[] = [];

  for (const batch of batches) {
    const result = await executeBatch<T>(graphClient, batch);
    results.push(result);
  }

  return results;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create a typed batch execution result
 */
function createBatchExecutionResult<T extends Record<string, unknown>>(
  responses: BatchResponse[],
): BatchExecutionResult<T> {
  const responseMap = new Map<string, BatchResponse>();
  for (const response of responses) {
    responseMap.set(response.id, response);
  }

  return {
    responses: responseMap,

    get<K extends keyof T>(id: K): BatchResponse<T[K]> | undefined {
      return responseMap.get(id as string) as BatchResponse<T[K]> | undefined;
    },

    getSuccessful(): BatchResponse[] {
      return responses.filter((r) => r.status >= 200 && r.status < 300);
    },

    getFailed(): BatchResponse[] {
      return responses.filter((r) => r.status < 200 || r.status >= 300);
    },

    allSucceeded(): boolean {
      return responses.every((r) => r.status >= 200 && r.status < 300);
    },

    hasFailures(): boolean {
      return responses.some((r) => r.status < 200 || r.status >= 300);
    },
  };
}

/**
 * Normalize URL for batch request
 * - Ensure leading slash
 * - Remove /v1.0 prefix if present
 */
function normalizeUrl(url: string): string {
  let normalized = url;

  // Remove base URL if present
  if (normalized.startsWith("https://graph.microsoft.com")) {
    const urlObj = new URL(normalized);
    normalized = urlObj.pathname + urlObj.search;
  }

  // Remove API version prefix
  normalized = normalized.replace(/^\/v1\.0/, "").replace(/^\/beta/, "");

  // Ensure leading slash
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }

  return normalized;
}

/**
 * Get status code from error
 */
function getErrorStatusCode(error: unknown): number {
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    if (typeof err.statusCode === "number") {
      return err.statusCode;
    }
    if (typeof err.status === "number") {
      return err.status;
    }
  }
  return 500;
}

/**
 * Map error to GraphApiError
 */
function mapBatchError(error: unknown): GraphApiError {
  if (error instanceof GraphApiError) {
    return error;
  }

  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    const statusCode = getErrorStatusCode(error);
    const message = (err.message as string) || "Batch request failed";
    return new GraphApiError(message, statusCode, "BatchError", undefined, error);
  }

  if (error instanceof Error) {
    return new GraphApiError(error.message, 500, "BatchError", undefined, error);
  }

  return new GraphApiError("Unknown batch error", 500);
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
