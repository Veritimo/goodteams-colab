# OpenClaw Feature Inventory

> **Purpose:** Deep-dive inventory of OpenClaw's agent/gateway features to inform independent rebuild planning.  
> **Last Updated:** 2026-02-03  
> **Source:** Code analysis of `goodteams-colab/goodteams-colab` repository

---

## Table of Contents

1. [Gateway Runtime](#1-gateway-runtime)
2. [Agent Loop](#2-agent-loop)
3. [Session Management](#3-session-management)
4. [Sub-agent Spawning](#4-sub-agent-spawning)
5. [Memory System](#5-memory-system)
6. [Skills System](#6-skills-system)
7. [Personal Assistant Features](#7-personal-assistant-features)
8. [Channel Integrations](#8-channel-integrations)
9. [Cron/Scheduling](#9-cronscheduling)
10. [Tool Framework](#10-tool-framework)
11. [Startup Experience](#11-startup-experience)
12. [Summary Table](#12-summary-table)

---

## 1. Gateway Runtime

### What It Does
The Gateway is OpenClaw's central daemon that orchestrates all agent operations. It:
- Serves as the WebSocket/HTTP server for client connections
- Manages all channel integrations (WhatsApp, Telegram, Discord, etc.)
- Handles agent RPC calls and message routing
- Runs the heartbeat and cron systems
- Provides browser control capabilities
- Manages node pairing and mobile device connections

### How It Works

#### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Gateway Server                            │
├─────────────────────────────────────────────────────────────┤
│  HTTP Server (Express/Hono)                                  │
│  ├── WebSocket (/ws) - Client connections                    │
│  ├── Health endpoints (/health, /status)                     │
│  ├── OpenAI-compatible API (/v1/chat/completions)           │
│  ├── OpenResponses API (/v1/responses)                       │
│  └── Control UI (optional web interface)                     │
├─────────────────────────────────────────────────────────────┤
│  Core Services                                               │
│  ├── Channel Manager (start/stop channels)                   │
│  ├── Cron Service (scheduled jobs)                           │
│  ├── Heartbeat Runner (periodic agent pings)                │
│  ├── Node Registry (mobile device pairing)                   │
│  ├── Browser Control Server (Playwright)                     │
│  └── Plugin Services (extension loading)                     │
├─────────────────────────────────────────────────────────────┤
│  State Management                                            │
│  ├── Session Store (sessions.json per agent)                 │
│  ├── Config Reloader (hot reload on file change)            │
│  ├── Subagent Registry (spawned agent tracking)             │
│  └── Exec Approval Manager (command approval flow)          │
└─────────────────────────────────────────────────────────────┘
```

#### Key Files
- **Entry Point:** `src/gateway/server.impl.ts` - Main `startGatewayServer()` function
- **HTTP Server:** `src/gateway/server-http.ts` - Express/Hono setup
- **WebSocket:** `src/gateway/server-ws-runtime.ts` - WS handlers
- **Startup:** `src/gateway/server-startup.ts` - Sidecar service initialization
- **Config Reload:** `src/gateway/config-reload.ts` - Hot reload system
- **Health:** `src/gateway/server/health-state.ts` - Health check caching

#### Startup Sequence
1. Load and validate config (`~/.openclaw/openclaw.json`)
2. Apply legacy config migrations if needed
3. Auto-enable plugins based on environment
4. Initialize TLS if configured
5. Create HTTP server(s) with bind host resolution
6. Set up WebSocket handlers with RPC methods
7. Start sidecars: Browser control, Gmail watcher, internal hooks
8. Start channel integrations (unless `OPENCLAW_SKIP_CHANNELS=1`)
9. Start cron service and heartbeat runner
10. Initialize node registry for mobile pairing
11. Log startup with fun tagline (see [Startup Experience](#11-startup-experience))
12. Start config file watcher for hot reload

### Dependencies
- `express` or `hono` - HTTP server
- `ws` - WebSocket
- `chokidar` - File watching for config reload
- `bonjour-service` - mDNS discovery
- `playwright` - Browser automation (optional)

### Complexity: **Complex**
### Replication Effort: **3-4 weeks**

---

## 2. Agent Loop

### What It Does
The agent loop is the core "think → act → respond" cycle that processes each message:
- Receives user input from any channel
- Assembles context (system prompt, history, tools)
- Calls the LLM for inference
- Executes tool calls
- Streams responses back to the user
- Persists session history

### How It Works

#### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Loop Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. INTAKE                                                   │
│     ├── Receive message (RPC: agent/agent.wait)             │
│     ├── Resolve session key & load session                   │
│     └── Queue in session lane (serialize per-session)       │
│                                                              │
│  2. CONTEXT ASSEMBLY                                         │
│     ├── Build system prompt (identity, skills, tools)       │
│     ├── Load workspace context files (AGENTS.md, etc.)      │
│     ├── Apply history limits & pruning                       │
│     └── Inject runtime info (time, channel, etc.)           │
│                                                              │
│  3. MODEL INFERENCE                                          │
│     ├── Resolve model + auth profile                         │
│     ├── Call LLM (Anthropic/OpenAI/Gemini/etc.)             │
│     ├── Handle auth rotation on failure                      │
│     └── Failover to alternate models if configured          │
│                                                              │
│  4. TOOL EXECUTION                                           │
│     ├── Parse tool calls from response                       │
│     ├── Execute tools (exec, browser, file ops)             │
│     ├── Stream tool progress events                          │
│     └── Return results for next inference                    │
│                                                              │
│  5. STREAMING                                                │
│     ├── Stream assistant deltas in chunks                    │
│     ├── Emit lifecycle events (start/end/error)             │
│     └── Buffer and flush block replies                       │
│                                                              │
│  6. PERSISTENCE                                              │
│     ├── Append to JSONL transcript                           │
│     ├── Update session store metadata                        │
│     └── Trigger memory index update (async)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Key Files
- **Main Runner:** `src/agents/pi-embedded-runner/run.ts` - `runEmbeddedPiAgent()`
- **Stream Handler:** `src/agents/pi-embedded-subscribe.ts` - Event subscription
- **System Prompt:** `src/agents/system-prompt.ts` - `buildAgentSystemPrompt()`
- **Context Files:** `src/agents/pi-embedded-helpers.ts` - Bootstrap context building
- **Tool Policy:** `src/agents/pi-tools.policy.ts` - Tool filtering
- **Compaction:** `src/agents/pi-embedded-runner/compact.ts` - History summarization

#### Model Auth Flow
```typescript
// Simplified auth profile resolution
1. Load auth-profiles.json from agentDir
2. Resolve profile order (config preference → last used)
3. Check cooldowns (rate limit backoff)
4. Get API key (keychain, env, profile)
5. On failure: rotate to next profile or failover model
```

#### Error Handling & Retries
- **Context overflow:** Auto-compaction with retry
- **Auth errors:** Rotate auth profiles, then failover model
- **Rate limits:** Profile cooldown + exponential backoff
- **Timeout:** Configurable per-agent (default 600s)

### Dependencies
- `@mariozechner/pi-agent-core` - Core agent runtime (external)
- `@anthropic-ai/sdk` - Anthropic API
- `openai` - OpenAI API
- Model-specific SDKs as needed

### Complexity: **Complex**
### Replication Effort: **4-5 weeks**

---

## 3. Session Management

### What It Does
Sessions track conversation state across messages:
- Map inbound messages to session keys
- Store conversation history in JSONL transcripts
- Handle session resets (daily, idle, manual)
- Support per-sender, per-group, per-channel isolation
- Manage session metadata (tokens, last update, origin)

### How It Works

#### Session Key Format
```
Direct messages: agent:<agentId>:<mainKey>
Groups:          agent:<agentId>:<channel>:group:<id>
Channels:        agent:<agentId>:<channel>:channel:<id>
Threads:         agent:<agentId>:<channel>:group:<id>:topic:<threadId>
Cron:            cron:<jobId>
Subagents:       agent:<agentId>:subagent:<uuid>
```

#### Storage Layout
```
~/.openclaw/
├── agents/
│   └── <agentId>/
│       └── sessions/
│           ├── sessions.json       # Session store (key → metadata)
│           ├── <sessionId>.jsonl   # Transcript (turns)
│           └── <sessionId>-topic-<threadId>.jsonl
```

#### Key Files
- **Session Store:** `src/config/sessions.ts` - Load/save session store
- **Session Paths:** `src/config/sessions/paths.ts` - Path resolution
- **Session Utils:** `src/gateway/session-utils.ts` - Session operations
- **Send Policy:** `src/sessions/send-policy.ts` - Delivery rules

#### Reset Policies
| Mode | Description |
|------|-------------|
| `daily` | Reset at configured hour (default 4 AM local) |
| `idle` | Reset after N minutes of inactivity |
| `per-type` | Different policies for DM/group/thread |
| `per-channel` | Channel-specific overrides |
| `manual` | `/new` or `/reset` command |

### Dependencies
- Node.js `fs` - File operations
- `chokidar` - File watching (optional)

### Complexity: **Medium**
### Replication Effort: **1-2 weeks**

---

## 4. Sub-agent Spawning

### What It Does
Enables the main agent to spawn isolated child sessions for parallel work:
- Create ephemeral sessions for background tasks
- Run with different models or thinking levels
- Announce results back to requester session
- Automatic cleanup after completion

### How It Works

#### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                 Sub-agent System                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Main Session                    Child Session               │
│  ┌──────────────┐               ┌──────────────┐            │
│  │ sessions_    │ ──spawns──▶  │ agent:main:   │            │
│  │ spawn tool   │               │ subagent:uuid │            │
│  └──────────────┘               └──────────────┘            │
│         │                              │                     │
│         │                              │ runs isolated       │
│         │                              │ task                │
│         │                              ▼                     │
│         │                       ┌──────────────┐            │
│         │◀──────announces──────│ completion   │            │
│         │                       │ result       │            │
│         ▼                       └──────────────┘            │
│  ┌──────────────┐                      │                     │
│  │ continue     │               cleanup: delete              │
│  │ main work    │               or keep session              │
│  └──────────────┘                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Key Files
- **Registry:** `src/agents/subagent-registry.ts` - Track spawned agents
- **Announce:** `src/agents/subagent-announce.ts` - Result announcement flow
- **Store:** `src/agents/subagent-registry.store.ts` - Persistence
- **Spawn Tool:** `src/agents/tools/sessions-spawn-tool.ts` - Tool implementation

#### Spawn Options
```typescript
interface SpawnParams {
  task: string;           // Task description
  model?: string;         // Model override (e.g., "sonnet" for fast work)
  thinking?: string;      // Thinking level ("low", "medium", "high")
  timeoutSeconds?: number;
  cleanup?: "delete" | "keep";
  label?: string;         // Human-readable label
}
```

#### Lifecycle
1. Parent calls `sessions_spawn` tool
2. New session created with `agent:<agentId>:subagent:<uuid>` key
3. Child runs independently with task prompt
4. On completion, result announced to parent session
5. Cleanup runs (delete transcript or keep)

### Dependencies
- Internal session management
- Gateway RPC for cross-session communication

### Complexity: **Medium**
### Replication Effort: **1-2 weeks**

---

## 5. Memory System

### What It Does
Provides persistent memory across sessions through:
- Markdown files in workspace (`MEMORY.md`, `memory/*.md`)
- Vector search for semantic retrieval
- Daily notes for running context
- Session transcript indexing (experimental)

### How It Works

#### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Memory System                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Workspace Files                   Memory Index              │
│  ┌────────────────┐              ┌────────────────┐         │
│  │ MEMORY.md      │──────────▶  │ SQLite DB      │         │
│  │ memory/*.md    │   watch +   │ ├── chunks     │         │
│  │ (extra paths)  │   index     │ ├── vectors    │         │
│  └────────────────┘              │ ├── FTS5      │         │
│         │                        │ └── cache     │         │
│         ▼                        └────────────────┘         │
│  ┌────────────────┐                     │                    │
│  │ File Watcher   │                     │                    │
│  │ (debounced)    │                     ▼                    │
│  └────────────────┘              ┌────────────────┐         │
│                                  │ Hybrid Search  │         │
│  Tools:                          │ ├── Vector     │         │
│  - memory_search ─────────────▶ │ └── BM25       │         │
│  - memory_get                    └────────────────┘         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Key Files
- **Manager:** `src/memory/manager.ts` - `MemoryIndexManager` class (2400+ LOC)
- **Embeddings:** `src/memory/embeddings.ts` - Provider abstraction
- **Search:** `src/memory/manager-search.ts` - Query execution
- **Hybrid:** `src/memory/hybrid.ts` - Vector + BM25 fusion

#### Embedding Providers
| Provider | Model | Notes |
|----------|-------|-------|
| OpenAI | `text-embedding-3-small` | Default remote, batch API supported |
| Gemini | `gemini-embedding-001` | Native Gemini embeddings |
| Local | `embeddinggemma-300M-Q8_0.gguf` | node-llama-cpp, ~0.6GB |

#### Index Storage
```
~/.openclaw/memory/<agentId>.sqlite
├── chunks        # Markdown chunks with metadata
├── chunks_vec    # Vector embeddings (sqlite-vec)
├── chunks_fts    # Full-text search (FTS5)
└── embedding_cache # Cached embeddings for reuse
```

#### Memory Flush (Pre-Compaction)
When session nears context limit:
1. Trigger silent agent turn
2. Prompt: "Store durable memories now"
3. Agent writes to `memory/YYYY-MM-DD.md`
4. Respond with `NO_REPLY` (invisible to user)

### Dependencies
- `better-sqlite3` - SQLite bindings
- `sqlite-vec` - Vector extension (optional)
- `node-llama-cpp` - Local embeddings (optional)
- `openai` / `@google/generative-ai` - Remote embeddings

### Complexity: **Complex**
### Replication Effort: **3-4 weeks**

---

## 6. Skills System

### What It Does
Skills are external capabilities the agent can use:
- CLI tools with `SKILL.md` documentation
- Auto-discovered from workspace and managed directories
- Injected into system prompt
- Support for install, update, and status checking

### How It Works

#### Skill Discovery Hierarchy
```
1. Bundled skills:     /path/to/openclaw/skills/
2. Managed skills:     ~/.openclaw/skills/
3. Workspace skills:   ~/.openclaw/workspace/skills/
4. Extra dirs:         config skills.load.extraDirs
5. Plugin skills:      extension-provided skills
```

#### SKILL.md Format
```markdown
---
name: weather
version: 1.0.0
command: weather-cli
install:
  brew: weather-cli
  npm: weather-cli-npm
description: Get weather forecasts
---

# Weather Skill

## Usage
- `weather-cli forecast <location>`
- `weather-cli current <city>`

## Examples
...
```

#### Key Files
- **Workspace:** `src/agents/skills/workspace.ts` - Discovery and loading
- **Config:** `src/agents/skills/config.ts` - Skill filtering/eligibility
- **Types:** `src/agents/skills/types.ts` - `SkillEntry`, `SkillSnapshot`
- **Install:** `src/agents/skills-install.ts` - Auto-installation
- **Status:** `src/agents/skills-status.ts` - Availability checking

#### Skill Entry Structure
```typescript
interface SkillEntry {
  skill: Skill;           // From pi-agent-core
  source: string;         // "openclaw-bundled" | "openclaw-managed" | etc.
  dir: string;            // Absolute path
  skillMdPath?: string;   // Path to SKILL.md
  frontmatter?: ParsedSkillFrontmatter;
}
```

### Dependencies
- `@mariozechner/pi-coding-agent` - Skill parsing
- Package managers: `brew`, `npm`, `pnpm`, `yarn`, `bun`

### Complexity: **Medium**
### Replication Effort: **1-2 weeks**

---

## 7. Personal Assistant Features

### What It Does
Configurable identity and behavior through workspace files:
- **SOUL.md** - Agent personality and values
- **USER.md** - Information about the user
- **IDENTITY.md** - Agent name and avatar
- **AGENTS.md** - Workspace conventions and rules
- **MEMORY.md** - Long-term curated memories
- **HEARTBEAT.md** - Periodic check instructions

### How It Works

#### Workspace File Loading
```
At session start, load in order:
1. AGENTS.md     → Always load (workspace conventions)
2. SOUL.md       → Always load (identity)
3. USER.md       → Always load (user context)
4. IDENTITY.md   → Always load (name/avatar)
5. MEMORY.md     → Main session only (privacy)
6. memory/*.md   → Today + yesterday (recent context)
```

#### Key Files
- **Identity:** `src/agents/identity.ts` - Name resolution
- **Identity File:** `src/agents/identity-file.ts` - IDENTITY.md parsing
- **Avatar:** `src/agents/identity-avatar.ts` - Avatar image handling
- **Workspace:** `src/agents/workspace.ts` - File layout constants
- **Bootstrap:** `src/agents/bootstrap-files.ts` - Context file loading

#### Heartbeat System
The heartbeat is a periodic "wake up" that lets the agent proactively check things:

```
┌─────────────────────────────────────────────────────────────┐
│                  Heartbeat Flow                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    every N min    ┌──────────────────┐        │
│  │ Timer    │──────────────────▶│ Read HEARTBEAT.md│        │
│  └──────────┘                   └──────────────────┘        │
│                                          │                   │
│                                          ▼                   │
│                                  ┌──────────────────┐        │
│                                  │ Run agent turn   │        │
│                                  │ with prompt      │        │
│                                  └──────────────────┘        │
│                                          │                   │
│                    ┌─────────────────────┼─────────────────┐│
│                    ▼                     ▼                 ▼│
│             ┌──────────┐          ┌──────────┐     ┌────────┐
│             │HEARTBEAT │          │ Take     │     │ Deliver│
│             │_OK       │          │ Action   │     │ Alert  │
│             │(silent)  │          │ (proact) │     │ to user│
│             └──────────┘          └──────────┘     └────────┘
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Key Heartbeat Files
- **Runner:** `src/infra/heartbeat-runner.ts` - `startHeartbeatRunner()`
- **Config:** Per-agent via `agents.list[].heartbeat` or `agents.defaults.heartbeat`
- **Prompt:** Configurable, default reads HEARTBEAT.md

#### Active Hours
Heartbeats respect quiet hours:
```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        activeHours: {
          start: "08:00",
          end: "23:00",
          timezone: "user"  // or "local" or explicit tz
        }
      }
    }
  }
}
```

### Dependencies
- Internal agent system
- File system access

### Complexity: **Medium**
### Replication Effort: **1-2 weeks**

---

## 8. Channel Integrations

### What It Does
Connect to messaging platforms to send/receive messages:
- Core channels: WhatsApp, Telegram, Discord, Slack, Signal, iMessage
- Extension channels: MS Teams, Matrix, Zalo, Voice Call, etc.
- Unified abstraction layer for routing and delivery
- Per-channel configuration and capabilities

### Supported Channels

| Channel | Type | Key Features |
|---------|------|--------------|
| **WhatsApp** | Core | Web-based, multi-account, polls, reactions |
| **Telegram** | Core | Bot API, inline buttons, topics, stickers |
| **Discord** | Core | Bot token, slash commands, threads, embeds |
| **Slack** | Core | Bot token, threads, app mentions |
| **Signal** | Core | signal-cli integration, attachments |
| **iMessage** | Core | macOS-only via BlueBubbles/Shortcuts |
| **MS Teams** | Extension | OAuth, adaptive cards |
| **Matrix** | Extension | Federation, encryption |
| **Webchat** | Core | Browser-based, gateway-direct |

### How It Works

#### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                 Channel System                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Inbound                         Outbound                    │
│  ┌──────────────┐               ┌──────────────┐            │
│  │ WhatsApp     │──┐         ┌──│ WhatsApp     │            │
│  │ Telegram     │  │         │  │ Telegram     │            │
│  │ Discord      │  │         │  │ Discord      │            │
│  │ ...          │  │         │  │ ...          │            │
│  └──────────────┘  │         │  └──────────────┘            │
│         │          │         │         ▲                     │
│         ▼          ▼         │         │                     │
│  ┌────────────────────┐     │  ┌────────────────────┐       │
│  │ Channel Manager    │     │  │ Delivery Engine    │       │
│  │ ├── normalize msg  │     │  │ ├── route by key   │       │
│  │ ├── resolve session│     │  │ ├── format message │       │
│  │ └── queue for agent│     │  │ └── retry on fail  │       │
│  └────────────────────┘     │  └────────────────────┘       │
│         │                    │         ▲                     │
│         ▼                    │         │                     │
│  ┌────────────────────┐     │  ┌────────────────────┐       │
│  │ Agent Loop         │─────┴──│ Reply Payload      │       │
│  └────────────────────┘        └────────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Key Files
- **Plugin Index:** `src/channels/plugins/index.ts` - Channel registry
- **Plugin Types:** `src/channels/plugins/types.ts` - `ChannelPlugin` interface
- **Registry:** `src/channels/registry.ts` - Channel ID normalization
- **Dock:** `src/channels/dock.ts` - Shared routing logic
- **Manager:** `src/gateway/server-channels.ts` - Start/stop channels

#### Channel Plugin Interface
```typescript
interface ChannelPlugin {
  id: ChannelId;
  meta: {
    label: string;
    icon?: string;
    order?: number;
  };
  // Lifecycle
  start?: (config) => Promise<void>;
  stop?: () => Promise<void>;
  // Messaging
  send?: (params) => Promise<SendResult>;
  // Capabilities
  capabilities?: ChannelCapabilities;
  // Gateway methods
  gatewayMethods?: string[];
  gatewayHandlers?: Record<string, Handler>;
}
```

### Dependencies
- `@whiskeysockets/baileys` - WhatsApp Web
- `telegraf` - Telegram Bot API
- `discord.js` - Discord Bot
- `@slack/bolt` - Slack App
- Channel-specific SDKs

### Complexity: **Complex**
### Replication Effort: **4-6 weeks** (all channels)

---

## 9. Cron/Scheduling

### What It Does
Schedule recurring or one-shot agent tasks:
- **systemEvent** - Inject text into main session
- **agentTurn** - Run isolated agent turn with delivery
- Supports cron expressions, intervals, and one-shot times
- Persist jobs across restarts

### How It Works

#### Job Types
| Type | Session | Description |
|------|---------|-------------|
| `systemEvent` | main | Inject text as system message in main session |
| `agentTurn` | isolated | Run independent agent turn, optionally deliver |

#### Schedule Formats
```typescript
type CronSchedule =
  | { kind: "at"; atMs: number }           // One-shot at timestamp
  | { kind: "every"; everyMs: number }     // Repeat every N ms
  | { kind: "cron"; expr: string; tz?: string };  // Cron expression
```

#### Key Files
- **Types:** `src/cron/types.ts` - `CronJob`, `CronPayload`
- **Jobs:** `src/cron/service/jobs.ts` - CRUD operations
- **Timer:** `src/cron/service/timer.ts` - Scheduling logic
- **Store:** `src/cron/service/store.ts` - Persistence
- **Isolated Agent:** `src/cron/isolated-agent/` - Isolated run execution

#### Storage
```
~/.openclaw/agents/<agentId>/cron.json
{
  "version": 1,
  "jobs": [
    {
      "id": "uuid",
      "name": "Daily standup",
      "enabled": true,
      "schedule": { "kind": "cron", "expr": "0 9 * * 1-5" },
      "sessionTarget": "isolated",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "Check calendar and summarize today's meetings",
        "deliver": true,
        "channel": "telegram"
      }
    }
  ]
}
```

### Dependencies
- `cron-parser` - Cron expression parsing
- Internal agent system

### Complexity: **Medium**
### Replication Effort: **1-2 weeks**

---

## 10. Tool Framework

### What It Does
Provide tools the agent can call during inference:
- File operations (read, write, edit)
- Shell execution (exec, process management)
- Browser automation (Playwright-based)
- Messaging (cross-session, cross-channel)
- Web access (search, fetch)
- Memory operations
- Session management

### Available Tools

#### Core Tools
| Tool | Description |
|------|-------------|
| `read` | Read file contents |
| `write` | Create/overwrite files |
| `edit` | Precise text replacement |
| `exec` | Execute shell commands |
| `process` | Manage background processes |
| `browser` | Web browser automation |
| `canvas` | Render UI to connected devices |
| `nodes` | Control paired mobile devices |
| `message` | Send messages via channels |
| `tts` | Text-to-speech |
| `web_search` | Brave Search API |
| `web_fetch` | Fetch URL content |
| `image` | Analyze images |
| `memory_search` | Semantic memory search |
| `memory_get` | Read memory files |
| `sessions_spawn` | Create sub-agents |
| `sessions_send` | Cross-session messaging |
| `sessions_list` | List active sessions |
| `session_status` | Current session info |
| `cron` | Manage scheduled jobs |

### How It Works

#### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                  Tool Framework                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Tool Definition                Tool Execution               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ TypeBox Schema   │         │ Tool Handler     │          │
│  │ ├── parameters   │────────▶│ ├── validate     │          │
│  │ ├── description  │         │ ├── execute      │          │
│  │ └── examples     │         │ └── return result│          │
│  └──────────────────┘         └──────────────────┘          │
│         │                              │                     │
│         ▼                              ▼                     │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ Tool Policy      │         │ Result Transform │          │
│  │ ├── allowlist    │         │ ├── truncate     │          │
│  │ ├── denylist     │         │ ├── format       │          │
│  │ └── per-channel  │         │ └── persist      │          │
│  └──────────────────┘         └──────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Key Files
- **Tool Definitions:** `src/agents/pi-tools.ts` - Main tool creation
- **Tool Schema:** `src/agents/pi-tools.schema.ts` - TypeBox schemas
- **Tool Policy:** `src/agents/pi-tools.policy.ts` - Filtering
- **Exec:** `src/agents/bash-tools.exec.ts` - Shell execution (54KB!)
- **Process:** `src/agents/bash-tools.process.ts` - Background processes
- **Browser:** `src/agents/tools/browser-tool.ts` - Playwright control
- **Individual Tools:** `src/agents/tools/*.ts`

#### Exec Sessions (Background Processes)
```typescript
// Start background process
exec({
  command: "npm run dev",
  background: true,
  yieldMs: 10000  // Wait 10s before backgrounding
})

// Later: poll, write input, kill
process({
  action: "poll",
  sessionId: "session-uuid"
})
```

#### Browser Control
```typescript
browser({
  action: "snapshot",  // Get page DOM
  profile: "openclaw", // Isolated browser
  targetId: "tab-uuid"
})

browser({
  action: "act",
  request: {
    kind: "click",
    ref: "e12"  // Element reference from snapshot
  }
})
```

### Dependencies
- `playwright` - Browser automation
- `node-pty` - PTY for exec
- Various tool-specific dependencies

### Complexity: **Complex**
### Replication Effort: **4-5 weeks**

---

## 11. Startup Experience

### What It Does
Make gateway startup memorable with:
- Fun rotating taglines
- Holiday-specific messages
- Clean status logging
- ASCII art (optional)

### The Jokes! 🎉

Located in `src/cli/tagline.ts`:

#### Regular Taglines (75+ total)
```
"Your terminal just grew claws—type something and let the bot pinch the busywork."
"Welcome to the command line: where dreams compile and confidence segfaults."
"I run on caffeine, JSON5, and the audacity of 'it worked on my machine.'"
"Gateway online—please keep hands, feet, and appendages inside the shell at all times."
"I speak fluent bash, mild sarcasm, and aggressive tab-completion energy."
"One CLI to rule them all, and one more restart because you changed the port."
"Hot reload for config, cold sweat for deploys."
"I keep secrets like a vault... unless you print them in debug logs again."
"If you're lost, run doctor; if you're brave, run prod; if you're wise, run tests."
"Greetings, Professor Falken"
```

#### Holiday Taglines
| Holiday | Message |
|---------|---------|
| **New Year** | "New year, new config—same old EADDRINUSE, but this time we resolve it like grown-ups." |
| **Lunar New Year** | "May your builds be lucky, your branches prosperous, and your merge conflicts chased away with fireworks." |
| **Christmas** | "Ho ho ho—Santa's little claw-sistant is here to ship joy, roll back chaos, and stash the keys safely." |
| **Halloween** | "Spooky season: beware haunted dependencies, cursed caches, and the ghost of node_modules past." |
| **Valentine's** | "Roses are typed, violets are piped—I'll automate the chores so you can spend time with humans." |
| **Thanksgiving** | "Grateful for stable ports, working DNS, and a bot that reads the logs so nobody has to." |

#### Holiday Detection
```typescript
// Example: Fourth Thursday of November
const isFourthThursdayOfNovember: HolidayRule = (date) => {
  const parts = utcParts(date);
  if (parts.month !== 10) return false; // November
  const firstDay = new Date(Date.UTC(parts.year, 10, 1)).getUTCDay();
  const offsetToThursday = (4 - firstDay + 7) % 7;
  const fourthThursday = 1 + offsetToThursday + 21;
  return parts.day === fourthThursday;
};
```

### Key Files
- **Taglines:** `src/cli/tagline.ts` - All jokes and holiday rules
- **Startup Log:** `src/gateway/server-startup-log.ts` - Logging

### Complexity: **Simple**
### Replication Effort: **1-2 days**

---

## 12. Summary Table

| Feature | Complexity | Effort | Key Dependencies |
|---------|------------|--------|------------------|
| Gateway Runtime | Complex | 3-4 weeks | express/hono, ws, chokidar |
| Agent Loop | Complex | 4-5 weeks | pi-agent-core, LLM SDKs |
| Session Management | Medium | 1-2 weeks | Node fs |
| Sub-agent Spawning | Medium | 1-2 weeks | Internal |
| Memory System | Complex | 3-4 weeks | better-sqlite3, embeddings |
| Skills System | Medium | 1-2 weeks | pi-coding-agent |
| Personal Assistant | Medium | 1-2 weeks | Internal |
| Channel Integrations | Complex | 4-6 weeks | baileys, telegraf, discord.js |
| Cron/Scheduling | Medium | 1-2 weeks | cron-parser |
| Tool Framework | Complex | 4-5 weeks | playwright, node-pty |
| Startup Experience | Simple | 1-2 days | None |

### Total Estimated Effort: **24-36 weeks** for full feature parity

### Recommended Build Order

1. **Phase 1 - Core (6-8 weeks)**
   - Gateway Runtime (basic HTTP/WS)
   - Agent Loop (basic inference)
   - Session Management
   - Tool Framework (read/write/exec)

2. **Phase 2 - Features (8-12 weeks)**
   - Memory System
   - Skills System
   - Sub-agent Spawning
   - Cron/Scheduling

3. **Phase 3 - Channels (8-12 weeks)**
   - Channel abstraction layer
   - Priority channels (Telegram, Discord)
   - Additional channels as needed

4. **Phase 4 - Polish (2-4 weeks)**
   - Personal Assistant features
   - Startup Experience
   - Documentation

---

## Appendix: Key Code Patterns

### Config Loading
```typescript
// Standard pattern throughout codebase
import { loadConfig } from "../config/config.js";
const cfg = loadConfig();
const value = cfg.agents?.defaults?.someOption ?? defaultValue;
```

### Subsystem Logging
```typescript
import { createSubsystemLogger } from "../logging/subsystem.js";
const log = createSubsystemLogger("gateway");
log.info("message", { meta: "data" });
log.child("submodule").warn("warning");
```

### TypeBox Tool Schemas
```typescript
import { Type } from "@sinclair/typebox";
const schema = Type.Object({
  path: Type.String({ description: "File path" }),
  content: Type.Optional(Type.String()),
});
```

### Error Handling
```typescript
try {
  await operation();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  log.error(`Operation failed: ${message}`);
  throw err; // or handle gracefully
}
```
