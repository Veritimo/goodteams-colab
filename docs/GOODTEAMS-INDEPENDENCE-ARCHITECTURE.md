# GoodTeams Independence Architecture

> **The definitive reference for building GoodTeams as an independent Workplace Personal Assistant platform.**

**Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Foundation — What We Have](#2-current-foundation--what-we-have)
3. [Architecture Overview](#3-architecture-overview)
4. [Component Responsibilities](#4-component-responsibilities)
5. [Feature Inventory with Context](#5-feature-inventory-with-context)
6. [Data Model](#6-data-model)
7. [Implementation Phases](#7-implementation-phases)
8. [Safety Integration Points](#8-safety-integration-points)
9. [CLI & Operations](#9-cli--operations)
10. [References & Deep Dives](#10-references--deep-dives)

---

## 1. Executive Summary

### GoodTeams: The Workplace Personal Assistant

GoodTeams transforms how knowledge workers interact with enterprise systems. It's not a chatbot—it's a **workplace personal assistant** that:

- **Learns** your role, projects, and team dynamics
- **Remembers** context across conversations and sessions
- **Proactively helps** with deadlines, meetings, and communication
- **Acts safely** within configurable autonomy boundaries
- **Integrates** with the tools you already use (Teams, Slack, Salesforce, Dataverse)

### What We Have vs. What We're Building

```
┌─────────────────────────────────────────────────────────────────┐
│                    WHAT WE HAVE (98% complete)                  │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Multi-tenant Platform     ✅ JWT Sessions        ~89K LOC   │
│  ✅ Entra SSO + Google OAuth  ✅ RBAC Permissions               │
│  ✅ Enterprise Connectors     ✅ Workflow Engine                │
│  ✅ Audit Logging            ✅ Admin UIs                       │
│  ✅ PostgreSQL + Prisma      ✅ Full REST API                   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WHAT WE'RE BUILDING                          │
├─────────────────────────────────────────────────────────────────┤
│  🔨 GoodTeams Gateway        🔨 Agent Loop                      │
│  🔨 Session Manager          🔨 Memory System                   │
│  🔨 Skills Engine            🔨 Safety Controller               │
│  🔨 Teams/Slack Channels     🔨 Workplace Heartbeat             │
│  🔨 goodteams CLI            🔨 Sub-agent System                │
└─────────────────────────────────────────────────────────────────┘
```

**The insight:** We're 98% independent from OpenClaw. The platform we built has zero imports from OpenClaw core. We only touch OpenClaw at **two coupling points**: API mounting and gateway process spawning. Building our own gateway unlocks full independence.

### Key Principles

1. **Start with what exists** — Our platform is rock solid. Build on it.
2. **Safety is architecture** — Not bolted on, baked in at every layer.
3. **Workplace context everywhere** — Every feature serves enterprise use cases.
4. **Actionable** — Developers can implement from this document.
5. **Single source of truth** — This is THE reference during implementation.

---

## 2. Current Foundation — What We Have

### 2.1 Technology Stack

| Layer | Technology | Status |
|-------|------------|--------|
| **Runtime** | Node.js 22+ | ✅ Done |
| **Language** | TypeScript 5.9 | ✅ Done |
| **Database** | PostgreSQL 15 | ✅ Done |
| **ORM** | Prisma 6 | ✅ Done |
| **Queue** | BullMQ + Redis | ✅ Done |
| **Frontend** | React 18 + TailwindCSS | ✅ Done |
| **Build** | Vite + pnpm | ✅ Done |

### 2.2 Module Inventory

#### Authentication & Authorization (`src/platform/auth/`, `src/platform/session/`)

| Component | Files | Status | Description |
|-----------|-------|--------|-------------|
| **RBAC System** | `permissions.ts`, `check-permission.ts` | ✅ Done | Role-based access control with 5 roles |
| **Admin Guards** | `admin-guard.ts` | ✅ Done | Prevents removing last admin |
| **Entra SSO** | `entra/*.ts` (9 files) | ✅ Done | Microsoft OAuth2 + consent flows |
| **Google OAuth** | `google-auth.ts` | ✅ Done | Google workspace authentication |
| **JWT Sessions** | `session/*.ts` (9 files) | ✅ Done | Access/refresh tokens, rotation |
| **Session Middleware** | `session/middleware.ts` | ✅ Done | Request authentication |

**What works today:**
- Users authenticate via Entra SSO or Google OAuth
- JWT access tokens (15min) + refresh tokens (14 days)
- Session cleanup and token rotation
- Role-based permissions with granular checks

#### Database Layer (`src/platform/db/`)

| Component | Status | Description |
|-----------|--------|-------------|
| **Prisma Schema** | ✅ Done | 500+ line schema with 17 models |
| **Client** | ✅ Done | PostgreSQL connection management |
| **Migrations** | ✅ Done | Full migration history |

**Key models:** Organization, User, Session, UserToken, OrganizationInvitation, UserPermission, OrganizationSkill, AuditLog, TenantGateway, TenantConfig, TenantCredential, ResourceConnection, SchemaHint, SchemaCache, Workflow, WorkflowExecution

#### Platform API (`src/platform/api/`)

| Route | Handler | Status | Description |
|-------|---------|--------|-------------|
| `/api/platform/health` | `handleHealth` | ✅ Done | Health checks |
| `/api/platform/org` | `handleOrg` | ✅ Done | Organization CRUD |
| `/api/platform/users` | `handleUsers` | ✅ Done | User management |
| `/api/platform/invitations` | `handleInvitations` | ✅ Done | Invite flow |
| `/api/platform/permissions` | `handlePermissions` | ✅ Done | RBAC management |
| `/api/platform/audit` | `handleAudit` | ✅ Done | Audit log queries |
| `/api/platform/auth` | `handleAuth` | ✅ Done | Auth flows (Entra, Google) |
| `/api/platform/workflows` | `handleWorkflows` | ✅ Done | Workflow CRUD + execution |
| `/api/platform/connectors` | `handleConnectors` | ✅ Done | Data connector management |
| `/api/platform/tenant` | `handleTenantGateway` | ✅ Done | Tenant provisioning |

**Key file:** `src/platform/api/index.ts` — Router mounting all routes under `/api/platform`

#### Audit System (`src/platform/audit/`)

| Component | File | Status | Description |
|-----------|------|--------|-------------|
| **Logger** | `logger.ts` | ✅ Done | Audit event logging |
| **Actions** | `actions.ts` | ✅ Done | Action types and risk levels |
| **Query** | `query.ts` | ✅ Done | Pagination and filtering |
| **Export** | `export.ts` | ✅ Done | CSV/JSON export |
| **Context** | `context.ts` | ✅ Done | System context for automated actions |

**What works today:**
- All user actions logged with actor, target, details
- Queryable by organization, actor, action type, time range
- Export to CSV/JSON for compliance
- Risk level classification (low, medium, high, critical)

#### Multi-Tenant Management (`src/platform/tenant/`)

| Component | File | Status | Description |
|-----------|------|--------|-------------|
| **Gateway Provisioner** | `gateway-provisioner.ts` | ✅ Done | Tenant gateway setup |
| **Gateway Manager** | `gateway-manager.ts` | ⚠️ OpenClaw CLI | Process lifecycle |
| **Port Allocator** | `port-allocator.ts` | ✅ Done | Dynamic port assignment |
| **Credential Vault** | `credential-vault.ts` | ✅ Done | Encrypted secret storage |
| **Config Generator** | `config-generator.ts` | ✅ Done | Per-tenant config files |
| **Health Monitor** | `gateway-health.ts` | ✅ Done | Heartbeat checks |
| **Tenant Router** | `router.ts` | ✅ Done | Subdomain-based routing |
| **WebSocket Proxy** | `ws-proxy.ts` | ✅ Done | WS connection routing |

**The coupling point:** `gateway-manager.ts` spawns `openclaw gateway run`. This is what we're replacing.

#### Enterprise Connectors (`src/platform/connectors/`)

| Connector | Files | Status | Features |
|-----------|-------|--------|----------|
| **Dataverse** | `dataverse/*.ts` | ✅ Done | REST client, TDS endpoint, entity metadata, bulk ops, CRM query generator |
| **Salesforce** | `salesforce/*.ts` | ✅ Done | OAuth, SOQL client, metadata, bulk operations |
| **SQL Server** | `sql/mssql-client.ts` | ✅ Done | Connection pool, query execution |
| **PostgreSQL** | `sql/postgres-client.ts` | ✅ Done | Connection pool, query execution |
| **Schema Hints** | `schema-hints/*.ts` | ✅ Done | LLM context enhancement |

**Common infrastructure:**
- Connection pooling (`connection-pool.ts`)
- Health checking (`health-checker.ts`)
- Credential encryption (via `credential-vault.ts`)

#### Workflow Engine (`src/platform/workflows/`)

| Component | File | Status | Description |
|-----------|------|--------|-------------|
| **Types** | `types.ts` | ✅ Done | Full type definitions |
| **Validation** | `validation.ts` | ✅ Done | Graph validation, variable reference checking |
| **Service** | `service.ts` | ✅ Done | CRUD operations with Prisma |
| **Triggers** | `triggers/*.ts` | ✅ Done | Manual, Cron, Webhook, Chat |
| **Node Executors** | `nodes/*.ts` | ✅ Done | Agent, Tool, Condition, Communication, Iterator |
| **Tools** | `tools/*.ts` | ✅ Done | Agent tool definitions for workflow management |

**Node types supported:**
- **Trigger**: Manual, cron, webhook, chat, email
- **Agent**: LLM interaction
- **Tool**: Custom function execution
- **Condition**: Branching logic
- **Communication**: Email, Teams, chat
- **Iterator**: Loop execution

#### Integrations (`src/platform/integrations/`)

| Integration | Status | Features |
|-------------|--------|----------|
| **Google Calendar** | ✅ Done | Event CRUD, availability |
| **Google Drive** | ✅ Done | File operations |
| **Gmail** | ✅ Done | Email operations |
| **SharePoint** | ✅ Done | Document operations |
| **Outlook** | ✅ Done | Calendar + email |

#### Admin UIs (`src/platform/ui/`)

| UI | Directory | Status | Description |
|----|-----------|--------|-------------|
| **Org Admin** | `admin/` | ✅ Done | User management, invitations, permissions |
| **Platform Admin** | `platform-admin/` | ✅ Done | Super admin dashboard, org management |
| **Onboarding** | `onboarding/` | ✅ Done | Self-service tenant setup |
| **Workflow Designer** | `workflows/` | ✅ Done | Visual workflow builder |

**Tech:** React 18, React Query, React Router, TailwindCSS

### 2.3 Code Statistics

| Module | Lines of Code | Files | Test Coverage |
|--------|---------------|-------|---------------|
| `auth/` | ~3,500 | 15 | 85%+ |
| `session/` | ~2,500 | 9 | 90%+ |
| `audit/` | ~2,000 | 10 | 85%+ |
| `db/` | ~700 | 5 | N/A (schema) |
| `api/` | ~3,000 | 26 | 80%+ |
| `tenant/` | ~4,000 | 17 | 85%+ |
| `connectors/` | ~12,000 | 45 | 80%+ |
| `workflows/` | ~20,000 | 50+ | 75%+ |
| `integrations/` | ~5,000 | 25+ | 70%+ |
| `ui/` | ~15,000 | 40+ | 60%+ |
| **Total** | **~89,000** | **240+** | **~75%** |

---

## 3. Architecture Overview

### 3.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GOODTEAMS PLATFORM                                │
│                     "The Workplace Personal Assistant"                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     GOODTEAMS GATEWAY (Building)                    │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│  │  │  HTTP    │  │WebSocket │  │  Hooks   │  │ Channel Plugins  │   │   │
│  │  │  Server  │  │  Server  │  │  Server  │  │  (Teams, Slack)  │   │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │   │
│  │       └──────────────┴───────────┬┴─────────────────┘              │   │
│  │                                  │                                  │   │
│  │  ┌───────────────┐  ┌───────────▼───────────┐  ┌────────────────┐ │   │
│  │  │   Session     │  │      Agent Loop       │  │     Tools      │ │   │
│  │  │   Manager     │◄─┤   (LLM Orchestrator)  ├─►│   Execution    │ │   │
│  │  └───────────────┘  └───────────────────────┘  └────────────────┘ │   │
│  │                              │                                     │   │
│  │  ┌───────────────────────────┼───────────────────────────────────┐│   │
│  │  │              SAFETY CONTROLLER (Embedded)                      ││   │
│  │  │  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌─────────────┐  ││   │
│  │  │  │ Action  │  │ Approval │  │  Rate      │  │  Audit      │  ││   │
│  │  │  │Classify │  │ Queue    │  │  Limiter   │  │  Logger     │  ││   │
│  │  │  │ T0-T4   │  │          │  │            │  │             │  ││   │
│  │  │  └─────────┘  └──────────┘  └────────────┘  └─────────────┘  ││   │
│  │  └──────────────────────────────────────────────────────────────┘│   │
│  │                                                                    │   │
│  │  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │   │
│  │  │  Memory    │  │  Skills  │  │    Cron    │  │  Sub-agents  │  │   │
│  │  │  (Vector)  │  │  System  │  │  Scheduler │  │   Spawner    │  │   │
│  │  └────────────┘  └──────────┘  └────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                 WORKPLACE PERSONAL ASSISTANT LAYER                  │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────────┐  │   │
│  │  │  Identity    │  │   Memory      │  │  Proactive Heartbeat    │  │   │
│  │  │  (SOUL/USER) │  │  (Context)    │  │  (Inbox/Calendar/Tasks) │  │   │
│  │  └──────────────┘  └───────────────┘  └─────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PLATFORM SERVICES (Already Built!)               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Auth/RBAC │ Sessions │ Multi-Tenant │ Workflows │ Connectors      │   │
│  │  Audit     │ API      │ Admin UI     │ Database  │ Entra SSO       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          DATA LAYER                                 │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  ┌───────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │   │
│  │  │  PostgreSQL       │  │  Redis          │  │  Vector Store   │   │   │
│  │  │  (Platform DB)    │  │  (Queue/Cache)  │  │  (pgvector)     │   │   │
│  │  └───────────────────┘  └─────────────────┘  └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    EXTERNAL INTEGRATIONS                            │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  M365 (Teams, Outlook, SharePoint)  │  Salesforce  │  Dataverse    │   │
│  │  Google Workspace (Gmail, Calendar, Drive)  │  Custom SQL DBs      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Safety Tier Integration

Safety is embedded at the architecture level, not bolted on:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ACTION FLOW WITH SAFETY                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Request                                                               │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────┐                                                        │
│  │ Action Classifier│  Determines tier: T0 (observe) → T4 (critical)       │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────────────────────────────────────────────┐              │
│  │  T0: Observe     │ Automatic. Read-only. Full audit.     │              │
│  │  T1: Draft       │ Automatic. Creates artifacts for review.│            │
│  │  T2: Internal Act│ Configurable. Low-risk org actions.    │              │
│  │  T3: External Act│ Approval required. External visibility. │             │
│  │  T4: Critical    │ Dual approval. Irreversible actions.   │              │
│  └────────┬─────────────────────────────────────────────────┘              │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Approval Queue  │  Pre-approval, batch review, or async                 │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Rate Limiter    │  Per-user, per-action limits                          │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Execute + Audit │  Action logged before execution                       │
│  └─────────────────┘                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Multi-Tenant Gateway Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MULTI-TENANT ROUTING                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Request: acme.goodteams.ai/chat                                           │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────┐                                                        │
│  │ Tenant Router   │  Extracts org from subdomain/header                   │
│  │ (router.ts)     │  Looks up TenantGateway                               │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Load Balancer   │  Routes to correct gateway port                       │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Per-Org Gateways (Isolated Processes)                              │   │
│  ├─────────────────┬─────────────────┬─────────────────┬───────────────┤   │
│  │ Acme Corp       │ Initech         │ Umbrella Inc    │ ...           │   │
│  │ Port: 18789     │ Port: 18790     │ Port: 18791     │               │   │
│  │ Agent: Atlas    │ Agent: Iris     │ Agent: Nova     │               │   │
│  └─────────────────┴─────────────────┴─────────────────┴───────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Responsibilities

### 4.1 GoodTeams Gateway

**What it does:**
- Central daemon orchestrating all agent operations
- Serves HTTP/WebSocket for client connections
- Manages channel integrations (Teams, Slack)
- Runs heartbeat and cron systems
- Hosts the agent runtime

**Key interfaces:**
```typescript
interface GatewayServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  status(): GatewayStatus;
  
  // Agent operations
  runAgent(sessionKey: string, message: string): AsyncGenerator<AgentEvent>;
  
  // Channel management
  startChannel(channelId: string): Promise<void>;
  stopChannel(channelId: string): Promise<void>;
}
```

**Safety considerations:**
- All requests authenticated via JWT or channel tokens
- Rate limiting at gateway level
- Tenant isolation enforced at process level
- Action audit before execution

**Key files to create:** `src/goodteams-gateway/server.ts`, `server-http.ts`, `server-ws.ts`

### 4.2 Agent Loop

**What it does:**
- Core "think → act → respond" cycle
- Assembles context (system prompt, history, tools)
- Calls LLM for inference
- Executes tool calls with safety checks
- Streams responses to clients
- Persists session history

**Key interfaces:**
```typescript
interface AgentRunner {
  run(params: AgentRunParams): AsyncGenerator<AgentEvent>;
}

interface AgentRunParams {
  sessionKey: string;
  message: string;
  organizationId: string;
  userId: string;
  channel: string;
}

type AgentEvent = 
  | { type: "thinking"; content: string }
  | { type: "text"; content: string }
  | { type: "tool_call"; tool: string; params: unknown }
  | { type: "tool_result"; tool: string; result: unknown }
  | { type: "done"; usage: TokenUsage };
```

**Safety considerations:**
- Tool calls classified by safety tier before execution
- Action audit for every tool invocation
- Rate limiting per user/session
- Context injection for workplace policies

**Workplace context:**
- Loads ORGANIZATION-SOUL.md, TEAM-SOUL.md for persona
- Loads employee profile for user context
- Injects current date, calendar context, pending tasks

### 4.3 Session Manager

**What it does:**
- Maps inbound messages to session keys
- Stores conversation history in PostgreSQL
- Handles session resets (daily, idle, manual)
- Manages per-org, per-user isolation

**Key interfaces:**
```typescript
interface SessionManager {
  getSession(sessionKey: string): Promise<Session>;
  appendMessage(sessionKey: string, message: Message): Promise<void>;
  resetSession(sessionKey: string, reason: string): Promise<void>;
  listSessions(userId: string): Promise<Session[]>;
}

// Session key format
// "org:{orgId}:user:{userId}:channel:{channel}"
// "org:{orgId}:user:{userId}:channel:{channel}:thread:{threadId}"
```

**Safety considerations:**
- Sessions scoped to organization
- User can only access own sessions
- Session transcripts stored encrypted
- Audit log for session operations

### 4.4 Memory System

**What it does:**
- Provides persistent memory across sessions
- Vector search for semantic retrieval
- Daily notes for running context
- Work context (projects, people, decisions)

**Key interfaces:**
```typescript
interface MemoryManager {
  search(query: string, options: SearchOptions): Promise<MemoryResult[]>;
  store(content: string, metadata: MemoryMetadata): Promise<void>;
  getWorkContext(userId: string): Promise<WorkContext>;
  updateWorkContext(userId: string, context: Partial<WorkContext>): Promise<void>;
}

interface WorkContext {
  currentProjects: Project[];
  teamMembers: Person[];
  recentDecisions: Decision[];
  tribalKnowledge: string[];
}
```

**Safety considerations:**
- Memory scoped to organization
- Privacy controls per memory category
- No cross-org memory leakage
- Memory search logged in audit

**Workplace context:**
- Categories: project, person, decision, tribal knowledge
- Integration with task systems (Jira, Linear)
- Team-level shared memories

### 4.5 Skills Engine

**What it does:**
- Loads and manages skills from database
- Injects skill documentation into system prompt
- Handles skill installation and updates
- Validates skill availability

**Key interfaces:**
```typescript
interface SkillsEngine {
  loadSkills(organizationId: string): Promise<Skill[]>;
  getSkillForTool(toolName: string): Skill | undefined;
  installSkill(orgId: string, skillId: string): Promise<void>;
  checkAvailability(skillId: string): Promise<SkillStatus>;
}
```

**Safety considerations:**
- Skills scoped to organization
- Role-based skill access (admin, user)
- Skill audit on installation/removal
- Skill execution logged

### 4.6 Connector Framework

**What it does:**
- Manages connections to external data sources
- Provides unified query interface
- Handles authentication and connection pooling
- Caches schema information for LLM context

**Key interfaces:** (Already built in `src/platform/connectors/`)

```typescript
interface ConnectorService {
  connect(connectionId: string): Promise<Connection>;
  query(connectionId: string, query: string): Promise<QueryResult>;
  getSchema(connectionId: string): Promise<SchemaInfo>;
  testConnection(connectionId: string): Promise<HealthResult>;
}
```

**Safety considerations:**
- Credentials encrypted at rest
- Connection-level read-only mode
- Query logging for audit
- Rate limiting per connection

### 4.7 Workflow Engine

**What it does:**
- Manages workflow definitions and executions
- Supports multiple trigger types
- Executes nodes in dependency order
- Handles errors and retries

**Key interfaces:** (Already built in `src/platform/workflows/`)

**Safety considerations:**
- Workflow execution logged
- Per-node approval settings
- Error isolation between nodes
- Execution timeout limits

### 4.8 Safety Controller

**What it does:**
- Classifies actions by safety tier (T0-T4)
- Manages approval queue for higher-tier actions
- Enforces rate limits
- Coordinates with audit system

**Key interfaces:**
```typescript
interface SafetyController {
  classifyAction(action: Action): SafetyTier;
  requiresApproval(action: Action): boolean;
  queueForApproval(action: Action): Promise<ApprovalRequest>;
  checkRateLimit(userId: string, actionType: string): Promise<boolean>;
  logAction(action: Action, result: ActionResult): Promise<void>;
}

enum SafetyTier {
  T0_OBSERVE = 0,    // Read-only, automatic
  T1_DRAFT = 1,      // Creates artifacts, automatic
  T2_INTERNAL = 2,   // Internal actions, configurable
  T3_EXTERNAL = 3,   // External actions, approval required
  T4_CRITICAL = 4,   // Critical actions, dual approval
}
```

**Workplace context:**
- Org-level policy configuration
- Per-user autonomy levels
- Escalation to managers for sensitive actions

### 4.9 Audit System

**What it does:** (Already built in `src/platform/audit/`)

- Logs all user and agent actions
- Provides query interface for compliance
- Exports for external audit systems
- Tracks action attribution

**Key files:** `audit/logger.ts`, `audit/query.ts`, `audit/export.ts`

---

## 5. Feature Inventory with Context

### 5.1 Core Platform (Mostly Done)

| Feature | Status | Safety Tier | Workplace Context | Priority | Key Files |
|---------|--------|-------------|-------------------|----------|-----------|
| Entra SSO | ✅ Done | T0 | Enterprise identity | P0 | `auth/entra/*.ts` |
| Google OAuth | ✅ Done | T0 | Workspace identity | P0 | `api/routes/google-auth.ts` |
| JWT Sessions | ✅ Done | T0 | Secure auth | P0 | `session/*.ts` |
| RBAC Permissions | ✅ Done | T0 | Access control | P0 | `auth/permissions.ts` |
| Organization CRUD | ✅ Done | T2 | Multi-tenant | P0 | `api/routes/org.ts` |
| User Management | ✅ Done | T2 | Team management | P0 | `api/routes/users.ts` |
| Invitations | ✅ Done | T2 | Onboarding | P0 | `api/routes/invitations.ts` |
| Audit Logging | ✅ Done | T0 | Compliance | P0 | `audit/*.ts` |
| Admin UI | ✅ Done | T0 | Administration | P0 | `ui/admin/*.tsx` |
| Platform Admin | ✅ Done | T0 | Super admin | P0 | `ui/platform-admin/*.tsx` |
| Onboarding Flow | ✅ Done | T2 | Self-service | P0 | `ui/onboarding/*.tsx` |

### 5.2 Agent Features (Building)

| Feature | Status | Safety Tier | Workplace Context | Priority | Key Files |
|---------|--------|-------------|-------------------|----------|-----------|
| Agent Loop | 🔨 Build | T1-T4 | LLM orchestration | P0 | `gateway/agent-loop.ts` |
| Session Management | 🔨 Build | T0 | Conversation state | P0 | `gateway/session-manager.ts` |
| Tool Framework | 🔨 Build | T1-T4 | Action execution | P0 | `gateway/tools/*.ts` |
| Memory System | 🔨 Build | T0-T1 | Context retrieval | P1 | `gateway/memory/*.ts` |
| Sub-agents | 🔨 Build | T1-T2 | Parallel work | P1 | `gateway/subagent/*.ts` |
| Skills Engine | 🔨 Build | T0 | Capability loading | P1 | `gateway/skills/*.ts` |
| Cron Service | 🔨 Build | T1-T3 | Scheduled tasks | P1 | `gateway/cron/*.ts` |

### 5.3 Workplace Assistant (Building)

| Feature | Status | Safety Tier | Workplace Context | Priority | Key Files |
|---------|--------|-------------|-------------------|----------|-----------|
| Org Personas | 🔨 Build | T0 | Culture + tone | P0 | `gateway/identity/org-soul.ts` |
| Employee Profiles | 🔨 Build | T0 | Role context | P0 | `gateway/identity/employee.ts` |
| Work Memory | 🔨 Build | T0 | Project context | P0 | `gateway/memory/work-context.ts` |
| Daily Notes | 🔨 Build | T1 | Session logs | P1 | `gateway/memory/daily-notes.ts` |
| Workplace Heartbeat | 🔨 Build | T0-T2 | Proactive checks | P1 | `gateway/heartbeat/*.ts` |
| Meeting Transcription | 🔨 Build | T0 | Audio → text | P1 | `gateway/transcription/*.ts` |

### 5.4 Enterprise Safety (Building)

| Feature | Status | Safety Tier | Workplace Context | Priority | Key Files |
|---------|--------|-------------|-------------------|----------|-----------|
| Action Classification | 🔨 Build | N/A | Tier system | P0 | `gateway/safety/classifier.ts` |
| Approval Queue | 🔨 Build | N/A | HITL patterns | P0 | `gateway/safety/approvals.ts` |
| Rate Limiting | 🔨 Build | N/A | Abuse prevention | P0 | `gateway/safety/rate-limiter.ts` |
| Prompt Injection Defense | 🔨 Build | N/A | Security | P0 | `gateway/safety/input-filter.ts` |
| Content Filters | 🔨 Build | N/A | PII protection | P0 | `gateway/safety/output-filter.ts` |

### 5.5 Integrations (Partial)

| Feature | Status | Safety Tier | Workplace Context | Priority | Key Files |
|---------|--------|-------------|-------------------|----------|-----------|
| Dataverse Connector | ✅ Done | T2-T3 | CRM data | P0 | `connectors/dataverse/*.ts` |
| Salesforce Connector | ✅ Done | T2-T3 | CRM data | P0 | `connectors/salesforce/*.ts` |
| SQL Connectors | ✅ Done | T2 | Database access | P0 | `connectors/sql/*.ts` |
| MS Teams Channel | 🔨 Build | T1-T3 | Enterprise chat | P0 | `gateway/channels/teams/*.ts` |
| Slack Channel | 🔨 Build | T1-T3 | Enterprise chat | P0 | `gateway/channels/slack/*.ts` |
| Webchat | 🔨 Build | T1-T3 | Built-in UI | P0 | `gateway/channels/webchat/*.ts` |
| Google Calendar | ✅ Done | T2 | Scheduling | P1 | `integrations/google/calendar/*.ts` |
| Google Drive | ✅ Done | T2 | Documents | P1 | `integrations/google/drive/*.ts` |
| Gmail | ✅ Done | T2-T3 | Email | P1 | `integrations/google/gmail/*.ts` |
| SharePoint | ✅ Done | T2 | Documents | P1 | `integrations/microsoft/sharepoint/*.ts` |
| Outlook | ✅ Done | T2-T3 | Calendar + Email | P1 | `integrations/microsoft/outlook/*.ts` |

---

## 6. Data Model

### 6.1 Current Schema (17 Models)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ENTITY RELATIONSHIPS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐                                                           │
│  │ Organization │──┬──► Users                                               │
│  │              │  ├──► Invitations                                         │
│  │              │  ├──► Skills                                              │
│  │              │  ├──► AuditLogs                                           │
│  │              │  ├──► TenantGateway (1:1)                                 │
│  │              │  ├──► TenantConfig (1:1)                                  │
│  │              │  ├──► TenantCredentials                                   │
│  │              │  ├──► ResourceConnections                                 │
│  │              │  └──► Workflows                                           │
│  └──────────────┘                                                           │
│                                                                             │
│  ┌──────────────┐                                                           │
│  │    User      │──┬──► Sessions (Platform auth)                            │
│  │              │  ├──► UserTokens (OAuth)                                  │
│  │              │  ├──► UserPermissions                                     │
│  │              │  └──► IssuedInvitations                                   │
│  └──────────────┘                                                           │
│                                                                             │
│  ┌──────────────┐                                                           │
│  │ Workflow     │──────► WorkflowExecutions                                 │
│  └──────────────┘                                                           │
│                                                                             │
│  ┌──────────────────────┐                                                   │
│  │ ResourceConnection   │──┬──► SchemaHints                                 │
│  │                      │  └──► SchemaCache (1:1)                           │
│  └──────────────────────┘                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Additions Needed

The following models need to be added for full workplace assistant functionality:

```prisma
// =============================================================================
// AGENT SESSION (Conversation State)
// =============================================================================

model AgentSession {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation(fields: [userId], references: [id])

  sessionKey     String       @unique  // "org:{id}:user:{id}:channel:{ch}"
  channel        String                // "teams", "slack", "webchat"
  status         SessionStatus @default(ACTIVE)
  
  // Session state
  lastMessageAt  DateTime?
  messageCount   Int          @default(0)
  tokenCount     Int          @default(0)
  
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  messages       AgentMessage[]
  
  @@index([organizationId, userId])
  @@index([channel])
  @@index([lastMessageAt])
}

// =============================================================================
// AGENT MESSAGE (Conversation History)
// =============================================================================

model AgentMessage {
  id        String        @id @default(uuid())
  sessionId String
  session   AgentSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  role      MessageRole   // user, assistant, system, tool
  content   String        @db.Text
  toolCalls Json?         // For assistant tool calls
  toolResults Json?       // For tool responses
  
  tokens    Int           @default(0)
  createdAt DateTime      @default(now())
  
  @@index([sessionId, createdAt])
}

// =============================================================================
// MEMORY (Vector + Context Storage)
// =============================================================================

model Memory {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String?      // Null = org-level memory
  user           User?        @relation(fields: [userId], references: [id])
  
  category       MemoryCategory  // project, person, decision, tribal
  content        String       @db.Text
  embedding      Unsupported("vector(1536)")?
  metadata       Json         @default("{}")
  
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  
  @@index([organizationId, category])
  @@index([userId])
}

// =============================================================================
// EMPLOYEE PROFILE (Adapted USER.md)
// =============================================================================

model EmployeeProfile {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String       @unique
  user           User         @relation(fields: [userId], references: [id])
  
  identity       Json         @default("{}")  // name, role, department
  workContext    Json         @default("{}")  // projects, specialties
  communication  Json         @default("{}")  // style, preferences
  workingPatterns Json        @default("{}")  // hours, focus time
  goals          Json         @default("{}")  // quarterly, career
  preferences    Json         @default("{}")  // notification, autonomy level
  
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}

// =============================================================================
// ACTION APPROVAL (Safety HITL)
// =============================================================================

model ActionApproval {
  id             String         @id @default(uuid())
  organizationId String
  organization   Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String
  user           User           @relation(fields: [userId], references: [id])
  
  actionType     String
  actionDetails  Json
  safetyTier     Int            // 0-4
  status         ApprovalStatus @default(PENDING)
  
  requestedAt    DateTime       @default(now())
  expiresAt      DateTime
  decidedAt      DateTime?
  decidedBy      String?
  decision       String?        // approved, rejected, modified
  
  @@index([organizationId, status])
  @@index([userId])
  @@index([expiresAt])
}

// =============================================================================
// ADDITIONAL ENUMS
// =============================================================================

enum SessionStatus {
  ACTIVE
  IDLE
  RESET
  ARCHIVED
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
  TOOL
}

enum MemoryCategory {
  PROJECT
  PERSON
  DECISION
  TRIBAL
  GENERAL
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}
```

### 6.3 Database Migrations Needed

```sql
-- 1. Add pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create indexes for vector search
CREATE INDEX idx_memory_embedding ON "Memory" 
  USING ivfflat (embedding vector_cosine_ops);
```

---

## 7. Implementation Phases

### Phase 1: Core Gateway (6 weeks)

**Goal:** Basic gateway with agent loop, sessions, and webchat. Replace OpenClaw CLI dependency.

#### Week 1-2: Foundation

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Gateway package | Create `src/goodteams-gateway/` structure | `index.ts` |
| HTTP Server | Express/Hono setup with routes | `server-http.ts` |
| WebSocket Server | Real-time client connections | `server-ws.ts` |
| Configuration | Config loading and validation | `config/*.ts` |
| CLI Foundation | `goodteams gateway start/stop/status` | `cli/commands/gateway.ts` |

**Existing code leveraged:**
- Platform API mounting from `src/platform/api/index.ts`
- Config patterns from tenant management
- Authentication middleware

**Safety gates:**
- JWT validation on all requests
- Tenant isolation checks

#### Week 3-4: Agent Loop

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Agent Runner | Core orchestration loop | `agent/runner.ts` |
| System Prompt | Prompt construction with context | `agent/system-prompt.ts` |
| Model Integration | Claude/GPT-4 API calls | `agent/model-client.ts` |
| Stream Handler | Response streaming | `agent/stream.ts` |
| Context Guard | Token limit management | `agent/context-guard.ts` |

**Existing code leveraged:**
- Audit logging from `src/platform/audit/`
- Error handling patterns

**Safety gates:**
- Action classification before tool execution
- Audit logging for all LLM calls

#### Week 5: Session Management

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Session Store | PostgreSQL session storage | `session/store.ts` |
| Session Keys | Key format and resolution | `session/keys.ts` |
| Message Persistence | Conversation history | `session/messages.ts` |
| Reset Policies | Daily/idle/manual reset | `session/reset.ts` |

**Schema additions:**
- `AgentSession` model
- `AgentMessage` model

**Safety gates:**
- Org-scoped session access
- User can only access own sessions

#### Week 6: Tool Framework

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Tool Definitions | read, write, edit, exec | `tools/*.ts` |
| Tool Policy | Permission checking | `tools/policy.ts` |
| Web Tools | web_search, web_fetch | `tools/web.ts` |
| Tool Executor | Unified execution | `tools/executor.ts` |

**Safety gates:**
- Tool classification by safety tier
- Rate limiting per tool type
- Audit logging for all tool calls

**Phase 1 Deliverables:**
- ✅ `goodteams gateway start/stop/status` works
- ✅ Webchat functional with conversation
- ✅ Basic tools (read, write, exec, web_search)
- ✅ Sessions persist across restarts
- ✅ **No OpenClaw CLI dependency**

---

### Phase 2: Memory & Workplace Features (4 weeks)

**Goal:** Full workplace personal assistant with memory, heartbeat, and transcription.

#### Week 7: Memory System

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Vector Store | pgvector integration | `memory/vector-store.ts` |
| Memory Manager | CRUD operations | `memory/manager.ts` |
| Search | Semantic + BM25 hybrid | `memory/search.ts` |
| Work Context | Project/people/decisions | `memory/work-context.ts` |

**Schema additions:**
- `Memory` model with vector column

**Safety gates:**
- Memory scoped to organization
- Search results audited

#### Week 8: Workplace Identity

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Org Personas | ORGANIZATION-SOUL.md loading | `identity/org-soul.ts` |
| Team Personas | TEAM-SOUL.md loading | `identity/team-soul.ts` |
| Employee Profiles | USER.md adaptation | `identity/employee.ts` |
| Context Injection | Inject into system prompt | `identity/context.ts` |

**Schema additions:**
- `EmployeeProfile` model

**Safety gates:**
- Profile privacy controls
- Manager visibility rules

#### Week 9: Skills & Sub-agents

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Skills Loader | Load from database | `skills/loader.ts` |
| Skills API | Install/uninstall | `skills/api.ts` |
| Sub-agent Registry | Track spawned agents | `subagent/registry.ts` |
| Sub-agent Announce | Result delivery | `subagent/announce.ts` |

**Existing code leveraged:**
- `OrganizationSkill` model already exists

**Safety gates:**
- Role-based skill access
- Sub-agent isolation

#### Week 10: Heartbeat & Cron

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Cron Service | Scheduled tasks | `cron/service.ts` |
| Cron Jobs | Job management | `cron/jobs.ts` |
| Workplace Heartbeat | Inbox/calendar/task checks | `heartbeat/workplace.ts` |
| Active Hours | Quiet time handling | `heartbeat/active-hours.ts` |

**Safety gates:**
- Cron job approval for T3+ actions
- Heartbeat rate limiting

**Phase 2 Deliverables:**
- ✅ Memory search returns relevant work context
- ✅ Skills load from database
- ✅ Sub-agents can be spawned
- ✅ Cron jobs execute on schedule
- ✅ Workplace heartbeat checks inbox/calendar/tasks
- ✅ Complete CLI with all commands

---

### Phase 3: Enterprise Channels (4 weeks)

**Goal:** Production-ready Teams and Slack integrations.

#### Week 11-12: Microsoft Teams

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Bot Framework | Azure Bot Service setup | `channels/teams/bot.ts` |
| Message Handler | Incoming message processing | `channels/teams/handler.ts` |
| Adaptive Cards | Rich message formatting | `channels/teams/cards.ts` |
| SSO Integration | Entra SSO reuse | `channels/teams/sso.ts` |
| Proactive Messaging | Heartbeat delivery | `channels/teams/proactive.ts` |

**Existing code leveraged:**
- Entra SSO from `src/platform/auth/entra/`
- OAuth token management

**Safety gates:**
- User identity from Teams context
- Org membership validation

#### Week 13: Slack

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Slack App | Bolt SDK integration | `channels/slack/app.ts` |
| Event Handler | Message and event processing | `channels/slack/handler.ts` |
| Slash Commands | /ask, /summarize | `channels/slack/commands.ts` |
| Thread Support | Threaded conversations | `channels/slack/threads.ts` |

**Safety gates:**
- Workspace validation
- User mapping to org

#### Week 14: Integration & Polish

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Channel Abstraction | Unified channel interface | `channels/interface.ts` |
| Message Routing | Channel → agent routing | `channels/router.ts` |
| Delivery Engine | Outbound message delivery | `channels/delivery.ts` |
| Error Handling | Channel-specific errors | `channels/errors.ts` |

**Phase 3 Deliverables:**
- ✅ Teams bot responds to messages
- ✅ Slack app works in enterprise workspace
- ✅ Proactive messaging works
- ✅ Workplace check-ins delivered to channels

---

### Phase 4: Advanced Autonomy (4 weeks)

**Goal:** Full safety framework, advanced features, production hardening.

#### Week 15-16: Safety Controller

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Action Classifier | T0-T4 classification | `safety/classifier.ts` |
| Approval Queue | HITL approval flows | `safety/approvals.ts` |
| Rate Limiter | Per-user/action limits | `safety/rate-limiter.ts` |
| Input Filters | Prompt injection defense | `safety/input-filter.ts` |
| Output Filters | PII/confidential masking | `safety/output-filter.ts` |

**Schema additions:**
- `ActionApproval` model

**Reference:** `GOODTEAMS-SAFETY-FRAMEWORK.md` for complete specification

#### Week 17-18: Additional Channels

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Discord | Community support | `channels/discord/*.ts` |
| Telegram | Global reach | `channels/telegram/*.ts` |
| Email | Async communication | `channels/email/*.ts` |

#### Week 19: Observability

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Structured Logging | Winston/Pino setup | `observability/logging.ts` |
| Metrics | Prometheus integration | `observability/metrics.ts` |
| Tracing | OpenTelemetry | `observability/tracing.ts` |
| Health Checks | Comprehensive health | `observability/health.ts` |

#### Week 20: Hardening

| Deliverable | Description | Files |
|-------------|-------------|-------|
| Security Audit | Penetration testing | N/A |
| Load Testing | Performance validation | N/A |
| Documentation | API docs, runbooks | `docs/*.md` |
| Disaster Recovery | Backup/restore procedures | N/A |

**Phase 4 Deliverables:**
- ✅ Full safety framework operational
- ✅ Additional channels available
- ✅ Enterprise observability
- ✅ Production-ready platform

---

### Timeline Overview

```
Week 1-6:   Phase 1 - Core Gateway
            ████████████████████████████████████████████████████████████████
            [Gateway] [Agent Loop] [Sessions] [Tools] [CLI] [Webchat]
            
Week 7-10:  Phase 2 - Memory & Workplace Features
            ████████████████████████████████████████
            [Memory] [Identity] [Skills] [Heartbeat]

Week 11-14: Phase 3 - Enterprise Channels
            ████████████████████████████████████████
            [MS Teams] [Slack] [Integration] [Polish]

Week 15-20: Phase 4 - Advanced Autonomy
            ████████████████████████████████████████████████████████████████
            [Safety] [Channels] [Observability] [Hardening]

Total: ~20 weeks (5 months)
```

---

## 8. Safety Integration Points

### 8.1 Where Safety Controls Appear

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SAFETY CONTROL POINTS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. INPUT LAYER                                                             │
│     ├── JWT Authentication           → All requests authenticated          │
│     ├── Tenant Isolation             → Org-scoped access                   │
│     ├── Prompt Injection Defense     → Input sanitization                  │
│     └── Rate Limiting                → Request throttling                  │
│                                                                             │
│  2. AGENT LAYER                                                             │
│     ├── Tool Classification          → T0-T4 before execution             │
│     ├── Approval Queue               → HITL for T3+ actions               │
│     ├── Action Rate Limits           → Per-action throttling              │
│     └── Context Boundaries           → Org-scoped context only            │
│                                                                             │
│  3. OUTPUT LAYER                                                            │
│     ├── Content Filters              → PII/confidential masking           │
│     ├── Recipient Validation         → External contact checks            │
│     └── Audit Logging                → All actions logged                 │
│                                                                             │
│  4. CHANNEL LAYER                                                           │
│     ├── User Identity Validation     → Map channel user to org user       │
│     ├── Org Membership Check         → Verify user belongs to org         │
│     └── Channel-Specific Policies    → Per-channel safety rules           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Component Safety Responsibilities

| Component | Safety Controls | Tier Enforcement |
|-----------|-----------------|------------------|
| **Gateway** | JWT auth, rate limiting, tenant isolation | All tiers |
| **Agent Loop** | Tool classification, approval queue | T2-T4 |
| **Session Manager** | Org scoping, user ownership | T0 |
| **Memory System** | Org scoping, search auditing | T0-T1 |
| **Skills Engine** | Role-based access, execution logging | T1-T2 |
| **Connector Framework** | Credential encryption, read-only mode | T2-T3 |
| **Channel Layer** | User validation, org membership | All tiers |
| **Audit System** | Immutable logging, export controls | N/A |

### 8.3 Approval Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        APPROVAL FLOW                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Agent wants to: "Send email to customer@external.com"                     │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────┐                                                        │
│  │ Classify Action │  Result: T3 (External Act)                            │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Check Policy    │  Org policy: T3 requires approval                     │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Queue Approval  │  Create ActionApproval record                         │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Notify User     │  "I'd like to send this email. Approve?"              │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│    User Decision                                                            │
│    ├── Approve → Execute + Audit                                           │
│    ├── Modify → Edit + Approve → Execute + Audit                           │
│    └── Reject → Audit rejection                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Reference:** See `GOODTEAMS-SAFETY-FRAMEWORK.md` for complete safety specification.

---

## 9. CLI & Operations

### 9.1 Command Structure

```
goodteams
├── gateway          Gateway daemon management
│   ├── start        Start the gateway daemon
│   ├── stop         Stop gracefully
│   ├── restart      Zero-downtime restart
│   ├── status       Current status
│   └── logs         Stream logs
│
├── tenant           Organization/tenant operations
│   ├── list         List all organizations
│   ├── show <id>    Organization details
│   ├── create       Create new org (interactive)
│   └── config <id>  Configure tenant
│
├── agent            Agent configuration and interaction
│   ├── list         List agents (--tenant required)
│   ├── show <id>    Agent details
│   ├── chat <id>    Direct chat with agent
│   └── reload <id>  Hot reload configuration
│
├── config           Configuration management
│   ├── show         Show current configuration
│   ├── edit         Edit in $EDITOR
│   ├── set <k> <v>  Set specific value
│   └── validate     Validate configuration
│
├── status           Health checks and diagnostics
│   ├── (default)    Quick health check
│   ├── --verbose    Detailed diagnostics
│   └── --check      Run all health checks
│
├── db               Database operations
│   ├── status       Database status
│   ├── migrate      Run pending migrations
│   └── backup       Create backup
│
├── logs             Log viewing and export
│   ├── (default)    Stream logs
│   ├── --tenant     Filter by tenant
│   └── --level      Filter by level
│
└── version          Version information
```

### 9.2 Example Startup

```bash
$ goodteams gateway start
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 GoodTeams Gateway v1.0.0                                ║
║                                                               ║
║   "Turning meetings into action items since 2026"            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

☕ Initializing services...
📊 Database connected (PostgreSQL 15.2)
🔐 Auth verified (Entra ID)
📡 Channels ready: Teams, Slack
💓 Heartbeat active (30m intervals)

═══════════════════════════════════════════════════════════════
✅ Gateway ready on http://localhost:3000
   Organizations: 3 active
   Agents: 12 running

   Let's make some teams good! 🎯
═══════════════════════════════════════════════════════════════
```

### 9.3 Startup Messages (Rotating)

```
"Turning meetings into action items since 2026."
"Your AI teammate who actually reads the docs."
"Because nobody should read 47 Slack messages at 9 AM."
"Hot reload for your workflow, cold brew for your sanity."
"We make teams good. You make them great."
"I speak fluent Jira, mild sarcasm, and aggressive deadline energy."
"Your calendar just got a little less scary."
"Gateway online—please keep all appendages inside the workflow at all times."
```

**Reference:** See `WORKPLACE-ASSISTANT-MAPPING.md` §7 for complete CLI specification.

---

## 10. References & Deep Dives

### Strategic Documents

| Document | Purpose | Location |
|----------|---------|----------|
| **GOODTEAMS-SAFETY-FRAMEWORK.md** | Complete safety specification, HITL patterns, approval flows | `docs/` |
| **WORKPLACE-ASSISTANT-MAPPING.md** | Personal → Workplace feature mapping, CLI spec | `docs/` |
| **GOODTEAMS-INDEPENDENCE-PLAN.md** | Detailed 20-week roadmap, task breakdown | `docs/` |
| **OPENCLAW-FEATURE-INVENTORY.md** | OpenClaw features catalogued for reference | `docs/` |
| **OPENCLAW-ENTANGLEMENT-ANALYSIS.md** | Coupling analysis, 98% independence finding | `docs/` |

### Code Reference

| Module | Purpose | Location |
|--------|---------|----------|
| **Platform API** | REST API implementation | `src/platform/api/` |
| **Authentication** | Entra SSO, Google OAuth | `src/platform/auth/` |
| **Sessions** | JWT session management | `src/platform/session/` |
| **Audit** | Action logging | `src/platform/audit/` |
| **Tenant** | Multi-tenant management | `src/platform/tenant/` |
| **Connectors** | Data source integrations | `src/platform/connectors/` |
| **Workflows** | Workflow engine | `src/platform/workflows/` |
| **Database** | Prisma schema | `src/platform/db/` |

### External References

| Resource | Purpose |
|----------|---------|
| Anthropic API Docs | Claude integration |
| Microsoft Bot Framework | Teams channel |
| Slack Bolt SDK | Slack channel |
| pgvector | Vector search |
| BullMQ | Job queues |

---

## Appendix: Quick Reference

### Safety Tier Summary

| Tier | Name | Approval | Examples |
|------|------|----------|----------|
| T0 | Observe | Automatic | Read emails, view calendar |
| T1 | Draft | Automatic | Create email draft, suggest reply |
| T2 | Internal Act | Configurable | Send internal email, update CRM |
| T3 | External Act | Required | Send external email, share documents |
| T4 | Critical | Dual Approval | Delete records, bulk operations |

### Session Key Format

```
org:{orgId}:user:{userId}:channel:{channel}
org:{orgId}:user:{userId}:channel:{channel}:thread:{threadId}
org:{orgId}:user:{userId}:channel:{channel}:group:{groupId}
```

### Key Environment Variables

```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_TENANT_ID=...
```

---

*This document is the single source of truth for GoodTeams independence architecture. It synthesizes strategic analysis, codebase reality, and implementation plans into one actionable reference.*

**Last Updated:** February 2026  
**Maintained By:** GoodTeams Engineering  
**Status:** Ready for Implementation
