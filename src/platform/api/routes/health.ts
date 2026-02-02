/**
 * Health check endpoint for platform API
 *
 * GET /api/platform/health
 * Returns service health status, timestamp, and version info.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";
import { sendJson, type RouteHandler } from "./utils.js";

/**
 * Health check response format
 */
export interface HealthResponse {
  status: "ok" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks?: {
    database?: "ok" | "error";
    redis?: "ok" | "error";
  };
}

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * Get current package version
 * In production this would read from package.json or environment
 */
function getVersion(): string {
  return process.env.npm_package_version ?? "0.0.0-dev";
}

/**
 * Perform health checks
 *
 * STUB: Returns healthy for Phase 1. Phase 2+ will add actual health checks.
 */
async function performHealthChecks(): Promise<HealthResponse["checks"]> {
  // TODO Phase 2: Add database health check
  // TODO Phase 3+: Add Redis/cache health check
  return {
    database: "ok",
  };
}

/**
 * Handle GET /api/platform/health
 */
export const handleHealth: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  _ctx: RequestContext,
): Promise<void> => {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Method Not Allowed");
    return;
  }

  const checks = await performHealthChecks();

  // Determine overall status based on checks
  let status: HealthResponse["status"] = "ok";
  if (checks) {
    const checkValues = Object.values(checks);
    if (checkValues.some((v) => v === "error")) {
      status = checkValues.every((v) => v === "error") ? "unhealthy" : "degraded";
    }
  }

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: getVersion(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    ...(checks && { checks }),
  };

  sendJson(res, response, 200);
};
