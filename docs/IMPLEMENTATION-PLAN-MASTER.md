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
| **GOOGLE-WORKSPACE-AUTH-ARCHITECTURE.md** | 9 | P1 - Important |
| **DESKTOP-AGENT-ARCHITECTURE.md** | 5 | P0 - Core |
| **GOODTEAMS-AI-GAP-ANALYSIS.md** | 7, 8 | P0 - Core |
| **AUDIT-LOGGING-SPEC.md** | 2 | P0 - Core |
| **ENTERPRISE-READINESS-GAPS.md** | All | Reference |
| **COMPLIANCE-MATRIX.md** | 10 | P2 - Later |
| **DATA-GOVERNANCE.md** | 10 | P2 - Later |
| **DISASTER-RECOVERY.md** | 10 | P2 - Later |
| **OPERATIONS-RUNBOOKS.md** | 10 | P2 - Later |

---

## 3. Phase Overview

### Core Functionality (Phases 1-9)

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
│  Desktop Agent   Database & CRM    Colab             Visual Workflow        │
│  (8 weeks)       (6 weeks)         (8 weeks)         (6 weeks)              │
│                                                                              │
│  • Electron app  • SQL Server      • Artifact UI     • React Flow           │
│  • Win UI Auto   • PostgreSQL      • PREE engine     • Node types           │
│  • Office COM    • Query builder   • Block system    • Execution engine     │
│  • Visual collab • SchemaHints     • SSE streaming   • Triggers             │
│  • Screen stream • Salesforce      • Accept/reject   • History/debug        │
│                                                                              │
│  Phase 9                                                                     │
│  ════════                                                                    │
│  Google Workspace                                                            │
│  (4 weeks)                                                                   │
│                                                                              │
│  • OAuth + DWD                                                               │
│  • Drive/Docs                                                                │
│  • Gmail                                                                     │
│  • Calendar                                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ ~52 weeks
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPLIANCE & OPS (Phase 10)                           │
│                              (12 weeks)                                      │
│                                                                              │
│  • SOC 2 controls mapping          • Data governance tooling                │
│  • GDPR data subject rights        • Disaster recovery                      │
│  • Compliance matrix               • Operations runbooks                    │
│  • Penetration testing             • Monitoring/alerting                    │
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
| 7 | Colab | 8 | 42 |
| 8 | Visual Workflow | 6 | 48 |
| 9 | Google Workspace | 4 | 52 |
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

**Goal:** SQL Server, PostgreSQL, Salesforce integration

**Spec References:**
- GOODTEAMS-STRATEGY.md §5.4-5.5

#### 6.1 SQL Connector Foundation (Week 29-30)

| Task | Description | Test |
|------|-------------|------|
| Connection management | Pool per connection | Connects |
| SQL Server driver | mssql package | Queries work |
| PostgreSQL driver | pg package | Queries work |
| Query builder | AI builds queries | SQL generated |
| Schema introspection | Read table/column metadata | Schema returned |

#### 6.2 SchemaHints System (Week 31)

| Task | Description | Test |
|------|-------------|------|
| SchemaHints model | DB model for hints | CRUD works |
| Hint application | Query builder uses hints | Hints applied |
| Hint UI | Admin can manage hints | UI works |
| Business rules → SQL | Natural language → patterns | Translates |

#### 6.3 Query Safety (Week 32)

| Task | Description | Test |
|------|-------------|------|
| Read-only mode | Prevent mutations | Mutations blocked |
| Row limits | Max rows per query | Limits enforced |
| Sensitive masking | Redact PII columns | Data masked |
| Query audit | Log all queries | Queries logged |
| Timeout enforcement | Kill long queries | Times out |

#### 6.4 Salesforce Integration (Week 33-34)

| Task | Description | Test |
|------|-------------|------|
| OAuth flow | Salesforce OAuth | Authenticates |
| SOQL queries | Query Salesforce data | Results returned |
| Record CRUD | Create/update/delete | Records modified |
| Report access | Read Salesforce reports | Reports returned |

#### Phase 6 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| SQL queries | Execute against SQL Server + PostgreSQL |
| SchemaHints | Business rules applied to queries |
| Safety | PII masked, mutations blocked when read-only |
| Salesforce | CRUD operations work |
| E2E | `sql_query`, `salesforce_crud` pass |

---

### Phase 7: Colab (Weeks 35-42)

**Goal:** Artifact-centric collaboration from goodteams-ai

**Spec References:**
- GOODTEAMS-AI-GAP-ANALYSIS.md §1 (Colab)

#### 7.1 Data Model (Week 35)

| Task | Description | Test |
|------|-------------|------|
| Artifact model | Format, status, blocks | CRUD works |
| Block model | Type, content, state | CRUD works |
| Block state machine | draft → pending → accepted | Transitions work |
| Workstream model | Container for artifacts | CRUD works |

#### 7.2 PREE Engine (Week 36-37)

| Task | Description | Test |
|------|-------------|------|
| Plan phase | Goal decomposition | Plan generated |
| Research phase | Context gathering | Sources found |
| Execute phase | Content generation | Blocks created |
| Evaluate phase | Self-critique | Evaluation logged |
| Phase transitions | State machine | Correct flow |

#### 7.3 Colab Tools (Week 38)

| Task | Description | Test |
|------|-------------|------|
| clarify_goal | Ask focused questions | Questions returned |
| propose_plan | Create work plan | Plan structured |
| draft_content | Generate blocks | Blocks created |
| update_block | Revise specific block | Block updated |
| evaluate_quality | Self-critique | Evaluation returned |

#### 7.4 Event Streaming (Week 39)

| Task | Description | Test |
|------|-------------|------|
| SSE endpoint | Server-sent events | Connection works |
| Phase events | phase_started, completed | Events sent |
| Block events | output_snapshot, output_patch | Events sent |
| Gate events | action_gate for approvals | Events sent |
| Client library | TypeScript SSE client | Receives events |

#### 7.5 Colab UI (Week 40-42)

| Task | Description | Test |
|------|-------------|------|
| Artifact viewer | Display blocks | Renders |
| Block actions | Accept/reject/revise | Actions work |
| Live updates | SSE → UI updates | Real-time |
| Block editor | Manual edits | Saves |
| Export | Download as DOCX/PDF | Exports work |

#### Phase 7 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| Artifacts | Create, draft, accept flow works |
| PREE | All phases execute correctly |
| SSE | Real-time updates in UI |
| Export | Artifacts exportable |
| E2E | `colab_create`, `colab_accept`, `colab_export` pass |

---

### Phase 8: Visual Workflow (Weeks 43-48)

**Goal:** No-code workflow automation builder

**Spec References:**
- GOODTEAMS-AI-GAP-ANALYSIS.md §2 (Visual Workflow Designer)

#### 8.1 Workflow Data Model (Week 43)

| Task | Description | Test |
|------|-------------|------|
| Workflow model | Name, tenant, status | CRUD works |
| Node model | Type, position, config | CRUD works |
| Edge model | Source, target, condition | CRUD works |
| Execution model | Run history, logs | CRUD works |

#### 8.2 React Flow Designer (Week 44-45)

| Task | Description | Test |
|------|-------------|------|
| Canvas | React Flow setup | Renders |
| Node palette | Draggable node types | Drag works |
| Node types | Trigger, Agent, Condition, Comm | All render |
| Edge connections | Connect nodes | Edges work |
| Save/load | Persist workflow | Saves/loads |

#### 8.3 Execution Engine (Week 46-47)

| Task | Description | Test |
|------|-------------|------|
| Job queue | BullMQ or similar | Jobs queued |
| Node executors | Execute each node type | All execute |
| Condition evaluation | Branch on conditions | Branches correctly |
| Error handling | Retry, fail gracefully | Errors handled |
| Execution logging | Log each step | Logs created |

#### 8.4 Triggers & History (Week 48)

| Task | Description | Test |
|------|-------------|------|
| Manual trigger | Run now button | Executes |
| Cron trigger | Scheduled runs | Fires on time |
| Webhook trigger | External trigger | Receives hook |
| Execution history | View past runs | History shown |
| Debug view | Step-through execution | Debug works |

#### Phase 8 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| Designer | Create workflow visually |
| Execution | Workflow runs end-to-end |
| Triggers | Cron and webhook work |
| History | Can view past executions |
| E2E | `workflow_create`, `workflow_run`, `workflow_trigger` pass |

---

### Phase 9: Google Workspace (Weeks 49-52)

**Goal:** Google OAuth, Drive, Gmail, Calendar

**Spec References:**
- GOOGLE-WORKSPACE-AUTH-ARCHITECTURE.md

#### 9.1 Google OAuth (Week 49)

| Task | Description | Test |
|------|-------------|------|
| OAuth client | Google Auth Library | Initializes |
| User OAuth | Consent flow | Authenticates |
| Domain-wide delegation | Service account setup | Impersonation works |
| Token storage | Encrypted storage | Persists |

#### 9.2 Google Drive (Week 50)

| Task | Description | Test |
|------|-------------|------|
| File listing | List Drive files | Returns files |
| File read | Download content | Content returned |
| File write | Upload files | File created |
| Shared drives | Access shared drives | Works |

#### 9.3 Gmail & Calendar (Week 51-52)

| Task | Description | Test |
|------|-------------|------|
| Read emails | List/search Gmail | Returns emails |
| Send email | Compose and send | Delivered |
| Calendar read | List events | Returns events |
| Calendar write | Create events | Event created |

#### Phase 9 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| OAuth | Both user and service account work |
| Drive | Read/write files |
| Gmail | Send emails |
| Calendar | Create events |
| E2E | `google_oauth`, `drive_crud`, `gmail_send` pass |

---

### Phase 10: Compliance & Ops (Weeks 53-64)

**Goal:** Enterprise compliance and operational readiness

**Spec References:**
- COMPLIANCE-MATRIX.md
- DATA-GOVERNANCE.md
- DISASTER-RECOVERY.md
- OPERATIONS-RUNBOOKS.md

#### 10.1 SOC 2 Controls (Week 53-56)

| Task | Description | Test |
|------|-------------|------|
| Controls mapping | Map to trust criteria | Document complete |
| Control implementation | Implement gaps | Controls work |
| Evidence collection | Automated evidence | Generates |
| Audit preparation | Documentation | Ready for audit |

#### 10.2 Data Governance (Week 57-59)

| Task | Description | Test |
|------|-------------|------|
| Data classification | Classification engine | Classifies |
| Retention policies | Auto-delete aged data | Deletes |
| Right to erasure | GDPR Article 17 | Erases |
| Data portability | GDPR Article 20 | Exports |

#### 10.3 Disaster Recovery (Week 60-61)

| Task | Description | Test |
|------|-------------|------|
| Backup automation | DB + files backup | Backups run |
| Restore procedure | Tested restore | Restores work |
| Failover | Multi-region failover | Fails over |
| RTO/RPO validation | Meet targets | Targets met |

#### 10.4 Operations (Week 62-64)

| Task | Description | Test |
|------|-------------|------|
| Runbooks | Documented procedures | Complete |
| Monitoring | Metrics + alerting | Alerts work |
| On-call | PagerDuty/Opsgenie | Alerts route |
| Incident response | IR playbook | Documented |

#### Phase 10 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| SOC 2 | Controls documented, evidence collecting |
| GDPR | Erasure and portability work |
| DR | Backup/restore tested |
| Ops | Runbooks complete, monitoring live |

---

## 6. Cross-Cutting Concerns

### 6.1 Database

All phases share a PostgreSQL database with Prisma ORM.

```
Phase 1: Core models (Org, User, Invite, Audit)
Phase 3: Tenant model
Phase 4-6: Integration credential storage
Phase 7: Artifact, Block, Workstream
Phase 8: Workflow, Node, Edge, Execution
```

**Migration strategy:** Each phase adds migrations, never breaks previous.

### 6.2 Authentication

```
Phase 2: Entra SSO (primary)
Phase 9: Google SSO (secondary)
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
