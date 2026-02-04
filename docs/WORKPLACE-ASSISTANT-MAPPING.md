# OpenClaw → GoodTeams: Workplace Assistant Feature Mapping

**Version:** 1.0  
**Created:** 2026-02-03  
**Purpose:** Map OpenClaw's personal assistant features to enterprise workplace scenarios  
**Status:** Ready for Implementation

---

## Executive Summary

**GoodTeams is a Workplace Personal Assistant.**

This isn't a pivot—it's a recognition. OpenClaw built something powerful: an AI assistant that learns about its user, remembers context, proactively helps, and adapts to personal style. That's *exactly* what knowledge workers need.

The enterprise opportunity isn't removing these features—it's **adapting them for the workplace**:

| Personal Assistant | Workplace Personal Assistant |
|-------------------|------------------------------|
| Remembers your preferences | Remembers your role, projects, team dynamics |
| Proactively checks your calendar | Proactively tracks deadlines, meetings, blockers |
| Learns your communication style | Learns your professional context and workflows |
| Helps with life tasks | Helps with work tasks and knowledge work |

This document maps every OpenClaw personal assistant feature to its GoodTeams workplace equivalent.

---

## Table of Contents

1. [Identity & Persona](#1-identity--persona)
2. [Memory & Learning](#2-memory--learning)
3. [Proactive Behaviors](#3-proactive-behaviors)
4. [Transcription Features](#4-transcription-features)
5. [Channel Integrations](#5-channel-integrations)
6. [Scheduling & Automation](#6-scheduling--automation)
7. [The GoodTeams CLI](#7-the-goodteams-cli)
8. [Implementation Priority Matrix](#8-implementation-priority-matrix)

---

## 1. Identity & Persona

### 1.1 SOUL.md → Organizational & Role Personas

**Original OpenClaw Feature:**
`SOUL.md` defines the agent's personality, values, communication style, and core identity. It's how the assistant "knows" who it is.

**Workplace Equivalent:**
GoodTeams uses **layered personas** that combine organizational culture with role-specific behaviors.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Persona Hierarchy                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Organizational Soul                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ORGANIZATION-SOUL.md                                      │  │
│  │ - Company values and culture                              │  │
│  │ - Communication tone (formal/casual/etc.)                 │  │
│  │ - Industry-specific knowledge                             │  │
│  │ - Compliance requirements                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  Layer 2: Team Persona                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ TEAM-SOUL.md (per team/department)                        │  │
│  │ - Team-specific workflows                                 │  │
│  │ - Domain expertise (Engineering, Sales, HR)               │  │
│  │ - Team communication norms                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  Layer 3: Role Persona                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ROLE-SOUL.md (per role type)                              │  │
│  │ - Manager assistant behaviors                             │  │
│  │ - IC assistant behaviors                                  │  │
│  │ - Executive assistant behaviors                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Enterprise Use Cases:**

1. **Tech Company Culture**: SOUL defines casual communication, emoji usage, engineering-first mindset. When helping an engineer, the assistant writes code-heavy responses; when helping sales, it adapts to business speak.

2. **Law Firm Formality**: SOUL defines precise, formal language, citation requirements, confidentiality emphasis. Never uses casual language, always qualifies advice with "consult attorney" disclaimers.

3. **Startup vs Enterprise**: Same organization, different team souls. Engineering team gets scrappy, move-fast assistant; Legal team gets thorough, risk-aware assistant.

**Modifications Needed:**
- Multi-level persona inheritance (org → team → role)
- Admin UI for persona management
- Persona templates for common industries
- Override controls (team can deviate from org defaults)

**Priority:** P0 — Core differentiator

---

### 1.2 USER.md → Employee Profile

**Original OpenClaw Feature:**
`USER.md` stores information about the user—their preferences, communication style, background, goals.

**Workplace Equivalent:**
**Employee Profile** combines user-provided info with organizational context.

```yaml
# Example: employee-profile.yaml (or stored in DB)

identity:
  name: Sarah Chen
  role: Senior Software Engineer
  department: Platform Engineering
  reports_to: Marcus Johnson
  tenure: 2.5 years
  timezone: America/Los_Angeles

work_context:
  current_projects:
    - "Platform Auth Rewrite (Tech Lead)"
    - "API Gateway Migration (Contributor)"
  specialties:
    - "Authentication systems"
    - "API design"
    - "Performance optimization"
  certifications:
    - "AWS Solutions Architect"

communication:
  style: "Direct, technical, prefers bullet points"
  meeting_preferences: "No meetings before 10am"
  slack_response_time: "Usually within 30 min during work hours"
  
working_patterns:
  typical_hours: "10am - 7pm PT"
  focus_time: "Tuesday/Thursday afternoons"
  one_on_ones: "Mondays with Marcus"
  
goals:
  quarterly:
    - "Ship auth rewrite by Q1 end"
    - "Reduce P99 latency by 40%"
  career:
    - "Grow into Staff Engineer role"
    - "Mentor junior engineers"

preferences:
  notification_level: "Important only during focus time"
  summary_format: "Brief with action items"
  ai_autonomy: "High - take action, report later"
```

**Enterprise Use Cases:**

1. **Context-Aware Responses**: When Sarah asks about "the migration," the assistant knows she means the API Gateway Migration and can pull relevant context.

2. **Meeting Preparation**: Before a 1:1 with Marcus, the assistant can prep talking points based on her goals and recent work.

3. **Communication Adaptation**: Knows Sarah prefers technical depth, so code examples > hand-wavy explanations.

**Modifications Needed:**
- Sync with HR/Identity systems (Workday, BambooHR, Entra ID)
- Privacy controls (employee chooses what to share)
- Manager visibility rules (what can managers see?)
- Profile completeness scoring

**Priority:** P0 — Personalization foundation

---

### 1.3 IDENTITY.md → Assistant Branding

**Original OpenClaw Feature:**
`IDENTITY.md` sets the assistant's name and avatar—how it presents itself.

**Workplace Equivalent:**
**Per-organization assistant branding** with optional team customization.

```yaml
# Example: org-identity.yaml

branding:
  name: "Atlas"  # The org's assistant name
  tagline: "Your Acme Co. AI teammate"
  avatar: "/assets/atlas-avatar.png"
  
  team_overrides:
    engineering:
      name: "Atlas Dev"
      avatar: "/assets/atlas-dev.png"
    sales:
      name: "Atlas Sales"
      avatar: "/assets/atlas-sales.png"

voice:
  greeting: "Hey! Atlas here."
  sign_off: "Let me know if you need anything else."
  error_message: "Hmm, I hit a snag. Let me try that again..."
  
theming:
  primary_color: "#1E40AF"
  secondary_color: "#60A5FA"
```

**Enterprise Use Cases:**

1. **Company-Wide Consistency**: Every employee interacts with "Atlas" (or whatever name), creating unified experience.

2. **Department Personality**: Engineering's "Atlas Dev" is more technical and casual; HR's "Atlas People" is warmer and more formal.

3. **White-Label Deployments**: MSPs can rebrand the assistant for each client org.

**Modifications Needed:**
- Admin UI for branding management
- Avatar upload and storage
- Team-level override permissions
- Preview before publish

**Priority:** P1 — Brand differentiation

---

### 1.4 AGENTS.md → Workplace Behavioral Guidelines

**Original OpenClaw Feature:**
`AGENTS.md` defines workspace conventions—how the agent should behave, what files to read, safety rules.

**Workplace Equivalent:**
**Organizational Behavioral Policy** that defines workplace-appropriate AI behavior.

```markdown
# AGENTS.md - Acme Co. Workplace Guidelines

## Security & Compliance

### Data Classification
Before responding, consider data sensitivity:
- **Public**: Can discuss freely
- **Internal**: OK within organization
- **Confidential**: Need explicit permission to share
- **Restricted**: Never include in responses

### Compliance Requirements
- SOC 2: All actions must be auditable
- GDPR: Don't store EU PII beyond session
- HIPAA: Never include PHI in responses (if applicable)

## Communication Rules

### External Communication
- **Email drafts**: Always show before sending
- **Customer messages**: Require approval
- **Social media**: Never post without explicit consent

### Internal Communication
- Slack: Can send to user's own channels freely
- Can mention teammates if explicitly requested
- Never message executives without user confirmation

## Tool Permissions

### Allowed Actions
- Read files in approved directories
- Search company wiki/Confluence
- Query approved data sources (CRM, ticketing)

### Requires Approval
- Modifying shared documents
- Creating calendar events with others
- Sending messages to external parties

### Never Allowed
- Deleting production data
- Accessing HR systems without audit trail
- Impersonating users

## Proactive Behavior

### Check-ins
- Daily: Summarize inbox, calendar, pending tasks
- Before meetings: Prep relevant context
- After meetings: Offer to create action items

### Quiet Hours
- No notifications: 6pm - 9am local
- Exception: @urgent mentions, P0 incidents
```

**Enterprise Use Cases:**

1. **Compliance Guardrails**: Assistant automatically recognizes confidential documents and refuses to share contents externally.

2. **Audit Trail**: Every action is logged per AGENTS.md requirements, satisfying SOC 2 auditors.

3. **Communication Safety**: Drafts external emails but always shows preview, preventing embarrassing mistakes.

**Modifications Needed:**
- Admin UI for policy editing
- Policy templates by industry (Healthcare, Finance, Tech)
- Policy version control and approval workflow
- Violation alerting to admins

**Priority:** P0 — Enterprise requirement

---

## 2. Memory & Learning

### 2.1 MEMORY.md → Work Context Memory

**Original OpenClaw Feature:**
`MEMORY.md` stores curated long-term memories—distilled knowledge the agent should always have access to.

**Workplace Equivalent:**
**Work Context Memory** stores professional context organized by category.

```markdown
# MEMORY.md - Sarah Chen's Work Context

## Current Projects

### Platform Auth Rewrite
- **Status**: In progress, 60% complete
- **Tech Lead**: Me
- **Key decisions**:
  - Using OAuth2 + PKCE (decided 2024-01-15, see RFC-AUTH-2024)
  - Migrating from session cookies to JWT (approved by Marcus)
  - Timeline: Ship by March 15
- **Blockers**:
  - Waiting on DevOps for new IAM roles
  - Legacy session migration needs more testing

### API Gateway Migration
- **Status**: Planning phase
- **My role**: Contributor (latency optimization)
- **Key contacts**: Alex (lead), Priya (infrastructure)

## Team Dynamics

- Marcus (manager): Prefers async updates, 1:1 Mondays
- Alex: Great for architecture discussions, in Singapore (16hr diff)
- Priya: Knows all the DevOps secrets, usually responds fast

## Recurring Meetings

- Monday 10am: Team standup
- Monday 2pm: 1:1 with Marcus
- Wednesday 11am: Auth working group
- Friday 3pm: Platform all-hands

## Tribal Knowledge

- The "legacy auth" system is in `/services/auth-v1` — don't touch it, it's haunted
- Prod deploys require approval from Alex OR Marcus
- The wiki is outdated; check #platform-eng Slack for real info
```

**Enterprise Use Cases:**

1. **Context Continuity**: "What's the status on my auth project?" → Instantly recalls 60% complete, key decisions, blockers.

2. **Relationship Memory**: "Remind me who owns infrastructure for the gateway?" → "That's Priya. She's usually quick to respond."

3. **Institutional Knowledge**: Remembers that legacy auth is "haunted" and guides user away from it.

**Modifications Needed:**
- Structured vs freeform memory storage
- Memory categories (projects, people, decisions, tribal knowledge)
- Privacy controls (work memory is org-scoped)
- Memory sharing (team-level shared memories)
- Integration with project management tools (Jira, Linear)

**Priority:** P0 — Core value proposition

---

### 2.2 Daily Notes (memory/*.md) → Work Session Logs

**Original OpenClaw Feature:**
Daily notes (`memory/YYYY-MM-DD.md`) capture day-by-day context, raw logs of what happened.

**Workplace Equivalent:**
**Work Session Logs** organized by day, capturing work activities, decisions, and learnings.

```markdown
# memory/2024-02-03.md

## Morning

- Reviewed PR #1234 for API rate limiting
  - Left comment about missing tests
  - Alex addressed it, LGTM'd
- Incident: Auth service spike at 9:23am
  - Root cause: Cache invalidation bug (see INC-5678)
  - Temporary fix deployed, permanent fix in PR #1240

## Meetings

### 10am - Team Standup
- Alex: Gateway migration planning this week
- Priya: New IAM roles ready by Wednesday
- Me: Shared auth rewrite progress (60% → 65%)

### 2pm - 1:1 with Marcus
- Discussed staff engineer path
- Action: Write technical vision doc by Feb 15
- Marcus feedback: "Showing good leadership on auth project"

## Afternoon

- Deep work on auth token validation
- Discovered edge case with refresh tokens (added to MEMORY.md)
- Helped junior (David) debug OAuth flow

## End of Day

- PRs merged: #1234, #1238
- PRs open: #1240 (waiting for review)
- Tomorrow focus: Refresh token edge case
```

**Enterprise Use Cases:**

1. **Standup Prep**: "What did I do yesterday?" → Summarizes from work session log.

2. **Weekly Report**: "Summarize my week for the status report" → Aggregates daily logs.

3. **Performance Review Evidence**: "What were my accomplishments last quarter?" → Searches across session logs.

**Modifications Needed:**
- Auto-capture from tool usage (PRs reviewed, messages sent, meetings attended)
- Integration with calendar for meeting notes
- Configurable detail level
- Export for performance reviews

**Priority:** P1 — Productivity enhancer

---

### 2.3 memory_search → Work Context Search

**Original OpenClaw Feature:**
`memory_search` provides semantic search across all memory files.

**Workplace Equivalent:**
**Work Context Search** finds relevant past decisions, conversations, and context.

```
User: "What did we decide about the database for the auth rewrite?"

Search results:
1. MEMORY.md (2024-01-15): "Decided to use PostgreSQL with pgvector..."
2. memory/2024-01-10.md: "Meeting notes: Debated MongoDB vs PostgreSQL..."
3. Team Decisions folder: "RFC-AUTH-DB-2024: Database selection rationale..."
```

**Enterprise Use Cases:**

1. **Decision Archaeology**: "Why did we choose React over Vue?" → Finds meeting notes, decision docs.

2. **Context Recovery**: Returning from PTO, search "what happened with Project X" to catch up.

3. **Knowledge Transfer**: New team member can search for tribal knowledge before asking questions.

**Modifications Needed:**
- Team-level search (search shared context, not just personal)
- Source attribution (where did this info come from?)
- Confidence scoring
- Integration with company knowledge bases (Confluence, Notion, SharePoint)

**Priority:** P0 — Essential for context retrieval

---

### 2.4 Long-term Learning → Role Understanding

**Original OpenClaw Feature:**
Over time, OpenClaw learns user preferences, communication style, and context from interactions.

**Workplace Equivalent:**
**Role Understanding** learns the employee's work patterns, expertise, and professional context.

```yaml
# Learned over time (stored in employee profile)

learned_patterns:
  expertise_areas:
    - "OAuth/OIDC implementation" (confidence: 0.95)
    - "API performance optimization" (confidence: 0.88)
    - "Code review best practices" (confidence: 0.85)
  
  common_tasks:
    - "PR reviews" (3-4/day average)
    - "Slack questions from junior engineers" (2-3/day)
    - "Architecture discussions" (2-3/week)
  
  communication_preferences:
    - "Prefers code examples over descriptions"
    - "Likes bullet points in summaries"
    - "Responds well to direct feedback"
  
  productivity_patterns:
    - "Most productive: Tuesday-Thursday afternoons"
    - "Avoid scheduling: Monday mornings"
    - "Deep work preference: 2+ hour blocks"
```

**Enterprise Use Cases:**

1. **Smart Assistance**: Knows user is an OAuth expert, so gives advanced responses on auth topics but explains unfamiliar areas more thoroughly.

2. **Workload Awareness**: Notices heavy PR review load today, offers to help triage or defer non-urgent requests.

3. **Communication Optimization**: Learns that user prefers "show me the code" over "let me explain the concept."

**Modifications Needed:**
- Privacy-preserving learning (user controls what's learned)
- Learning transparency ("I noticed you often...")
- Learning reset capability
- Team-level learning (patterns across similar roles)

**Priority:** P1 — Differentiating feature

---

## 3. Proactive Behaviors

### 3.1 Heartbeat System → Workplace Check-ins

**Original OpenClaw Feature:**
The heartbeat system periodically "wakes up" the agent to check on things and optionally reach out.

**Workplace Equivalent:**
**Workplace Check-ins** monitor professional obligations and proactively assist.

```
┌─────────────────────────────────────────────────────────────────┐
│                  Workplace Heartbeat Checks                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📬 Email Monitoring                                            │
│  ├── "You have 3 unread emails from executives"                 │
│  ├── "Sarah's email from Monday is still unanswered (3 days)"   │
│  └── "New email from customer tagged 'urgent'"                  │
│                                                                  │
│  📅 Calendar Awareness                                          │
│  ├── "Standup in 30 minutes"                                    │
│  ├── "1:1 with Marcus in 2 hours - want me to prep?"            │
│  ├── "You have no lunch break scheduled today"                  │
│  └── "Tomorrow is back-to-back meetings, 7 hours total"         │
│                                                                  │
│  📋 Task Tracking                                                │
│  ├── "The report you mentioned is due tomorrow"                 │
│  ├── "PR #1234 has been waiting for review for 2 days"          │
│  └── "You said you'd follow up with Alex - still pending"       │
│                                                                  │
│  🔔 Communication Monitoring                                     │
│  ├── "You were mentioned in #platform-eng 3 times"              │
│  ├── "David asked a question in thread - waiting on you"        │
│  └── "Marcus shared a doc and asked for feedback"               │
│                                                                  │
│  ⚠️ Deadline Awareness                                          │
│  ├── "Auth project deadline: 10 days away, 35% remaining"       │
│  ├── "Q1 goals due in 2 weeks"                                  │
│  └── "Expense report deadline: this Friday"                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Configuration:**
```yaml
heartbeat:
  frequency: "30m"
  active_hours:
    start: "09:00"
    end: "18:00"
    timezone: "user"
  
  checks:
    email:
      enabled: true
      urgent_senders: ["ceo@company.com", "vp@company.com"]
      stale_threshold: "48h"
    
    calendar:
      enabled: true
      prep_time: "15m"  # Alert this long before meetings
      review_tomorrow: true
    
    tasks:
      enabled: true
      sources: ["jira", "linear", "github"]
      
    communication:
      enabled: true
      channels: ["slack", "teams"]
      mention_alert: true
      
  delivery:
    channel: "slack_dm"
    batch: true  # Group alerts vs individual
    quiet_mode: true  # Subtle notifications during focus time
```

**Enterprise Use Cases:**

1. **Executive Email Alert**: "Heads up—CFO emailed you 2 hours ago about budget. Might want to respond before EOD."

2. **Meeting Prep Offer**: "Your 1:1 with Marcus is in 15 minutes. Want me to pull up your recent accomplishments and blockers?"

3. **Deadline Warning**: "The auth rewrite is due in 10 days but 35% of tasks remain. Want me to help identify what can be cut or delegated?"

4. **Communication Catch-up**: "You were mentioned 3 times in #platform-eng while in your meeting. Here's a summary..."

**Modifications Needed:**
- Integration with email providers (Gmail, Outlook)
- Integration with calendar (Google Calendar, Outlook)
- Integration with task systems (Jira, Linear, Asana)
- Integration with chat (Slack, Teams)
- Smart batching (group alerts intelligently)
- Priority scoring (what's actually urgent vs FYI)
- Do-not-disturb respect (focus time, meetings)

**Priority:** P0 — Primary value driver for workplace assistant

---

### 3.2 Background Work → Intelligent Monitoring

**Original OpenClaw Feature:**
OpenClaw can do background work during heartbeats—checking things, organizing files, etc.

**Workplace Equivalent:**
**Intelligent Background Monitoring** with optional autonomous action.

```
┌─────────────────────────────────────────────────────────────────┐
│              Background Work Modes                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Mode 1: Watch & Report                                         │
│  "Tell me about things, but don't act"                          │
│  ├── Monitor inbox for important emails                         │
│  ├── Track PR review requests                                   │
│  └── Watch for mentions in Slack                                │
│                                                                  │
│  Mode 2: Watch & Suggest                                        │
│  "Tell me and suggest actions"                                  │
│  ├── "David's question looks like a duplicate of..."            │
│  │   → Suggest: "Reply with link to existing answer?"           │
│  ├── "PR #1234 has test failures"                               │
│  │   → Suggest: "Looks like a flaky test. Re-run?"              │
│  └── "Meeting notes weren't shared"                             │
│      → Suggest: "Draft notes from your calendar?"               │
│                                                                  │
│  Mode 3: Watch & Act (with audit)                               │
│  "Handle routine things, tell me what you did"                  │
│  ├── Auto-acknowledge receipt of exec emails                    │
│  ├── Auto-categorize support tickets                            │
│  ├── Auto-update project status from PR merges                  │
│  └── Summary: "While you were in meetings, I..."                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Enterprise Use Cases:**

1. **Inbox Zero Assist**: Auto-categorize emails, draft responses to routine messages, flag urgent items for immediate attention.

2. **PR Hygiene**: Monitor PRs for stale reviews, ping reviewers, update labels based on CI status.

3. **Documentation Freshness**: Notice when code changes don't update related docs, suggest or draft updates.

4. **Meeting Follow-up**: After meetings, auto-create tasks from action items mentioned, draft follow-up emails.

**Modifications Needed:**
- Configurable autonomy levels
- Action audit trail (what did it do while I was away?)
- Undo/rollback capability
- User approval workflow for higher-risk actions

**Priority:** P1 — Increases with trust/adoption

---

## 4. Transcription Features

### 4.1 Audio Transcription → Meeting & Voice Notes

**Original OpenClaw Feature:**
OpenClaw supports audio transcription for voice memos and conversations.

**Workplace Equivalent:**
**Meeting Transcription & Voice Notes** for professional context.

```
┌─────────────────────────────────────────────────────────────────┐
│              Transcription Use Cases                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📱 Voice Notes                                                 │
│  "Record thought, transcribe, add to context"                   │
│  ├── Walking meeting notes                                      │
│  ├── Quick ideas between meetings                               │
│  └── Feedback while reviewing code                              │
│                                                                  │
│  🎤 Meeting Transcription                                       │
│  "Transcribe meeting, extract action items"                     │
│  ├── Upload meeting recording → Full transcript                 │
│  ├── Key decisions extracted                                    │
│  ├── Action items with owners                                   │
│  └── Follow-up email draft                                      │
│                                                                  │
│  📞 Call Summaries                                              │
│  "What happened on that customer call?"                         │
│  ├── Customer call transcription                                │
│  ├── Sentiment analysis                                         │
│  ├── Key points and concerns                                    │
│  └── CRM update suggestions                                     │
│                                                                  │
│  💬 Voice Messages                                              │
│  "What did Sarah say in her Slack huddle?"                      │
│  ├── Transcribe Slack/Teams voice messages                      │
│  └── Search across transcribed messages                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Note:** This is *transcription* (process audio files), NOT voice wake ("Hey GoodTeams"). Voice wake is deferred to P2/P3.

**Enterprise Use Cases:**

1. **Meeting Notes Automation**: Record team meetings, get transcription + action items + key decisions, auto-share to team.

2. **Voice Memo to Task**: Walk back from a meeting, record "I need to follow up with David about the API rate limits"—becomes a tracked task.

3. **Customer Call Analysis**: Sales calls transcribed with sentiment analysis, key concerns highlighted, CRM automatically updated.

**Modifications Needed:**
- Integration with transcription APIs (Whisper, AssemblyAI, Deepgram)
- Meeting integration (Zoom, Teams, Meet recordings)
- Speaker diarization (who said what)
- Secure handling of audio data
- Retention policies

**Priority:** P1 — KEEP, valuable for knowledge work

---

### 4.2 Voice Wake (Deferred) → P2/P3

**Original OpenClaw Feature:**
"Hey OpenClaw" voice activation for hands-free operation.

**Workplace Status:**
**Deferred to P2/P3**. Focus on transcription (process files) first. Voice wake requires:
- Always-listening infrastructure
- Privacy considerations (recording in office)
- Device integration
- Enterprise security review

---

## 5. Channel Integrations

### 5.1 Channel Priority for Enterprise

| Channel | Priority | Rationale |
|---------|----------|-----------|
| **Microsoft Teams** | P0 | Enterprise default, Entra integration |
| **Slack** | P0 | Startup/tech default, rich API |
| **Webchat** | P0 | Built-in, no dependencies |
| **Email** | P1 | Universal, async communication |
| **Discord** | P2 | Community/DevRel teams |
| **Telegram** | P2 | International teams |
| **WhatsApp** | P2 | Regional enterprise use (EMEA, LATAM) |

### 5.2 Teams Channel → Primary Enterprise Channel

**Workplace Adaptation:**

```
┌─────────────────────────────────────────────────────────────────┐
│              Microsoft Teams Integration                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Authentication                                                  │
│  ├── Entra ID SSO (already built!)                              │
│  ├── User identity from Teams context                           │
│  └── Org membership from tenant                                 │
│                                                                  │
│  Message Types                                                   │
│  ├── Direct messages (1:1 with assistant)                       │
│  ├── @mentions in channels                                      │
│  ├── Channel bot interactions                                   │
│  └── Meeting chat integration                                   │
│                                                                  │
│  Rich Features                                                   │
│  ├── Adaptive Cards (buttons, forms, approvals)                 │
│  ├── Task creation integration                                  │
│  ├── Calendar integration                                       │
│  └── Document preview/actions                                   │
│                                                                  │
│  Enterprise Features                                             │
│  ├── Compliance (DLP, eDiscovery)                               │
│  ├── Information barriers support                               │
│  └── Audit logging integration                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Enterprise Use Cases:**

1. **Meeting Assistant**: During Teams meetings, the assistant can take notes, suggest action items, and create tasks.

2. **Channel Expert**: In project channels, assistant answers questions, finds relevant docs, and tracks decisions.

3. **Approval Workflows**: Adaptive Cards for expense approvals, PTO requests, document sign-offs—all within Teams.

**Priority:** P0 — Enterprise must-have

---

### 5.3 Slack Channel → Tech/Startup Standard

**Workplace Adaptation:**

```
┌─────────────────────────────────────────────────────────────────┐
│              Slack Integration                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Core Features                                                   │
│  ├── App mentions (@assistant)                                  │
│  ├── DM conversations                                           │
│  ├── Thread replies                                             │
│  └── Slash commands (/ask, /summarize)                          │
│                                                                  │
│  Workflow Integration                                            │
│  ├── Workflow Builder triggers                                  │
│  ├── Scheduled messages                                         │
│  └── Canvas/List integrations                                   │
│                                                                  │
│  Developer Features                                              │
│  ├── GitHub/GitLab notifications handling                       │
│  ├── CI/CD status interpretation                                │
│  └── Incident response automation                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Enterprise Use Cases:**

1. **Support Channel**: In #customer-support, assistant triages questions, drafts responses, routes to right team.

2. **Engineering Help**: In #platform-eng, assistant answers "how do I...?" questions by searching docs and tribal knowledge.

3. **Incident Response**: In incident channels, assistant summarizes timeline, suggests runbook steps, drafts postmortem.

**Priority:** P0 — Critical for tech companies

---

## 6. Scheduling & Automation

### 6.1 Cron System → Work Automation

**Original OpenClaw Feature:**
Cron jobs for scheduled agent tasks.

**Workplace Equivalent:**
**Workplace Automation Schedules**

```yaml
# Example: workplace cron jobs

jobs:
  - name: "Morning Brief"
    schedule: "0 9 * * 1-5"  # 9am weekdays
    task: |
      Summarize:
      1. Important unread emails
      2. Today's calendar with prep notes
      3. High-priority tasks
      4. Relevant Slack mentions overnight
    deliver_to: "slack_dm"
    
  - name: "EOD Review"
    schedule: "0 17 * * 1-5"  # 5pm weekdays
    task: |
      Review today:
      1. What got done (from commits, PRs, tasks)
      2. What's pending
      3. Tomorrow's priorities
    deliver_to: "email"
    
  - name: "Weekly Prep"
    schedule: "0 8 * * 1"  # Monday 8am
    task: |
      Prepare for the week:
      1. Review calendar for meeting prep needs
      2. Check project deadlines approaching
      3. Summarize last week's progress
    deliver_to: "teams_dm"
    
  - name: "Standup Reminder"
    schedule: "55 9 * * 1-5"  # 9:55am weekdays
    task: |
      Standup in 5 minutes! Here's a quick draft:
      - Yesterday: [from session log]
      - Today: [from calendar + tasks]
      - Blockers: [from MEMORY.md]
    deliver_to: "slack_dm"
```

**Enterprise Use Cases:**

1. **Automated Status Reports**: Every Friday, compile weekly accomplishments from task completions and meeting notes, send to manager.

2. **Intelligent Stand-ups**: Daily auto-generated standup drafts based on actual activity (commits, PRs, completed tasks).

3. **Deadline Monitoring**: Weekly check of approaching deadlines, alert if at risk based on remaining work.

**Modifications Needed:**
- Per-user and per-org schedules
- Template library for common automations
- Integration with calendar (respect PTO, holidays)
- Trigger conditions (only run if X)

**Priority:** P1 — Significant productivity boost

---

## 7. The GoodTeams CLI

A delightful, professional CLI for managing GoodTeams.

### 7.1 Design Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│              CLI Design Principles                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PROFESSIONAL — Enterprise-ready, audit-friendly             │
│  2. DELIGHTFUL — Fun touches without being silly                │
│  3. DISCOVERABLE — Help is always helpful                       │
│  4. SCRIPTABLE — JSON output, exit codes, predictable           │
│  5. SAFE — Dangerous operations require confirmation            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Command Structure

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

### 7.3 Detailed Command Reference

#### `goodteams gateway` — Gateway Management

```bash
# Start the gateway daemon
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

# Check gateway status
$ goodteams gateway status
Gateway Status: ● Running (PID: 12345)
  Uptime:       2d 4h 32m
  Memory:       245 MB
  Connections:  42 active
  Orgs:         3 active (Acme Corp, Initech, Umbrella)
  Agents:       12 running
  
  Services:
    ✅ HTTP Server     :3000
    ✅ WebSocket       :3000/ws
    ✅ Database        Connected (PostgreSQL)
    ✅ Redis           Connected (cache + queues)
    ✅ Teams Channel   3 orgs connected
    ✅ Slack Channel   2 orgs connected

# Stop the gateway
$ goodteams gateway stop
🛑 Stopping gateway...
   → Draining 42 active connections...
   → Saving 12 agent sessions...
   → Flushing queues...
✅ Gateway stopped gracefully.

# Restart with zero downtime
$ goodteams gateway restart
♻️  Rolling restart initiated...
   → New instance starting...
   → Health check passed
   → Traffic migrated
   → Old instance stopped
✅ Restart complete. No requests dropped.

# View real-time logs
$ goodteams gateway logs -f
[09:15:32] INFO  gateway: Request from Acme/sarah.chen
[09:15:33] INFO  agent: Processing message (session: acme:sarah:main)
[09:15:34] DEBUG tools: Executing read(/docs/api.md)
[09:15:35] INFO  agent: Response generated (823 tokens)
[09:15:35] INFO  teams: Message delivered
```

#### `goodteams tenant` — Organization Management

```bash
# List all tenants
$ goodteams tenant list
╭─────────────────────────────────────────────────────────────────╮
│ Organizations                                                   │
├──────────┬────────────────┬──────────┬─────────┬───────────────┤
│ ID       │ Name           │ Plan     │ Users   │ Status        │
├──────────┼────────────────┼──────────┼─────────┼───────────────┤
│ acme     │ Acme Corp      │ Business │ 150     │ ● Active      │
│ initech  │ Initech        │ Team     │ 25      │ ● Active      │
│ umbrella │ Umbrella Inc   │ Business │ 89      │ ● Active      │
╰──────────┴────────────────┴──────────┴─────────┴───────────────╯

# Get tenant details
$ goodteams tenant show acme
Organization: Acme Corp (acme)
  Created:    2024-01-15
  Plan:       Business
  Users:      150 active
  
  Configuration:
    Default Model:  claude-3-5-sonnet
    Channels:       Teams, Slack
    Memory:         Enabled (pgvector)
    Heartbeat:      Every 30m
    
  Credentials:
    ✅ Azure/Entra    Connected
    ✅ Teams Bot      Active
    ✅ Slack App      Active
    ✅ LLM API Keys   Valid
    
  Usage (This Month):
    Conversations:  12,456
    Tokens:         4.2M
    Active Users:   98/150

# Create new tenant
$ goodteams tenant create
Creating new organization...

  Organization ID: newco
  Display Name: NewCo Industries
  Plan: team
  Admin Email: admin@newco.com
  
✅ Organization created!
   → Admin invitation sent to admin@newco.com
   → Complete setup at: https://app.goodteams.ai/newco/setup

# Configure tenant
$ goodteams tenant config acme --set model=claude-3-opus
✅ Updated Acme Corp configuration
   model: claude-3-5-sonnet → claude-3-opus
```

#### `goodteams agent` — Agent Operations

```bash
# List agents for a tenant
$ goodteams agent list --tenant acme
╭───────────────────────────────────────────────────────────────────╮
│ Agents for Acme Corp                                              │
├─────────────┬──────────────┬──────────┬───────────────────────────┤
│ Agent ID    │ Name         │ Sessions │ Status                    │
├─────────────┼──────────────┼──────────┼───────────────────────────┤
│ atlas       │ Atlas Main   │ 42       │ ● Running                 │
│ atlas-eng   │ Atlas Dev    │ 18       │ ● Running                 │
│ atlas-sales │ Atlas Sales  │ 12       │ ● Running                 │
╰─────────────┴──────────────┴──────────┴───────────────────────────╯

# Agent details
$ goodteams agent show atlas --tenant acme
Agent: atlas (Atlas Main)
  Tenant:       Acme Corp
  Status:       ● Running
  Sessions:     42 active
  
  Configuration:
    Model:        claude-3-5-sonnet
    Thinking:     medium
    Memory:       Enabled
    Skills:       12 loaded
    
  Active Sessions:
    sarah.chen    Teams DM     4h ago    "Working on auth rewrite"
    alex.wong     Slack DM     20m ago   "API design review"
    ...
    
  Recent Activity:
    [09:15] Responded to sarah.chen (auth question)
    [09:12] Memory updated (new project context)
    [09:08] Executed tool: read (3 files)

# Talk to an agent directly
$ goodteams agent chat atlas --tenant acme
╭─────────────────────────────────────────────────────────────────╮
│ Chat with Atlas (Acme Corp)                                     │
│ Type /help for commands, /exit to quit                          │
╰─────────────────────────────────────────────────────────────────╯

You: What's the status of our auth rewrite project?

Atlas: Based on my context, the auth rewrite project is at about 60% 
completion. Sarah Chen is the tech lead, and the key decisions made so 
far include:

• OAuth2 + PKCE authentication (decided Jan 15)
• JWT tokens replacing session cookies
• Target ship date: March 15

Current blockers:
• Waiting on DevOps for new IAM roles
• Legacy session migration needs more testing

Would you like me to pull up more details or check with Sarah's 
recent updates?

You: /exit
👋 Goodbye!

# Reload agent configuration
$ goodteams agent reload atlas --tenant acme
♻️  Reloading Atlas configuration...
   → Stopping active sessions...
   → Loading new config...
   → Restarting sessions...
✅ Agent reloaded. 42 sessions restored.
```

#### `goodteams config` — Configuration Management

```bash
# Show current config
$ goodteams config show
GoodTeams Configuration:

Gateway:
  host: 0.0.0.0
  port: 3000
  env: production
  
Database:
  url: postgresql://...
  pool_size: 20
  
Redis:
  url: redis://localhost:6379
  
Features:
  memory: enabled
  cron: enabled
  heartbeat: enabled
  
Channels:
  teams: enabled (3 orgs)
  slack: enabled (2 orgs)
  webchat: enabled

# Edit configuration
$ goodteams config edit
# Opens config in $EDITOR

# Set specific values
$ goodteams config set gateway.port 3001
✅ gateway.port updated: 3000 → 3001
   Restart gateway to apply changes.

# Validate configuration
$ goodteams config validate
Validating configuration...

✅ Database connection OK
✅ Redis connection OK
✅ LLM API keys valid
✅ Channel credentials valid
⚠️  Warning: High memory limit (8GB) may cause issues

Configuration is valid.
```

#### `goodteams status` — Health & Diagnostics

```bash
# Quick status check
$ goodteams status
GoodTeams Status: ✅ Healthy

  Gateway:     ● Running (12345)
  Database:    ● Connected (15ms latency)
  Redis:       ● Connected (2ms latency)
  Channels:    3/3 active
  Agents:      12/12 running

# Detailed diagnostics
$ goodteams status --verbose
═══════════════════════════════════════════════════════════════
                    GoodTeams Diagnostics
═══════════════════════════════════════════════════════════════

System:
  Version:      1.0.0
  Node:         v20.10.0
  Platform:     darwin arm64
  Memory:       245 MB / 8 GB
  CPU:          12% (8 cores)

Gateway:
  Status:       ● Running
  PID:          12345
  Uptime:       2d 4h 32m
  HTTP:         http://localhost:3000
  WebSocket:    ws://localhost:3000/ws
  
Database (PostgreSQL):
  Status:       ● Connected
  Version:      15.2
  Latency:      15ms avg
  Pool:         8/20 connections
  Size:         2.4 GB
  
Redis:
  Status:       ● Connected
  Version:      7.2.0
  Latency:      2ms avg
  Memory:       128 MB
  Queues:       4 active
  
Channels:
  ✅ Teams      3 orgs, 42 active conversations
  ✅ Slack      2 orgs, 28 active conversations
  ✅ Webchat    15 active sessions
  
LLM Providers:
  ✅ Anthropic  API key valid, $1,234 remaining
  ✅ OpenAI     API key valid, $567 remaining

# Run health checks
$ goodteams status --check
Running health checks...

  [1/6] Database connection........ ✅ PASS (15ms)
  [2/6] Redis connection........... ✅ PASS (2ms)
  [3/6] LLM API keys............... ✅ PASS
  [4/6] Channel connectivity....... ✅ PASS
  [5/6] Memory system.............. ✅ PASS
  [6/6] Disk space................. ✅ PASS (45% free)

All checks passed!
```

#### `goodteams db` — Database Operations

```bash
# Database status
$ goodteams db status
Database Status: ● Connected

  Host:         localhost:5432
  Database:     goodteams
  Version:      PostgreSQL 15.2
  Size:         2.4 GB
  Tables:       24
  
  Recent Migrations:
    ✅ 20240203_add_memory_embeddings
    ✅ 20240201_add_session_transcripts
    ✅ 20240128_add_cron_jobs

# Run migrations
$ goodteams db migrate
Checking for pending migrations...

  Pending migrations:
    • 20240205_add_user_preferences
    
  Apply 1 migration? [y/N]: y
  
  Applying 20240205_add_user_preferences...
  ✅ Migration complete.

# Backup database
$ goodteams db backup
Creating database backup...
  → Dumping 24 tables...
  → Compressing...
  → Uploading to S3...
  
✅ Backup complete: goodteams_2024-02-03_091532.sql.gz
   Size: 156 MB
   Location: s3://goodteams-backups/daily/

# Query for debugging
$ goodteams db query "SELECT COUNT(*) FROM users WHERE active = true"
╭───────╮
│ count │
├───────┤
│ 264   │
╰───────╯
```

#### `goodteams logs` — Log Management

```bash
# Stream logs
$ goodteams logs -f
[2024-02-03 09:15:32.123] INFO  [gateway] Request from acme/sarah.chen
[2024-02-03 09:15:32.456] INFO  [agent] Session: acme:sarah:main
[2024-02-03 09:15:33.789] DEBUG [tools] Executing: read /docs/api.md
[2024-02-03 09:15:34.012] INFO  [agent] Response: 823 tokens

# Filter by level
$ goodteams logs --level error
[2024-02-03 08:45:12] ERROR [teams] Connection timeout for Initech
[2024-02-03 07:23:45] ERROR [agent] Tool execution failed: browser

# Filter by tenant
$ goodteams logs --tenant acme --since 1h
[09:15:32] INFO  sarah.chen: "What's the auth project status?"
[09:15:35] INFO  atlas: Response delivered (Teams DM)
[09:12:18] INFO  alex.wong: "Review this API design?"
[09:12:22] INFO  atlas: Response delivered (Slack DM)

# Export for analysis
$ goodteams logs --since 24h --format json > logs.json
Exported 12,456 log entries to logs.json
```

### 7.4 Global Flags

```bash
# All commands support these flags:

--tenant, -t    Target tenant (org ID)
--json          Output in JSON format
--quiet, -q     Suppress non-essential output
--verbose, -v   Show detailed output
--yes, -y       Skip confirmation prompts
--help, -h      Show help
```

### 7.5 Startup Messages (Rotating)

```
"Turning meetings into action items since 2026."
"Your AI teammate who actually reads the docs."
"Because nobody should read 47 Teams messages at 9 AM."
"Hot reload for your workflow, cold brew for your sanity."
"We make teams good. You make them great."
"I speak fluent Jira, mild sarcasm, and aggressive deadline energy."
"Your calendar just got a little less scary."
"Gateway online—please keep all appendages inside the workflow at all times."
```

---

## 8. Implementation Priority Matrix

### P0 — Must Have for Launch

| Feature | OpenClaw Source | Workplace Adaptation | Effort |
|---------|-----------------|---------------------|--------|
| SOUL.md → Org Personas | Personal identity | Multi-level personas | 1 week |
| USER.md → Employee Profile | User context | Role + org integration | 1 week |
| AGENTS.md → Behavioral Policy | Workspace rules | Compliance guardrails | 1 week |
| MEMORY.md → Work Context | Long-term memory | Project/people/decision context | 2 weeks |
| memory_search → Context Search | Semantic search | Work knowledge retrieval | 1 week |
| Heartbeat → Workplace Check-ins | Periodic checks | Email/calendar/task monitoring | 2 weeks |
| Teams Channel | N/A | Build from scratch | 2 weeks |
| Slack Channel | Existing | Adapt for enterprise | 1 week |
| GoodTeams CLI | N/A | Build new | 1 week |

**P0 Total: ~12 weeks**

### P1 — Important for Value

| Feature | OpenClaw Source | Workplace Adaptation | Effort |
|---------|-----------------|---------------------|--------|
| IDENTITY.md → Assistant Branding | Name/avatar | Per-org branding | 3 days |
| Daily Notes → Work Session Logs | Daily logs | Activity tracking | 1 week |
| Long-term Learning → Role Understanding | Preference learning | Professional pattern learning | 2 weeks |
| Background Work → Intelligent Monitoring | Heartbeat work | Autonomous task handling | 2 weeks |
| Audio Transcription | Transcription | Meeting/voice notes | 2 weeks |
| Cron → Work Automation | Scheduling | Status reports, standups | 1 week |

**P1 Total: ~9 weeks**

### P2 — Nice to Have

| Feature | OpenClaw Source | Workplace Adaptation | Effort |
|---------|-----------------|---------------------|--------|
| Discord Channel | Existing | Community/DevRel | 1 week |
| Telegram Channel | Existing | International teams | 1 week |
| WhatsApp Channel | Existing | Regional enterprise | 1 week |
| Email Integration | New | Async communication | 2 weeks |
| Voice Wake | Existing | Hands-free operation | TBD |

**P2 Total: ~6 weeks**

---

## Summary

GoodTeams doesn't strip away OpenClaw's personal assistant magic—it **transplants it into the workplace**:

| OpenClaw Personal Assistant | GoodTeams Workplace Personal Assistant |
|----------------------------|---------------------------------------|
| Remembers your birthday | Remembers your project deadlines |
| Checks your personal calendar | Preps you for meetings with context |
| Learns your communication style | Learns your professional workflow |
| Proactively reminds about tasks | Proactively tracks work obligations |
| Helps with life admin | Helps with work admin |

The result: An AI teammate that knows your role, understands your context, remembers your decisions, and proactively helps you be more effective at work.

**That's the product. That's the vision. Let's build it. 🚀**
