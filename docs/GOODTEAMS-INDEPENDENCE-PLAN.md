# GoodTeams Independence Implementation Plan

**Version:** 2.0  
**Created:** 2025-02-03  
**Updated:** 2026-02-03  
**Status:** Ready for Execution  

---

## Executive Summary

GoodTeams is positioned for complete independence from OpenClaw. Our analysis shows we're **98% independent already** — we've built a full enterprise platform (89K+ lines of TypeScript) that only touches OpenClaw at two coupling points: the API mount and gateway process spawning.

### 🎯 The Big Insight: We're Building a Workplace Personal Assistant

This isn't about *removing* personal assistant features—it's about **adapting them for the workplace**.

OpenClaw built something powerful: an AI that learns about its user, remembers context, proactively helps, and adapts to personal style. That's *exactly* what knowledge workers need. GoodTeams takes this model and adapts it for enterprise:

| Personal Assistant | Workplace Personal Assistant |
|-------------------|------------------------------|
| SOUL.md → Personality | SOUL.md → Org culture + role persona |
| USER.md → Personal info | USER.md → Employee profile + role context |
| MEMORY.md → Personal memories | MEMORY.md → Work context, project history |
| Heartbeat → Life check-ins | Heartbeat → Work check-ins (inbox, calendar, tasks) |
| Proactive help | Proactive help (meeting prep, deadline tracking) |

**See [WORKPLACE-ASSISTANT-MAPPING.md](./WORKPLACE-ASSISTANT-MAPPING.md) for complete feature mapping.**

### The Vision: GoodTeams Independent

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GOODTEAMS PLATFORM                                    │
│                    "The Workplace Personal Assistant"                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    GoodTeams Gateway 🚀                              │   │
│  │  "Turning meetings into action items since 2026"                    │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│  │  │  HTTP    │  │WebSocket │  │  Hooks   │  │ Channel Plugins  │   │   │
│  │  │  Server  │  │  Server  │  │  Server  │  │  (Teams, Slack)  │   │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │   │
│  │       └──────────────┴───────────┬┴─────────────────┘              │   │
│  │                                  │                                  │   │
│  │                    ┌─────────────▼─────────────┐                   │   │
│  │                    │      Message Router       │                   │   │
│  │                    └─────────────┬─────────────┘                   │   │
│  │                                  │                                  │   │
│  │  ┌───────────────┐  ┌───────────▼───────────┐  ┌────────────────┐ │   │
│  │  │   Session     │  │      Agent Loop       │  │     Tools      │ │   │
│  │  │   Manager     │◄─┤   (LLM Orchestrator)  ├─►│   Execution    │ │   │
│  │  └───────────────┘  └───────────────────────┘  └────────────────┘ │   │
│  │                                                                    │   │
│  │  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │   │
│  │  │  Memory    │  │  Skills  │  │    Cron    │  │  Sub-agents  │  │   │
│  │  │  (Vector)  │  │  System  │  │  Scheduler │  │   Spawner    │  │   │
│  │  └────────────┘  └──────────┘  └────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                 Workplace Personal Assistant Features                │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Identity    │ Memory      │ Proactive    │ Channels    │ Transcribe │   │
│  │  (SOUL/USER) │ (Context)   │ (Heartbeat)  │ (Teams/     │ (Meetings) │   │
│  │              │             │              │  Slack)     │            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Platform Services (Already Built!)                │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Auth/RBAC │ Sessions │ Multi-Tenant │ Workflows │ Connectors      │   │
│  │  Audit     │ API      │ Admin UI     │ Database  │ Entra SSO       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**What independence looks like:**
- ✅ Our own gateway process (`goodteams gateway start`)
- ✅ Our own agent loop (LLM orchestration we control)
- ✅ Zero `openclaw` CLI dependencies
- ✅ Zero OpenClaw runtime imports
- ✅ Full control over feature roadmap
- ✅ **Workplace personal assistant features** (not stripped, adapted!)
- ✅ Enterprise-first architecture

---

## 1. Current State Assessment

### 1.1 What We Already Have (The 98%)

GoodTeams platform code: **~89,000 lines of TypeScript**, all independent.

| Module | LOC | Description | Dependency |
|--------|-----|-------------|------------|
| `auth/` + `session/` | ~6,000 | RBAC, Entra SSO, JWT sessions | None |
| `audit/` | ~2,000 | Comprehensive audit logging | None |
| `db/` | ~700 | Prisma ORM, 15 models | None |
| `api/` | ~3,000 | Full REST API (12 route handlers) | None |
| `tenant/` | ~4,000 | Multi-tenant gateway management | **CLI spawn only** |
| `connectors/` | ~12,000 | Dataverse, Salesforce, SQL | None |
| `workflows/` | ~20,000 | Full workflow engine with Redis | None |
| `admin/` (UI) | ~15,000 | React admin console | None |

**Database models we own:**
- Organization, User, Session, UserToken
- OrganizationInvitation, UserPermission, OrganizationSkill
- AuditLog, TenantGateway, TenantConfig, TenantCredential
- ResourceConnection, SchemaHint, SchemaCache
- Workflow, WorkflowExecution

### 1.2 The Only Coupling Points

```typescript
// Coupling Point #1: API Mount (server-http.ts)
import { createPlatformApiHandler } from "../platform/api/index.js";
// → OpenClaw's HTTP server mounts our API

// Coupling Point #2: Gateway Spawning (gateway-manager.ts)
spawn("openclaw", ["gateway", "run", "--config", configPath, "--port", port]);
// → We call OpenClaw's CLI to start gateways
```

**That's it.** Two lines of coupling.

### 1.3 What We Need to Build/Adapt

| Component | OpenClaw LOC | Complexity | Strategy |
|-----------|--------------|------------|----------|
| HTTP/WS Server | ~2,000 | Medium | Copy & adapt |
| Agent Loop | ~50,000 | Very High | Copy & simplify |
| Session Management | ~5,000 | High | Copy & adapt |
| Tool Framework | ~15,000 | High | Copy & adapt |
| Channel Plugins | ~3,000 each | Medium | Copy priority ones |
| Cron Service | ~5,000 | Medium | Copy & adapt |
| Memory System | ~10,000 | High | Copy & adapt |
| Skills System | ~8,000 | Medium | Copy & adapt |
| Heartbeat Runner | ~3,000 | Medium | Copy & adapt |
| **Personal Assistant Features** | ~5,000 | Medium | **KEEP & ADAPT** |
| **Transcription** | ~2,000 | Medium | **KEEP** |
| **GoodTeams CLI** | New | Medium | **BUILD** |

---

## 2. Architecture Design

### 2.1 GoodTeams Gateway Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                   goodteams-gateway                             │
│                   (Our new package)                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Entry: src/gateway/index.ts                                   │
│  CLI:   goodteams gateway [start|stop|status]                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Transport Layer                                         │  │
│  │  ├── http-server.ts      (Express/Fastify)              │  │
│  │  ├── ws-server.ts        (WebSocket)                    │  │
│  │  ├── hooks-handler.ts    (Webhook ingestion)            │  │
│  │  └── platform-api.ts     (Mounts platform routes)       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Agent Layer                                             │  │
│  │  ├── agent-loop.ts       (Core LLM orchestration)       │  │
│  │  ├── session-manager.ts  (Conversation state)           │  │
│  │  ├── tool-executor.ts    (Tool invocation)              │  │
│  │  ├── subagent-spawner.ts (Child agent management)       │  │
│  │  └── message-router.ts   (Channel → Agent routing)      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Workplace Personal Assistant                            │  │
│  │  ├── identity/           (SOUL.md, USER.md, IDENTITY.md)│  │
│  │  ├── memory/             (MEMORY.md, daily notes)       │  │
│  │  ├── heartbeat/          (Proactive workplace checks)   │  │
│  │  ├── transcription/      (Meeting/voice transcription)  │  │
│  │  └── personas/           (Org/team/role personas)       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Support Services                                        │  │
│  │  ├── cron-service.ts     (Scheduled tasks)              │  │
│  │  ├── memory-manager.ts   (Vector search)                │  │
│  │  ├── skills-loader.ts    (Workspace skills)             │  │
│  │  └── config-reloader.ts  (Hot config reload)            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Channels (Priority order)                               │  │
│  │  ├── webchat/            (Built-in)                     │  │
│  │  ├── teams/              (P0 - Enterprise)              │  │
│  │  ├── slack/              (P0 - Enterprise)              │  │
│  │  ├── discord/            (P2 - Community)               │  │
│  │  └── telegram/           (P2 - Global reach)            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 How It Differs from OpenClaw

| Aspect | OpenClaw | GoodTeams |
|--------|----------|-----------|
| **Target audience** | Personal assistant | **Workplace personal assistant** |
| **Multi-tenant** | Single user | Native multi-org support |
| **Auth model** | API keys, basic auth | Entra SSO, RBAC, org membership |
| **Channel priority** | Discord, Telegram | Teams, Slack (enterprise first) |
| **State storage** | File-based JSON | PostgreSQL + Redis |
| **Skills source** | Filesystem | DB-backed org skills |
| **Deployment** | Single gateway | Per-org isolated gateways |
| **Admin interface** | Terminal UI | Web admin console |
| **Personal assistant** | Individual use | **Workplace adaptation** |

### 2.3 Enterprise Multi-Tenant Considerations

```typescript
// Per-org gateway isolation (already designed!)
interface TenantGateway {
  organizationId: string;
  port: number;
  configPath: string;
  status: GatewayStatus;
  pid: number | null;
}

// Tenant routing (already built!)
// subdomain → organization → gateway port → proxy
router.use(tenantMiddleware);  // Resolves org from subdomain/header
router.proxy(req, res, tenantGateway.port);
```

**Key enterprise features:**
- ✅ Org-scoped credentials (encrypted vault)
- ✅ Org-scoped skills (DB-backed)
- ✅ Org-scoped audit logs
- ✅ Per-org gateway processes
- ✅ RBAC with permissions
- ✅ **Org/team/role personas** (adapted from SOUL.md)

---

## 3. The GoodTeams CLI

A professional, delightful CLI for managing GoodTeams. **Part of Phase 1 deliverables.**

### 3.1 Command Structure

```
goodteams
├── gateway         Gateway daemon management
├── tenant          Organization/tenant operations  
├── agent           Agent configuration and interaction
├── config          Configuration management
├── status          Health checks and diagnostics
├── db              Database operations
├── logs            Log viewing and export
└── version         Version information
```

### 3.2 Key Commands

```bash
# Gateway Management
goodteams gateway start         # Start the gateway daemon
goodteams gateway stop          # Stop gracefully
goodteams gateway restart       # Zero-downtime restart
goodteams gateway status        # Current status
goodteams gateway logs -f       # Stream logs

# Tenant Management  
goodteams tenant list           # List all organizations
goodteams tenant show <id>      # Organization details
goodteams tenant create         # Create new org (interactive)
goodteams tenant config <id>    # Configure tenant

# Agent Operations
goodteams agent list -t <org>   # List agents for org
goodteams agent show <id>       # Agent details
goodteams agent chat <id>       # Direct chat with agent
goodteams agent reload <id>     # Hot reload config

# Configuration
goodteams config show           # Show current config
goodteams config edit           # Edit in $EDITOR
goodteams config validate       # Validate configuration

# Status & Health
goodteams status                # Quick health check
goodteams status --verbose      # Detailed diagnostics
goodteams status --check        # Run all health checks

# Database
goodteams db status             # Database status
goodteams db migrate            # Run pending migrations
goodteams db backup             # Create backup

# Logs
goodteams logs -f               # Stream all logs
goodteams logs --tenant <id>    # Filter by tenant
goodteams logs --level error    # Filter by level
```

### 3.3 Example Output

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

### 3.4 Startup Messages (Rotating)

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

**Full CLI specification in [WORKPLACE-ASSISTANT-MAPPING.md](./WORKPLACE-ASSISTANT-MAPPING.md#7-the-goodteams-cli)**

---

## 4. Feature Rebuild Roadmap

### 4.1 Overview Matrix

| Feature | Priority | Effort | OpenClaw Source | Strategy |
|---------|----------|--------|-----------------|----------|
| Agent Loop | **P0** | 4 weeks | `src/agents/pi-embedded-*.ts` | Copy & simplify |
| Session Management | **P0** | 2 weeks | `src/gateway/session-utils.ts` | Copy & adapt |
| HTTP/WS Server | **P0** | 1 week | `src/gateway/server-*.ts` | Copy & simplify |
| Tool Framework | **P0** | 2 weeks | `src/agents/tools/`, `bash-tools.ts` | Copy essential tools |
| **GoodTeams CLI** | **P0** | 1 week | N/A | **BUILD NEW** |
| **Workplace Personal Assistant** | **P0** | 2 weeks | Identity/Memory files | **KEEP & ADAPT** |
| Teams Channel | **P0** | 2 weeks | N/A (build from scratch) | Build new |
| Slack Channel | **P0** | 1 week | `src/slack/` | Copy & adapt |
| Sub-agent Spawning | **P1** | 1 week | `src/agents/subagent-*.ts` | Copy & adapt |
| Memory System | **P1** | 2 weeks | `src/memory/` | Copy & adapt |
| Skills System | **P1** | 1 week | `src/agents/skills*.ts` | Copy & adapt for DB |
| Cron Service | **P1** | 1 week | `src/cron/` | Copy & adapt |
| Heartbeat Runner | **P1** | 1 week | `src/infra/heartbeat-runner.ts` | **Enhance for workplace** |
| **Transcription** | **P1** | 2 weeks | Existing | **KEEP** |
| Discord Channel | **P2** | 1 week | `src/discord/` | Copy & adapt |
| Telegram Channel | **P2** | 1 week | `src/telegram/` | Copy & adapt |
| Voice Wake | **P3** | TBD | Existing | **DEFER** |

### 4.2 Key Feature Decisions

#### ✅ KEEP: Personal Assistant Features (Adapted for Workplace)

**DON'T remove these—adapt them:**

| Feature | Personal Use | Workplace Adaptation |
|---------|-------------|---------------------|
| SOUL.md | Personal identity | Org culture + role personas |
| USER.md | Personal info | Employee profile + role context |
| IDENTITY.md | Name/avatar | Org-branded assistant identity |
| AGENTS.md | Workspace rules | Compliance guardrails |
| MEMORY.md | Personal memories | Work context, project history |
| Daily notes | Personal logs | Work session logs, decisions |
| Heartbeat | Life check-ins | **Workplace check-ins** (inbox, calendar, tasks) |

**These features ARE the product.** See [WORKPLACE-ASSISTANT-MAPPING.md](./WORKPLACE-ASSISTANT-MAPPING.md) for complete mapping.

#### ✅ KEEP: Transcription Features

**Audio transcription for professional use:**

| Use Case | Description |
|----------|-------------|
| Meeting transcription | Upload recording → transcript + action items |
| Voice memos | Walking meeting notes, quick ideas |
| Call summaries | Customer call transcription + analysis |
| Voice messages | Transcribe Slack/Teams voice messages |

**This is transcription (process audio files), NOT voice wake (always-listening).**

#### ⏸️ DEFER: Voice Wake ("Hey GoodTeams")

Voice wake requires:
- Always-listening infrastructure
- Privacy considerations (recording in office)
- Device integration
- Enterprise security review

**Deferred to P2/P3.** Focus on file-based transcription first.

### 4.3 Detailed Feature Breakdown

#### 4.3.1 Agent Loop & LLM Orchestration (P0)

**Source files to copy:**
```
src/agents/
├── pi-embedded-runner.ts        # Main orchestration loop
├── pi-embedded-subscribe.ts     # Stream handling
├── pi-embedded-helpers/         # Helper utilities
├── pi-tools.ts                  # Tool definitions
├── pi-tools.policy.ts           # Tool filtering
├── compaction.ts                # Context management
├── context-window-guard.ts      # Token limits
├── model-selection.ts           # Model routing
├── model-fallback.ts            # Retry logic
└── system-prompt.ts             # Prompt construction
```

**Adaptations for GoodTeams:**
- Add enterprise context injection (org, user roles)
- Add usage tracking hooks for billing
- **KEEP personal assistant context loading** (adapted for workplace)
- Add audit logging integration

**Effort:** 4 weeks  
**Dependencies:** HTTP server, session management, tool framework

---

#### 4.3.2 Workplace Personal Assistant Features (P0)

**This is NEW: Adapting personal assistant features for workplace.**

**Source files to adapt:**
```
src/agents/
├── identity.ts                  # Name resolution → Org-branded names
├── identity-file.ts             # IDENTITY.md → Org identity config
├── bootstrap-files.ts           # Context loading → Workplace context
├── workspace.ts                 # File layout → Org/team structure
└── AGENTS.md loading            # Rules → Compliance guardrails

src/infra/
└── heartbeat-runner.ts          # Periodic checks → Workplace checks
```

**New workplace features:**
```typescript
// Org/Team/Role Persona Hierarchy
interface PersonaHierarchy {
  organization: OrgPersona;      // From ORGANIZATION-SOUL.md
  team?: TeamPersona;            // From TEAM-SOUL.md
  role?: RolePersona;            // From ROLE-SOUL.md
}

// Employee Profile (adapted from USER.md)
interface EmployeeProfile {
  identity: { name, role, department, reports_to };
  work_context: { current_projects, specialties };
  communication: { style, preferences };
  working_patterns: { hours, focus_time };
  goals: { quarterly, career };
}

// Workplace Heartbeat Checks
interface WorkplaceHeartbeat {
  email: { urgent_senders, stale_threshold };
  calendar: { prep_time, review_tomorrow };
  tasks: { sources: ['jira', 'linear', 'github'] };
  communication: { channels, mention_alert };
}
```

**Effort:** 2 weeks  
**Dependencies:** Agent loop, configuration system

---

#### 4.3.3 Session Management (P0)

**Source files to copy:**
```
src/gateway/
├── session-utils.ts             # Core session logic
├── session-utils.fs.ts          # File storage → PostgreSQL
├── session-utils.types.ts       # Type definitions
├── sessions-patch.ts            # History patching
└── sessions-resolve.ts          # Session key resolution
```

**Adaptations for GoodTeams:**
- Replace file-based storage with PostgreSQL
- Add org-scoping to session keys
- Add session expiration/archival
- Add cross-device session sync

**New session key format:**
```typescript
// OpenClaw: "agent:main:channel:discord:123456"
// GoodTeams: "org:{orgId}:agent:{agentId}:channel:{channel}:{userId}"
```

**Effort:** 2 weeks  
**Dependencies:** Database layer (already built!)

---

#### 4.3.4 GoodTeams CLI (P0) — NEW

**This is new, not copied from OpenClaw.**

**Package structure:**
```
src/cli/
├── index.ts                     # Entry point
├── commands/
│   ├── gateway.ts               # gateway start/stop/status
│   ├── tenant.ts                # tenant list/show/create
│   ├── agent.ts                 # agent list/show/chat
│   ├── config.ts                # config show/edit/validate
│   ├── status.ts                # status/diagnostics
│   ├── db.ts                    # db status/migrate/backup
│   └── logs.ts                  # logs streaming/filtering
├── ui/
│   ├── startup-banner.ts        # ASCII art, fun messages
│   ├── tables.ts                # CLI table formatting
│   └── progress.ts              # Progress indicators
└── utils/
    ├── output.ts                # JSON/pretty output
    └── validation.ts            # Config validation
```

**Effort:** 1 week  
**Dependencies:** Gateway, database

---

#### 4.3.5 Transcription Features (P1) — KEEP

**Copy and adapt transcription capabilities:**

```
src/transcription/
├── whisper.ts                   # OpenAI Whisper integration
├── assemblyai.ts                # AssemblyAI option
├── processing.ts                # Audio processing
└── summarization.ts             # Meeting summary generation
```

**Use cases:**
- Meeting transcription (upload recording)
- Voice memos to text
- Call summaries with analysis
- Voice message transcription

**NOT included (P3):**
- Voice wake ("Hey GoodTeams")
- Always-listening mode

**Effort:** 2 weeks  
**Dependencies:** Agent loop, file handling

---

#### 4.3.6 Workplace Heartbeat (P1) — ENHANCED

**Adapt heartbeat for workplace check-ins:**

```typescript
// Workplace heartbeat checks
const workplaceChecks = {
  email: async () => {
    // "You have 3 unread emails from executives"
    // "Sarah's email from Monday is still unanswered (3 days)"
  },
  
  calendar: async () => {
    // "Standup in 30 minutes"
    // "1:1 with Marcus in 2 hours - want me to prep?"
  },
  
  tasks: async () => {
    // "The report you mentioned is due tomorrow"
    // "PR #1234 has been waiting for review for 2 days"
  },
  
  communication: async () => {
    // "You were mentioned in #platform-eng 3 times"
    // "David asked a question in thread - waiting on you"
  },
  
  deadlines: async () => {
    // "Auth project deadline: 10 days away, 35% remaining"
  }
};
```

**Effort:** 1 week (enhanced from basic heartbeat)  
**Dependencies:** Calendar integration, email integration, task system integration

---

## 5. Phased Implementation

### Phase 1: Core Gateway + CLI MVP (8 weeks)

**Goal:** Basic gateway with workplace personal assistant features and delightful CLI.

**Week 1-2: Foundation**
- [ ] Create `src/goodteams-gateway/` package structure
- [ ] Copy & adapt HTTP/WS server from OpenClaw
- [ ] Set up configuration system
- [ ] **Build GoodTeams CLI foundation**
- [ ] Create startup sequence with fun messages

**Week 3-4: Agent Loop**
- [ ] Copy agent loop code
- [ ] Simplify for enterprise use case
- [ ] **KEEP personal assistant context loading** (SOUL.md, USER.md, etc.)
- [ ] Adapt for org/user context injection
- [ ] Test with single model (Claude)

**Week 5: Session Management**
- [ ] Copy session code
- [ ] Adapt for PostgreSQL storage
- [ ] Implement org-scoped session keys
- [ ] Add session persistence

**Week 6: Tool Framework**
- [ ] Copy essential tools (read, write, edit, exec)
- [ ] Add web search and fetch
- [ ] Implement tool policy/permissions
- [ ] Integration testing

**Week 7-8: Workplace Personal Assistant**
- [ ] Adapt SOUL.md → Org personas
- [ ] Adapt USER.md → Employee profiles
- [ ] Adapt MEMORY.md → Work context
- [ ] Set up AGENTS.md → Compliance guardrails
- [ ] Basic heartbeat (check-in capability)

**Phase 1 Deliverables:**
- ✅ Working gateway with webchat
- ✅ `goodteams gateway start/stop/status`
- ✅ `goodteams tenant list/show`
- ✅ `goodteams agent list/chat`
- ✅ Basic workplace personal assistant features
- ✅ PostgreSQL sessions
- ✅ No OpenClaw CLI dependency

---

### Phase 2: Memory, Skills & Workplace Features (4 weeks)

**Week 9: Memory System**
- [ ] Set up pgvector extension
- [ ] Port memory manager for PostgreSQL
- [ ] Implement org-scoped memories
- [ ] **Adapt for work context** (projects, people, decisions)
- [ ] Test embedding generation

**Week 10: Skills System & Transcription**
- [ ] Adapt skills loader for DB
- [ ] Implement skill CRUD API
- [ ] **Add transcription features** (meeting, voice notes)
- [ ] Admin UI for skill management

**Week 11: Sub-agents & Enhanced Heartbeat**
- [ ] Port subagent registry
- [ ] **Implement workplace heartbeat** (inbox, calendar, tasks)
- [ ] Test multi-agent scenarios
- [ ] Add cron service

**Week 12: CLI Completion**
- [ ] `goodteams config` commands
- [ ] `goodteams status` diagnostics
- [ ] `goodteams db` operations
- [ ] `goodteams logs` streaming

**Phase 2 Deliverables:**
- ✅ Full workplace personal assistant features
- ✅ Memory with work context
- ✅ Skills from database
- ✅ Meeting transcription
- ✅ Workplace heartbeat (proactive check-ins)
- ✅ Complete CLI

---

### Phase 3: Enterprise Channels (4 weeks)

**Week 13-14: Microsoft Teams**
- [ ] Bot Framework integration
- [ ] Adaptive Cards support
- [ ] Teams SSO (via Entra - already have!)
- [ ] Proactive messaging

**Week 15: Slack**
- [ ] Port Slack plugin from OpenClaw
- [ ] Add org-scoping
- [ ] Test in enterprise workspace
- [ ] Slash commands

**Week 16: Integration & Polish**
- [ ] End-to-end testing
- [ ] Documentation
- [ ] Admin UI updates
- [ ] Performance optimization

**Phase 3 Deliverables:**
- ✅ Microsoft Teams integration
- ✅ Slack integration
- ✅ Production-ready channels

---

### Phase 4: Advanced Features (4 weeks)

**Week 17-18: Additional Channels**
- [ ] Discord (community support)
- [ ] Telegram (global reach)
- [ ] Email integration

**Week 19: Observability**
- [ ] Structured logging
- [ ] Metrics (Prometheus)
- [ ] Tracing (OpenTelemetry)
- [ ] Dashboard (Grafana)

**Week 20: Hardening**
- [ ] Security audit
- [ ] Load testing
- [ ] Disaster recovery
- [ ] Documentation

**Phase 4 Deliverables:**
- ✅ Additional channels
- ✅ Enterprise observability
- ✅ Enterprise-grade platform

---

### Timeline Overview

```
Week 1-8:   Phase 1 - Core Gateway + CLI MVP
            ████████████████████████████████████████████████████████████████
            [Gateway] [Agent Loop] [Sessions] [Tools] [CLI] [Workplace PA]
            
Week 9-12:  Phase 2 - Memory, Skills & Workplace Features
            ████████████████████████████████████████
            [Memory] [Skills] [Transcription] [Heartbeat] [CLI Complete]

Week 13-16: Phase 3 - Enterprise Channels
            ████████████████████████████████████████
            [MS Teams] [Slack] [Integration] [Polish]

Week 17-20: Phase 4 - Advanced Features
            ████████████████████████████████████████
            [Channels] [Observability] [Hardening]

Total: ~20 weeks (5 months)
```

---

## 6. Migration Path

### 6.1 Code Extraction Steps

**Step 1: Create new package structure**
```
src/
├── platform/              # Keep as-is (already independent)
├── goodteams-gateway/     # NEW - our gateway code
│   ├── agent/
│   ├── channels/
│   ├── server/
│   ├── services/
│   ├── workplace/         # NEW - workplace personal assistant
│   │   ├── identity/
│   │   ├── memory/
│   │   ├── heartbeat/
│   │   └── transcription/
│   └── index.ts
├── cli/                   # NEW - GoodTeams CLI
│   ├── commands/
│   └── index.ts
└── [openclaw-legacy/]     # Keep temporarily for reference
```

**Step 2: Copy core files (KEEP personal assistant features)**
```bash
# From OpenClaw to GoodTeams Gateway
cp -r src/agents/pi-embedded*.ts src/goodteams-gateway/agent/
cp -r src/agents/tools/ src/goodteams-gateway/agent/tools/
cp -r src/gateway/session-utils*.ts src/goodteams-gateway/server/
cp -r src/cron/ src/goodteams-gateway/services/cron/
cp -r src/memory/ src/goodteams-gateway/services/memory/

# KEEP these - adapt for workplace:
cp -r src/agents/identity*.ts src/goodteams-gateway/workplace/identity/
cp -r src/agents/bootstrap-files.ts src/goodteams-gateway/workplace/
cp -r src/infra/heartbeat-runner.ts src/goodteams-gateway/workplace/heartbeat/
```

**Step 3: Update imports**
```typescript
// Change all imports from:
import { something } from "../agents/xyz.js";

// To:
import { something } from "./agent/xyz.js";
```

**Step 4: Update tenant manager**
```typescript
// src/platform/tenant/gateway-manager.ts

// OLD:
spawn("openclaw", ["gateway", "run", ...]);

// NEW:
import { startGoodTeamsGateway } from "../../goodteams-gateway/index.js";
await startGoodTeamsGateway({ organizationId, port, ...config });
```

### 6.2 What to Delete (After Full Migration)

```
SAFE TO DELETE:
├── src/agents/        # Replaced by goodteams-gateway/agent/
├── src/gateway/       # Replaced by goodteams-gateway/server/
├── src/channels/      # Replaced by goodteams-gateway/channels/
├── src/cron/          # Replaced by goodteams-gateway/services/
├── src/memory/        # Replaced by goodteams-gateway/services/
├── src/cli/           # Replaced by our CLI
├── src/daemon/        # Not needed
├── src/discord/       # Moved or deprecated
├── src/telegram/      # Moved or deprecated
├── src/slack/         # Moved to channels/
└── src/web/           # Replaced by our admin UI

KEEP:
├── src/platform/      # Our platform code
├── admin/             # Our admin UI
└── prisma/            # Our database
```

### 6.3 Testing Strategy

**Unit Tests:**
```typescript
// Copy and adapt OpenClaw's tests
// They're comprehensive and well-written

// Example structure:
src/goodteams-gateway/
├── agent/
│   ├── agent-loop.ts
│   └── agent-loop.test.ts  # Copied from OpenClaw
├── workplace/
│   ├── heartbeat/
│   │   └── workplace-heartbeat.test.ts  # NEW
```

**Integration Tests:**
```typescript
describe("GoodTeams Gateway Integration", () => {
  it("starts up successfully", async () => {
    const gateway = await startGoodTeamsGateway(testConfig);
    expect(gateway.status).toBe("healthy");
    await gateway.close();
  });
  
  it("handles workplace personal assistant features", async () => {
    const response = await gateway.chat({
      organizationId: "test-org",
      message: "What's on my calendar today?",
    });
    expect(response).toContain("calendar");
  });
});
```

**E2E Tests:**
- Webchat conversation flow
- Multi-turn context preservation
- Tool execution
- Channel message delivery
- **Workplace heartbeat checks**
- **Transcription pipeline**

### 6.4 Rollback Plan

**During Migration:**
```typescript
// Feature flag for gradual rollout
const USE_GOODTEAMS_GATEWAY = process.env.GOODTEAMS_GATEWAY === "true";

async function spawnGateway(orgId: string) {
  if (USE_GOODTEAMS_GATEWAY) {
    return startGoodTeamsGateway({ organizationId: orgId, ... });
  } else {
    return spawn("openclaw", ["gateway", "run", ...]);
  }
}
```

**If Something Breaks:**
1. Set `GOODTEAMS_GATEWAY=false`
2. Restart affected gateways
3. Debug in staging environment
4. Fix and re-enable

---

## 7. Risks and Mitigations

### 7.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Agent loop complexity | High | High | Simplify aggressively, test extensively |
| LLM API changes | Medium | Medium | Abstraction layer, vendor diversity |
| Channel API changes | Medium | Low | Monitor changelogs, automated tests |
| Performance issues | Medium | Medium | Load testing, profiling, caching |
| Security vulnerabilities | Low | High | Security audit, penetration testing |
| Scope creep | High | Medium | Strict phase boundaries, MVP focus |
| **Feature loss (personal assistant)** | N/A | N/A | **Mitigated: KEEPING these features** |

### 7.2 Detailed Risk Analysis

**Risk: Agent loop is complex (~50K LOC)**
- *Mitigation:* Don't copy everything! We don't need:
  - Voice wake support (deferred to P3)
  - CLI interactive mode
  - Many edge case handlers
- *KEEP:* Personal assistant context loading (adapted for workplace)
- *Target:* ~15K LOC of essential agent logic + workplace adaptations

**Risk: OpenClaw updates something we copied**
- *Mitigation:* We're forking, not tracking. Once copied, it's ours.
- *Consideration:* Monitor OpenClaw for security fixes only

**Risk: Teams channel is complex to build**
- *Mitigation:* 
  - Start with basic messaging
  - Use Bot Framework SDK (well-documented)
  - Leverage existing Entra SSO
- *Fallback:* Contract Teams integration specialist

**Risk: Multi-tenant performance**
- *Mitigation:*
  - Per-org gateway isolation (already designed)
  - Connection pooling
  - Redis caching
  - Horizontal scaling

---

## 8. Resource Requirements

### 8.1 Developer Effort

| Phase | Duration | Developers | Focus |
|-------|----------|------------|-------|
| Phase 1 | 8 weeks | 2 | Core gateway, CLI, workplace PA |
| Phase 2 | 4 weeks | 1-2 | Memory, skills, transcription, heartbeat |
| Phase 3 | 4 weeks | 2 | Channels (Teams, Slack) |
| Phase 4 | 4 weeks | 1-2 | Polish, advanced features |

**Total:** ~20 weeks with 2 developers = ~40 developer-weeks

### 8.2 External Dependencies

| Dependency | Purpose | Cost |
|------------|---------|------|
| PostgreSQL | Database | Existing |
| Redis | Queues, caching | Existing |
| pgvector | Vector search | Free extension |
| LLM APIs | Claude, GPT-4 | Per-usage |
| Bot Framework | Teams channel | Free SDK |
| Slack API | Slack channel | Free tier |
| **Whisper API** | **Transcription** | Per-usage |

### 8.3 Infrastructure

Already have:
- ✅ PostgreSQL (platform DB)
- ✅ Redis (workflow engine)
- ✅ Node.js runtime
- ✅ Admin UI

Need to add:
- pgvector extension for PostgreSQL
- Increased Redis capacity for memory
- Load balancer for multi-gateway
- **Audio file storage (for transcription)**

---

## 9. Decision Points

### 9.1 Key Decisions Made ✅

**D1: Personal assistant features**
- **Decision:** KEEP and adapt for workplace
- **Rationale:** These features ARE the product. GoodTeams is a workplace personal assistant.

**D2: Transcription vs Voice Wake**
- **Decision:** 
  - KEEP transcription (P1)
  - DEFER voice wake (P3)
- **Rationale:** Transcription (process files) is simpler and immediately valuable. Voice wake requires enterprise security review.

**D3: CLI priority**
- **Decision:** Part of Phase 1 (P0)
- **Rationale:** Professional CLI is essential for enterprise adoption and operations.

### 9.2 Remaining Decisions Needed

**D4: Agent loop simplification scope**
- *Question:* How much of OpenClaw's agent loop do we keep?
- *Options:*
  - A) Full copy (~50K LOC) - Maximum compatibility
  - B) Selective copy (~20K LOC) - Essential features + workplace PA
  - C) Rewrite (~10K LOC) - Clean but risky
- *Recommendation:* **Option B** - Copy essential + keep personal assistant features

**D5: Memory system database**
- *Question:* Use pgvector or separate vector DB?
- *Options:*
  - A) pgvector - Keep everything in PostgreSQL
  - B) Pinecone/Weaviate - Dedicated vector DB
- *Recommendation:* **Option A** - Simplicity, already using PostgreSQL

**D6: Deployment model**
- *Question:* How to run tenant gateways?
- *Options:*
  - A) Child processes (current approach)
  - B) Docker containers
  - C) Kubernetes pods
- *Recommendation:* **Start with A**, evolve to B/C for scale

---

## 10. Success Criteria

### Phase 1 Complete When:
- [ ] Gateway starts with fun startup messages
- [ ] `goodteams gateway start/stop/status` works
- [ ] `goodteams tenant list/show` works
- [ ] `goodteams agent list/chat` works
- [ ] Webchat works end-to-end
- [ ] Basic tools work (read, write, exec)
- [ ] Sessions persist across restarts (PostgreSQL)
- [ ] **Workplace personal assistant features work** (SOUL, USER, MEMORY adapted)
- [ ] No OpenClaw CLI dependency

### Phase 2 Complete When:
- [ ] Memory search returns relevant results (work context)
- [ ] Skills load from database
- [ ] Subagents can be spawned
- [ ] Cron jobs execute on schedule
- [ ] **Meeting transcription works**
- [ ] **Workplace heartbeat proactively checks inbox/calendar/tasks**
- [ ] Complete CLI with all commands

### Phase 3 Complete When:
- [ ] Teams bot responds to messages
- [ ] Slack app works in enterprise workspace
- [ ] Proactive messaging works
- [ ] **Workplace check-ins delivered to channels**

### Full Independence When:
- [ ] Zero imports from `src/agents/`, `src/gateway/`, `src/channels/`
- [ ] Can delete all OpenClaw code
- [ ] All tests pass
- [ ] Production traffic on GoodTeams gateway
- [ ] **Workplace personal assistant fully functional**

---

## Appendix A: File Copy Checklist

### Agent Loop Files
- [ ] `pi-embedded-runner.ts`
- [ ] `pi-embedded-subscribe.ts`
- [ ] `pi-embedded-utils.ts`
- [ ] `pi-embedded-helpers/*.ts`
- [ ] `pi-tools.ts`
- [ ] `pi-tools.policy.ts`
- [ ] `compaction.ts`
- [ ] `system-prompt.ts`
- [ ] `model-selection.ts`
- [ ] `model-fallback.ts`

### Workplace Personal Assistant Files (KEEP & ADAPT)
- [ ] `identity.ts`
- [ ] `identity-file.ts`
- [ ] `identity-avatar.ts`
- [ ] `bootstrap-files.ts`
- [ ] `workspace.ts`
- [ ] `heartbeat-runner.ts`

### Session Files
- [ ] `session-utils.ts`
- [ ] `session-utils.types.ts`
- [ ] `sessions-patch.ts`
- [ ] `sessions-resolve.ts`

### Tool Files
- [ ] `bash-tools.exec.ts`
- [ ] `bash-tools.process.ts`
- [ ] `bash-tools.shared.ts`
- [ ] `tools/read.ts`
- [ ] `tools/write.ts`
- [ ] `tools/edit.ts`
- [ ] `tools/web-search.ts`
- [ ] `tools/web-fetch.ts`

### Service Files
- [ ] `cron/service/*.ts`
- [ ] `memory/manager.ts`
- [ ] `memory/embeddings.ts`

---

## Appendix B: CLI Command Reference

```
goodteams
├── gateway
│   ├── start           Start the gateway daemon
│   ├── stop            Stop the gateway gracefully
│   ├── restart         Zero-downtime restart
│   ├── status          Current status and health
│   └── logs            Stream gateway logs
├── tenant
│   ├── list            List all organizations
│   ├── show <id>       Show organization details
│   ├── create          Create new organization (interactive)
│   └── config <id>     Configure tenant settings
├── agent
│   ├── list            List agents (--tenant required)
│   ├── show <id>       Show agent details
│   ├── chat <id>       Direct chat with agent
│   └── reload <id>     Hot reload configuration
├── config
│   ├── show            Show current configuration
│   ├── edit            Edit in $EDITOR
│   ├── set <key> <val> Set specific value
│   └── validate        Validate configuration
├── status
│   ├── (default)       Quick health check
│   ├── --verbose       Detailed diagnostics
│   └── --check         Run all health checks
├── db
│   ├── status          Database status
│   ├── migrate         Run pending migrations
│   ├── backup          Create backup
│   └── query <sql>     Run query (admin only)
├── logs
│   ├── (default)       Stream logs
│   ├── --tenant <id>   Filter by tenant
│   ├── --level <lvl>   Filter by level
│   └── --since <time>  Filter by time
└── version             Show version info
```

---

## Appendix C: Database Migrations Needed

```sql
-- Add pgvector extension for memory system
CREATE EXTENSION IF NOT EXISTS vector;

-- Memory embeddings table (work context)
CREATE TABLE memory_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "Organization"(id),
  user_id UUID REFERENCES "User"(id),  -- Optional: personal work memories
  category TEXT NOT NULL DEFAULT 'general',  -- 'project', 'person', 'decision', 'tribal'
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_memory_org ON memory_embeddings(organization_id);
CREATE INDEX idx_memory_user ON memory_embeddings(user_id);
CREATE INDEX idx_memory_category ON memory_embeddings(category);
CREATE INDEX idx_memory_embedding ON memory_embeddings 
  USING ivfflat (embedding vector_cosine_ops);

-- Session transcripts table (replacing file-based)
CREATE TABLE session_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "Organization"(id),
  user_id UUID NOT NULL REFERENCES "User"(id),
  session_key TEXT NOT NULL,
  messages JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, session_key)
);

-- Work session logs (daily notes adapted)
CREATE TABLE work_session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "Organization"(id),
  user_id UUID NOT NULL REFERENCES "User"(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  entries JSONB DEFAULT '[]',  -- Structured log entries
  summary TEXT,                -- AI-generated summary
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, user_id, date)
);

-- Employee profiles (adapted from USER.md)
CREATE TABLE employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "Organization"(id),
  user_id UUID NOT NULL REFERENCES "User"(id) UNIQUE,
  identity JSONB DEFAULT '{}',        -- name, role, department, etc.
  work_context JSONB DEFAULT '{}',    -- projects, specialties
  communication JSONB DEFAULT '{}',   -- style, preferences
  working_patterns JSONB DEFAULT '{}',-- hours, focus time
  goals JSONB DEFAULT '{}',           -- quarterly, career
  preferences JSONB DEFAULT '{}',     -- notification, autonomy level
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Organization personas (adapted from SOUL.md)
CREATE TABLE organization_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "Organization"(id),
  level TEXT NOT NULL DEFAULT 'organization', -- 'organization', 'team', 'role'
  team_id TEXT,  -- For team-level personas
  role_type TEXT, -- For role-level personas
  persona_content TEXT NOT NULL,  -- The SOUL.md-style content
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cron jobs table (replacing file-based)
CREATE TABLE cron_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "Organization"(id),
  user_id UUID REFERENCES "User"(id),  -- Optional: per-user jobs
  name TEXT NOT NULL,
  schedule TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transcription records
CREATE TABLE transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "Organization"(id),
  user_id UUID NOT NULL REFERENCES "User"(id),
  type TEXT NOT NULL DEFAULT 'meeting',  -- 'meeting', 'voice_memo', 'call'
  audio_url TEXT,
  transcript TEXT,
  summary TEXT,
  action_items JSONB DEFAULT '[]',
  speakers JSONB DEFAULT '[]',  -- Diarization
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

*End of GoodTeams Independence Implementation Plan v2.0*

**The key insight:** GoodTeams is a **Workplace Personal Assistant**. We're not removing OpenClaw's personal assistant magic—we're **adapting it for the enterprise workplace**.

**Next step:** Review this plan, finalize decisions, then start Phase 1!
