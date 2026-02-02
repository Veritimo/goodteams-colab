# GoodTeams-AI → GoodTeams-Colab Gap Analysis

**Purpose:** Identify features implemented in `goodteams-ai` (legacy WIP) that are not yet articulated or architected in `goodteams-colab` (OpenClaw fork).

*Author: Orion ✨*  
*Date: February 2026*  
*Source Repos:*
- `goodteams-ai`: `/Users/dawie/Repos/goodteams_ai`
- `goodteams-colab`: `/Users/dawie/Repos/goodteams-colab/goodteams-colab`

---

## Executive Summary

The `goodteams-ai` codebase contains **10 major feature areas** that are either missing or only partially covered in the `goodteams-colab` strategy document. The most significant gaps are:

1. **Colab (Collaborative Document Creation)** — A complete artifact-centric UI with PREE execution model
2. **Visual Workflow Designer** — React Flow-based automation builder
3. **RAG/Knowledge Base System** — pgvector-backed semantic search with SharePoint ingestion
4. **Organization Communication Rules** — AI-managed tone/style/banned-phrases system

These represent substantial IP and should be migrated or re-architected for the OpenClaw-based platform.

---

## Gap Matrix

| Feature Area | goodteams-ai Status | goodteams-colab Status | Priority | Migration Complexity |
|--------------|---------------------|------------------------|----------|---------------------|
| **Colab (Artifact UI)** | ✅ Implemented (72KB React + 36KB Python) | ❌ Not mentioned | P0 | High |
| **Visual Workflow Designer** | ✅ Implemented (React Flow) | ❌ Not mentioned | P1 | Medium |
| **RAG / Knowledge Base** | ✅ Implemented (pgvector) | ⚠️ Memory system exists, different architecture | P0 | Medium |
| **Communication Rules** | ✅ Implemented | ❌ Not mentioned | P1 | Low |
| **Tool Registry (Python)** | ✅ Implemented | ⚠️ OpenClaw has tools, different pattern | P1 | Medium |
| **System Identity** | ✅ Implemented | ⚠️ OpenClaw has identity, partial overlap | P2 | Low |
| **Authorized Models** | ✅ Implemented | ⚠️ OpenClaw has model config, different UX | P2 | Low |
| **Dataverse/CRM** | ✅ Implemented (TDS endpoint) | ⚠️ Mentioned in strategy, not detailed | P1 | Medium |
| **Workflow Triggers** | ✅ Multiple (Chat, Cron, Webhook, Exchange, SharePoint) | ⚠️ OpenClaw has cron, partial | P1 | Medium |
| **Agent Projects** | ✅ Implemented (SharePoint-linked) | ❌ Not mentioned | P2 | Low |

---

## 1. Colab (Collaborative Document Creation) — **CRITICAL GAP**

### What goodteams-ai Has

**Location:** `platform/app/src/colab/` + `engine/app/colab/`

A complete artifact-centric collaboration system:

#### Frontend (`ColabPage.tsx` — 72KB)
```typescript
// Core concepts
type Block = {
  id: string;
  type: string;           // heading, paragraph, slide, table, code_block
  content: any;           // type-specific JSON
  state: BlockState;      // draft | pending | accepted | revision_requested
  changeIntent?: string;  // what agent was trying to accomplish
  sources?: string[];     // context refs
  feedback?: string;      // user feedback if revision requested
};

type Artifact = {
  id: string;
  title: string;
  format: "document" | "slide_deck" | "data_table" | "code" | "plan";
  status: "drafting" | "in_review" | "complete";
  blocks: Block[];
};
```

#### Backend (`engine/app/colab/agent.py` — 36KB)
- **PREE Execution Model:** Plan → Research → Execute → Evaluate
- **Colab-specific tools:**
  - `clarify_goal` — Ask focused questions
  - `propose_plan` — Create structured work plan
  - `draft_content` — Generate structured outputs with changeIntent
  - `evaluate_quality` — Self-critique before presenting
  - `search_knowledge` — RAG integration
  - `load_into_context` — Dynamic context loading
  - `update_block` — Revise specific blocks

#### Event Streaming (SSE)
```typescript
// Event types from eventMap.ts
type ColabEvent = 
  | { type: "phase_started"; phase: string }
  | { type: "output_snapshot"; outputId: string; blocks: Block[] }
  | { type: "output_patch"; blockId: string; op: "update"; changeIntent: string }
  | { type: "action_gate"; gateId: string; risk: "L1" | "L2" | "L3" }
  | { type: "checkpoint_reached"; checkpoint: string };
```

### What goodteams-colab Has

**Nothing comparable.** OpenClaw has:
- Chat interface (different paradigm)
- Canvas for A2UI rendering (one-way, no collaboration)
- No artifact-centric workflow
- No block-level accept/reject
- No PREE execution model

### Recommendation

**Create new section in strategy:** "Phase 8: Colab — Collaborative Knowledge Work"

Key architectural decisions:
1. Port the artifact/block model to TypeScript
2. Integrate with OpenClaw's session/agent framework
3. Leverage existing SSE infrastructure
4. Design plugin architecture for Colab tools

---

## 2. Visual Workflow Designer — **MAJOR GAP**

### What goodteams-ai Has

**Location:** `platform/app/src/workflows/`

A complete React Flow-based visual workflow builder:

#### Workflow Components
- `WorkflowDesignerPage.tsx` (48KB) — Visual node editor
- `WorkflowsDashboardPage.tsx` (35KB) — Workflow management
- Node types in `nodes/` directory

#### Supported Node Types
| Node Type | Description |
|-----------|-------------|
| **Trigger** | Chat, Manual, Cron, Webhook, Exchange (email), SharePoint (file watcher) |
| **Condition** | JavaScript-based branching logic |
| **Agent** | LLM processing with configurable model/prompts |
| **Communication** | Chat reply, Email (SMTP/Graph), Teams message |
| **SQL Generator** | Natural language → SQL |
| **SQL Executor** | Execute queries, return rows/JSON/Excel |
| **SQL Explainer** | Explain queries in plain English |
| **Iterator** | Batch processing over lists |
| **Tool** | Execute registered Python tools |

#### Workflow Engine
- PgBoss job queue for background execution
- Execution history with node inputs/outputs
- Error handling and retries

### What goodteams-colab Has

**Partial:** OpenClaw has cron jobs but no visual workflow builder.

### Recommendation

**Add to strategy:** Either:
1. Build new workflow designer as GoodTeams extension, or
2. Integrate with existing workflow tools (n8n, Windmill) via plugin

---

## 3. RAG / Knowledge Base System — **CRITICAL GAP**

### What goodteams-ai Has

**Location:** `engine/app/services/ingestion_service.py`, `knowledge_service.py`

A complete RAG pipeline:

#### Knowledge Collections
```sql
-- From schema.sql
CREATE TABLE public."KnowledgeCollection" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    type public."CollectionType" NOT NULL,  -- ORGANIZATION | PROJECT | PERSONAL
    status text DEFAULT 'IDLE',
    "organizationId" text NOT NULL,
    "createdAt" timestamp(3),
    "updatedAt" timestamp(3)
);

CREATE TABLE public."CollectionSource" (
    id text NOT NULL,
    "collectionId" text NOT NULL,
    type text NOT NULL,          -- SHAREPOINT_LIBRARY, FILE_UPLOAD, etc.
    url text NOT NULL,
    config jsonb
);

CREATE TABLE public."DocumentChunk" (
    id text NOT NULL,
    "collectionId" text NOT NULL,
    content text NOT NULL,
    embedding vector(768),       -- pgvector
    "sourceUrl" text,
    metadata jsonb,
    "createdAt" timestamp(3)
);
```

#### Ingestion Pipeline
1. **Source sync** — Pull from SharePoint, file upload, etc.
2. **Chunking** — Split text with overlap
3. **Embedding** — Generate vectors via embedding service
4. **Storage** — Store in pgvector

#### Search
```python
# Semantic search via pgvector
async def search_knowledge(query: str, collection_id: str = None, limit: int = 5):
    vector = EmbeddingService.embed_text(query)
    # Uses pgvector cosine similarity
```

### What goodteams-colab Has

**Different architecture:** OpenClaw has a memory system with:
- Workspace files (MEMORY.md, memory/*.md)
- Optional vector embedding (memory-core plugin)
- memory_search tool

**Key differences:**
- OpenClaw: File-based, workspace-scoped
- goodteams-ai: Database-backed, organization-scoped, multi-source ingestion

### Recommendation

**Hybrid approach:**
1. Keep OpenClaw's workspace memory for personal/agent use
2. Add enterprise knowledge system for organization-wide RAG
3. SharePoint ingestion as a connector plugin
4. Expose via existing memory_search tool interface

---

## 4. Organization Communication Rules — **SIGNIFICANT GAP**

### What goodteams-ai Has

**Location:** `platform/app/src/organization/CommunicationRulesSettings.tsx`, `ai_communication_rules.ts`

AI-managed communication policy:

```typescript
type CommunicationRules = {
  general: Rule[];   // Tone, voice, persona
  banned: Rule[];    // Words/phrases to avoid
  style: Rule[];     // Formatting constraints
};

type Rule = {
  id: string;
  rule: string;
  description: string;
  examples: string[];
};
```

#### Features
- AI-generated rules from natural language prompts
- Three distinct categories
- Full CRUD UI
- Rules injected into agent system prompts

### What goodteams-colab Has

**Nothing comparable.** OpenClaw has:
- SOUL.md for persona (but not organization-scoped)
- No structured rule categories
- No AI-assisted rule generation

### Recommendation

**Add to strategy Phase 6 (Enterprise Features):**
- Organization-level communication policy
- Injected into all agent prompts for that tenant
- Admin UI for rule management
- AI-assisted rule generation

---

## 5. Tool Registry (Python) — **ARCHITECTURAL DIFFERENCE**

### What goodteams-ai Has

**Location:** `engine/app/tools/`, `engine/app/services/`

Python-based tool registry with capability scoping:

```python
# Tool categories
- Knowledge: search_knowledge, list_knowledge_collections
- Files: list_files, read_sharepoint_file
- SQL: list_sql_connectors, generate_sql, execute_sql
- M365: read_calendar, send_teams_message
- External: google_search
- CRM: list_crm_connectors, generate_crm_query, execute_crm_query
```

### What goodteams-colab Has

OpenClaw has a comprehensive TypeScript tool system:
- 57+ built-in tools
- Plugin-based extensibility
- Different architecture (not Python)

### Recommendation

**Bridge approach:**
1. Port critical tools to TypeScript/OpenClaw pattern
2. Consider Python tool bridge for complex integrations
3. Maintain capability scoping concept

---

## 6. Additional Gaps (Lower Priority)

### 6.1 System Identity Configuration
- **goodteams-ai:** Bot persona (name, email) for outgoing comms
- **goodteams-colab:** OpenClaw has identity but different scope
- **Action:** Add organization-level identity config

### 6.2 Authorized Models Management
- **goodteams-ai:** Admin controls which models users can access
- **goodteams-colab:** OpenClaw has model config but no tenant restrictions
- **Action:** Add to multi-tenancy phase

### 6.3 Dataverse/CRM Integration
- **goodteams-ai:** TDS endpoint, CRM service
- **goodteams-colab:** Mentioned in strategy but not detailed
- **Action:** Add detailed spec in Phase 4

### 6.4 Multiple Workflow Triggers
- **goodteams-ai:** Chat, Cron, Webhook, Exchange, SharePoint triggers
- **goodteams-colab:** OpenClaw has cron only
- **Action:** Add trigger extensibility to workflow phase

### 6.5 Agent Projects
- **goodteams-ai:** Projects linked to SharePoint/OneDrive folders
- **goodteams-colab:** Not mentioned
- **Action:** Consider for enterprise features

---

## Migration Priority Matrix

| Priority | Feature | Effort | Value | Recommendation |
|----------|---------|--------|-------|----------------|
| **P0** | Colab (Artifact UI) | High | Critical | Port as core feature |
| **P0** | Knowledge Base (RAG) | Medium | Critical | Hybrid with OpenClaw memory |
| **P1** | Communication Rules | Low | High | Add to enterprise phase |
| **P1** | Visual Workflows | Medium | High | Build or integrate |
| **P1** | Tool Registry | Medium | High | Port critical tools |
| **P2** | System Identity | Low | Medium | Extend OpenClaw identity |
| **P2** | Authorized Models | Low | Medium | Add to multi-tenancy |
| **P2** | Agent Projects | Low | Medium | Future consideration |

---

## Recommended Strategy Updates

### Add New Phases

**Phase 8: Colab — Collaborative Knowledge Work (Weeks 67-82)**
- Port artifact/block model
- Implement PREE execution
- Build tripane Inspector UI
- Integrate with OpenClaw sessions

**Phase 9: Visual Automation (Weeks 83-90)**
- React Flow workflow designer
- Trigger extensibility (webhook, email, file watcher)
- Execution engine with job queue

### Update Existing Phases

**Phase 4 (Database & CRM):**
- Add Dataverse TDS endpoint details
- Add CRM tool specifications

**Phase 6 (Enterprise Features):**
- Add Communication Rules system
- Add Authorized Models management
- Add System Identity per-tenant config

**Phase 5 (Multi-Tenancy):**
- Add knowledge collection scoping (org/project/personal)

---

## Appendix: Key File References

### goodteams-ai Source Files

| File | Size | Description |
|------|------|-------------|
| `platform/app/src/colab/ColabPage.tsx` | 72KB | Main Colab UI |
| `engine/app/colab/agent.py` | 36KB | Colab agent with PREE |
| `platform/app/src/workflows/WorkflowDesignerPage.tsx` | 48KB | Workflow visual editor |
| `engine/app/services/ingestion_service.py` | 23KB | RAG ingestion pipeline |
| `platform/app/src/organization/KnowledgeSettings.tsx` | 34KB | Knowledge UI |
| `platform/app/src/organization/CommunicationRulesSettings.tsx` | 15KB | Comm rules UI |
| `engine/app/services/microsoft_graph.py` | 30KB | M365 integration |
| `engine/app/services/crm_service.py` | 19KB | CRM/Dataverse service |
| `schema.sql` | 46KB | Full database schema |
| `documentation/technical_specifications.md` | 9KB | Technical overview |
| `documentation/developer_notes/goodteams_colab_master_plan.md` | 8KB | Colab implementation plan |

---

*This analysis should be reviewed with stakeholders to prioritize migration efforts and update the GOODTEAMS-STRATEGY.md accordingly.*
