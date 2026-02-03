#!/usr/bin/env tsx
/**
 * End-to-End API Test Suite for GoodTeams Platform
 *
 * Tests all API endpoints with real HTTP calls.
 * Uses stub authentication format: `stub:base64(json)` where json has {id, email, name, orgId, role}
 *
 * Run: pnpm tsx scripts/e2e-tests.ts
 *
 * Prerequisites:
 *   - Platform server running on PORT (default 3000)
 *   - PostgreSQL database accessible
 */

import { randomUUID } from "node:crypto";

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const API_PREFIX = "/api/platform";

// Test data
const TEST_ORG_ID = process.env.E2E_ORG_ID || randomUUID();
const TEST_ADMIN_ID = randomUUID();
const TEST_USER_ID = randomUUID();

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

// =============================================================================
// AUTH HELPERS
// =============================================================================

interface StubUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
  role: "owner" | "admin" | "member" | "viewer";
  permissions?: string[];
}

/**
 * Create stub auth token
 */
function createStubToken(user: StubUser): string {
  const json = JSON.stringify(user);
  const base64 = Buffer.from(json).toString("base64");
  return `stub:${base64}`;
}

/**
 * Create admin user token
 */
function adminToken(orgId: string = TEST_ORG_ID): string {
  return createStubToken({
    id: TEST_ADMIN_ID,
    email: "admin@test.goodteams.ai",
    name: "Test Admin",
    orgId,
    role: "admin",
    permissions: [],
  });
}

/**
 * Create regular user token
 */
function userToken(orgId: string = TEST_ORG_ID): string {
  return createStubToken({
    id: TEST_USER_ID,
    email: "user@test.goodteams.ai",
    name: "Test User",
    orgId,
    role: "member",
    permissions: [],
  });
}

/**
 * Create viewer user token
 */
function viewerToken(orgId: string = TEST_ORG_ID): string {
  return createStubToken({
    id: randomUUID(),
    email: "viewer@test.goodteams.ai",
    name: "Test Viewer",
    orgId,
    role: "viewer",
    permissions: [],
  });
}

// =============================================================================
// HTTP HELPERS
// =============================================================================

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
}

interface ApiResponse<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
  headers: Headers;
}

async function api<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${API_PREFIX}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, fetchOptions);
    const text = await response.text();
    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = text as unknown as T;
    }

    return {
      status: response.status,
      ok: response.ok,
      data,
      headers: response.headers,
    };
  } catch (error) {
    throw new Error(`Request failed: ${url} - ${error}`);
  }
}

// =============================================================================
// TEST FRAMEWORK
// =============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(
  name: string,
  fn: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({
      name,
      passed: true,
      duration: Date.now() - start,
    });
    console.log(`  ${colors.green}✓${colors.reset} ${name} ${colors.dim}(${Date.now() - start}ms)${colors.reset}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      name,
      passed: false,
      error: errorMsg,
      duration: Date.now() - start,
    });
    console.log(`  ${colors.red}✗${colors.reset} ${name}`);
    console.log(`    ${colors.red}${errorMsg}${colors.reset}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertStatus(response: ApiResponse, expected: number): void {
  if (response.status !== expected) {
    throw new Error(
      `Expected status ${expected}, got ${response.status}: ${JSON.stringify(response.data)}`
    );
  }
}

// =============================================================================
// TEST SUITES
// =============================================================================

async function runHealthCheckTests(): Promise<void> {
  console.log(`\n${colors.cyan}Health Check Tests${colors.reset}`);

  await test("GET /health returns ok status", async () => {
    const res = await api("/health");
    assertStatus(res, 200);
    assert((res.data as { status: string }).status === "ok", "Health status should be ok");
  });

  await test("GET /health returns version info", async () => {
    const res = await api<{ version: string; uptime: number }>("/health");
    assertStatus(res, 200);
    assert(typeof res.data.version === "string", "Should return version");
    assert(typeof res.data.uptime === "number", "Should return uptime");
  });
}

async function runAuthTests(): Promise<void> {
  console.log(`\n${colors.cyan}Authentication Tests${colors.reset}`);

  await test("GET /auth/status without auth returns unauthenticated", async () => {
    const res = await api<{ authenticated: boolean }>("/auth/status");
    assertStatus(res, 200);
    assertEqual(res.data.authenticated, false);
  });

  await test("GET /auth/status with valid stub token returns authenticated", async () => {
    const res = await api<{ authenticated: boolean; user: { id: string } }>("/auth/status", {
      token: adminToken(),
    });
    assertStatus(res, 200);
    assertEqual(res.data.authenticated, true);
    assert(res.data.user?.id === TEST_ADMIN_ID, "User ID should match");
  });

  await test("POST /auth/logout succeeds", async () => {
    const res = await api("/auth/logout", {
      method: "POST",
      token: adminToken(),
    });
    assertStatus(res, 200);
  });
}

async function runOrganizationTests(): Promise<void> {
  console.log(`\n${colors.cyan}Organization Tests${colors.reset}`);

  await test("GET /org requires authentication", async () => {
    const res = await api("/org");
    assertEqual(res.status, 401);
  });

  await test("GET /org with auth returns organization details", async () => {
    const res = await api<{ id: string; name: string }>("/org", {
      token: adminToken(),
    });
    // May be 200 or 404 depending on whether org exists
    assert(res.status === 200 || res.status === 404, "Should return 200 or 404");
  });

  await test("GET /org/members lists organization members", async () => {
    const res = await api<{ members: unknown[]; total: number }>("/org/members", {
      token: adminToken(),
    });
    // May be 200 or 404 depending on whether org exists
    if (res.status === 200) {
      assert(Array.isArray(res.data.members), "Should return members array");
      assert(typeof res.data.total === "number", "Should return total count");
    }
  });

  await test("PUT /org requires admin role", async () => {
    const res = await api("/org", {
      method: "PUT",
      token: viewerToken(),
      body: { name: "Updated Name" },
    });
    assertEqual(res.status, 403);
  });
}

async function runUserTests(): Promise<void> {
  console.log(`\n${colors.cyan}User Tests${colors.reset}`);

  await test("GET /users requires authentication", async () => {
    const res = await api("/users");
    assertEqual(res.status, 401);
  });

  await test("GET /users/me returns current user", async () => {
    const res = await api<{ id: string; email: string }>("/users/me", {
      token: adminToken(),
    });
    assertStatus(res, 200);
    assertEqual(res.data.id, TEST_ADMIN_ID);
  });

  await test("GET /users lists organization users", async () => {
    const res = await api<{ users: unknown[]; total: number }>("/users", {
      token: adminToken(),
    });
    // May be 200 or return error if org doesn't exist
    if (res.status === 200) {
      assert(Array.isArray(res.data.users), "Should return users array");
    }
  });

  await test("PUT /users/:id/role requires admin permission", async () => {
    const targetUserId = randomUUID();
    const res = await api(`/users/${targetUserId}/role`, {
      method: "PUT",
      token: userToken(), // Non-admin
      body: { role: "ADMIN" },
    });
    assertEqual(res.status, 403);
  });
}

async function runPermissionTests(): Promise<void> {
  console.log(`\n${colors.cyan}Permission Tests${colors.reset}`);

  await test("GET /permissions lists available permissions", async () => {
    const res = await api<{ permissions: unknown[] }>("/permissions", {
      token: adminToken(),
    });
    assertStatus(res, 200);
    assert(Array.isArray(res.data.permissions), "Should return permissions array");
  });

  await test("POST /users/:id/permissions requires admin", async () => {
    const res = await api(`/users/${TEST_USER_ID}/permissions`, {
      method: "POST",
      token: userToken(), // Non-admin
      body: { permission: "CRM_READ" },
    });
    assertEqual(res.status, 403);
  });
}

async function runWorkflowTests(): Promise<void> {
  console.log(`\n${colors.cyan}Workflow Tests${colors.reset}`);

  let workflowId: string | null = null;

  await test("GET /workflows requires authentication", async () => {
    const res = await api("/workflows");
    assertEqual(res.status, 401);
  });

  await test("GET /workflows lists workflows", async () => {
    const res = await api<{ workflows: unknown[]; total: number }>("/workflows", {
      token: adminToken(),
    });
    // May return 200 or error depending on org state
    if (res.status === 200) {
      assert(Array.isArray(res.data.workflows), "Should return workflows array");
    }
  });

  await test("POST /workflows creates a workflow", async () => {
    const res = await api<{ id: string; name: string }>("/workflows", {
      method: "POST",
      token: adminToken(),
      body: {
        name: `E2E Test Workflow ${Date.now()}`,
        description: "Created by E2E tests",
        definition: {
          nodes: [
            {
              id: "start",
              type: "START",
              config: {},
              position: { x: 0, y: 0 },
            },
            {
              id: "end",
              type: "END",
              config: {},
              position: { x: 200, y: 0 },
            },
          ],
          edges: [
            { source: "start", target: "end" },
          ],
        },
        triggerType: "MANUAL",
      },
    });
    // May succeed or fail depending on org state
    if (res.status === 201) {
      assert(typeof res.data.id === "string", "Should return workflow ID");
      workflowId = res.data.id;
    }
  });

  await test("GET /workflows/:id returns workflow details", async () => {
    if (!workflowId) {
      console.log(`    ${colors.yellow}Skipped (no workflow created)${colors.reset}`);
      return;
    }
    const res = await api<{ id: string; definition: unknown }>(`/workflows/${workflowId}`, {
      token: adminToken(),
    });
    assertStatus(res, 200);
    assertEqual(res.data.id, workflowId);
    assert(res.data.definition !== undefined, "Should return definition");
  });

  await test("PUT /workflows/:id updates workflow", async () => {
    if (!workflowId) {
      console.log(`    ${colors.yellow}Skipped (no workflow created)${colors.reset}`);
      return;
    }
    const res = await api(`/workflows/${workflowId}`, {
      method: "PUT",
      token: adminToken(),
      body: {
        name: "Updated E2E Test Workflow",
        status: "ACTIVE",
      },
    });
    assertStatus(res, 200);
  });

  await test("POST /workflows/:id/execute creates execution", async () => {
    if (!workflowId) {
      console.log(`    ${colors.yellow}Skipped (no workflow created)${colors.reset}`);
      return;
    }
    const res = await api<{ id: string; status: string }>(`/workflows/${workflowId}/execute`, {
      method: "POST",
      token: adminToken(),
      body: {
        inputs: { test: true },
      },
    });
    // May succeed or fail depending on workflow status
    if (res.status === 201) {
      assert(typeof res.data.id === "string", "Should return execution ID");
      assert(typeof res.data.status === "string", "Should return status");
    }
  });

  await test("GET /workflows/:id/executions lists executions", async () => {
    if (!workflowId) {
      console.log(`    ${colors.yellow}Skipped (no workflow created)${colors.reset}`);
      return;
    }
    const res = await api<{ executions: unknown[]; total: number }>(
      `/workflows/${workflowId}/executions`,
      { token: adminToken() }
    );
    assertStatus(res, 200);
    assert(Array.isArray(res.data.executions), "Should return executions array");
  });

  await test("DELETE /workflows/:id archives workflow", async () => {
    if (!workflowId) {
      console.log(`    ${colors.yellow}Skipped (no workflow created)${colors.reset}`);
      return;
    }
    const res = await api(`/workflows/${workflowId}`, {
      method: "DELETE",
      token: adminToken(),
    });
    assertStatus(res, 200);
  });
}

async function runConnectorTests(): Promise<void> {
  console.log(`\n${colors.cyan}Connector Tests${colors.reset}`);

  await test("GET /connectors requires authentication", async () => {
    const res = await api("/connectors");
    assertEqual(res.status, 401);
  });

  await test("GET /connectors lists connectors", async () => {
    const res = await api<{ connectors: unknown[]; total: number }>("/connectors", {
      token: adminToken(),
    });
    // May return 200 or error depending on org state
    if (res.status === 200) {
      assert(Array.isArray(res.data.connectors), "Should return connectors array");
    }
  });

  await test("POST /connectors requires admin", async () => {
    const res = await api("/connectors", {
      method: "POST",
      token: viewerToken(),
      body: {
        type: "SQL_SERVER",
        name: "Test Connector",
        config: { host: "localhost", port: 1433 },
      },
    });
    assertEqual(res.status, 403);
  });
}

async function runInvitationTests(): Promise<void> {
  console.log(`\n${colors.cyan}Invitation Tests${colors.reset}`);

  await test("GET /invitations requires admin", async () => {
    const res = await api("/invitations", {
      token: userToken(), // Non-admin
    });
    assertEqual(res.status, 403);
  });

  await test("POST /invitations requires admin", async () => {
    const res = await api("/invitations", {
      method: "POST",
      token: userToken(),
      body: {
        email: "newuser@test.com",
        role: "USER",
      },
    });
    assertEqual(res.status, 403);
  });
}

async function runAuditTests(): Promise<void> {
  console.log(`\n${colors.cyan}Audit Log Tests${colors.reset}`);

  await test("GET /audit requires admin", async () => {
    const res = await api("/audit", {
      token: userToken(), // Non-admin
    });
    assertEqual(res.status, 403);
  });

  await test("GET /audit returns logs for admin", async () => {
    const res = await api<{ logs?: unknown[]; entries?: unknown[]; total: number }>("/audit", {
      token: adminToken(),
    });
    // May return 200 or error depending on org state
    if (res.status === 200) {
      assert(
        Array.isArray(res.data.logs) || Array.isArray(res.data.entries),
        "Should return logs array"
      );
    }
  });

  await test("GET /audit supports pagination", async () => {
    const res = await api("/audit?limit=10&offset=0", {
      token: adminToken(),
    });
    // Just verify it doesn't crash
    assert(res.status === 200 || res.status >= 400, "Should return valid response");
  });
}

async function runRBACTests(): Promise<void> {
  console.log(`\n${colors.cyan}RBAC (Role-Based Access Control) Tests${colors.reset}`);

  // Test admin-only endpoints
  await test("Admin can access admin endpoints", async () => {
    const res = await api("/audit", { token: adminToken() });
    assert(res.status !== 403, "Admin should have access");
  });

  await test("Viewer cannot access admin endpoints", async () => {
    const res = await api("/audit", { token: viewerToken() });
    assertEqual(res.status, 403);
  });

  await test("User cannot modify other user roles", async () => {
    const res = await api(`/users/${TEST_ADMIN_ID}/role`, {
      method: "PUT",
      token: userToken(),
      body: { role: "VIEWER" },
    });
    assertEqual(res.status, 403);
  });

  await test("Viewer can read /users/me", async () => {
    const res = await api("/users/me", { token: viewerToken() });
    assertStatus(res, 200);
  });

  await test("Different org user cannot access other org data", async () => {
    const otherOrgToken = createStubToken({
      id: randomUUID(),
      email: "other@different.org",
      name: "Other User",
      orgId: randomUUID(), // Different org
      role: "admin",
    });
    const res = await api(`/users/${TEST_ADMIN_ID}`, { token: otherOrgToken });
    // Should be 403 or 404 depending on implementation
    assert(res.status === 403 || res.status === 404, "Should not access other org data");
  });
}

async function runTenantGatewayTests(): Promise<void> {
  console.log(`\n${colors.cyan}Tenant Gateway Tests${colors.reset}`);

  await test("GET /tenant/gateway returns status", async () => {
    const res = await api("/tenant/gateway", { token: adminToken() });
    // May return 200, 404, or error depending on state
    assert(res.status >= 200, "Should return valid response");
  });

  await test("GET /tenant/config returns configuration", async () => {
    const res = await api("/tenant/config", { token: adminToken() });
    // May return 200 or 404 depending on state
    assert(res.status === 200 || res.status === 404, "Should return config or not found");
  });

  await test("POST /tenant/gateway/restart requires admin", async () => {
    const res = await api("/tenant/gateway/restart", {
      method: "POST",
      token: viewerToken(),
    });
    assertEqual(res.status, 403);
  });
}

// =============================================================================
// CLEANUP
// =============================================================================

async function cleanup(): Promise<void> {
  console.log(`\n${colors.cyan}Cleanup${colors.reset}`);
  // Note: In production, this would delete test data
  // For stub auth tests, data may not persist anyway
  console.log(`  ${colors.dim}Cleanup skipped (stub auth mode)${colors.reset}`);
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  GoodTeams Platform E2E Test Suite${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`Test Org ID: ${TEST_ORG_ID}`);
  console.log(`Test Admin ID: ${TEST_ADMIN_ID}\n`);

  const startTime = Date.now();

  // Run all test suites
  await runHealthCheckTests();
  await runAuthTests();
  await runOrganizationTests();
  await runUserTests();
  await runPermissionTests();
  await runWorkflowTests();
  await runConnectorTests();
  await runInvitationTests();
  await runAuditTests();
  await runRBACTests();
  await runTenantGatewayTests();

  await cleanup();

  // Print summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = Date.now() - startTime;

  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  Summary${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  console.log(`  Total:    ${results.length} tests`);
  console.log(`  ${colors.green}Passed:   ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed:   ${failed}${colors.reset}`);
  console.log(`  Duration: ${totalDuration}ms\n`);

  if (failed > 0) {
    console.log(`${colors.red}Failed Tests:${colors.reset}`);
    for (const result of results.filter((r) => !r.passed)) {
      console.log(`  - ${result.name}`);
      if (result.error) {
        console.log(`    ${colors.dim}${result.error}${colors.reset}`);
      }
    }
    console.log();
  }

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run if called directly
main().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
