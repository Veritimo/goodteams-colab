# GoodTeams Master Implementation Plan

> Complete Transformation of OpenClaw into Enterprise AI Platform

**Version:** 1.0  
**Status:** Planning  
**Created:** February 2026  
**Estimated Duration:** ~70 weeks (core functionality) + ~12 weeks (compliance/ops)

---

## Table of Contents

1. [Vision & Scope](#1-vision--scope)
2. [Spec Coverage](#2-spec-coverage)
3. [Phase Overview](#3-phase-overview)
4. [Testing Strategy](#4-testing-strategy)
5. [Phase Details](#5-phase-details)
6. [Cross-Cutting Concerns](#6-cross-cutting-concerns)
7. [Implementation Log](#7-implementation-log)

---

## 1. Vision & Scope

### What We're Building

Transform **goodteams-colab** (OpenClaw fork) into a complete enterprise AI assistant platform:

- **Multi-tenant SaaS** with gateway-per-tenant isolation
- **Enterprise auth** via Microsoft Entra and Google Workspace
- **RBAC** with organization/team management
- **Desktop automation** for Windows (Excel, Word, Outlook, any app)
- **Enterprise integrations** (M365, Google, SQL, CRM)
- **Collaborative AI** (artifact-based document creation)
- **Visual workflows** (no-code automation builder)

### What We're NOT Doing (Yet)

Pushed to final stages:
- SOC 2 Type II audit (requires production history)
- HIPAA BAA (vertical-specific)
- Full disaster recovery implementation
- Operations runbooks (need production learnings)
- Data governance tooling (after core features)

### Source Materials

| Source | Purpose |
|--------|---------|
| `goodteams-colab` | Base codebase (OpenClaw fork) |
| `goodteams-ai` | Reference implementation for patterns |
| `/docs/*.md` | Architecture specs (the blueprints) |

---

## 2. Spec Coverage

Every spec in `/docs` is mapped to an implementation phase:

| Spec Document | Phase | Priority |
|---------------|-------|----------|
| **GOODTEAMS-STRATEGY.md** | All | Master reference |
| **MULTI-TENANT-ARCHITECTURE.md** | 3 | P0 - Core |
| **SECURITY-ARCHITECTURE.md** | 2 | P0 - Core |
| **RBAC-STAFF-ONBOARDING.md** | 2 | P0 - Core |
| **MICROSOFT-365-AUTH-ARCHITECTURE.md** | 2, 4 | P0 - Core |
| **GOOGLE-WORKSPACE-AUTH-ARCHITECTURE.md** | 8 | P1 - Important |
| **DESKTOP-AGENT-ARCHITECTURE.md** | 5 | P0 - Core |
| **GOODTEAMS-AI-GAP-ANALYSIS.md** | 7, Backlog | P0 - Core |
| **IMPLEMENTATION-PLAN-PHASE7.md** | 7 | P0 - Core |
| **AUDIT-LOGGING-SPEC.md** | 2 | P0 - Core |
| **ENTERPRISE-READINESS-GAPS.md** | All | Reference |
| **COMPLIANCE-MATRIX.md** | 9 | P2 - Later |
| **DATA-GOVERNANCE.md** | 9 | P2 - Later |
| **DISASTER-RECOVERY.md** | 9 | P2 - Later |
| **OPERATIONS-RUNBOOKS.md** | 9 | P2 - Later |

---

## 3. Phase Overview

### Core Functionality (Phases 1-8)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CORE FUNCTIONALITY PHASES                             │
│                                                                              │
│  Phase 1         Phase 2           Phase 3           Phase 4                │
│  ════════        ════════          ════════          ════════               │
│  Foundation      Security          Multi-Tenancy     Microsoft 365          │
│  (4 weeks)       (5 weeks)         (5 weeks)         (6 weeks)              │
│                                                                              │
│  • Database      • Entra SSO       • Gateway-per-    • MS Graph API         │
│  • Platform API  • RBAC            │ tenant          • SharePoint           │
│  • Clean code    • Audit logs      • Tenant mgmt     • OneDrive             │
│  • Project setup • Staff onboard   • Config isol.    • Outlook              │
│                                    • Credential      • Teams channel        │
│                                    │ vault                                  │
│                                                                              │
│  Phase 5         Phase 6           Phase 7           Phase 8                │
│  ════════        ════════          ════════          ════════               │
│  Desktop Agent   Database & CRM    Visual Workflow   Google Workspace       │
│  (8 weeks)       (6 weeks)         (6 weeks)         (4 weeks)              │
│                                                                              │
│  • Electron app  • SQL Server      • React Flow      • OAuth + DWD          │
│  • Win UI Auto   • PostgreSQL      • Node types      • Drive/Docs           │
│  • Office COM    • Dynamics CRM    • Execution eng   • Gmail                │
│  • Visual collab • Salesforce      • Triggers        • Calendar             │
│  • Screen stream • SchemaHints     • Agent tools     • Chat integration     │
│                                    • History/debug                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ ~44 weeks (core)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPLIANCE & OPS (Phase 9)                            │
│                              (12 weeks)                                      │
│                                                                              │
│  • SOC 2 controls mapping          • Data governance tooling                │
│  • GDPR data subject rights        • Disaster recovery                      │
│  • Compliance matrix               • Operations runbooks                    │
│  • Penetration testing             • Monitoring/alerting                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ +12 weeks
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BACKLOG / FUTURE PHASES                               │
│                                                                              │
│  Colab (Deferred)                                                            │
│  ════════════════                                                            │
│  • Artifact UI             • Block system                                   │
│  • PREE engine             • Accept/reject workflow                         │
│  • SSE streaming           • Export (DOCX/PDF)                              │
│                                                                              │
│  When: After core phases, based on customer demand                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Timeline Summary

| Phase | Name | Weeks | Cumulative |
|-------|------|-------|------------|
| 1 | Foundation | 4 | 4 |
| 2 | Security Foundation | 5 | 9 |
| 3 | Multi-Tenancy | 5 | 14 |
| 4 | Microsoft 365 | 6 | 20 |
| 5 | Desktop Agent | 8 | 28 |
| 6 | Database & CRM | 6 | 34 |
| 7 | Visual Workflow | 6 | 40 |
| 8 | Google Workspace | 4 | 44 |
| 9 | Compliance & Ops | 12 | 56 |
| — | Colab (Backlog) | 8 | — |
| 10 | Compliance & Ops | 12 | 64 |

**Core functionality complete:** Week 52 (~12 months)  
**Full platform:** Week 64 (~15 months)

---

## 4. Testing Strategy

### Testing Philosophy

> **Test at every phase, gate progression on test passage**

We use a layered testing approach where each phase has explicit test requirements that must pass before the next phase begins.

### Test Pyramid

```
                        ┌─────────────┐
                       │    E2E      │  5%  - Critical user journeys
                      │   (Playwright)│
                     └──────┬────────┘
                            │
                    ┌───────▼────────┐
                   │   Integration   │  25% - API + DB + Services
                  │    (Vitest)      │
                 └────────┬─────────┘
                          │
              ┌───────────▼───────────┐
             │         Unit           │  70% - Functions, logic
            │       (Vitest)          │
           └──────────────────────────┘
```

### When Tests Run

| Trigger | What Runs | Must Pass |
|---------|-----------|-----------|
| **Every commit** | Unit + Integration (affected) | Yes |
| **Every PR** | Full test suite | Yes to merge |
| **Phase checkpoint** | Full suite + E2E + Demo | Yes to proceed |
| **Nightly** | Full suite + Regression | Alert on failure |

### Phase Gate Testing

Each phase ends with a **checkpoint** that requires:

1. **All unit tests pass** (coverage ≥ 80% for new code)
2. **All integration tests pass**
3. **E2E scenarios for phase features pass**
4. **No critical/high security issues** (from linting/scanning)
5. **Demo to stakeholders** (shows feature working)

```typescript
// Phase gate checklist (example)
const phaseGate = {
  phase: 2,
  name: "Security Foundation",
  
  tests: {
    unit: { passing: true, coverage: 85 },
    integration: { passing: true, count: 47 },
    e2e: { passing: true, scenarios: ["login_sso", "rbac_deny", "invite_accept"] }
  },
  
  security: {
    criticalIssues: 0,
    highIssues: 0,
    mediumIssues: 3  // Acceptable
  },
  
  demo: {
    completed: true,
    stakeholderApproval: true
  },
  
  verdict: "PASS"  // Proceed to Phase 3
};
```

### Test Locations

```
src/
├── platform/
│   ├── __tests__/
│   │   ├── unit/           # Unit tests
│   │   ├── integration/    # Integration tests
│   │   └── e2e/            # E2E scenarios
│   └── ...
├── ...
└── test/
    ├── e2e/                # Cross-cutting E2E
    ├── fixtures/           # Shared test data
    └── helpers/            # Test utilities
```

### Key E2E Scenarios Per Phase

| Phase | Critical E2E Scenarios |
|-------|------------------------|
| 1 | DB connects, API health check |
| 2 | SSO login, RBAC deny unauthorized, invite→accept→access |
| 3 | Tenant isolation (A can't see B's data), tenant CRUD |
| 4 | SharePoint file read, Outlook send, Graph API token refresh |
| 5 | Desktop agent connects, Excel read/write, screen stream |
| 6 | SQL query execution, SchemaHints applied, Salesforce CRUD |
| 7 | Create artifact, draft blocks, accept/reject, SSE updates |
| 8 | Create workflow, execute, trigger fires, history logged |
| 9 | Google SSO, Drive file read, Gmail send |

### Test Database

```bash
# Separate test database
DATABASE_URL="postgresql://localhost:5432/goodteams_test"

# Reset before test suites
npx prisma migrate reset --force --skip-seed
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test:unit
      
  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: npx prisma migrate deploy
      - run: pnpm test:integration
      
  e2e:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:e2e
```

---

## 5. Phase Details

### Phase 1: Foundation (Weeks 1-4)

**Goal:** Establish infrastructure for platform development

**Spec References:**
- GOODTEAMS-STRATEGY.md §1 (Architecture Review)
- GOODTEAMS-STRATEGY.md Appendix C (Migration Checklist)

#### 1.1 Database Layer (Week 1)

| Task | Description | Test |
|------|-------------|------|
| Add Prisma | `pnpm add prisma @prisma/client` | Setup completes |
| Create schema | Core models (Org, User, Invite, Audit) | Migration runs |
| DB client singleton | `src/platform/db/client.ts` | Query works |
| Seed script | Dev data for testing | Seed runs |

**Schema:** See IMPLEMENTATION-PLAN-RBAC.md §4.1

#### 1.2 Platform API Layer (Week 2)

| Task | Description | Test |
|------|-------------|------|
| Create `src/platform/` | Directory structure | Exists |
| Platform router | Express router for `/api/platform/*` | Routes load |
| Integrate with gateway | Hook into existing HTTP server | Health endpoint works |
| Request context middleware | User, org, IP extraction | Context populated |
| Error handling | Consistent error responses | Errors formatted |

#### 1.3 Project Cleanup (Week 3)

| Task | Description | Test |
|------|-------------|------|
| Remove consumer channels | WhatsApp personal, iMessage personal | Builds without |
| Update branding | OpenClaw → GoodTeams | No OpenClaw refs |
| Lint/format codebase | Consistent style | Lint passes |
| Update dependencies | Security patches, latest versions | No vulnerabilities |

#### 1.4 Dev Environment (Week 4)

| Task | Description | Test |
|------|-------------|------|
| Docker Compose | Local dev with PostgreSQL | `docker-compose up` works |
| Environment configs | `.env.example`, validation | Missing vars caught |
| Test infrastructure | Vitest setup, test DB | Tests run |
| CI/CD pipeline | GitHub Actions for tests | PR checks run |

#### Phase 1 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| Database | Migrations run, CRUD works |
| Platform API | `/api/platform/health` returns 200 |
| Tests | Unit tests run, CI passes |
| Codebase | Lints clean, builds clean |

---

### Phase 2: Security Foundation (Weeks 5-9)

**Goal:** Enterprise authentication, authorization, and audit

**Spec References:**
- SECURITY-ARCHITECTURE.md
- RBAC-STAFF-ONBOARDING.md
- MICROSOFT-365-AUTH-ARCHITECTURE.md (auth portion)
- AUDIT-LOGGING-SPEC.md

#### 2.1 Entra SSO Integration (Week 5)

| Task | Description | Test |
|------|-------------|------|
| MSAL setup | `@azure/msal-node` client | Client initializes |
| Admin consent flow | Redirect → Microsoft → Callback | Creates org |
| User auth code flow | SSO login for users | User authenticated |
| Token storage | Encrypted token vault | Tokens persist |
| Token refresh | Auto-refresh before expiry | Silent refresh works |

#### 2.2 RBAC Implementation (Week 6)

| Task | Description | Test |
|------|-------------|------|
| Permission constants | All permission types defined | Constants match spec |
| checkPermission() | Role + explicit permission check | Correct access |
| requirePermission middleware | Express middleware | Denies unauthorized |
| Admin continuity guard | Can't remove last admin | Guard blocks |
| Self-removal prevention | Can't demote yourself | Blocked |

#### 2.3 Staff Onboarding (Week 7)

| Task | Description | Test |
|------|-------------|------|
| Entra directory search | Graph API user lookup | Returns users |
| Create invitation | Pending invitation with token | Creates, emails |
| Accept invitation | Link user to org | User linked |
| Revoke invitation | Cancel pending | Deleted |
| Invitation expiry | 7-day TTL | Expired rejected |

#### 2.4 Audit Logging (Week 8)

| Task | Description | Test |
|------|-------------|------|
| Audit log model | Prisma model with indexes | Queries fast |
| logAudit() utility | Standard logging function | Logs created |
| Log all auth events | Login, logout, failures | Events logged |
| Log all RBAC events | Role changes, permission grants | Events logged |
| Audit log API | Query with filters | Returns filtered |

#### 2.5 Security Hardening (Week 9)

| Task | Description | Test |
|------|-------------|------|
| Rate limiting | Per-IP, per-user limits | Blocks excess |
| Input validation | Zod schemas for all endpoints | Rejects invalid |
| CSRF protection | Token validation | Attacks blocked |
| Security headers | Helmet.js or equivalent | Headers present |
| Dependency scan | npm audit, Snyk | No critical vulns |

#### Phase 2 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| SSO | Login via Entra works end-to-end |
| RBAC | Admin actions blocked for User role |
| Invitations | Full lifecycle works |
| Audit | All security events logged |
| E2E | `login_sso`, `rbac_deny`, `invite_accept` pass |

---

### Phase 3: Multi-Tenancy (Weeks 10-14)

**Goal:** Tenant isolation with gateway-per-tenant architecture

**Spec References:**
- MULTI-TENANT-ARCHITECTURE.md

#### 3.1 Tenant Orchestrator (Week 10-11)

| Task | Description | Test |
|------|-------------|------|
| Tenant model | DB model with status, config | CRUD works |
| Gateway provisioner | Spawn gateway process per tenant | Process starts |
| Gateway lifecycle | Start, stop, restart, health | All states work |
| Port/socket allocation | Dynamic allocation per tenant | No conflicts |
| Process monitoring | Health checks, auto-restart | Restarts on crash |

#### 3.2 Tenant Routing (Week 12)

| Task | Description | Test |
|------|-------------|------|
| Request router | Route to correct gateway | Tenant A → Gateway A |
| Subdomain routing | `tenant.goodteams.ai` → gateway | Resolves correctly |
| WebSocket proxying | WS connections routed | Sessions work |
| API proxying | HTTP calls routed | Calls succeed |

#### 3.3 Tenant Configuration (Week 13)

| Task | Description | Test |
|------|-------------|------|
| Per-tenant config | Isolated YAML per tenant | Config loads |
| Config API | CRUD via platform API | Updates apply |
| Config templates | Default config for new tenants | Templates work |
| Hot reload | Config changes without restart | Updates live |

#### 3.4 Credential Isolation (Week 14)

| Task | Description | Test |
|------|-------------|------|
| Per-tenant vault | Separate credential storage | Isolated |
| Credential API | Secure CRUD | Encryption works |
| Key rotation | Rotate without downtime | Seamless |
| Cross-tenant check | Verify no leakage | A can't access B |

#### Phase 3 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| Isolation | Tenant A cannot access Tenant B data |
| Provisioning | New tenant gets running gateway in <30s |
| Routing | Requests route to correct gateway |
| E2E | `tenant_isolation`, `tenant_crud` pass |

---

### Phase 4: Microsoft 365 Integration (Weeks 15-20)

**Goal:** Full M365 integration via Graph API

**Spec References:**
- MICROSOFT-365-AUTH-ARCHITECTURE.md
- GOODTEAMS-STRATEGY.md §5.2-5.4

#### 4.1 MS Graph Foundation (Week 15)

| Task | Description | Test |
|------|-------------|------|
| Graph client | SDK setup with token provider | Client works |
| Scopes configuration | Per-resource scopes | Correct scopes |
| Error handling | Token refresh, retries | Resilient |
| Rate limiting | Respect Graph limits | No throttle errors |

#### 4.2 SharePoint & OneDrive (Week 16-17)

| Task | Description | Test |
|------|-------------|------|
| Site listing | List accessible sites | Returns sites |
| File browsing | List files/folders | Returns items |
| File read | Download file content | Content returned |
| File write | Upload files | File created |
| File search | Search across sites | Results returned |
| Sites.Selected | Grant per-site access | Permission works |

#### 4.3 Outlook Integration (Week 18)

| Task | Description | Test |
|------|-------------|------|
| Read emails | List inbox, search | Returns emails |
| Send email | Compose and send | Delivered |
| Calendar read | List events | Returns events |
| Calendar write | Create/update events | Event created |
| Contacts | Read contacts | Returns contacts |

#### 4.4 Teams Channel (Week 19-20)

| Task | Description | Test |
|------|-------------|------|
| Teams channel plugin | `extensions/teams/` | Loads |
| Receive messages | Webhook for incoming | Messages received |
| Send messages | Post to channels/chats | Delivered |
| Meeting transcripts | Access meeting recordings | Transcripts fetched |
| Adaptive cards | Rich message formatting | Cards render |

#### Phase 4 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| SharePoint | Read/write files works |
| Outlook | Send email works |
| Teams | Bidirectional messaging works |
| E2E | `sharepoint_crud`, `outlook_send`, `teams_message` pass |

---

### Phase 5: Desktop Agent (Weeks 21-28)

**Goal:** Windows desktop automation with visual collaboration

**Spec References:**
- DESKTOP-AGENT-ARCHITECTURE.md

#### 5.1 Electron Foundation (Week 21-22)

| Task | Description | Test |
|------|-------------|------|
| Electron app shell | Basic window, tray | App runs |
| Gateway client | Connect as node | Connects |
| Auto-updater | Squirrel/electron-updater | Updates work |
| System tray | Status, menu | Tray works |
| IPC bridge | Main ↔ Renderer comms | Messages pass |

#### 5.2 Windows UI Automation (Week 23-24)

| Task | Description | Test |
|------|-------------|------|
| UIA bindings | Node bindings for UI Automation | Loads |
| Window inspection | Get UI element tree | Returns tree |
| Click action | Click UI elements | Clicks work |
| Type action | Send keystrokes | Text enters |
| Wait for element | Wait until visible | Waits correctly |

#### 5.3 Office COM Automation (Week 25-26)

| Task | Description | Test |
|------|-------------|------|
| COM bindings | node-windows-ole or edge.js | Loads |
| Excel read | Read cells, ranges | Data returned |
| Excel write | Write cells, ranges | Data written |
| Word automation | Read/write documents | Doc modified |
| Outlook automation | Read/send via COM | Works |

#### 5.4 Visual Collaboration (Week 27-28)

| Task | Description | Test |
|------|-------------|------|
| Screen capture | Capture desktop/window | Image returned |
| Screen streaming | WebRTC stream | Stream works |
| Cursor overlay | Highlight AI cursor | Visible |
| Action toast | Show action notifications | Toasts appear |
| Element highlight | Box around target element | Visible |

#### Phase 5 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| Agent connects | Desktop agent as node in gateway |
| UI automation | Can click/type in Windows apps |
| Office | Can read/write Excel via COM |
| Visual | Screen stream visible in web |
| E2E | `agent_connect`, `excel_rw`, `screen_stream` pass |

---

### Phase 6: Database & CRM (Weeks 29-34)

**Goal:** SQL Server, PostgreSQL, Dynamics CRM/Dataverse, Salesforce integration

**Spec References:**
- GOODTEAMS-STRATEGY.md §5.4-5.5
- IMPLEMENTATION-PLAN-PHASE6.md (detailed spec)

#### 6.1 Connector Framework (Week 29)

| Task | Description | Test |
|------|-------------|------|
| ResourceConnection model | Unified connector storage | CRUD works |
| Credential encryption | AES-256-GCM for secrets | Encrypts/decrypts |
| Connection pooling | Per-connector pools | Pools reused |
| Health checks | Periodic connectivity test | Status updated |

#### 6.2 SQL Integration (Week 29-30)

| Task | Description | Test |
|------|-------------|------|
| SQL Server driver | mssql + tedious packages | Queries work |
| PostgreSQL driver | pg package | Queries work |
| Schema introspection | Tables, columns, relationships | Schema returned |
| Query generation | Natural language → SQL via LLM | SQL generated |

#### 6.3 SchemaHints System (Week 30-31)

| Task | Description | Test |
|------|-------------|------|
| SchemaHint model | Per-connector business rules | CRUD works |
| Hints engine | Apply hints to query generation | Hints applied |
| Query safety | Read-only mode, row limits, timeouts | Safety enforced |
| Query audit | Log all queries with user context | Queries logged |

#### 6.4 Dynamics CRM/Dataverse (Week 31-32)

| Task | Description | Test |
|------|-------------|------|
| Azure auth | ClientSecretCredential integration | Authenticates |
| TDS client | SQL via Dataverse TDS endpoint (port 5558) | Queries work |
| Entity metadata | Schema cache + refresh | Metadata cached |
| CRM SchemaHints | Entity-specific query rules | Hints applied |
| Bulk operations | Batch create/update/delete (500/batch) | Bulk works |
| Permission gating | CRM_CREATE/UPDATE/DELETE required | Writes gated |

#### 6.5 Salesforce Integration (Week 33-34)

| Task | Description | Test |
|------|-------------|------|
| OAuth flow | Salesforce OAuth 2.0 | Authenticates |
| SOQL execution | Query with pagination | Results returned |
| Metadata API | Object/field introspection | Schema returned |
| Salesforce hints | Object-specific rules | Hints applied |
| Bulk API | Large data operations | Bulk works |
| Report access | Read Salesforce reports | Reports returned |

#### Phase 6 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| Connectors | Unified CRUD, credentials encrypted |
| SQL | Query SQL Server + PostgreSQL |
| Dataverse | Query via TDS, bulk ops with batching |
| Salesforce | SOQL + Bulk API work |
| SchemaHints | Business rules improve query accuracy |
| Safety | Writes gated by RBAC, read-only default |
| E2E | `sql_query`, `crm_query`, `salesforce_crud` pass |

---

### Phase 7: Visual Workflow (Weeks 35-40) ✅ COMPLETE

**Goal:** No-code workflow automation with agent-assisted creation

**Spec References:**
- GOODTEAMS-AI-GAP-ANALYSIS.md §2 (Visual Workflow Designer)
- IMPLEMENTATION-PLAN-PHASE7.md (detailed spec)

**Key Decisions:**
- SQL/CRM as **tools**, not separate node types
- Main agent creates workflows via `workflow_create` tool (no separate workflow agent)
- BullMQ for reliable job queue execution

**Status:** ✅ Complete (474 tests passing)

#### 7.1 Foundation & Data Model (Week 35)

| Task | Description | Test |
|------|-------------|------|
| Workflow model | Name, tenant, status, definition | CRUD works |
| WorkflowExecution model | Run history, logs, context | CRUD works |
| Schema migration | Prisma migration | Migration runs |
| CRUD service | Create, read, update, delete | All ops work |
| API routes | `/api/workflows/*` endpoints | Routes respond |
| Definition validation | Validate node/edge structure | Invalid rejected |

#### 7.2 Execution Engine Core (Week 36)

| Task | Description | Test |
|------|-------------|------|
| BullMQ setup | Redis queue for workflow jobs | Queue works |
| Engine class | Variable resolution `{{node.output}}` | Variables resolve |
| Graph traversal | Find next nodes from edges | Traversal works |
| Job processor | Dequeue and execute nodes | Jobs process |
| Context management | Track inputs/outputs per node | Context persists |

#### 7.3 Node Executors (Week 37)

| Task | Description | Test |
|------|-------------|------|
| Trigger executor | Pass-through for execution start | Triggers fire |
| Agent executor | LLM call with tools | Agent responds |
| Tool executor | Call registered tools (SQL, CRM, etc.) | Tools execute |
| Condition executor | Branch on JavaScript expression | Branches correctly |
| Communication executor | Email, Teams, chat | Messages sent |
| Iterator executor | Loop over collections | Loops work |

#### 7.4 Agent Workflow Tools (Week 38)

| Task | Description | Test |
|------|-------------|------|
| workflow_list | List workflows for tenant | Returns list |
| workflow_get | Get workflow details | Returns definition |
| workflow_create | Create from prompt or definition | Creates workflow |
| workflow_update | Modify existing workflow | Updates saved |
| workflow_execute | Trigger workflow run | Execution starts |
| workflow_status | Check execution status | Status returned |
| Prompt-to-workflow | LLM generates definition from NL | Generates valid def |

#### 7.5 Triggers (Week 39)

| Task | Description | Test |
|------|-------------|------|
| Manual trigger | API call to start | Starts execution |
| Cron trigger | node-cron scheduling | Fires on schedule |
| Webhook trigger | Unique HTTP endpoint per workflow | Receives payload |
| Chat trigger | Start from conversation | Workflow starts |

#### 7.6 React Flow Designer (Week 40)

| Task | Description | Test |
|------|-------------|------|
| Canvas | React Flow setup | Renders |
| Node components | Custom node UIs per type | All types render |
| Node palette | Draggable node types | Drag works |
| Edge connections | Connect nodes with handles | Edges work |
| Properties panel | Edit node configuration | Edits save |
| Save/load | Persist workflow to API | Workflow saved |
| Run button | Execute from designer | Starts execution |
| Execution view | Show run status/logs | Status shown |

#### Phase 7 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| Designer | Create workflow visually with React Flow |
| Execution | Workflow runs end-to-end via BullMQ |
| Triggers | Cron, webhook, and chat triggers work |
| Agent tools | Main agent can create/run workflows |
| History | Can view past executions with logs |
| Tests | 150+ unit tests, 30+ integration tests pass |
| E2E | `workflow_create`, `workflow_run`, `workflow_trigger` pass |
---

### Phase 8: Google Workspace (Weeks 41-44)

**Goal:** Google OAuth, Drive, Gmail, Calendar

**Spec References:**
- GOOGLE-WORKSPACE-AUTH-ARCHITECTURE.md

#### 8.1 Google OAuth (Week 41)

| Task | Description | Test |
|------|-------------|------|
| OAuth client | Google Auth Library | Initializes |
| User OAuth | Consent flow | Authenticates |
| Domain-wide delegation | Service account setup | Impersonation works |
| Token storage | Encrypted storage | Persists |

#### 8.2 Google Drive (Week 42)

| Task | Description | Test |
|------|-------------|------|
| File listing | List Drive files | Returns files |
| File read | Download content | Content returned |
| File write | Upload files | File created |
| Shared drives | Access shared drives | Works |

#### 8.3 Gmail & Calendar (Week 43-44)

| Task | Description | Test |
|------|-------------|------|
| Read emails | List/search Gmail | Returns emails |
| Send email | Compose and send | Delivered |
| Calendar read | List events | Returns events |
| Calendar write | Create events | Event created |

#### Phase 8 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| OAuth | Both user and service account work |
| Drive | Read/write files |
| Gmail | Send emails |
| Calendar | Create events |
| E2E | `google_oauth`, `drive_crud`, `gmail_send` pass |

---

### Phase 9: Compliance & Ops (Weeks 45-56)

**Goal:** Enterprise compliance and operational readiness

**Spec References:**
- COMPLIANCE-MATRIX.md
- DATA-GOVERNANCE.md
- DISASTER-RECOVERY.md
- OPERATIONS-RUNBOOKS.md

#### 9.1 SOC 2 Controls (Week 45-48)

| Task | Description | Test |
|------|-------------|------|
| Controls mapping | Map to trust criteria | Document complete |
| Control implementation | Implement gaps | Controls work |
| Evidence collection | Automated evidence | Generates |
| Audit preparation | Documentation | Ready for audit |

#### 9.2 Data Governance (Week 49-51)

| Task | Description | Test |
|------|-------------|------|
| Data classification | Classification engine | Classifies |
| Retention policies | Auto-delete aged data | Deletes |
| Right to erasure | GDPR Article 17 | Erases |
| Data portability | GDPR Article 20 | Exports |

#### 9.3 Disaster Recovery (Week 52-53)

| Task | Description | Test |
|------|-------------|------|
| Backup automation | DB + files backup | Backups run |
| Restore procedure | Tested restore | Restores work |
| Failover | Multi-region failover | Fails over |
| RTO/RPO validation | Meet targets | Targets met |

#### 9.4 Operations (Week 54-56)

| Task | Description | Test |
|------|-------------|------|
| Runbooks | Documented procedures | Complete |
| Monitoring | Metrics + alerting | Alerts work |
| On-call | PagerDuty/Opsgenie | Alerts route |
| Incident response | IR playbook | Documented |

#### Phase 9 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| SOC 2 | Controls documented, evidence collecting |
| GDPR | Erasure and portability work |
| DR | Backup/restore tested |
| Ops | Runbooks complete, monitoring live |

---

### Backlog: Colab (Future)

**Goal:** Artifact-centric collaboration (deferred based on customer demand)

**Spec References:**
- GOODTEAMS-AI-GAP-ANALYSIS.md §1 (Colab)

**Features (when implemented):**
- Artifact model with blocks
- PREE engine (Plan-Revise-Evaluate-Execute)
- SSE streaming for real-time updates
- Accept/reject workflow for blocks
- Export to DOCX/PDF

**When to consider:** After Phase 9, based on customer feedback and demand for collaborative document editing features.

---

## 6. Cross-Cutting Concerns

### 6.1 Database

All phases share a PostgreSQL database with Prisma ORM.

```
Phase 1: Core models (Org, User, Invite, Audit)
Phase 3: Tenant model
Phase 4-6: Integration credential storage
Phase 7: Workflow, WorkflowExecution
Phase 8: Google integration credentials
```

**Migration strategy:** Each phase adds migrations, never breaks previous.

### 6.2 Authentication

```
Phase 2: Entra SSO (primary)
Phase 8: Google SSO (secondary)
All: JWT tokens with refresh
```

### 6.3 API Design

Consistent REST API patterns:

```
GET    /api/platform/{resource}          # List
POST   /api/platform/{resource}          # Create
GET    /api/platform/{resource}/{id}     # Read
PUT    /api/platform/{resource}/{id}     # Update
DELETE /api/platform/{resource}/{id}     # Delete
```

### 6.4 Error Handling

Consistent error format:

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You don't have permission to perform this action",
    "details": { "required": "MANAGE_USERS" }
  }
}
```

### 6.5 Logging

Structured JSON logging:

```json
{
  "level": "info",
  "timestamp": "2026-02-15T10:30:00Z",
  "tenantId": "abc123",
  "userId": "user456",
  "action": "sharepoint.file.read",
  "duration": 234,
  "success": true
}
```

---

## 7. Implementation Log

> Chronological record of work completed

### Format

```markdown
### YYYY-MM-DD — Phase X.Y: Task Name

**Status:** ✅ Complete | 🔄 In Progress | ❌ Blocked | ⏸️ Paused

**Work:**
- What was done

**Decisions:**
- Choices made

**Blockers:**
- Issues (if any)

**Tests:**
- Tests written/passing

**Commit:** `abc123`
```

---

### 2026-02-02 — Planning

**Status:** ✅ Complete

**Work:**
- Created RBAC-STAFF-ONBOARDING.md spec
- Created IMPLEMENTATION-PLAN-RBAC.md (now superseded)
- Created this master implementation plan
- Analyzed all spec documents
- Defined phase ordering (core functionality first)
- Defined testing strategy

**Decisions:**
- Core functionality phases 1-9, compliance/ops phase 10
- Desktop Agent is P0 core (moved up)
- Google Workspace is P1 (can be after Desktop Agent)
- Testing gates between phases (must pass to proceed)
- Use Prisma for ORM (TypeScript-native)

**Next:**
- Start Phase 1: Foundation
- First task: Add Prisma and create initial schema

---

### 2026-02-02 — Phase 1: Foundation COMPLETE ✅

**Status:** ✅ Complete

**Work:**
- Spawned 3 parallel agents for Phase 1
- All streams completed successfully:

**Stream A (Database):**
- Added Prisma ORM with PostgreSQL
- Created schema.prisma with 6 models (Organization, User, Invitation, Permission, Skill, AuditLog)
- Prisma client singleton with health check
- Seed script for development data
- Commit: `6d5fed7f9`

**Stream B (Platform API):**
- Created src/platform/api/ structure
- Middleware: auth (stub), context, errors
- Routes: health, org, users, invitations (stubs)
- Integrated into gateway HTTP server at /api/platform/*
- Request context with X-Request-Id tracing
- Commit: `6d5fed7f9`

**Stream C (Cleanup):**
- Rebranded OpenClaw → GoodTeams
- Added PostgreSQL to docker-compose.yml
- Updated .env.example with DATABASE_URL, ENTRA_* vars
- Basic health tests
- Commit: `fec71199c`

**Multi-Agent Results:**
- 3 agents worked in parallel
- ~15 files created/modified
- ~14,000 lines of code added
- Total time: ~20 minutes

**Commits:**
- `fec71199c` Phase 1C: Project cleanup, branding, dev environment
- `6d5fed7f9` Phase 1A+1B: Database layer and Platform API scaffold

**Next:**
- Run Phase 1 checkpoint tests
- Verify database migrations
- Start Phase 2: Security Foundation

---

### 2026-02-02 — Phase 2: Security Foundation COMPLETE ✅

**Status:** ✅ Complete

**Work:**
- 4 parallel agents completed Phase 2:

**Stream A (Entra SSO):** `d21e0dc32`
- MSAL client configuration
- Admin consent flow for org-level M365 integration
- User SSO with OAuth 2.0 authorization code flow
- Encrypted token storage (AES-256-GCM)
- Entra directory search via MS Graph API
- Auth routes: consent, callback, login, logout, status
- **72 tests**

**Stream B (RBAC):** `1b7a3696c`
- Permission constants (20+ permission types)
- checkPermission with role-based + explicit permissions
- requirePermission/requireRole/requireAuth middleware
- Admin continuity guards (prevent last admin removal)
- Permission management routes
- **65 tests**

**Stream C (Audit):** `159b0ee01`
- Audit logger with risk classification
- 30+ auditable action constants
- Query utilities with filtering/pagination
- CSV/JSON export with streaming
- Audit API routes
- **64 tests**

**Stream D (Staff Onboarding):** `64aef974f`
- Full invitation lifecycle (create, accept, revoke, resend)
- Entra directory search route
- User management (list, role change, removal)
- Organization settings management
- Email stubs for notifications
- **62 tests**

**Phase 2 Totals:**
- 4 commits
- ~263 tests
- Complete security foundation

**Commits:**
- `159b0ee01` Phase 2C: Audit logging
- `1b7a3696c` Phase 2B: RBAC
- `d21e0dc32` Phase 2A: Entra SSO
- `64aef974f` Phase 2D: Staff onboarding

**Next:**
- Run Phase 2 checkpoint tests
- Start Phase 3: Multi-Tenancy

---

### 2026-02-02 — Phase 7: Visual Workflow COMPLETE ✅

**Status:** ✅ Complete

**Work:**
- 6-week implementation completed across backend and frontend:

**Week 35 - Foundation & Data Model:**
- Prisma schema with Workflow + WorkflowExecution models
- CRUD service with comprehensive error handling
- Definition validation with node/edge structure checks
- API routes: `/api/platform/workflows/*`

**Week 36 - Execution Engine Core:**
- BullMQ queue setup for reliable job processing
- Engine class with variable resolution `{{node.output}}`
- Graph traversal for finding next nodes
- Execution context management

**Week 37 - Node Executors:**
- Trigger executor (workflow start)
- Agent executor (LLM calls with tools)
- Tool executor (direct tool invocation)
- Condition executor (JavaScript expressions)
- Communication executor (email, Teams, chat)
- Iterator executor (loop over collections)

**Week 38 - Agent Workflow Tools:**
- workflow_list, workflow_get, workflow_create
- workflow_update, workflow_execute, workflow_status
- Prompt-to-workflow generation via LLM

**Week 39 - Triggers:**
- Manual trigger (API call)
- Cron trigger (node-cron scheduling)
- Webhook trigger (unique HTTP endpoints)
- Chat trigger (conversation-based activation)

**Week 40 - React Flow Designer UI:**
- WorkflowDesigner canvas with React Flow
- Custom node components (6 node types)
- PropertiesPanel for node configuration
- ExecutionView for run status/logs
- useWorkflowDesigner hook

**Phase 7 Totals:**
- 48 source files created
- 474 tests passing
- Complete workflow automation system

**Tests by Component:**
| Component | Tests |
|-----------|-------|
| Service | 41 |
| Validation | 38 |
| Engine | 70 |
| Nodes | 133 |
| Triggers | 79 |
| Tools | 47 |
| UI Components | 16 |
| API Routes | 50 |
| **Total** | **474** |

**Dependencies Added:**
- `bullmq@^5.67.2` - Redis-backed job queue
- `reactflow@^11.11.4` - Visual workflow designer
- `ioredis@^5.9.2` - Redis client for BullMQ

**Next:**
- Start Phase 8: Google Workspace

---

*[Add new entries above this line]*

---

## Quick Reference

### Commands

```bash
# Development
pnpm dev                    # Start gateway
pnpm test                   # Run all tests
pnpm test:unit              # Unit tests only
pnpm test:integration       # Integration tests
pnpm test:e2e               # E2E tests

# Database
npx prisma migrate dev      # Create migration
npx prisma db push          # Push schema
npx prisma studio           # Visual browser
npx prisma migrate reset    # Reset DB (test)

# Build
pnpm build                  # Production build
pnpm lint                   # Lint check
pnpm typecheck              # Type check
```

### Key Directories

```
src/platform/           # NEW - Platform layer
  ├── db/               # Prisma
  ├── api/              # Platform API routes
  ├── auth/             # SSO, RBAC
  └── audit/            # Audit logging

src/gateway/            # EXISTING - Core gateway
src/agents/             # EXISTING - Agent framework
extensions/             # EXISTING + NEW - Plugins

packages/
  └── desktop-agent/    # NEW - Electron app
```

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."

# Entra (Microsoft)
ENTRA_CLIENT_ID="..."
ENTRA_CLIENT_SECRET="..."

# Google (Phase 9)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# App
APP_URL="https://app.goodteams.ai"
```
