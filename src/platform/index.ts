/**
 * GoodTeams Platform Module
 *
 * Core platform layer for multi-tenant SaaS functionality.
 * Built on top of OpenClaw gateway infrastructure.
 *
 * Modules:
 *   - db: Database access via Prisma
 *   - api: Platform REST API (coming soon)
 *   - auth: Authentication and authorization (coming soon)
 *   - audit: Audit logging utilities (coming soon)
 */

// Database
export * from "./db/index.js";
