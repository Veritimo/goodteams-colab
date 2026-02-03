/**
 * Microsoft Graph Integration
 *
 * Provides authenticated access to Microsoft 365 services via MS Graph API.
 *
 * @example
 * ```typescript
 * import {
 *   createGraphClient,
 *   graphRequest,
 *   createBatch,
 *   addRequest,
 *   executeBatch,
 * } from './integrations/microsoft';
 *
 * // Create client
 * const client = await createGraphClient({
 *   organizationId: org.id,
 *   userId: user.id,
 * });
 *
 * // Simple request
 * const profile = await graphRequest(client, '/me');
 *
 * // Batch request
 * const batch = createBatch();
 * addRequest(batch, 'user', 'GET', '/me');
 * addRequest(batch, 'mail', 'GET', '/me/messages?$top=5');
 * const result = await executeBatch(client, batch);
 * ```
 *
 * @module
 */

// =============================================================================
// GRAPH CLIENT
// =============================================================================

export {
  // Client creation
  createGraphClient,
  createTestGraphClient,
  // Request helpers
  graphRequest,
  graphRequestWithHeaders,
  graphRequestAllPages,
  // Error class
  GraphApiError,
  // Types
  type GraphClient,
  type GraphClientOptions,
  type GraphRequestOptions,
  type GraphCollection,
} from "./graph-client.js";

// =============================================================================
// RATE LIMITER
// =============================================================================

export {
  // Class
  RateLimiter,
  // Factory
  createRateLimiter,
  // Global instance
  getGlobalRateLimiter,
  resetGlobalRateLimiter,
  // Types
  type RateLimitResource,
  type RateLimiterConfig,
} from "./rate-limiter.js";

// =============================================================================
// BATCH REQUESTS
// =============================================================================

export {
  // Constants
  MAX_BATCH_SIZE,
  // Builder functions
  createBatch,
  addRequest,
  addRequests,
  getBatchSize,
  isBatchEmpty,
  isBatchFull,
  clearBatch,
  // Execution
  executeBatch,
  executeBatchStrict,
  // Chunking
  chunkIntoBatches,
  executeAllBatches,
  // Types
  type Batch,
  type BatchRequest,
  type BatchResponse,
  type BatchResult,
  type BatchExecutionResult,
} from "./graph-batch.js";
