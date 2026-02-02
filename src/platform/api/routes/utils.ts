/**
 * Utility functions for platform API routes
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";

/**
 * Route handler function signature
 */
export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
) => Promise<void>;

/**
 * Send JSON response
 */
export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

/**
 * Read request body as JSON
 */
export async function readJsonBody<T = unknown>(
  req: IncomingMessage,
  maxBytes = 1024 * 1024, // 1MB default
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        req.destroy();
        resolve({ ok: false, error: "payload too large" });
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({ ok: true, value: {} as T });
        return;
      }
      try {
        const parsed = JSON.parse(raw) as T;
        resolve({ ok: true, value: parsed });
      } catch {
        resolve({ ok: false, error: "invalid JSON" });
      }
    });

    req.on("error", () => {
      resolve({ ok: false, error: "read error" });
    });
  });
}

/**
 * Parse URL path parameters
 * e.g., "/api/platform/users/:id" with path "/api/platform/users/123" returns { id: "123" }
 */
export function parsePathParams(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = pathPart;
    } else if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

/**
 * Parse query parameters from URL
 */
export function parseQueryParams(url: URL): Record<string, string> {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}
