/**
 * Microsoft Graph API Rate Limiter
 *
 * Handles 429 (Too Many Requests) responses and rate limit tracking:
 * - Per-resource rate limit tracking (different APIs have different limits)
 * - Retry-After header parsing
 * - Exponential backoff for repeated throttling
 *
 * MS Graph rate limits vary by resource:
 * - Mail: ~10,000 requests per 10 minutes per mailbox
 * - SharePoint: ~1,200 requests per minute per tenant
 * - Teams: Varies by endpoint
 *
 * @see https://learn.microsoft.com/en-us/graph/throttling
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Resource categories with different rate limits
 */
export type RateLimitResource =
  | "mail"
  | "calendar"
  | "contacts"
  | "sharepoint"
  | "onedrive"
  | "teams"
  | "users"
  | "groups"
  | "default";

/**
 * Throttle entry tracking for a resource
 */
interface ThrottleEntry {
  /** Timestamp when requests can resume */
  blockedUntil: number;
  /** Number of consecutive 429 responses */
  consecutiveThrottles: number;
  /** Last 429 response timestamp */
  lastThrottle: number;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Base wait time in ms for exponential backoff (default: 1000) */
  baseBackoffMs?: number;
  /** Maximum backoff time in ms (default: 60000) */
  maxBackoffMs?: number;
  /** Reset consecutive throttle count after this many ms of no throttling (default: 300000) */
  resetAfterMs?: number;
}

// =============================================================================
// RATE LIMITER CLASS
// =============================================================================

/**
 * Microsoft Graph Rate Limiter
 *
 * Tracks rate limit responses per resource and provides intelligent backoff.
 *
 * @example
 * ```typescript
 * const limiter = createRateLimiter();
 *
 * // Before making a request
 * const waitTime = limiter.getWaitTime('mail');
 * if (waitTime > 0) {
 *   await delay(waitTime);
 * }
 *
 * // After receiving a response
 * limiter.recordResponse('mail', response.status, response.headers.get('Retry-After'));
 * ```
 */
export class RateLimiter {
  private readonly throttleMap = new Map<RateLimitResource, ThrottleEntry>();
  private readonly config: Required<RateLimiterConfig>;

  constructor(config: RateLimiterConfig = {}) {
    this.config = {
      baseBackoffMs: config.baseBackoffMs ?? 1000,
      maxBackoffMs: config.maxBackoffMs ?? 60000,
      resetAfterMs: config.resetAfterMs ?? 300000, // 5 minutes
    };
  }

  /**
   * Check if requests to a resource should be throttled
   *
   * @returns true if the caller should wait before making a request
   */
  shouldThrottle(resource: RateLimitResource): boolean {
    return this.getWaitTime(resource) > 0;
  }

  /**
   * Get the time to wait before making a request to a resource
   *
   * @returns Wait time in milliseconds, or 0 if no wait needed
   */
  getWaitTime(resource: RateLimitResource): number {
    const entry = this.throttleMap.get(resource);
    if (!entry) {
      return 0;
    }

    const now = Date.now();

    // Check if we've passed the blocked-until time
    if (now >= entry.blockedUntil) {
      return 0;
    }

    return entry.blockedUntil - now;
  }

  /**
   * Record an API response for rate limit tracking
   *
   * @param resource - The resource category
   * @param statusCode - HTTP status code
   * @param retryAfter - Retry-After header value (seconds or HTTP date)
   */
  recordResponse(
    resource: RateLimitResource,
    statusCode: number,
    retryAfter?: string | number | null,
  ): void {
    if (statusCode === 429) {
      this.handleThrottle(resource, retryAfter);
    } else if (statusCode >= 200 && statusCode < 300) {
      // Successful response - potentially reduce throttle state
      this.handleSuccess(resource);
    }
    // 5xx errors don't affect rate limit state (server error, not throttle)
  }

  /**
   * Record a 429 throttle response
   */
  private handleThrottle(resource: RateLimitResource, retryAfter?: string | number | null): void {
    const now = Date.now();
    const existing = this.throttleMap.get(resource);

    // Parse Retry-After header
    let waitMs = this.parseRetryAfter(retryAfter);

    // Apply exponential backoff for consecutive throttles
    const consecutiveThrottles = (existing?.consecutiveThrottles ?? 0) + 1;
    const backoffMs = Math.min(
      this.config.baseBackoffMs * Math.pow(2, consecutiveThrottles - 1),
      this.config.maxBackoffMs,
    );

    // Use the larger of Retry-After and calculated backoff
    waitMs = Math.max(waitMs, backoffMs);

    this.throttleMap.set(resource, {
      blockedUntil: now + waitMs,
      consecutiveThrottles,
      lastThrottle: now,
    });
  }

  /**
   * Handle successful response - potentially reduce throttle state
   */
  private handleSuccess(resource: RateLimitResource): void {
    const entry = this.throttleMap.get(resource);
    if (!entry) {
      return;
    }

    const now = Date.now();

    // If enough time has passed since last throttle, reset the counter
    if (now - entry.lastThrottle >= this.config.resetAfterMs) {
      this.throttleMap.delete(resource);
    }
  }

  /**
   * Parse Retry-After header value
   *
   * Supports:
   * - Number of seconds: "120"
   * - HTTP date: "Wed, 21 Oct 2025 07:28:00 GMT"
   *
   * @returns Wait time in milliseconds
   */
  private parseRetryAfter(retryAfter?: string | number | null): number {
    if (retryAfter === null || retryAfter === undefined) {
      return this.config.baseBackoffMs;
    }

    // Handle number directly
    if (typeof retryAfter === "number") {
      return retryAfter * 1000;
    }

    // Try parsing as seconds
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try parsing as HTTP date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      const waitMs = date.getTime() - Date.now();
      return Math.max(waitMs, 0);
    }

    // Fallback to base backoff
    return this.config.baseBackoffMs;
  }

  /**
   * Get resource category from Graph API path
   *
   * @example
   * ```typescript
   * getResourceFromPath('/me/messages') // 'mail'
   * getResourceFromPath('/sites/root') // 'sharepoint'
   * ```
   */
  static getResourceFromPath(path: string): RateLimitResource {
    const normalizedPath = path.toLowerCase();

    // Mail endpoints
    if (
      normalizedPath.includes("/messages") ||
      normalizedPath.includes("/mailfolders") ||
      normalizedPath.includes("/sendmail")
    ) {
      return "mail";
    }

    // Calendar endpoints
    if (
      normalizedPath.includes("/calendar") ||
      normalizedPath.includes("/events") ||
      normalizedPath.includes("/calendarview")
    ) {
      return "calendar";
    }

    // Contacts endpoints
    if (normalizedPath.includes("/contacts") || normalizedPath.includes("/contactfolders")) {
      return "contacts";
    }

    // SharePoint endpoints
    if (normalizedPath.includes("/sites")) {
      return "sharepoint";
    }

    // OneDrive endpoints
    if (normalizedPath.includes("/drive") || normalizedPath.includes("/drives")) {
      return "onedrive";
    }

    // Teams endpoints
    if (
      normalizedPath.includes("/teams") ||
      normalizedPath.includes("/channels") ||
      normalizedPath.includes("/chats")
    ) {
      return "teams";
    }

    // User endpoints
    if (normalizedPath.includes("/users") || normalizedPath.startsWith("/me")) {
      return "users";
    }

    // Group endpoints
    if (normalizedPath.includes("/groups")) {
      return "groups";
    }

    return "default";
  }

  /**
   * Clear all throttle state
   * Primarily for testing
   */
  clear(): void {
    this.throttleMap.clear();
  }

  /**
   * Get current throttle state for a resource
   * Primarily for debugging/testing
   */
  getThrottleState(resource: RateLimitResource): ThrottleEntry | undefined {
    return this.throttleMap.get(resource);
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new rate limiter instance
 */
export function createRateLimiter(config?: RateLimiterConfig): RateLimiter {
  return new RateLimiter(config);
}

// =============================================================================
// SINGLETON FOR SHARED USE
// =============================================================================

let globalRateLimiter: RateLimiter | null = null;

/**
 * Get or create the global rate limiter instance
 *
 * Use this for application-wide rate limiting across all Graph clients.
 */
export function getGlobalRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = createRateLimiter();
  }
  return globalRateLimiter;
}

/**
 * Reset the global rate limiter
 * Primarily for testing
 */
export function resetGlobalRateLimiter(): void {
  globalRateLimiter?.clear();
  globalRateLimiter = null;
}
