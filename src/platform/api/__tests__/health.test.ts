/**
 * Tests for platform API health endpoint
 */

import { describe, expect, it } from "vitest";
import { createPlatformApiHandler, PLATFORM_API_BASE_PATH } from "../index.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { EventEmitter } from "node:events";

/**
 * Create a mock request object
 */
function createMockRequest(opts: {
  method: string;
  url: string;
  headers?: Record<string, string | string[]>;
}): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method = opts.method;
  req.url = opts.url;
  req.headers = opts.headers ?? {};
  req.socket = { remoteAddress: "127.0.0.1" } as IncomingMessage["socket"];
  return req;
}

/**
 * Create a mock response object that captures output
 */
function createMockResponse(): ServerResponse & {
  _statusCode: number;
  _headers: Map<string, string>;
  _body: string;
} {
  const res = new EventEmitter() as ServerResponse & {
    _statusCode: number;
    _headers: Map<string, string>;
    _body: string;
  };
  res._statusCode = 200;
  res._headers = new Map();
  res._body = "";

  Object.defineProperty(res, "statusCode", {
    get() {
      return this._statusCode;
    },
    set(value: number) {
      this._statusCode = value;
    },
  });

  res.setHeader = function (name: string, value: string) {
    this._headers.set(name.toLowerCase(), value);
    return this;
  };

  res.end = function (body?: string) {
    if (body) {
      this._body = body;
    }
    return this;
  };

  res.headersSent = false;

  return res;
}

describe("Platform API Health Endpoint", () => {
  const handler = createPlatformApiHandler();

  it("should return true for handled requests to /api/platform/health", async () => {
    const req = createMockRequest({
      method: "GET",
      url: `${PLATFORM_API_BASE_PATH}/health`,
    });
    const res = createMockResponse();

    const handled = await handler(req, res);

    expect(handled).toBe(true);
  });

  it("should return health status for GET /api/platform/health", async () => {
    const req = createMockRequest({
      method: "GET",
      url: `${PLATFORM_API_BASE_PATH}/health`,
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(res._headers.get("content-type")).toContain("application/json");

    const body = JSON.parse(res._body);
    expect(body).toMatchObject({
      status: "ok",
      version: expect.any(String),
      uptime: expect.any(Number),
    });
    expect(body.timestamp).toBeDefined();
  });

  it("should include X-Request-Id header in response", async () => {
    const req = createMockRequest({
      method: "GET",
      url: `${PLATFORM_API_BASE_PATH}/health`,
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._headers.has("x-request-id")).toBe(true);
  });

  it("should use provided X-Request-Id header if present", async () => {
    const requestId = "test-request-123";
    const req = createMockRequest({
      method: "GET",
      url: `${PLATFORM_API_BASE_PATH}/health`,
      headers: { "x-request-id": requestId },
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._headers.get("x-request-id")).toBe(requestId);
  });

  it("should return 405 for non-GET methods", async () => {
    const req = createMockRequest({
      method: "POST",
      url: `${PLATFORM_API_BASE_PATH}/health`,
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(405);
    expect(res._headers.get("allow")).toBe("GET");
  });

  it("should return false for non-platform paths", async () => {
    const req = createMockRequest({
      method: "GET",
      url: "/some/other/path",
    });
    const res = createMockResponse();

    const handled = await handler(req, res);

    expect(handled).toBe(false);
  });

  it("should add CORS headers", async () => {
    const req = createMockRequest({
      method: "GET",
      url: `${PLATFORM_API_BASE_PATH}/health`,
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._headers.has("access-control-allow-origin")).toBe(true);
    expect(res._headers.has("access-control-allow-methods")).toBe(true);
  });

  it("should handle OPTIONS preflight requests", async () => {
    const req = createMockRequest({
      method: "OPTIONS",
      url: `${PLATFORM_API_BASE_PATH}/health`,
    });
    const res = createMockResponse();

    const handled = await handler(req, res);

    expect(handled).toBe(true);
    expect(res._statusCode).toBe(204);
    expect(res._headers.has("access-control-allow-methods")).toBe(true);
  });
});

describe("Platform API Route Stubs", () => {
  const handler = createPlatformApiHandler();

  it("should return 501 Not Implemented for /api/platform/org", async () => {
    const req = createMockRequest({
      method: "GET",
      url: `${PLATFORM_API_BASE_PATH}/org`,
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(501);
    const body = JSON.parse(res._body);
    expect(body.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("should return 501 Not Implemented for /api/platform/users", async () => {
    const req = createMockRequest({
      method: "GET",
      url: `${PLATFORM_API_BASE_PATH}/users`,
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(501);
    const body = JSON.parse(res._body);
    expect(body.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("should return 501 Not Implemented for /api/platform/invitations", async () => {
    const req = createMockRequest({
      method: "GET",
      url: `${PLATFORM_API_BASE_PATH}/invitations`,
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(501);
    const body = JSON.parse(res._body);
    expect(body.error.code).toBe("NOT_IMPLEMENTED");
  });
});

describe("Platform API Error Handling", () => {
  const handler = createPlatformApiHandler();

  it("should return 404 for unknown routes under /api/platform", async () => {
    const req = createMockRequest({
      method: "GET",
      url: `${PLATFORM_API_BASE_PATH}/unknown/route`,
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(404);
    const body = JSON.parse(res._body);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
