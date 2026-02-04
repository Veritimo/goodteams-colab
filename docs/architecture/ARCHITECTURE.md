# GoodTeams-Colab Architecture

> Enterprise AI Platform built on OpenClaw
> Version: 2026.1.30 | Phases 1-8 Complete

## Overview

GoodTeams-Colab is a multi-tenant enterprise AI platform forked from OpenClaw. It provides organizations with secure, isolated AI assistants that integrate with Microsoft 365, Google Workspace, databases, and CRM systems.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Client Layer                                       │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   Web UI (Lit)  │  Desktop Agent  │   Mobile Apps   │   Messaging Channels  │
│   Vite + TS     │  (Windows/Mac)  │   (iOS/Android) │   (Teams/Slack/etc)   │
└────────┬────────┴────────┬────────┴────────┬────────┴──────────┬────────────┘
         │                 │                 │                   │
         └─────────────────┴─────────────────┴───────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Platform API Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Auth/SSO    │  │  Tenant      │  │  Connectors  │  │  Workflows       │ │
│  │  (Entra/     │  │  Router &    │  │  (SQL/CRM)   │  │  (Visual)        │ │
│  │   Google)    │  │  Proxy       │  │              │  │                  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘ │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Gateway Layer (Per-Tenant)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Sessions    │  │  Agents      │  │  Skills      │  │  Hooks           │ │
│  │  Manager     │  │  Runtime     │  │  Registry    │  │  System          │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘ │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Data Layer                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    PostgreSQL 16 (Primary)                            │   │
│  │  Organizations │ Users │ Tokens │ Connections │ Workflows │ Audit    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │               External Data Sources (Per-Tenant)                      │   │
│  │  SQL Server │ Dataverse │ Salesforce │ SharePoint │ Google Drive     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Runtime & Language
| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | ≥22.12.0 |
| Language | TypeScript | 5.9.x |
| Package Manager | pnpm | 10.23.0 |
| Build Tool | tsc + rolldown | - |
| Test Framework | Vitest | 4.x |

### Backend
| Component | Technology | Purpose |
|-----------|------------|---------|
| HTTP Server | Hono | Lightweight, fast API framework |
| WebSocket | ws | Real-time communication |
| ORM | Prisma | Type-safe database access |
| Database | PostgreSQL 16 | Primary data store |
| Queue | BullMQ + Redis | Background job processing |
| Cron | Croner | Scheduled tasks |

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| UI Framework | Lit | Web components |
| Build Tool | Vite | Fast dev/build |
| Styling | CSS | Native styles |
| Flow Editor | ReactFlow | Visual workflow builder |

### External Integrations
| Integration | Technology | Purpose |
|-------------|------------|---------|
| Microsoft 365 | MSAL Node + Graph SDK | SSO, Mail, Calendar, Drive |
| Google Workspace | googleapis | OAuth, Drive, Gmail, Calendar |
| Salesforce | jsforce | CRM connector |
| SQL Server | tedious | Database connector |
| PostgreSQL | Prisma native | Database connector |

---

## Directory Structure

```
goodteams-colab/
├── src/                      # TypeScript source
│   ├── platform/             # 🆕 Enterprise platform layer
│   │   ├── api/              # REST API handlers
│   │   ├── audit/            # Audit logging system
│   │   ├── auth/             # Authentication
│   │   │   └── entra/        # Microsoft Entra SSO
│   │   ├── connectors/       # Database/CRM connectors
│   │   │   ├── sql/          # SQL Server/PostgreSQL
│   │   │   ├── dataverse/    # Dynamics 365
│   │   │   └── salesforce/   # Salesforce CRM
│   │   ├── db/               # Prisma schema & client
│   │   ├── integrations/     # Cloud integrations
│   │   │   ├── microsoft/    # M365 Graph API
│   │   │   └── google/       # Google Workspace
│   │   ├── tenant/           # Multi-tenancy
│   │   └── workflows/        # Visual workflow engine
│   │       ├── engine/       # Execution engine
│   │       ├── nodes/        # Node executors
│   │       ├── tools/        # Agent tools
│   │       └── triggers/     # Trigger handlers
│   │
│   ├── gateway/              # Gateway server (from OpenClaw)
│   ├── agents/               # Agent runtime
│   ├── channels/             # Messaging channels
│   ├── sessions/             # Session management
│   ├── hooks/                # Extensibility hooks
│   └── ...                   # Other OpenClaw modules
│
├── packages/
│   └── desktop-agent/        # 🆕 Windows desktop automation
│       └── src/
│           ├── automation/   # Office COM automation
│           ├── visual/       # Screen capture/OCR
│           └── main/         # Electron main process
│
├── extensions/               # Channel plugins
│   ├── msteams/              # Microsoft Teams
│   ├── slack/                # Slack
│   ├── telegram/             # Telegram
│   └── ...                   # Other channels
│
├── ui/                       # Web control panel
│   └── src/
│       └── ui/               # Lit components
│
├── apps/                     # Native applications
│   ├── macos/                # macOS app (Swift)
│   ├── ios/                  # iOS app (Swift)
│   └── android/              # Android app (Kotlin)
│
├── skills/                   # Agent skills
├── docs/                     # Documentation
└── scripts/                  # Build & deployment scripts
```

---

## Core Modules

### 1. Platform API (`src/platform/api/`)

RESTful API layer for platform operations.

**Base Path:** `/api/platform`

```typescript
// Key routes
POST   /auth/entra/login     // Initiate Entra SSO
GET    /auth/entra/callback  // OAuth callback
POST   /auth/google/login    // Initiate Google OAuth
GET    /auth/google/callback // OAuth callback
GET    /auth/status          // Check authentication

GET    /organizations        // List organizations
POST   /organizations        // Create organization
GET    /users                // List users
PATCH  /users/:id/role       // Update user role

GET    /connectors           // List data connections
POST   /connectors           // Create connection
POST   /connectors/:id/test  // Test connection

GET    /workflows            // List workflows
POST   /workflows            // Create workflow
POST   /workflows/:id/execute // Execute workflow
```

### 2. Authentication (`src/platform/auth/`)

Multi-provider SSO with token management.

```typescript
// Entra SSO Flow
┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  Client  │────▶│ /entra/login │────▶│ Microsoft   │────▶│ Callback │
│          │     │              │     │ Login Page  │     │          │
└──────────┘     └──────────────┘     └─────────────┘     └────┬─────┘
                                                               │
                      ┌────────────────────────────────────────┘
                      ▼
              ┌──────────────┐     ┌──────────────┐
              │ Exchange     │────▶│ Store Token  │────▶ Session
              │ Auth Code    │     │ in DB        │
              └──────────────┘     └──────────────┘
```

**Supported Providers:**
- **Microsoft Entra ID** (multi-tenant SaaS app)
- **Google OAuth 2.0** (with minimal/full scope options)

**Token Storage:**
- OAuth tokens encrypted at rest (AES-256-GCM)
- Automatic refresh token rotation
- Per-user, per-provider token storage

### 2.1. Session Management (`src/platform/session/`)

JWT-based session management with refresh token rotation for secure, stateless authentication.

```typescript
// Session Flow
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Login   │────▶│ Create       │────▶│ Issue       │
│  (SSO)   │     │ Session (DB) │     │ Token Pair  │
└──────────┘     └──────────────┘     └─────┬───────┘
                                            │
      ┌─────────────────────────────────────┘
      ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Access Token │────▶│ API Request  │────▶│ JWT Verify   │
│ (15 min)     │     │ (httpOnly)   │     │ + User Load  │
└──────────────┘     └──────────────┘     └──────────────┘
      │
      │ (Expired)
      ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Refresh      │────▶│ Rotate       │────▶│ New Token    │
│ Token (14d)  │     │ Token        │     │ Pair         │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Key Features:**
- **Access Tokens:** Short-lived (15 min default), stateless JWT
- **Refresh Tokens:** Long-lived (14 days default), stored in DB with hash
- **Token Rotation:** Every refresh generates a new token pair
- **Sliding Window:** Optional automatic extension on activity
- **Org-Configurable:** Per-tenant session settings via `TenantConfig`

**Session Configuration (per-organization):**
| Setting | Default | Description |
|---------|---------|-------------|
| `accessTokenTtlMinutes` | 15 | Access token lifetime |
| `refreshTokenTtlDays` | 14 | Refresh token lifetime |
| `absoluteMaxDays` | 30 | Maximum session duration |
| `slidingWindow` | true | Extend on activity |
| `maxConcurrentSessions` | 10 | Max sessions per user |

**Security Features:**
- HttpOnly cookies for token storage (`gt_access`, `gt_refresh`)
- Refresh token hashed with SHA-256 before storage
- Unique JWT ID (`jti`) for rotation tracking
- Automatic cleanup of expired sessions

**API Endpoints:**
```typescript
POST   /auth/refresh              // Rotate tokens
GET    /auth/sessions             // List user sessions
DELETE /auth/sessions/:id         // Revoke specific session
POST   /auth/logout               // Revoke current session + clear cookies
```

**Cleanup:**
```bash
# Run session cleanup (cron recommended: hourly or daily)
pnpm db:session-cleanup
```

### 3. Multi-Tenancy (`src/platform/tenant/`)

Complete tenant isolation with dedicated gateway instances.

```typescript
// Tenant Architecture
┌────────────────────────────────────────────────────────┐
│                   Platform Gateway                      │
│                   (Port 19100)                          │
├────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Tenant A    │  │ Tenant B    │  │ Tenant C    │    │
│  │ Gateway     │  │ Gateway     │  │ Gateway     │    │
│  │ :19101      │  │ :19102      │  │ :19103      │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │            Tenant Router & Proxy                │   │
│  │  • Subdomain extraction                         │   │
│  │  • Request routing                              │   │
│  │  • WebSocket proxying                           │   │
│  └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

**Components:**
- **Port Allocator:** Dynamic port assignment (19101-19999)
- **Gateway Manager:** Process lifecycle management
- **Health Monitor:** Continuous health checks with backoff
- **Config Generator:** Per-tenant configuration
- **Credential Manager:** Encrypted credential storage

### 4. Connectors (`src/platform/connectors/`)

Enterprise data source integrations.

**Supported Connectors:**

| Type | Driver | Features |
|------|--------|----------|
| SQL Server | tedious | TDS protocol, Windows auth |
| PostgreSQL | Prisma | Native driver |
| MySQL | Prisma | Native driver |
| Dataverse | REST API | Dynamics 365 integration |
| Salesforce | jsforce | SOQL, REST, Bulk API |

**Architecture:**
```typescript
// Connection Pool with Health Checking
┌─────────────────────────────────────────────────────┐
│                 Connection Pool                      │
├─────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐       │
│  │ SQL Srv 1 │  │ Postgres  │  │ Salesforce│       │
│  │ Pool      │  │ Pool      │  │ Client    │       │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘       │
│        │              │              │              │
│  ┌─────┴──────────────┴──────────────┴─────┐       │
│  │           Health Checker                 │       │
│  │  • Periodic connection validation        │       │
│  │  • Automatic reconnection                │       │
│  │  • Status updates to DB                  │       │
│  └──────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
```

**Schema Hints Engine:**
- Business context for AI understanding
- Table/column descriptions
- Pattern matching for data interpretation

### 5. Workflows (`src/platform/workflows/`)

Visual workflow builder with AI-powered automation.

**Node Types:**

| Node | Purpose | Config |
|------|---------|--------|
| `trigger` | Start execution | manual, cron, webhook, chat |
| `agent` | AI processing | model, prompt, tools |
| `tool` | Function execution | tool name, args |
| `condition` | Branching logic | expression, branches |
| `communication` | Send messages | email, Teams, chat |
| `iterator` | Loop processing | collection, body |

**Execution Engine:**
```typescript
// Workflow Execution Flow
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Trigger  │────▶│ Agent    │────▶│ Condition│
│ (Webhook)│     │ (Claude) │     │ (if/else)│
└──────────┘     └──────────┘     └────┬─────┘
                                       │
                      ┌────────────────┼────────────────┐
                      ▼                                 ▼
               ┌──────────┐                      ┌──────────┐
               │ Tool     │                      │ Commun.  │
               │ (Query)  │                      │ (Email)  │
               └──────────┘                      └──────────┘
```

**Trigger Types:**
- **Manual:** API/UI initiated
- **Cron:** Scheduled (cron expressions)
- **Webhook:** HTTP callbacks (HMAC signed)
- **Chat:** Conversation triggers

### 6. Integrations (`src/platform/integrations/`)

Cloud service integrations.

**Microsoft 365:**
```typescript
// Available APIs
- Mail: Read/Send/Search emails
- Calendar: Events, scheduling
- Drive: OneDrive/SharePoint files
- Teams: Messages, channels
- Users: Directory search
```

**Google Workspace:**
```typescript
// Available APIs (with scopes)
- Drive: File access
- Gmail: Mail operations
- Calendar: Event management
```

### 7. Audit Logging (`src/platform/audit/`)

Comprehensive audit trail for compliance.

```typescript
// Audit Log Entry
{
  id: "uuid",
  organizationId: "uuid",
  actorId: "uuid",
  actorRole: "ADMIN",
  action: "user.role.changed",
  targetType: "user",
  targetId: "uuid",
  details: {
    oldRole: "USER",
    newRole: "ADMIN"
  },
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  createdAt: "2026-02-03T..."
}
```

**Risk Levels:**
- `low`: Read operations
- `medium`: Standard mutations
- `high`: Role/permission changes
- `critical`: Security-sensitive operations

---

## Database Schema

### Entity Relationship

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Organization   │────▶│      User       │────▶│   UserToken     │
│                 │     │                 │     │   (OAuth)       │
│ • name          │     │ • email         │     │ • provider      │
│ • externalTenant│     │ • role          │     │ • accessToken   │
│ • status        │     │ • externalId    │     │ • refreshToken  │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         │     ┌─────────────────┐     ┌─────────────────┐
         ├────▶│ TenantGateway   │     │  TenantConfig   │
         │     │ • port          │     │ • model         │
         │     │ • status        │     │ • limits        │
         │     └─────────────────┘     └─────────────────┘
         │
         │     ┌─────────────────┐     ┌─────────────────┐
         ├────▶│ResourceConnection│───▶│  SchemaHint     │
         │     │ • type          │     │ • tableName     │
         │     │ • config        │     │ • description   │
         │     └─────────────────┘     └─────────────────┘
         │
         │     ┌─────────────────┐     ┌─────────────────┐
         └────▶│    Workflow     │────▶│WorkflowExecution│
               │ • definition    │     │ • status        │
               │ • triggerType   │     │ • context       │
               └─────────────────┘     └─────────────────┘
```

### Key Tables

| Table | Purpose | Relations |
|-------|---------|-----------|
| `Organization` | Tenant root | Users, Connections, Workflows |
| `User` | Platform users | Organization, Tokens, Permissions |
| `UserToken` | OAuth tokens | User |
| `TenantGateway` | Gateway instances | Organization |
| `ResourceConnection` | Data sources | Organization, SchemaHints |
| `Workflow` | Workflow definitions | Organization, Executions |
| `AuditLog` | Audit trail | Organization |

---

## Security Model

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Authentication Layers                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SSO (Entra/Google)                                          │
│     └─▶ OAuth 2.0 Authorization Code + PKCE                     │
│                                                                  │
│  2. Token Storage                                                │
│     └─▶ AES-256-GCM encrypted in PostgreSQL                     │
│                                                                  │
│  3. Session Management                                           │
│     └─▶ JWT cookies (Phase 2B - pending)                        │
│                                                                  │
│  4. API Authorization                                            │
│     └─▶ Role-based (SUPER_ADMIN, ADMIN, USER, BILLING, VIEWER)  │
│                                                                  │
│  5. Tenant Isolation                                             │
│     └─▶ Per-org gateway processes with separate credentials     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Role-Based Access Control

| Role | Organization | Users | Connectors | Workflows | Billing |
|------|--------------|-------|------------|-----------|---------|
| SUPER_ADMIN | Full | Full | Full | Full | Full |
| ADMIN | Read/Update | Full | Full | Full | Read |
| USER | Read | Self | Use | Execute | - |
| BILLING | Read | - | - | - | Full |
| VIEWER | Read | Read | Read | Read | - |

### Permission System

Fine-grained permissions beyond roles:
- `CRM_CREATE`, `CRM_READ`, `CRM_UPDATE`, `CRM_DELETE`
- `SQL_EXECUTE`, `SQL_READONLY`
- `WORKFLOW_CREATE`, `WORKFLOW_EXECUTE`

---

## Infrastructure

### Development Environment

```yaml
# docker-compose.yml services
services:
  postgres:
    image: postgres:16
    ports: ["5434:5432"]
    
  goodteams-gateway:
    ports: ["19100:18789"]
    depends_on: postgres
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://goodteams:goodteams@localhost:5434/goodteams

# Microsoft Entra
ENTRA_CLIENT_ID=31446b34-023a-4be4-b931-9b64de7a101e
ENTRA_CLIENT_SECRET=<secret>
ENTRA_TENANT_ID=common  # Multi-tenant SaaS
ENTRA_REDIRECT_URI=http://localhost:19100/api/platform/auth/entra/callback

# Google OAuth
GOOGLE_CLIENT_ID=48421898102-xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<secret>
GOOGLE_REDIRECT_URI=http://localhost:19100/api/platform/auth/google/callback

# Security
CREDENTIAL_ENCRYPTION_KEY=<32-byte-hex>
```

### Port Allocations

| Port | Service |
|------|---------|
| 5434 | PostgreSQL (GoodTeams) |
| 5432 | PostgreSQL (Personal/Other) |
| 19100 | Platform Gateway |
| 18789 | Personal OpenClaw |
| 19101-19999 | Tenant Gateways |

---

## Testing Architecture

### Test Categories

```bash
# Unit tests (6615 total)
pnpm test

# E2E tests (39 total)
pnpm test:e2e

# Integration tests
pnpm tsx scripts/e2e-tests.ts

# Live provider tests
OPENCLAW_LIVE_TEST=1 pnpm test:live
```

### Coverage

| Phase | Tests | Coverage |
|-------|-------|----------|
| Phase 2: Security | 268 | Auth, RBAC, Audit |
| Phase 3: Multi-Tenancy | 225 | Tenant isolation |
| Phase 4: M365 | 419 | Integrations |
| Phase 5: Desktop Agent | 548 | Automation |
| Phase 6: Connectors | 500+ | DB/CRM |
| Phase 7: Workflows | 569 | Visual workflows |
| **Total** | **6615** | **99.92%** |

---

## Deployment Targets

### Supported Platforms

- **macOS:** Native Swift app + Node.js gateway
- **Windows:** Desktop agent with Office COM
- **Linux:** Docker containerized
- **iOS/Android:** Mobile companion apps

### Scaling Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                             │
└─────────────────────────────┬───────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Platform API  │     │ Platform API  │     │ Platform API  │
│ Instance 1    │     │ Instance 2    │     │ Instance N    │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  PostgreSQL       │
                    │  (Primary + Read  │
                    │   Replicas)       │
                    └───────────────────┘
```

---

## Roadmap Progress

| Phase | Name | Status | Weeks |
|-------|------|--------|-------|
| 1 | Foundation | ✅ Complete | 4 |
| 2 | Security & RBAC | ✅ Complete | 6 |
| 3 | Multi-Tenancy | ✅ Complete | 8 |
| 4 | M365 Integration | ✅ Complete | 6 |
| 5 | Desktop Agent | ✅ Complete | 8 |
| 6 | Database/CRM Connectors | ✅ Complete | 8 |
| 7 | Visual Workflows | ✅ Complete | 8 |
| 8 | Integration Testing | ✅ Complete | 4 |
| 9 | Compliance & Ops | 🔄 Next | 6 |
| 10 | Production Hardening | ⏳ Pending | 6 |

---

## Quick Reference

### Key Commands

```bash
# Start PostgreSQL (if using Docker)
docker-compose up -d postgres

# Run database migrations
pnpm db:push

# Start gateway
node openclaw.mjs --profile goodteams gateway --port 19100 --allow-unconfigured --token "$TOKEN"

# Run tests
pnpm test           # Unit tests
pnpm test:e2e       # E2E tests

# TypeScript check
npx tsc --noEmit

# Lint & format
pnpm lint
pnpm format:fix
```

### Important Files

| File | Purpose |
|------|---------|
| `src/platform/index.ts` | Platform module exports |
| `src/platform/db/schema.prisma` | Database schema |
| `docker-compose.yml` | Development services |
| `.env` | Environment configuration |
| `vitest.config.ts` | Test configuration |

---

*Last updated: February 3, 2026*
*Document version: 1.0*
