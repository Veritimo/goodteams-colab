# GoodTeams Strategy Document

**Strategic Analysis for Transforming OpenClaw into an Enterprise AI Assistant Platform**

*Author: Forge 🔨 (Development Agent)*  
*Date: February 2026*  
*Version: 1.0*

---

## Executive Summary

This document provides a comprehensive analysis of the OpenClaw codebase and outlines a strategic roadmap for transforming it into **GoodTeams** — an enterprise AI assistant platform designed to help employees be more productive with corporate tools, documents, and data.

OpenClaw is a mature, well-architected personal AI assistant with sophisticated plugin systems, multi-channel support, browser automation, and agent capabilities. Its modular design provides an excellent foundation for enterprise transformation, though significant work is needed around security hardening, multi-tenancy, and enterprise integrations.

---

## Table of Contents

1. [Architecture Review](#1-architecture-review)
2. [Security Analysis](#2-security-analysis)
3. [Feature Gap Analysis](#3-feature-gap-analysis)
4. [Removal Candidates](#4-removal-candidates)
5. [Integration Points](#5-integration-points)
6. [Multi-Tenancy Considerations](#6-multi-tenancy-considerations)
7. [Recommendations & Roadmap](#7-recommendations--roadmap)
8. [Appendices](#appendices)
   - [Appendix A: File Reference](#appendix-a-file-reference)
   - [Appendix B: Enterprise Config Schema](#appendix-b-enterprise-config-schema)
   - [Appendix C: Migration Checklist](#appendix-c-migration-checklist)
   - [Appendix D: Desktop Agent Architecture](#appendix-d-desktop-agent-architecture)
   - [Appendix E: Microsoft 365 Auth Architecture](#appendix-e-microsoft-365-auth-architecture)
   - [Appendix F: Google Workspace Auth Architecture](#appendix-f-google-workspace-auth-architecture)

---

## 1. Architecture Review

### 1.1 Core Architecture Overview

OpenClaw follows a **gateway-centric architecture** with the following major components:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Gateway Server                            │
│  (src/gateway/server.impl.ts - central orchestration)           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Agents    │  │  Channels   │  │   Plugins   │              │
│  │  Framework  │  │   System    │  │   System    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │    Tools    │  │   Hooks     │  │   Memory    │              │
│  │   System    │  │   System    │  │   System    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Sessions   │  │   Config    │  │  Security   │              │
│  │  Manager    │  │   System    │  │   Layer     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

**Desktop Agent Extension:** The architecture supports a Windows-first **Desktop Agent** that connects as a "node" to the gateway, enabling control of native Windows applications (Powerpoint, Excel, Word, Outlook) via UI Automation and COM, alongside browser automation via Playwright. This provides visual collaboration capabilities where users can watch AI work in real-time. See [DESKTOP-AGENT-ARCHITECTURE.md](./DESKTOP-AGENT-ARCHITECTURE.md) for full specification.

### 1.2 Core Modules

#### Agent Framework (`src/agents/`)
- **297+ files** - Comprehensive agent implementation
- Multi-agent support with scope isolation (`agent-scope.ts`)
- Auth profile management with credential rotation (`auth-profiles/`)
- Tool invocation system (`tools/` - 57+ tool implementations)
- Session management and persistence
- Subagent spawning and orchestration (`subagent-registry.ts`)
- Model provider abstraction (Anthropic, OpenAI, Bedrock, etc.)

**Key Files:**
- `agent-scope.ts` - Agent isolation and workspace resolution
- `bash-tools.exec.ts` - Shell execution with approval workflows
- `auth-profiles/types.ts` - API key, OAuth, token credential types
- `tools/common.ts` - Shared tool utilities and result formatters

#### Plugin System (`src/plugins/`)
- **35+ files** - Extensible plugin architecture
- Plugin discovery and loading (`discovery.ts`, `loader.ts`)
- Plugin registry with lifecycle management (`registry.ts`)
- Hook system integration (`hooks.ts`)
- CLI extension points (`cli.ts`)
- Service registration for background tasks (`services.ts`)

**Plugin API Capabilities:**
```typescript
type OpenClawPluginApi = {
  registerTool: (tool, opts?) => void;
  registerHook: (events, handler, opts?) => void;
  registerHttpHandler: (handler) => void;
  registerHttpRoute: (params) => void;
  registerChannel: (registration) => void;
  registerGatewayMethod: (method, handler) => void;
  registerCli: (registrar, opts?) => void;
  registerService: (service) => void;
  registerProvider: (provider) => void;
  registerCommand: (command) => void;
  on: <K extends PluginHookName>(hookName, handler, opts?) => void;
};
```

#### Channel System (`src/channels/`)
- **31+ files** + extensions for channel integrations
- Unified channel abstraction (`plugins/types.ts`)
- Channel dock system for shared behaviors (`dock.ts`)
- Built-in channels: Telegram, Discord, Slack, Signal, iMessage, WhatsApp, LINE
- Extension channels: MS Teams, Matrix, Google Chat, Nostr, Twitch, Zalo, etc.

**Channel Capabilities:**
```typescript
type ChannelCapabilities = {
  chatTypes: ["direct", "group", "channel", "thread"];
  nativeCommands: boolean;
  blockStreaming: boolean;
};

type ChannelPlugin = {
  id: ChannelId;
  meta: ChannelMeta;
  capabilities: ChannelCapabilities;
  config: ChannelConfigAdapter;
  security?: ChannelSecurityAdapter;
  groups?: ChannelGroupAdapter;
  outbound?: ChannelOutboundAdapter;
  gateway?: ChannelGatewayAdapter;
  // ... 15+ adapter interfaces
};
```

#### Gateway Server (`src/gateway/`)
- **125+ files** - Central server implementation
- WebSocket and HTTP API endpoints
- Authentication middleware (`auth.ts`)
- Channel management and routing
- Session lifecycle management
- Cron job scheduling
- Node (mobile device) registry

**Key Components:**
- `server.impl.ts` - Main gateway orchestration
- `auth.ts` - Token/password/Tailscale authentication
- `server-methods.ts` - RPC method handlers
- `session-utils.ts` - Session persistence and retrieval

#### Configuration System (`src/config/`)
- **120+ files** - Comprehensive configuration management
- Zod schema validation (`zod-schema.ts`)
- Type-safe configuration (`types.ts` - split into 25+ focused modules)
- Runtime overrides
- Migration support for legacy configs

**Configuration Scope:**
- Agents, Models, Channels
- Browser automation settings
- Sandbox/Docker settings
- Hooks and Skills
- Security and Approvals
- Logging and Diagnostics

#### Security Layer (`src/security/`)
- **9 files** - Security auditing and hardening
- Comprehensive audit system (`audit.ts` - 37KB)
- Filesystem permission checks (`audit-fs.ts`)
- External content validation (`external-content.ts`)
- Windows ACL support (`windows-acl.ts`)
- Security fix suggestions (`fix.ts`)

#### Tool System (`src/agents/tools/`)
- **57+ tool implementations**
- Browser automation (`browser-tool.ts`)
- Message sending (`message-tool.ts`)
- File operations (via bash tools)
- Cron scheduling (`cron-tool.ts`)
- Session management tools
- Memory/search tools
- Canvas/presentation tools

#### Memory System (`src/memory/`)
- **33 files** - Vector-based memory and search
- Embedding generation (OpenAI, Gemini)
- SQLite-vec for vector storage
- Batch processing for embeddings
- Session file synchronization
- Hybrid search capabilities

#### Browser Automation (`src/browser/`)
- **68 files** - Playwright-based browser control
- Chrome CDP integration
- Extension relay system
- Screenshot and snapshot capabilities
- Form filling and interaction
- Profile management

### 1.3 Extension Architecture

Extensions live in `extensions/` as workspace packages:

| Extension | Purpose |
|-----------|---------|
| `msteams` | Microsoft Teams channel |
| `matrix` | Matrix protocol channel |
| `googlechat` | Google Chat integration |
| `voice-call` | Voice calling capabilities |
| `memory-lancedb` | LanceDB-backed memory |
| `lobster` | CLI theming/styling |
| `nostr` | Nostr protocol channel |
| `twitch` | Twitch integration |
| `llm-task` | Background LLM tasks |

### 1.4 Build and Runtime

- **Language:** TypeScript (ESM modules)
- **Runtime:** Node.js 22+, Bun-compatible
- **Build:** tsc with custom scripts
- **Package Manager:** pnpm with workspace packages
- **Testing:** Vitest with V8 coverage
- **Linting:** Oxlint, Oxfmt, SwiftLint

---

## 2. Security Analysis

### 2.1 Current Security Mechanisms

#### Authentication (`src/gateway/auth.ts`)
```typescript
type ResolvedGatewayAuth = {
  mode: "token" | "password";
  token?: string;
  password?: string;
  allowTailscale: boolean;
};
```

- **Token-based auth** - Bearer tokens for API access
- **Password auth** - Basic authentication option
- **Tailscale integration** - Network-level identity verification
- **Device tokens** - Mobile device authentication
- **Timing-safe comparison** - Protection against timing attacks

**Gaps for Enterprise:**
- ❌ No SSO/SAML/OIDC support
- ❌ No RBAC (Role-Based Access Control)
- ❌ No tenant isolation
- ❌ No session management beyond tokens
- ❌ No MFA support

#### Security Audit System (`src/security/audit.ts`)
```typescript
type SecurityAuditFinding = {
  checkId: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  remediation?: string;
};
```

Current audit checks:
- Filesystem permissions (world-writable, symlinks)
- Channel security (DM policies, group policies)
- State directory integrity
- Config file permissions
- Secrets detection

**Gaps for Enterprise:**
- ❌ No compliance framework mapping (SOC2, GDPR, HIPAA)
- ❌ No data classification/tagging
- ❌ No audit log persistence/SIEM integration
- ❌ No data residency controls

#### Approval System (`src/config/types.approvals.ts`)
- Exec command approvals
- Configurable approval modes (off, unsafe, ask, ask-unsafe)
- Allowlist/denylist patterns

**Gaps for Enterprise:**
- ❌ No multi-level approval workflows
- ❌ No separation of duties enforcement
- ❌ No audit trail for approvals

### 2.2 Critical Security Requirements for Enterprise

| Requirement | Current State | Priority |
|-------------|---------------|----------|
| SSO/SAML/OIDC | Not implemented | P0 |
| RBAC | Not implemented | P0 |
| Audit Logging | Basic (file-based) | P0 |
| Data Encryption at Rest | Not implemented | P1 |
| Tenant Isolation | Not implemented | P0 |
| Secret Management | File-based credentials | P1 |
| Network Segmentation | Tailscale only | P1 |
| Compliance Reporting | Not implemented | P2 |
| Data Loss Prevention | Not implemented | P1 |
| MFA | Not implemented | P1 |

### 2.3 Security Hardening Recommendations

#### Phase 1: Foundation (Critical)
1. **Implement Identity Provider Integration**
   - Add OIDC client for Azure AD, Okta, Google Workspace
   - JWT validation and session management
   - User attribute mapping to internal permissions

2. **Build RBAC System**
   ```typescript
   type Role = {
     id: string;
     tenantId: string;
     permissions: Permission[];
     inherits?: string[];
   };
   
   type Permission = {
     resource: string;    // "documents", "emails", "databases"
     actions: string[];   // "read", "write", "delete", "share"
     conditions?: Record<string, unknown>;
   };
   ```

3. **Comprehensive Audit Logging**
   ```typescript
   type AuditEvent = {
     timestamp: string;
     tenantId: string;
     userId: string;
     sessionId: string;
     action: string;
     resource: string;
     outcome: "success" | "failure" | "denied";
     metadata: Record<string, unknown>;
     ipAddress: string;
     userAgent: string;
   };
   ```

#### Phase 2: Data Protection (High)
1. **Encryption at Rest**
   - SQLite database encryption
   - Session file encryption
   - Credential vault integration (HashiCorp Vault, Azure Key Vault)

2. **Data Classification**
   - Content tagging (public, internal, confidential, restricted)
   - Automatic classification using LLM
   - Policy enforcement based on classification

3. **Data Loss Prevention**
   - Output filtering for sensitive data
   - PII detection and redaction
   - Watermarking for document exports

#### Phase 3: Compliance (Medium)
1. **Compliance Framework Integration**
   - SOC 2 Type II controls mapping
   - GDPR data subject rights automation
   - HIPAA BAA support

2. **Data Residency**
   - Regional deployment options
   - Data localization controls
   - Cross-border transfer logging

---

## 3. Feature Gap Analysis

### 3.1 Existing Features (Leverage)

| Feature | Current State | Enterprise Applicability |
|---------|---------------|-------------------------|
| Multi-agent system | ✅ Mature | High - persona-based assistants |
| Plugin architecture | ✅ Mature | High - enterprise connectors |
| Channel system | ✅ Mature | Medium - adapt for enterprise chat |
| Browser automation | ✅ Mature | High - web app automation |
| Memory/search | ✅ Mature | High - knowledge base |
| Cron scheduling | ✅ Mature | High - scheduled reports |
| Tool system | ✅ Mature | High - action execution |
| Session management | ✅ Mature | Medium - needs multi-user |
| Config system | ✅ Mature | High - enterprise settings |

### 3.2 Required New Features

#### Corporate Document Access
| Integration | Priority | Complexity | Notes |
|-------------|----------|------------|-------|
| SharePoint Online | P0 | High | MS Graph API, search, permissions |
| OneDrive | P0 | Medium | MS Graph API, file ops |
| Google Drive | P0 | Medium | Google Drive API v3 |
| Box | P2 | Medium | Box Platform API |
| Dropbox Business | P2 | Medium | Dropbox API |

**Plugin Architecture Fit:**
```typescript
// Example: SharePoint connector plugin
const sharepointPlugin: OpenClawPluginDefinition = {
  id: "sharepoint",
  name: "SharePoint Connector",
  register: (api) => {
    api.registerTool(createSharePointSearchTool(api.config));
    api.registerTool(createSharePointDownloadTool(api.config));
    api.registerTool(createSharePointUploadTool(api.config));
    api.registerProvider(sharepointAuthProvider);
  }
};
```

#### Corporate Email Integration
| Integration | Priority | Complexity | Notes |
|-------------|----------|------------|-------|
| Exchange/Outlook | P0 | High | MS Graph API, delegated perms |
| Gmail/Google Workspace | P0 | Medium | Gmail API, admin SDK |
| Generic IMAP/SMTP | P2 | Low | Fallback option |

**Tool Examples:**
- `email_search` - Search emails with filters
- `email_read` - Read email content
- `email_compose` - Draft/send emails
- `email_reply` - Reply to threads
- `calendar_availability` - Check schedules
- `calendar_schedule` - Create meetings

#### Database & CRM Access
| Integration | Priority | Complexity | Notes |
|-------------|----------|------------|-------|
| **SQL Server (T-SQL)** | P0 | Medium | Enterprise primary, query builder, schema hints |
| **PostgreSQL** | P0 | Medium | Cloud/startup primary, query builder, schema hints |
| Salesforce | P1 | High | REST API, SOQL queries |
| HubSpot | P1 | Medium | HubSpot API |
| Microsoft Dynamics | P1 | High | Dataverse API |
| Snowflake | P2 | Medium | Snowflake connector |

**Query Builder with Schema Hints:**
The SQL integration uses a schema-aware query builder that leverages **SchemaHints** — a growing formal structure of business rules expressed in technical terms:

```typescript
type SchemaHints = {
  tables: {
    [tableName: string]: {
      description: string;           // Human-readable purpose
      businessContext: string;       // Domain-specific meaning
      primaryKey: string[];
      foreignKeys: ForeignKeyHint[];
      commonJoins: JoinHint[];       // Pre-defined join patterns
      sensitiveColumns: string[];    // PII, financial, etc.
      defaultFilters?: string;       // e.g., "is_deleted = 0"
    };
  };
  businessRules: {
    [ruleName: string]: {
      description: string;
      sqlFragment: string;           // Reusable WHERE/JOIN clause
      appliesTo: string[];           // Table names
    };
  };
  terminology: {
    [businessTerm: string]: string;  // "active customer" → "status = 'A' AND last_order_date > DATEADD(year, -1, GETDATE())"
  };
};
```

**Security Considerations:**
- Read-only by default, write requires explicit permission
- Query result size limits and timeout enforcement
- Sensitive column masking (PII, financial data)
- Query logging, analysis, and audit trail
- Schema hints flag sensitive columns for automatic redaction

#### Document Creation
| Capability | Priority | Complexity | Notes |
|------------|----------|------------|-------|
| PowerPoint creation | P0 | High | PPTX generation |
| Excel creation | P0 | Medium | XLSX generation |
| Word documents | P0 | Medium | DOCX generation |
| PDF generation | P1 | Low | Existing libs available |
| Templates system | P1 | Medium | Branded templates |

**Implementation Approach:**
```typescript
// Leverage existing canvas/browser tools pattern
type DocumentTool = AgentTool<{
  type: "pptx" | "xlsx" | "docx";
  template?: string;
  content: DocumentContent;
  output: "file" | "sharepoint" | "onedrive";
}>;
```

#### Calendar & Task Management
| Integration | Priority | Complexity | Notes |
|-------------|----------|------------|-------|
| Outlook Calendar | P0 | Medium | MS Graph API |
| Google Calendar | P0 | Medium | Calendar API |
| Microsoft Planner | P1 | Medium | MS Graph API |
| Asana | P2 | Medium | Asana API |
| Jira | P2 | Medium | Jira REST API |

### 3.3 Feature Mapping to Existing Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GoodTeams Feature Layer                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Microsoft  │  │   Google    │  │   Generic   │              │
│  │  365 Suite  │  │  Workspace  │  │ Connectors  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┴────────────────┘                      │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Enterprise Connector Layer                  │    │
│  │  (Unified auth, caching, rate limiting, audit logging)  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Plugin System                          │    │
│  │            (Existing OpenClaw architecture)              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Removal Candidates

### 4.1 Features to Remove or Simplify

| Feature | Current Location | Recommendation | Rationale |
|---------|------------------|----------------|-----------|
| WhatsApp (Baileys) | `src/web/`, `src/whatsapp/` | Remove | Consumer-focused, unofficial API |
| iMessage | `src/imessage/` | Remove | Consumer Apple ecosystem |
| Signal | `src/signal/` | Remove | Consumer messaging |
| Telegram | `src/telegram/` | Simplify | Keep for notifications only |
| Discord | `src/discord/` | Remove | Consumer gaming platform |
| Nostr | `extensions/nostr/` | Remove | Consumer social protocol |
| Twitch | `extensions/twitch/` | Remove | Gaming/streaming |
| Zalo | `extensions/zalo*` | Remove | Regional consumer app |
| Tlon/Urbit | `extensions/tlon/` | Remove | Niche platform |
| BlueBubbles | `extensions/bluebubbles/` | Remove | iMessage workaround |

### 4.2 Features to Retain and Adapt

| Feature | Current Location | Adaptation Needed |
|---------|------------------|-------------------|
| MS Teams | `extensions/msteams/` | Enhance for enterprise |
| Slack | `src/slack/` | Enhance for enterprise |
| Google Chat | `extensions/googlechat/` | Enhance for enterprise |
| Matrix | `extensions/matrix/` | Consider for on-prem |
| Browser automation | `src/browser/` | Add enterprise policies |
| Voice call | `extensions/voice-call/` | Enterprise conferencing |

### 4.3 Code Simplification Opportunities

1. **Channel System Simplification**
   - Remove consumer channel docks from `src/channels/dock.ts`
   - Simplify channel registry to enterprise channels only
   - Remove pairing flow (replaced by SSO)

2. **Mobile Nodes Removal**
   - Remove `src/node-host/` (personal device integration)
   - Remove mobile app dependencies in `apps/ios/`, `apps/android/`
   - Simplify gateway to server-only deployment

3. **Personal Automation Removal**
   - Remove home automation hooks
   - Remove personal assistant personas
   - Simplify to enterprise assistant role

### 4.4 Estimated Code Reduction

| Component | Files | Lines | % of Codebase |
|-----------|-------|-------|---------------|
| Consumer channels | ~150 | ~25K | 15% |
| Mobile apps | ~100 | ~15K | 10% |
| Personal automation | ~50 | ~8K | 5% |
| **Total Removable** | **~300** | **~48K** | **~30%** |

---

## 5. Integration Points

### 5.1 Plugin System as Integration Hub

The existing plugin system (`src/plugins/types.ts`) provides excellent integration points:

```typescript
// Enterprise connector pattern
type EnterpriseConnectorPlugin = OpenClawPluginDefinition & {
  // Authentication provider registration
  registerProvider: (provider: EnterpriseAuthProvider) => void;
  
  // Tool registration for connector operations
  registerTool: (tool: EnterpriseConnectorTool) => void;
  
  // Event hooks for audit and monitoring
  on: (hookName: EnterpriseHookName, handler: HookHandler) => void;
};
```

### 5.2 Microsoft Graph Integration Point

**Location:** New extension `extensions/ms-graph/`

```typescript
// extensions/ms-graph/index.ts
export const msGraphPlugin: OpenClawPluginDefinition = {
  id: "ms-graph",
  name: "Microsoft 365 Connector",
  
  configSchema: {
    jsonSchema: {
      tenantId: { type: "string" },
      clientId: { type: "string" },
      scopes: { type: "array", items: { type: "string" } },
    }
  },
  
  register: (api) => {
    // Authentication
    api.registerProvider(msGraphAuthProvider);
    
    // Document tools
    api.registerTool(sharePointSearchTool);
    api.registerTool(sharePointFileTool);
    api.registerTool(oneDriveFileTool);
    
    // Email tools
    api.registerTool(outlookSearchTool);
    api.registerTool(outlookComposeTool);
    api.registerTool(outlookCalendarTool);
    
    // Audit hooks
    api.on("after_tool_call", msGraphAuditHandler);
  }
};
```

### 5.3 Google Workspace Integration Point

**Location:** Enhance `extensions/googlechat/` → `extensions/google-workspace/`

```typescript
export const googleWorkspacePlugin: OpenClawPluginDefinition = {
  id: "google-workspace",
  name: "Google Workspace Connector",
  
  register: (api) => {
    // Drive tools
    api.registerTool(driveSearchTool);
    api.registerTool(driveFileTool);
    api.registerTool(docsCreateTool);
    api.registerTool(sheetsCreateTool);
    api.registerTool(slidesCreateTool);
    
    // Gmail tools
    api.registerTool(gmailSearchTool);
    api.registerTool(gmailComposeTool);
    
    // Calendar tools
    api.registerTool(calendarTool);
    
    // Chat channel (existing, enhanced)
    api.registerChannel(googleChatChannel);
  }
};
```

### 5.4 SQL/Database Integration Point

**Location:** New extension `extensions/sql-connector/`

**Supported Databases (v1):**
- **SQL Server (T-SQL)** — Primary enterprise target, full T-SQL dialect support
- **PostgreSQL** — Primary cloud/startup target, full PL/pgSQL support

```typescript
export const sqlConnectorPlugin: OpenClawPluginDefinition = {
  id: "sql-connector",
  name: "Enterprise Database Connector",
  
  configSchema: {
    jsonSchema: {
      connections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            driver: { enum: ["mssql", "postgres"] },  // T-SQL and PostgreSQL
            connectionString: { type: "string" },
            readOnly: { type: "boolean", default: true },
            maxRowsPerQuery: { type: "number", default: 1000 },
            timeoutMs: { type: "number", default: 30000 },
            schemaHintsPath: { type: "string" },  // Path to schema hints file
          }
        }
      },
      schemaHints: {
        type: "object",
        description: "Business rules and terminology expressed as SQL patterns",
        // See SchemaHints type definition in Section 3
      }
    }
  },
  
  register: (api) => {
    // Core tools
    api.registerTool(sqlQueryTool);          // Execute queries via query builder
    api.registerTool(sqlSchemaTool);         // Introspect schema
    api.registerTool(sqlSchemaHintsTool);    // Read/update schema hints
    
    // Query builder integration
    api.registerTool(sqlBuildQueryTool);     // AI builds query, returns for review
    api.registerTool(sqlExplainQueryTool);   // Explain query plan
    
    // Lifecycle hooks
    api.on("before_tool_call", sqlQueryValidator);   // Validate against schema hints
    api.on("before_tool_call", sqlSensitiveColumnMasker);  // Redact PII
    api.on("after_tool_call", sqlAuditLogger);       // Full audit trail
  }
};

// Query builder with schema hints integration
type SqlBuildQueryParams = {
  connection: string;
  intent: string;              // Natural language: "Find all active customers who ordered last month"
  useSchemaHints: boolean;     // Apply business rules from schema hints
  explain: boolean;            // Include query explanation
  dryRun: boolean;             // Build but don't execute
};

type SqlBuildQueryResult = {
  sql: string;                 // Generated SQL (T-SQL or PostgreSQL dialect)
  dialect: "tsql" | "pgsql";
  explanation: string;         // Human-readable explanation
  schemaHintsApplied: string[];  // Which business rules were used
  estimatedRows?: number;
  warnings?: string[];         // e.g., "Query may be slow without index on X"
};
```

### 5.5 CRM Integration Points

**Salesforce:** `extensions/salesforce/`
```typescript
// SOQL query tool, record CRUD, report generation
api.registerTool(salesforceQueryTool);
api.registerTool(salesforceRecordTool);
api.registerTool(salesforceReportTool);
```

**HubSpot:** `extensions/hubspot/`
```typescript
// Contact/company lookup, deal tracking, email sequences
api.registerTool(hubspotContactTool);
api.registerTool(hubspotDealTool);
api.registerTool(hubspotSequenceTool);
```

### 5.6 Document Generation Integration

**Location:** New extension `extensions/office-docs/`

Leverage existing patterns from:
- `src/agents/tools/canvas-tool.ts` - Canvas/presentation generation
- Browser automation for complex document manipulation

```typescript
export const officeDocsPlugin: OpenClawPluginDefinition = {
  id: "office-docs",
  name: "Office Document Generator",
  
  register: (api) => {
    // PPTX generation
    api.registerTool(createPowerPointTool({
      templateDir: api.config.officeDocs?.templateDir,
      outputDir: api.config.officeDocs?.outputDir,
    }));
    
    // XLSX generation
    api.registerTool(createExcelTool({
      allowMacros: false,
      maxRows: 100000,
    }));
    
    // DOCX generation
    api.registerTool(createWordTool({
      templateDir: api.config.officeDocs?.templateDir,
    }));
    
    // Integration with SharePoint/OneDrive for saving
    api.on("after_tool_call", async (event, ctx) => {
      if (event.toolName.startsWith("office_")) {
        await syncToCloud(event.result, ctx.config);
      }
    });
  }
};
```

### 5.7 Desktop Agent Integration Point

**Location:** New package `packages/desktop-agent/`

The Desktop Agent extends GoodTeams to native Windows desktop applications, enabling AI assistance with real enterprise workflows beyond chat and browser automation.

```typescript
// Desktop agent connects as a node with specialized capabilities
{
  clientName: "goodteams-desktop",
  mode: "node",
  role: "desktop-agent",
  caps: ["system", "browser", "windows.uia", "windows.office", "screen.stream"],
}
```

**Key Integration Patterns:**

| Pattern | Description |
|---------|-------------|
| **Node Protocol** | Desktop agent uses existing node-host protocol (`src/node-host/runner.ts`) |
| **Tool Routing** | Gateway routes `windows.*` and `excel_*` tools to connected desktop agents |
| **Screen Streaming** | WebRTC-based real-time screen sharing through gateway signaling |
| **Exec Approvals** | Leverages existing approval system for sensitive desktop operations |

**New Tools Registered:**
- `windows_inspect` — Get UI tree of target window (UI Automation)
- `windows_click` / `windows_type` — Interact with Windows apps
- `excel_read` / `excel_write` — Direct Excel manipulation (COM)
- `outlook_send` / `outlook_calendar` — Outlook automation (COM)
- `screen_stream` — Real-time visual collaboration

See [DESKTOP-AGENT-ARCHITECTURE.md](./DESKTOP-AGENT-ARCHITECTURE.md) for complete technical specification.

### 5.8 Integration Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         GoodTeams Gateway                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Enterprise Auth Layer                         │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │ │
│  │  │  Azure   │  │  Okta    │  │  Google  │  │    On-Prem AD    │ │ │
│  │  │   AD     │  │  OIDC    │  │   OIDC   │  │    (LDAP/SAML)   │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                    │                                  │
│  ┌─────────────────────────────────▼───────────────────────────────┐ │
│  │                    Plugin System (Connectors)                    │ │
│  │                                                                  │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐ │ │
│  │  │   MS Graph     │  │    Google      │  │      SQL           │ │ │
│  │  │  Connector     │  │   Workspace    │  │   Connector        │ │ │
│  │  │                │  │   Connector    │  │                    │ │ │
│  │  │ • SharePoint   │  │ • Drive        │  │ • SQL Server (T-SQL)│ │ │
│  │  │ • OneDrive     │  │ • Docs/Sheets  │  │ • PostgreSQL       │ │ │
│  │  │ • Outlook      │  │ • Gmail        │  │ • Query Builder    │ │ │
│  │  │ • Teams        │  │ • Calendar     │  │ • SchemaHints      │ │ │
│  │  │ • Planner      │  │ • Chat         │  │                    │ │ │
│  │  └────────────────┘  └────────────────┘  └────────────────────┘ │ │
│  │                                                                  │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐ │ │
│  │  │   Salesforce   │  │    HubSpot     │  │     Office         │ │ │
│  │  │   Connector    │  │   Connector    │  │     Docs           │ │ │
│  │  │                │  │                │  │                    │ │ │
│  │  │ • SOQL Queries │  │ • Contacts     │  │ • PowerPoint       │ │ │
│  │  │ • Records      │  │ • Deals        │  │ • Excel            │ │ │
│  │  │ • Reports      │  │ • Sequences    │  │ • Word             │ │ │
│  │  └────────────────┘  └────────────────┘  └────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                    │                                  │
│  ┌─────────────────────────────────▼───────────────────────────────┐ │
│  │                     Core Agent Framework                         │ │
│  │         (Existing OpenClaw architecture, enhanced)               │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                    │                                  │
│                                    │ Node Protocol (WebSocket)        │
│                                    ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    Desktop Agent (Windows)                        │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐  │ │
│  │  │   Windows      │  │    Office      │  │     Visual         │  │ │
│  │  │   UI Automation│  │    COM         │  │   Collaboration    │  │ │
│  │  │                │  │   Automation   │  │                    │  │ │
│  │  │ • Click/Type   │  │ • Excel        │  │ • Screen Stream    │  │ │
│  │  │ • Inspect      │  │ • Word         │  │ • Cursor Highlight │  │ │
│  │  │ • Window Mgmt  │  │ • Outlook      │  │ • Action Toast     │  │ │
│  │  └────────────────┘  └────────────────┘  └────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Multi-Tenancy Considerations

### 6.1 Current State

OpenClaw is designed as a **single-tenant, single-user** system:
- Configuration stored in `~/.openclaw/`
- Sessions keyed by agent ID, not tenant
- No tenant isolation in memory/storage
- Gateway binds to single auth context

### 6.2 Multi-Tenancy Architecture for SaaS

#### Option A: Tenant-per-Instance (Recommended for MVP)
```
┌─────────────────────────────────────────────────────────────────┐
│                      Load Balancer / Gateway                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Tenant A   │  │  Tenant B   │  │  Tenant C   │              │
│  │  Instance   │  │  Instance   │  │  Instance   │              │
│  │             │  │             │  │             │              │
│  │ GoodTeams   │  │ GoodTeams   │  │ GoodTeams   │              │
│  │  Gateway    │  │  Gateway    │  │  Gateway    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│        │                │                │                       │
│        ▼                ▼                ▼                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Tenant A   │  │  Tenant B   │  │  Tenant C   │              │
│  │  Storage    │  │  Storage    │  │  Storage    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Pros:**
- Strong isolation (process-level)
- Simpler to implement
- Per-tenant scaling
- Easier compliance

**Cons:**
- Higher resource overhead
- More complex orchestration

#### Option B: Shared-Instance Multi-Tenancy (Future State)
```typescript
// Required changes to core types
type TenantContext = {
  tenantId: string;
  organizationId: string;
  userId: string;
  roles: string[];
  permissions: Permission[];
  dataResidency: "us" | "eu" | "ap";
};

// Session key format change
type SessionKey = `tenant:${string}:agent:${string}:${string}`;

// Config scoping
type TenantConfig = OpenClawConfig & {
  tenantId: string;
  tenantSettings: TenantSettings;
};
```

### 6.3 Required Multi-Tenancy Changes

#### Database Layer
| Component | Current | Multi-Tenant Change |
|-----------|---------|---------------------|
| Sessions | File-based | PostgreSQL with tenant_id |
| Memory | SQLite-vec | Per-tenant vector DB |
| Config | JSON file | Database with tenant_id |
| Credentials | File-based | Vault per tenant |
| Audit logs | File-based | Centralized log store |

#### Code Changes Required

1. **Session Key Format** (`src/routing/session-key.ts`)
   ```typescript
   // Current: agent:main:main
   // New: tenant:abc123:agent:main:main
   ```

2. **Config Resolution** (`src/config/io.ts`)
   ```typescript
   async function loadTenantConfig(
     tenantId: string,
     configStore: ConfigStore
   ): Promise<OpenClawConfig>
   ```

3. **Gateway Server** (`src/gateway/server.impl.ts`)
   - Add tenant context to request handling
   - Route to appropriate tenant resources
   - Enforce tenant boundaries

4. **Plugin System** (`src/plugins/types.ts`)
   ```typescript
   type OpenClawPluginApi = {
     tenantId?: string;
     // ... existing properties
   };
   ```

### 6.4 Data Isolation Strategy

```
┌───────────────────────────────────────────────────────────────┐
│                    Data Isolation Layers                       │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  Layer 1: Network Isolation                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  VPC / Subnet per tenant (optional for enterprise tier)  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Layer 2: Compute Isolation                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Container/Pod per tenant with resource limits           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Layer 3: Data Isolation                                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  • Database: Row-level security OR separate databases    │ │
│  │  • Files: Tenant-prefixed object storage                 │ │
│  │  • Vectors: Tenant-specific vector collections           │ │
│  │  • Credentials: Separate vault namespaces                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Layer 4: Encryption Isolation                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  • Per-tenant encryption keys (KEK)                      │ │
│  │  • Customer-managed keys (BYOK) for enterprise           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

---

## 7. Recommendations & Roadmap

### 7.1 Phased Approach

#### Phase 0: Foundation (Weeks 1-4)
**Goal:** Establish enterprise baseline without breaking existing functionality

| Task | Effort | Priority |
|------|--------|----------|
| Fork and rebrand to GoodTeams | 1 week | P0 |
| Remove consumer channels (WhatsApp, iMessage, Signal, etc.) | 1 week | P0 |
| Remove mobile apps | 3 days | P0 |
| Create enterprise config schema | 1 week | P0 |
| Set up CI/CD for enterprise builds | 3 days | P0 |

**Deliverable:** Clean GoodTeams codebase with enterprise-only focus

#### Phase 1: Security Foundation (Weeks 5-10)
**Goal:** Enterprise-grade authentication and authorization

| Task | Effort | Priority |
|------|--------|----------|
| Implement OIDC authentication (Entra ID/MSAL) | 2 weeks | P0 |
| Multi-tenant app registration pattern | 1 week | P0 |
| Admin consent flow for org-level tenant linking | 1 week | P0 |
| Token storage infrastructure (encrypted vault) | 1 week | P0 |
| Build RBAC system | 2 weeks | P0 |
| Create audit logging infrastructure | 1 week | P0 |

**Token Storage Note:** The encrypted vault infrastructure supports credentials for BOTH Microsoft 365 (Entra ID tokens) and Google Workspace (OAuth tokens + service account keys). This shared foundation enables Phase 2 (Microsoft) and Phase 3 (Google) integrations.

**SaaS Authentication Model:**
GoodTeams uses a **multi-tenant Entra ID (Azure AD) application** — the canonical SaaS pattern:
- **Developer registers app once** in their own Entra tenant (multi-tenant enabled)
- **Customers authorize** via admin consent flow (links their Microsoft 365 tenant to GoodTeams)
- **User SSO** via MSAL authorization code flow (delegated access)
- **Tokens stored encrypted**, auto-refreshed via refresh token rotation

See [Appendix E: Microsoft 365 Auth Architecture](#appendix-e-microsoft-365-auth-architecture) for full specification.

**Deliverable:** Secure multi-user system with SSO support

#### Phase 2: Microsoft 365 Integration (Weeks 11-18)
**Goal:** Full Microsoft ecosystem support

**Dependency:** Requires Phase 1 auth infrastructure (multi-tenant Entra app, token storage, admin consent flow)

| Task | Effort | Priority |
|------|--------|----------|
| User authorization code flow (delegated access) | 1 week | P0 |
| Token refresh service | 0.5 weeks | P0 |
| MS Graph connector plugin | 2 weeks | P0 |
| SharePoint/OneDrive tools | 2 weeks | P0 |
| Outlook email/calendar tools | 2 weeks | P0 |
| MS Teams channel enhancement | 1 week | P0 |
| Teams meeting transcript tool (OnlineMeetingTranscript API) | 1 week | P1 |
| Document generation (PPTX, XLSX, DOCX) | 1 week | P1 |
| Meeting summary & action item extraction | 0.5 weeks | P2 |

**MS Teams as Primary Enterprise Channel:**
MS Teams is intended to be the **primary enterprise communication channel** for GoodTeams — the same role WhatsApp/Telegram play in personal OpenClaw. This includes:
- **Chat** — DMs, group chats, and channel conversations
- **Meeting transcripts** — Knowledge capture from Teams meetings for context and follow-up
- **File sharing** — Via SharePoint integration (Teams files are SharePoint-backed)

**Required Permissions (Delegated):**
- `User.Read` — Basic user profile
- `Sites.Read.All` — SharePoint sites and content
- `Files.Read.All` — OneDrive and SharePoint files
- `Calendars.Read` — Outlook calendar access
- `Mail.ReadWrite` — Email read and write
- `Mail.Send` — Send email on behalf of user
- `OnlineMeetings.Read` — Read user's meetings
- `OnlineMeetingTranscript.Read.All` — Read meeting transcripts

**Deliverable:** Full Microsoft 365 productivity integration with MS Teams as the enterprise communication hub

#### Phase 3: Google Workspace Integration (Weeks 19-24)
**Goal:** Full Google ecosystem support

**Dependency:** Requires Phase 1 auth infrastructure (token storage vault, OAuth callback framework, user credential schema)

| Task | Effort | Priority |
|------|--------|----------|
| OAuth consent screen & client setup | 0.5 weeks | P0 |
| User authorization code flow | 1 week | P0 |
| Token refresh service | 0.5 weeks | P0 |
| Service account + domain-wide delegation setup | 1 week | P0 |
| Google Drive connector plugin | 2 weeks | P0 |
| Gmail tools (read, send, search) | 1.5 weeks | P0 |
| Google Calendar tools | 1 week | P0 |
| Google Docs/Sheets/Slides read access | 1 week | P1 |
| Google Chat channel enhancement | 1 week | P1 |

**Two Authentication Patterns:**

| Pattern | Use Case | Description |
|---------|----------|-------------|
| **User OAuth** | Individual consent | Standard OAuth 2.0 flow — user authorizes access to their data |
| **Domain-wide Delegation** | Enterprise background access | Service account impersonates any user in the domain |

**Domain-wide Delegation Note:** This is MORE powerful than Microsoft's admin consent model. With Microsoft, admin consent grants the *app* access to tenant resources, but users still authenticate. With Google, the service account can impersonate ANY domain user without their individual consent — enabling true background automation.

**Required Scopes:**

| Scope | Purpose |
|-------|---------|
| `openid`, `email`, `profile` | User identity |
| `drive.readonly`, `drive.file` | Google Drive access |
| `gmail.readonly`, `gmail.send` | Email read and send |
| `calendar.readonly`, `calendar.events` | Calendar access |

See [Appendix F: Google Workspace Auth Architecture](#appendix-f-google-workspace-auth-architecture) for full specification.

**Deliverable:** Full Google Workspace productivity integration with dual auth model

#### Phase 4: Database & CRM (Weeks 25-32)
**Goal:** Enterprise data access with intelligent query building

| Task | Effort | Priority |
|------|--------|----------|
| SQL Server (T-SQL) connector | 2 weeks | P0 |
| PostgreSQL connector | 1 week | P0 |
| Schema-aware query builder | 2 weeks | P0 |
| SchemaHints system (business rules → SQL) | 1 week | P0 |
| Salesforce connector | 2 weeks | P1 |
| HubSpot connector | 1 week | P1 |
| Microsoft Dynamics/Dataverse connector | 1 week | P1 |

**SchemaHints Concept:**
SchemaHints is a growing formal structure that captures business rules in technical terms:
- Maps business terminology to SQL patterns ("active customer" → `status='A' AND last_order > DATEADD(year,-1,GETDATE())`)
- Defines safe join patterns and common query templates
- Flags sensitive columns for automatic masking
- Enables AI to generate accurate, business-aware queries

**Dynamics/Dataverse Note:**
Microsoft Dynamics 365 and Dataverse integration reuses the Entra tokens established in Phase 2 — same multi-tenant app, additional scopes. Access options:
- **Dataverse Web API** — REST API at `https://{org}.crm.dynamics.com/api/data/v9.2`
- **TDS Endpoint** — SQL-like access at `{org}.crm.dynamics.com:5558` (enables reuse of SQL connector patterns)

**Deliverable:** T-SQL and PostgreSQL access with schema-aware query builder and business rules engine

#### Phase 5: Multi-Tenancy (Weeks 33-40)
**Goal:** SaaS-ready multi-tenant architecture

| Task | Effort | Priority |
|------|--------|----------|
| Tenant isolation implementation | 3 weeks | P0 |
| Database migration to PostgreSQL | 2 weeks | P0 |
| Per-tenant configuration | 1 week | P0 |
| Admin portal | 2 weeks | P1 |

**Deliverable:** Multi-tenant SaaS platform

#### Phase 6: Enterprise Features (Weeks 41-48)
**Goal:** Enterprise-grade operational features

| Task | Effort | Priority |
|------|--------|----------|
| Compliance reporting (SOC 2, GDPR) | 2 weeks | P1 |
| Data loss prevention | 2 weeks | P1 |
| Advanced analytics | 2 weeks | P2 |
| Enterprise support tooling | 2 weeks | P2 |

**Deliverable:** Enterprise-ready SaaS platform

#### Phase 7: Desktop Agent (Weeks 49-66)
**Goal:** Native Windows desktop automation with visual collaboration

The Desktop Agent extends GoodTeams beyond browser and API automation to control native Windows applications, enabling AI assistance with real enterprise desktop workflows.

| Task | Effort | Priority |
|------|--------|----------|
| **D1: Foundation** | 4 weeks | P0 |
| Electron shell scaffolding | 1 week | |
| Gateway client integration (node protocol) | 1 week | |
| Basic exec capability | 1 week | |
| Installer/auto-update (MSI, Squirrel) | 1 week | |
| **D2: Windows Automation** | 6 weeks | P0 |
| UI Automation bindings (inspect, click, type) | 2 weeks | |
| Office COM automation (Excel, Word, Outlook) | 2 weeks | |
| Tool registration with gateway | 1 week | |
| Error handling/recovery | 1 week | |
| **D3: Visual Collaboration** | 4 weeks | P1 |
| Transparent overlay window | 1 week | |
| Element highlighting before interaction | 1 week | |
| Cursor visualization | 1 week | |
| Screen streaming (WebRTC) | 1 week | |
| **D4: Polish & Enterprise** | 4 weeks | P1 |
| Approval workflows for sensitive actions | 1 week | |
| Audit logging | 1 week | |
| Enterprise deployment (MSI/MSIX, GPO) | 1 week | |
| Performance optimization | 1 week | |

**Deliverable:** Windows desktop agent with:
- Native Office automation (Excel, Word, Outlook)
- UI Automation for any Windows app
- Real-time visual collaboration (users watch AI work)
- Enterprise-grade security and audit trail

See [DESKTOP-AGENT-ARCHITECTURE.md](./DESKTOP-AGENT-ARCHITECTURE.md) for complete technical specification.

#### Phase 8: Colab — Collaborative Knowledge Work (Weeks 67-82)
**Goal:** Port the artifact-centric collaboration system from goodteams-ai

| Task | Effort | Priority |
|------|--------|----------|
| Port artifact/block model to TypeScript | 2 weeks | P0 |
| Implement PREE execution engine (Plan→Research→Execute→Evaluate) | 3 weeks | P0 |
| Build tripane Inspector UI (Context/Stage/Control) | 3 weeks | P0 |
| Integrate with OpenClaw sessions and tools | 2 weeks | P0 |
| Block-level accept/reject with semantic diff | 2 weeks | P0 |
| Colab-specific tools (clarify, propose_plan, draft_content, evaluate) | 2 weeks | P1 |
| SSE event streaming for real-time updates | 2 weeks | P1 |

**Deliverable:** Artifact-centric collaboration UI where AI drives and humans review/steer

#### Phase 9: Visual Workflow Automation (Weeks 83-94)
**Goal:** Build visual workflow designer on OpenClaw's existing primitives (cron, hooks, webhooks, plugins)

| Task | Effort | Priority |
|------|--------|----------|
| Workflow data model and persistence (PostgreSQL) | 2 weeks | P0 |
| React Flow visual designer (node palette, canvas, connections) | 2 weeks | P0 |
| Core nodes: Trigger, Agent, Condition, Communication | 2 weeks | P0 |
| Execution engine with job queue and error handling | 2 weeks | P0 |
| Advanced nodes: Iterator, SQL Generator/Executor, Tool | 2 weeks | P0 |
| New triggers: Email watcher (Graph API), SharePoint file watcher | 2 weeks | P1 |
| Execution history, logs, and debugging UI | 2 weeks | P1 |
| Builder Agent (AI creates workflows from natural language) | 2 weeks | P2 |

**Architecture note:** Build ON OpenClaw primitives — Trigger nodes use cron/webhooks, Agent nodes use isolated sessions, Tool nodes use existing tool registry.

**Deliverable:** Full visual workflow automation system with execution history

### 7.2 Technical Decisions

#### Architecture Decisions

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Deployment model | Kubernetes | Scalability, isolation, enterprise standard |
| Database | PostgreSQL + pgvector | Enterprise-grade, vector support |
| Cache | Redis | Session, rate limiting, pub/sub |
| Queue | Redis Streams or SQS | Reliable async processing |
| Auth | OIDC with Auth0/Okta | Standards-based, enterprise SSO |
| Secrets | HashiCorp Vault | Enterprise secret management |
| Observability | OpenTelemetry | Standard tracing/metrics |

#### Technology Stack

```
Frontend:        React/Vue admin portal
Backend:         Node.js (existing GoodTeams core)
Database:        PostgreSQL + pgvector
Cache:           Redis
Queue:           Redis Streams
Auth:            OIDC (Auth0/Okta/Azure AD)
Secrets:         HashiCorp Vault / AWS Secrets Manager
Storage:         S3-compatible object storage
Search:          PostgreSQL FTS + pgvector
Observability:   OpenTelemetry → Datadog/New Relic
Infrastructure:  Kubernetes (EKS/GKE/AKS)
CI/CD:           GitHub Actions → ArgoCD
```

### 7.3 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Security vulnerabilities | Medium | Critical | Security audit, penetration testing |
| Performance at scale | Medium | High | Load testing, capacity planning |
| Integration complexity | High | Medium | Phased rollout, feature flags |
| Data migration issues | Medium | High | Thorough testing, rollback plans |
| Compliance gaps | Medium | Critical | External compliance audit |
| Customer data isolation | Low | Critical | Architecture review, testing |

### 7.4 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first value | < 15 minutes | Onboarding analytics |
| User adoption | 80% DAU/MAU | Usage analytics |
| Task completion rate | > 95% | Success tracking |
| Security incidents | 0 critical | Incident tracking |
| Uptime | 99.9% | Monitoring |
| Response time | < 2s p95 | APM |

### 7.5 Team Structure Recommendation

```
┌─────────────────────────────────────────────────────────────────┐
│                    GoodTeams Engineering                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Platform  │  │ Integrations│  │  Security   │              │
│  │    Team     │  │    Team     │  │    Team     │              │
│  │             │  │             │  │             │              │
│  │ • Core      │  │ • MS Graph  │  │ • Auth/RBAC │              │
│  │ • Multi-    │  │ • Google WS │  │ • Audit     │              │
│  │   tenant    │  │ • Salesforce│  │ • Compliance│              │
│  │ • Infra     │  │ • SQL       │  │ • DLP       │              │
│  │             │  │             │  │             │              │
│  │ 3-4 eng     │  │ 2-3 eng     │  │ 2 eng       │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: File Reference

### Key Files to Modify

| File | Changes Needed |
|------|----------------|
| `src/gateway/auth.ts` | Add OIDC, RBAC integration |
| `src/gateway/server.impl.ts` | Tenant context, multi-user |
| `src/config/types.ts` | Enterprise config schema |
| `src/plugins/types.ts` | Tenant-aware plugin API |
| `src/security/audit.ts` | Compliance extensions |
| `src/routing/session-key.ts` | Tenant-scoped sessions |
| `src/node-host/runner.ts` | Desktop agent integration |

### Key Files to Add

| File/Directory | Purpose |
|----------------|---------|
| `packages/desktop-agent/` | Windows desktop agent (Electron) |
| `docs/DESKTOP-AGENT-ARCHITECTURE.md` | Desktop agent technical specification |
| `docs/GOODTEAMS-AI-GAP-ANALYSIS.md` | Gap analysis between goodteams-ai and OpenClaw |

### Key Files to Remove

| File/Directory | Reason |
|----------------|--------|
| `src/web/` | WhatsApp (consumer) |
| `src/imessage/` | iMessage (consumer) |
| `src/signal/` | Signal (consumer) |
| `src/telegram/` | Telegram (simplify) |
| `src/discord/` | Discord (consumer) |
| `apps/ios/` | Mobile app |
| `apps/android/` | Mobile app |
| `extensions/nostr/` | Consumer protocol |
| `extensions/twitch/` | Gaming |
| `extensions/zalo*/` | Regional consumer |
| `extensions/tlon/` | Niche platform |
| `extensions/bluebubbles/` | iMessage workaround |

---

## Appendix B: Enterprise Config Schema

```typescript
// Proposed enterprise configuration additions
type GoodTeamsEnterpriseConfig = OpenClawConfig & {
  enterprise: {
    tenantId: string;
    organizationName: string;
    
    auth: {
      provider: "azure-ad" | "okta" | "google" | "custom-oidc";
      oidc: {
        issuer: string;
        clientId: string;
        clientSecret?: string; // Reference to secret store
        scopes: string[];
      };
      rbac: {
        defaultRole: string;
        roleAssignments: RoleAssignment[];
      };
    };
    
    connectors: {
      microsoft365?: {
        tenantId: string;
        clientId: string;
        scopes: string[];
      };
      googleWorkspace?: {
        domain: string;
        serviceAccountKey?: string; // Reference to secret store
      };
      salesforce?: {
        instanceUrl: string;
        clientId: string;
      };
      databases?: DatabaseConnection[];
    };
    
    security: {
      dataClassification: {
        enabled: boolean;
        defaultLevel: "public" | "internal" | "confidential" | "restricted";
      };
      dlp: {
        enabled: boolean;
        rules: DlpRule[];
      };
      audit: {
        retentionDays: number;
        exportDestination?: string;
      };
    };
    
    compliance: {
      frameworks: ("soc2" | "gdpr" | "hipaa" | "iso27001")[];
      dataResidency: "us" | "eu" | "ap" | "custom";
      customRegion?: string;
    };
  };
};
```

---

## Appendix C: Migration Checklist

### Pre-Migration
- [ ] Complete security audit of existing codebase
- [ ] Document all current features and their enterprise applicability
- [ ] Create comprehensive test suite for core functionality
- [ ] Set up isolated development environment

### Phase 0 Checklist
- [ ] Fork repository to new organization
- [ ] Update all branding (OpenClaw → GoodTeams)
- [ ] Remove consumer channels
- [ ] Remove mobile apps
- [ ] Update documentation
- [ ] Set up new CI/CD pipelines

### Security Foundation Checklist
- [ ] OIDC integration tested with Azure AD
- [ ] OIDC integration tested with Okta
- [ ] RBAC system implemented and tested
- [ ] Audit logging to structured format
- [ ] Session management with proper expiry
- [ ] Security penetration test

### Integration Checklist
- [ ] MS Graph API integration
- [ ] SharePoint read/write
- [ ] OneDrive file operations
- [ ] Outlook email/calendar
- [ ] Google Drive integration
- [ ] Gmail integration
- [ ] SQL Server (T-SQL) connector with query builder
- [ ] PostgreSQL connector with query builder
- [ ] SchemaHints system (business rules → SQL patterns)
- [ ] Sensitive column masking and audit logging
- [ ] Salesforce basic integration
- [ ] Document generation (PPTX, XLSX, DOCX)

### Multi-Tenancy Checklist
- [ ] Tenant isolation verified
- [ ] Per-tenant configuration
- [ ] Per-tenant data storage
- [ ] Per-tenant credentials
- [ ] Cross-tenant access prevented
- [ ] Load testing completed

### Compliance Checklist
- [ ] SOC 2 controls documented
- [ ] GDPR data subject rights implemented
- [ ] Audit log retention configured
- [ ] Data residency controls verified
- [ ] External security audit completed

### Desktop Agent Checklist
- [ ] Electron shell with tray icon and status UI
- [ ] Gateway client connecting as node
- [ ] Windows UI Automation bindings working
- [ ] Office COM automation (Excel, Word, Outlook)
- [ ] Visual overlay (element highlighting, cursor)
- [ ] Screen streaming (WebRTC)
- [ ] Exec approval workflows
- [ ] MSI/MSIX installer with auto-update
- [ ] Enterprise deployment (GPO support)
- [ ] Performance benchmarks passing

### Colab Checklist
- [ ] Artifact/block model ported to TypeScript
- [ ] PREE execution engine (Plan→Research→Execute→Evaluate)
- [ ] Tripane Inspector UI (Context/Stage/Control)
- [ ] OpenClaw sessions and tools integration
- [ ] Block-level accept/reject with semantic diff
- [ ] Colab-specific tools (clarify, propose_plan, draft_content, evaluate)
- [ ] SSE event streaming for real-time updates

### Visual Workflow Automation Checklist
- [ ] Workflow data model and persistence (PostgreSQL)
- [ ] React Flow visual designer (node palette, canvas, connections)
- [ ] Core nodes: Trigger, Agent, Condition, Communication
- [ ] Execution engine with job queue and error handling
- [ ] Advanced nodes: Iterator, SQL Generator/Executor, Tool
- [ ] New triggers: Email watcher (Graph API), SharePoint file watcher
- [ ] Execution history, logs, and debugging UI
- [ ] Builder Agent (AI creates workflows from natural language)

---

## Appendix D: Desktop Agent Architecture

The Desktop Agent is a Windows-first Electron application that extends GoodTeams to native desktop automation. It enables AI assistants to control Windows applications (Excel, Word, Outlook, etc.) while providing real-time visual collaboration — users can watch the AI work.

### Key Capabilities

| Capability | Technology | Description |
|------------|------------|-------------|
| **Windows UI Automation** | UIA API | Control any Windows app with accessibility support |
| **Office Automation** | COM/OLE | Deep integration with Excel, Word, Outlook |
| **Browser Control** | Playwright | Web automation (existing capability) |
| **Visual Collaboration** | Electron overlay | Users see AI actions in real-time |
| **Screen Streaming** | WebRTC | Remote observation via web dashboard |

### Architecture Summary

```
┌────────────────────────────────────────────────────────────┐
│              GoodTeams Desktop Agent (Electron)             │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Gateway    │  │    Tool      │  │     Visual       │  │
│  │   Client     │  │   Registry   │  │  Collaboration   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Browser    │  │   Windows    │  │     Screen       │  │
│  │  (Playwright)│  │   UIA/COM    │  │    Capture       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└────────────────────────────────────────────────────────────┘
                           │
                           │ WebSocket (Node Protocol)
                           ▼
┌────────────────────────────────────────────────────────────┐
│                   GoodTeams Gateway                         │
└────────────────────────────────────────────────────────────┘
```

### Implementation Timeline

| Phase | Duration | Focus |
|-------|----------|-------|
| D1: Foundation | 4 weeks | Electron shell, gateway integration |
| D2: Windows Automation | 6 weeks | UIA, Office COM |
| D3: Visual Collaboration | 4 weeks | Overlay, streaming |
| D4: Enterprise | 4 weeks | Security, deployment |

**Desktop Agent Total:** ~18 weeks (4.5 months)

### Full Project Timeline

| Phase | Weeks | Focus |
|-------|-------|-------|
| Phase 0: Foundation | 1-4 | Clean enterprise codebase |
| Phase 1: Security Foundation | 5-10 | SSO, RBAC, audit |
| Phase 2: Microsoft 365 | 11-18 | MS Graph, SharePoint, Outlook |
| Phase 3: Google Workspace | 19-24 | Drive, Gmail, Calendar |
| Phase 4: Database & CRM | 25-32 | SQL Server, PostgreSQL, Salesforce |
| Phase 5: Multi-Tenancy | 33-40 | SaaS architecture |
| Phase 6: Enterprise Features | 41-48 | Compliance, DLP |
| Phase 7: Desktop Agent | 49-66 | Windows automation, visual collab |
| Phase 8: Colab | 67-82 | Artifact-centric collaboration |
| Phase 9: Visual Workflow | 83-94 | Workflow designer & automation |

**Total Project Duration:** ~94 weeks (~22 months)

For complete technical specification including component design, security model, and implementation details, see:

**[DESKTOP-AGENT-ARCHITECTURE.md](./DESKTOP-AGENT-ARCHITECTURE.md)**

---

## Appendix E: Microsoft 365 Auth Architecture

GoodTeams uses a **multi-tenant Entra ID (Azure AD) application** to integrate with Microsoft 365. This is the canonical SaaS pattern that enables single app registration, customer consent via admin flow, and delegated user access.

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Customer Enterprise                             │
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │
│  │    Users      │  │  SharePoint   │  │   Dynamics    │            │
│  │ (Entra IDs)   │  │   OneDrive    │  │   Dataverse   │            │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘            │
│          └──────────────────┼──────────────────┘                     │
│                    Microsoft Graph API                               │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
     ┌─────────▼─────────┐        ┌─────────▼─────────┐
     │   Admin Consent   │        │   User Auth       │
     │   (Org-level)     │        │   (User-level)    │
     └─────────┬─────────┘        └─────────┬─────────┘
               └──────────────┬──────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────┐
│                      GoodTeams Platform                               │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                 Multi-tenant Entra App                           │ │
│  │                                                                  │ │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │ │
│  │  │ Admin Consent   │ │ Auth Code Flow  │ │ Token Refresh   │   │ │
│  │  │ (Org linking)   │ │ (User SSO)      │ │ (Auto-refresh)  │   │ │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Two Authentication Flows

| Flow | Purpose | Trigger |
|------|---------|---------|
| **Admin Consent** | Link customer's M365 tenant to their GoodTeams org | Org admin clicks "Connect Microsoft 365" |
| **User Authorization** | Get delegated access to individual user's data | User clicks "Link Microsoft Account" |

### Key Capabilities

- **MS Graph API** — SharePoint, OneDrive, Outlook, Teams, Planner
- **Dynamics/Dataverse** — CRM data via same tokens (additional scopes)
- **Delegated Access** — Actions on behalf of user (respects their permissions)
- **Token Management** — Encrypted storage, automatic refresh

### Alternative: M365 MCP Server

For simpler deployments or rapid prototyping, the **Microsoft 365 MCP Server** provides M365 access via Model Context Protocol. However, native MSAL/Graph is recommended for production SaaS due to full control over auth flows, custom scoping, and complete audit trail.

### Full Specification

For complete details including:
- Admin consent and user auth flow implementation
- App registration configuration
- Token storage and refresh patterns
- Security considerations
- Environment variables

See: **[MICROSOFT-365-AUTH-ARCHITECTURE.md](./MICROSOFT-365-AUTH-ARCHITECTURE.md)**

---

## Appendix F: Google Workspace Auth Architecture

GoodTeams uses **Google Cloud OAuth 2.0** with optional **Domain-wide Delegation** to integrate with Google Workspace. This mirrors the Microsoft 365 pattern with Google-specific implementations.

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Customer Enterprise                             │
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │
│  │    Users      │  │  Google Drive │  │     Gmail     │            │
│  │ (Google IDs)  │  │  Docs/Sheets  │  │   Calendar    │            │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘            │
│          └──────────────────┼──────────────────┘                     │
│                       Google APIs                                    │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
     ┌─────────▼─────────┐        ┌─────────▼─────────┐
     │  Domain-wide      │        │   User OAuth      │
     │  Delegation       │        │   (Consent)       │
     │  (Service Acct)   │        │                   │
     └─────────┬─────────┘        └─────────┬─────────┘
               └──────────────┬──────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────┐
│                      GoodTeams Platform                               │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                 Google Cloud OAuth Client                        │ │
│  │                                                                  │ │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │ │
│  │  │ Service Acct    │ │ Auth Code Flow  │ │ Token Refresh   │   │ │
│  │  │ Impersonation   │ │ (User consent)  │ │ (Auto-refresh)  │   │ │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Two Authentication Flows

| Flow | Purpose | Trigger |
|------|---------|---------|
| **User OAuth** | Get delegated access to individual user's data | User clicks "Link Google Account" |
| **Domain-wide Delegation** | Background access to any user in domain | Admin configures in Google Admin Console |

### Key Difference from Microsoft

**Microsoft:** Admin consent grants the *app* access to the tenant. Users still authenticate individually.

**Google:** Domain-wide delegation grants a *service account* the ability to **impersonate any user** in the domain. No user authentication needed for background operations. This is more powerful — the service account can access any domain user's Drive, Gmail, Calendar without individual consent.

### Key Capabilities

- **Google Drive API** — Files, Docs, Sheets, Slides
- **Gmail API** — Email read, send, search
- **Calendar API** — Events, availability
- **Delegated + Impersonation** — Both consent-based and service account flows

### Security Considerations

- **Service account keys stored in vault** — Never in database
- **Key rotation** — Generate new keys periodically
- **Scope minimization** — Only grant necessary scopes in Admin Console
- **Domain verification** — Verify user email domain matches organization

### Full Specification

For complete details including:
- User OAuth and domain-wide delegation flow implementation
- OAuth client and service account configuration
- Token storage and refresh patterns
- Scope reference for Drive, Gmail, Calendar, Docs
- Security considerations

See: **[GOOGLE-WORKSPACE-AUTH-ARCHITECTURE.md](./GOOGLE-WORKSPACE-AUTH-ARCHITECTURE.md)**

---

*This document serves as the foundation for the GoodTeams enterprise transformation. Regular updates should be made as the project progresses and requirements evolve.*
