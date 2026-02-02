/**
 * Error handling middleware for platform API
 *
 * Provides consistent error response format across all platform endpoints.
 */

import type { ServerResponse } from "node:http";

/**
 * Standard error codes used across the platform API
 */
export type PlatformErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "CONFLICT"
  | "UNPROCESSABLE_ENTITY"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_ERROR"
  | "NOT_IMPLEMENTED"
  | "SERVICE_UNAVAILABLE";

/**
 * Structured error response format
 */
export interface PlatformErrorResponse {
  error: {
    code: PlatformErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Platform API error class for typed error handling
 */
export class PlatformError extends Error {
  constructor(
    public readonly code: PlatformErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly statusCode: number = codeToStatus(code),
  ) {
    super(message);
    this.name = "PlatformError";
  }
}

/**
 * Map error code to HTTP status code
 */
function codeToStatus(code: PlatformErrorCode): number {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "METHOD_NOT_ALLOWED":
      return 405;
    case "CONFLICT":
      return 409;
    case "UNPROCESSABLE_ENTITY":
      return 422;
    case "TOO_MANY_REQUESTS":
      return 429;
    case "INTERNAL_ERROR":
      return 500;
    case "NOT_IMPLEMENTED":
      return 501;
    case "SERVICE_UNAVAILABLE":
      return 503;
    default:
      return 500;
  }
}

/**
 * Send a structured error response
 */
export function sendError(
  res: ServerResponse,
  code: PlatformErrorCode,
  message: string,
  details?: Record<string, unknown>,
): void {
  const statusCode = codeToStatus(code);
  const body: PlatformErrorResponse = {
    error: {
      code,
      message,
      ...(details && Object.keys(details).length > 0 ? { details } : {}),
    },
  };

  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

/**
 * Handle errors thrown during request processing
 */
export function handleError(res: ServerResponse, error: unknown): void {
  if (error instanceof PlatformError) {
    sendError(res, error.code, error.message, error.details);
    return;
  }

  // Log unexpected errors (in production, use proper logging)
  console.error("[platform-api] Unexpected error:", error);

  // Don't expose internal error details
  sendError(res, "INTERNAL_ERROR", "An unexpected error occurred");
}

/**
 * Create common error helpers
 */
export const errors = {
  badRequest: (message: string, details?: Record<string, unknown>) =>
    new PlatformError("BAD_REQUEST", message, details),

  unauthorized: (message = "Authentication required") =>
    new PlatformError("UNAUTHORIZED", message),

  forbidden: (message = "You don't have permission to perform this action", details?: Record<string, unknown>) =>
    new PlatformError("FORBIDDEN", message, details),

  notFound: (resource = "Resource") =>
    new PlatformError("NOT_FOUND", `${resource} not found`),

  methodNotAllowed: (allowed: string[]) =>
    new PlatformError("METHOD_NOT_ALLOWED", `Method not allowed. Allowed: ${allowed.join(", ")}`, {
      allowed,
    }),

  conflict: (message: string, details?: Record<string, unknown>) =>
    new PlatformError("CONFLICT", message, details),

  unprocessable: (message: string, details?: Record<string, unknown>) =>
    new PlatformError("UNPROCESSABLE_ENTITY", message, details),

  rateLimit: (retryAfter?: number) =>
    new PlatformError("TOO_MANY_REQUESTS", "Rate limit exceeded", retryAfter ? { retryAfter } : undefined),

  internal: (message = "Internal server error") =>
    new PlatformError("INTERNAL_ERROR", message),

  notImplemented: (feature = "This feature") =>
    new PlatformError("NOT_IMPLEMENTED", `${feature} is not yet implemented`),

  unavailable: (message = "Service temporarily unavailable") =>
    new PlatformError("SERVICE_UNAVAILABLE", message),
};
