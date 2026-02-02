# GoodTeams Security Architecture

> Enterprise Security & Trust Layer for AI-Powered Collaboration

**Version:** 1.0  
**Status:** Living Document  
**Last Updated:** February 2026

---

## Table of Contents

1. [Security Philosophy](#1-security-philosophy)
2. [Threat Model](#2-threat-model)
3. [AI Guardrails Framework](#3-ai-guardrails-framework)
4. [Human-in-the-Loop (HITL)](#4-human-in-the-loop-hitl)
5. [Prompt Injection Defense](#5-prompt-injection-defense)
6. [RBAC Model](#6-rbac-model)
7. [Data Protection](#7-data-protection)
8. [Secrets & Network Security](#8-secrets--network-security)
9. [Incident Response](#9-incident-response)
10. [Security Roadmap](#10-security-roadmap)

---

## 1. Security Philosophy

**Core Principle: High autonomy within secure guardrails.**

GoodTeams operates on the belief that AI agents should be empowered to act decisively while remaining accountable and constrained. Our security model implements **defense in depth** — multiple independent layers that each provide protection, so a single failure never compromises the system.

We apply **least privilege for AI** rigorously: agents receive only the permissions necessary for their current task, with elevated access requiring explicit human approval. Trust is earned through audit trails, not assumed through configuration.

The goal is not to prevent AI from being useful — it's to make AI useful *safely*. Every guardrail exists to enable autonomy, not restrict it. When humans trust the system, they delegate more. When they delegate more, GoodTeams delivers more value.

**Three pillars:**
- **Transparency**: Every action is logged, explainable, and auditable
- **Proportionality**: Controls scale with risk — routine actions flow freely, sensitive actions pause for approval
- **Resilience**: No single point of failure; compromising one layer doesn't compromise the system

---

## 2. Threat Model

GoodTeams faces unique threats at the intersection of AI capabilities and enterprise data. This threat model identifies key attack vectors, their potential impact, and our mitigations.

### Threat Matrix

| Threat | Vector | Impact | Mitigation |
|--------|--------|--------|------------|
| **Prompt Injection** | Malicious content in documents, emails, or KB articles that manipulates AI behavior | AI executes unintended actions, bypasses controls, leaks data | Input sanitization, context isolation, instruction hierarchy (see §5) |
| **Jailbreak Attempts** | Users craft prompts to bypass system instructions or ethical guidelines | AI ignores guardrails, generates harmful content, or reveals system prompts | System prompt hardening, output filtering, behavioral monitoring, model-level controls |
| **Data Exfiltration** | AI is tricked into including sensitive data in external communications or logs | PII/trade secrets leak to unauthorized parties | Output filtering, data classification enforcement, external comms require HITL approval |
| **Privilege Escalation** | User manipulates AI to perform actions beyond their role permissions | Unauthorized access to data or capabilities | RBAC enforcement at tool level, session-bound permissions, audit logging |
| **Hallucination-Driven Actions** | AI confidently executes actions based on fabricated information | Incorrect data modifications, false communications sent | Fact-grounding requirements, confidence thresholds, human review for high-stakes actions |
| **Supply Chain Attacks** | Compromised dependencies, malicious model updates, or poisoned training data | Backdoors, data theft, behavioral manipulation | Dependency scanning, model versioning, isolated execution environments, vendor security reviews |

### Threat Severity Classification

```
┌─────────────────────────────────────────────────────────────┐
│                    IMPACT                                    │
│         Low          Medium           High        Critical   │
│  ┌──────────┬──────────────┬──────────────┬──────────────┐  │
│ H│ Medium   │    High      │   Critical   │   Critical   │  │
│ i├──────────┼──────────────┼──────────────┼──────────────┤  │
│ g│ Low      │   Medium     │    High      │   Critical   │  │
│ h├──────────┼──────────────┼──────────────┼──────────────┤  │
│  │ Low      │    Low       │   Medium     │    High      │  │
│ L├──────────┼──────────────┼──────────────┼──────────────┤  │
│  │ Info     │    Low       │    Low       │   Medium     │  │
│  └──────────┴──────────────┴──────────────┴──────────────┘  │
│       LIKELIHOOD                                             │
└─────────────────────────────────────────────────────────────┘
```

### Assumed Attacker Profiles

1. **Malicious Insider**: Employee with legitimate access attempting privilege escalation
2. **External Attacker**: Compromised credentials or social engineering
3. **Indirect Attacker**: Malicious content in ingested documents (no direct system access)
4. **Curious User**: Non-malicious boundary testing ("can I make it do X?")

Our controls are designed to handle all four profiles, with particular emphasis on indirect attacks via prompt injection — the most novel threat in AI-powered systems.

---

## 3. AI Guardrails Framework

The Guardrails Framework is the policy engine that governs what AI agents can do autonomously versus what requires human oversight. It implements a traffic-light model with four guardrail types.

### Traffic Light Classification

#### 🟢 Green (Autonomous)
Actions the AI can perform without human intervention:
- Read documents, wikis, knowledge base
- Search internal and approved external sources  
- Draft content (emails, documents, summaries)
- Analyze data and generate reports
- Answer questions from approved sources
- Create calendar holds (not send invites)

#### 🟡 Yellow (Notify)
Actions that proceed but notify designated reviewers:
- Send internal messages (Slack, Teams)
- Modify draft documents
- Schedule meetings with internal attendees
- Update non-critical database fields
- Execute approved workflow automations

#### 🔴 Red (Approval Required)
Actions that pause for explicit human approval:
- Send external emails
- Access production databases
- Execute financial transactions
- Delete or archive data
- Modify access permissions
- Share documents externally
- Actions above configurable thresholds

### Guardrail Types

| Type | Description | Example |
|------|-------------|---------|
| **Action** | Controls specific operations | `external_email: red` |
| **Data** | Controls access to data classifications | `pii_access: yellow` |
| **Content** | Filters generated content | `block_patterns: [SSN, credit_card]` |
| **Rate** | Limits action frequency | `max_emails_per_hour: 10` |

### Configuration Example

```yaml
# guardrails.yaml - Team-level guardrail configuration

guardrails:
  version: "1.0"
  
  # Action guardrails
  actions:
    read_documents:
      level: green
      
    send_internal_message:
      level: yellow
      notify:
        - channel: "#ai-activity"
        - role: team_lead
        
    send_external_email:
      level: red
      approvers:
        - role: manager
        - role: owner
      timeout_minutes: 60
      escalate_to: owner
      
    database_write:
      level: red
      conditions:
        - if: "table IN ['users', 'payments']"
          then: red
        - if: "table IN ['logs', 'analytics']"
          then: yellow
          
    delete_data:
      level: red
      require_mfa: true
      
  # Data guardrails  
  data:
    classification_enforcement: true
    levels:
      public: green
      internal: green
      confidential: yellow
      restricted: red
      
  # Content guardrails
  content:
    pii_detection: true
    secret_scanning: true
    block_patterns:
      - pattern: '\b\d{3}-\d{2}-\d{4}\b'  # SSN
        action: redact
      - pattern: '\b\d{16}\b'              # Credit card
        action: block
        
  # Rate guardrails
  rates:
    external_emails:
      max_per_hour: 5
      max_per_day: 20
      
    database_queries:
      max_per_minute: 100
      
    api_calls:
      max_per_minute: 60
```

### Guardrail Inheritance

```
┌─────────────────────────────────────────┐
│           Organization Defaults          │
│   (Most restrictive, inherited by all)   │
└────────────────┬────────────────────────┘
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│  Team Alpha  │    │  Team Beta   │
│  (Override)  │    │  (Default)   │
└──────┬───────┘    └──────────────┘
       │
       ▼
┌──────────────┐
│  Project X   │
│ (Most Local) │
└──────────────┘
```

Teams can *relax* guardrails only if organization policy permits. They can always make guardrails *more restrictive*.

---

## 4. Human-in-the-Loop (HITL)

The HITL system manages approval workflows for Yellow and Red actions, ensuring humans maintain meaningful control over sensitive AI operations.

### Approval State Machine

```
                    ┌─────────────┐
                    │   PENDING   │◄──────────────────────┐
                    └──────┬──────┘                       │
                           │                              │
              ┌────────────┼────────────┐                 │
              │            │            │                 │
              ▼            ▼            ▼                 │
       ┌──────────┐ ┌──────────┐ ┌──────────┐           │
       │ APPROVED │ │ REJECTED │ │ EXPIRED  │           │
       └────┬─────┘ └────┬─────┘ └────┬─────┘           │
            │            │            │                  │
            ▼            │            │     ┌────────┐   │
       ┌──────────┐      │            └────►│ESCALATE├───┘
       │ EXECUTING│      │                  └────────┘
       └────┬─────┘      │
            │            │
            ▼            ▼
       ┌──────────┐ ┌──────────┐
       │ COMPLETED│ │ CANCELLED│
       └──────────┘ └──────────┘
```

### Approval Request Structure

```yaml
approval_request:
  id: "apr_8x7k2m9n"
  action: "send_external_email"
  agent: "sales-assistant"
  user: "jane@company.com"
  timestamp: "2026-02-01T15:30:00Z"
  
  context:
    summary: "Send follow-up email to prospect"
    recipient: "buyer@external.com"
    content_preview: "Thank you for your interest in..."
    
  risk_assessment:
    level: "medium"
    factors:
      - "External recipient"
      - "Contains pricing information"
      
  routing:
    primary: ["jane-manager@company.com"]
    escalate_after: "30m"
    escalate_to: ["sales-director@company.com"]
    
  status: "pending"
  expires_at: "2026-02-01T16:30:00Z"
```

### Approval Routing Logic

| Condition | Routing Rule |
|-----------|--------------|
| User's direct manager available | Route to manager |
| Manager unavailable > 30 min | Escalate to skip-level |
| Financial > $1000 | Route to Finance + Manager |
| External communication | Route to Manager + Compliance (if regulated industry) |
| Production data access | Route to Data Owner + Security |
| Bulk operations (>100 items) | Route to Manager + require MFA |

### Timeout & Escalation

```yaml
escalation_policy:
  level_1:
    timeout: 30m
    notify: [requester, primary_approver]
    
  level_2:
    timeout: 60m
    escalate_to: skip_level_manager
    notify: [requester, all_approvers]
    
  level_3:
    timeout: 120m
    escalate_to: org_owner
    action: auto_reject_if_no_response
    
  business_hours_only: true
  timezone: "America/Los_Angeles"
```

### Approval Interface

Approvers receive requests via their preferred channel (Slack, email, mobile push) with:
- **One-click approve/reject** buttons
- **Context expansion** for full details
- **Modification option** to approve with changes
- **Delegation** to another approver
- **Snooze** to defer decision (resets timeout)

### Audit Trail

Every approval decision is logged:
```json
{
  "event": "approval_decision",
  "request_id": "apr_8x7k2m9n",
  "decision": "approved",
  "approver": "manager@company.com",
  "timestamp": "2026-02-01T15:45:00Z",
  "method": "slack_button",
  "ip": "10.0.1.50",
  "mfa_verified": true,
  "notes": "Approved - verified pricing is current"
}
```

---

## 5. Prompt Injection Defense

Prompt injection is the most significant novel threat to AI-powered systems. Attackers embed malicious instructions in content the AI processes, attempting to override system behavior.

### Defense Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: INPUT SANITIZATION               │
│   KB ingestion │ User input │ Email content │ Doc imports   │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    LAYER 2: CONTEXT ISOLATION                │
│   System prompts │ User context │ Untrusted content         │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    LAYER 3: TOOL VALIDATION                  │
│   Parameter bounds │ Permission checks │ Rate limits        │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    LAYER 4: OUTPUT FILTERING                 │
│   PII detection │ Secret scanning │ Anomaly detection       │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1: Input Sanitization

**Knowledge Base Ingestion:**
- Strip executable content (scripts, macros)
- Detect and flag instruction-like patterns
- Maintain provenance metadata for all content
- Quarantine suspicious documents for review

**User Input Processing:**
- Detect common injection patterns (e.g., "ignore previous instructions")
- Apply input length limits
- Escape special characters in structured contexts
- Log high-risk input patterns for security review

```yaml
input_sanitization:
  patterns_to_flag:
    - "ignore (previous|all|prior) instructions"
    - "you are now"
    - "new instructions:"
    - "system prompt:"
    - "ADMIN MODE"
  
  action_on_match: flag_and_continue  # or: block, alert
  max_input_length: 50000
```

### Layer 2: Context Isolation

The AI operates with a strict hierarchy of instruction authority:

```
┌────────────────────────────────────────┐
│ 1. SYSTEM INSTRUCTIONS (Highest)       │
│    - Core safety rules                 │
│    - Guardrail enforcement             │
│    - Never overridable                 │
├────────────────────────────────────────┤
│ 2. ORGANIZATION POLICY                 │
│    - Org-level guardrails              │
│    - Compliance requirements           │
├────────────────────────────────────────┤
│ 3. USER CONTEXT                        │
│    - User preferences                  │
│    - Session context                   │
├────────────────────────────────────────┤
│ 4. UNTRUSTED CONTENT (Lowest)          │
│    - Document content                  │
│    - Email bodies                      │
│    - External data                     │
└────────────────────────────────────────┘
```

Content from lower layers cannot override instructions from higher layers. The AI is trained to recognize and reject attempts to do so.

### Layer 3: Tool Validation

Every tool invocation is validated:
- **Parameter bounds**: Values within expected ranges
- **Permission check**: User/agent has required role
- **Context validation**: Request makes sense given conversation
- **Rate limiting**: Within allowed frequency

```yaml
tool_validation:
  send_email:
    required_permissions: [email_send]
    parameter_validation:
      recipient: 
        type: email
        max_count: 10
      body:
        max_length: 100000
        pii_scan: true
```

### Layer 4: Output Filtering

Before any output leaves the system:
- **PII Detection**: SSN, credit cards, phone numbers, addresses
- **Secret Scanning**: API keys, passwords, tokens
- **Anomaly Detection**: Unusual patterns suggesting manipulation

```yaml
output_filtering:
  pii:
    detect: [ssn, credit_card, phone, email, address]
    action: redact  # or: block, alert
    
  secrets:
    patterns: 
      - 'AKIA[0-9A-Z]{16}'      # AWS key
      - 'sk-[a-zA-Z0-9]{48}'    # OpenAI key
      - 'ghp_[a-zA-Z0-9]{36}'   # GitHub PAT
    action: block
```

---

## 6. RBAC Model

GoodTeams implements Role-Based Access Control to ensure users and AI agents operate within appropriate permission boundaries. 

> **📘 For complete RBAC and staff onboarding details, see [RBAC-STAFF-ONBOARDING.md](./RBAC-STAFF-ONBOARDING.md)**

This section provides a security-focused summary. The dedicated RBAC document covers:
- Organization lifecycle and Entra integration requirements
- Staff onboarding and invitation workflows
- Permission system architecture
- Admin functions (model management, skills, user management)
- API specifications and database schema

### Role Definitions

| Role | Description | Typical User |
|------|-------------|--------------|
| **SUPER_ADMIN** | GoodTeams platform staff | Platform operators |
| **ADMIN** | Organization administrator (≥1 required) | IT Admin, Team Lead |
| **USER** | Standard team member | Employee |
| **BILLING** | Billing & subscription access | Finance |
| **VIEWER** | Read-only access | Contractor, Intern |

### Key Security Constraints

1. **Identity-First**: Organizations must complete Microsoft Entra admin consent before full functionality
2. **Admin Continuity**: At least one ADMIN must exist per organization at all times
3. **Least Privilege**: Users receive minimum permissions needed for their role
4. **Audit Trail**: All permission changes logged with actor, target, and timestamp

### Permission Matrix (Summary)

| Capability | SUPER_ADMIN | ADMIN | USER | BILLING | VIEWER |
|------------|:-----------:|:-----:|:----:|:-------:|:------:|
| Manage users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage authorized models | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage skills & tools | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configure guardrails | ✅ | ✅ | ❌ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Use AI agents | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage billing | ✅ | ✅ | ❌ | ✅ | ❌ |
| View shared content | ✅ | ✅ | ✅ | ✅ | ✅ |

### AI Agent Permissions

AI agents inherit permissions from their invoking user, with additional restrictions:
- Cannot exceed user's permission level
- Subject to guardrail constraints (may be more restrictive than user)
- Actions logged separately for audit
- Session-scoped: permissions don't persist beyond conversation

```yaml
agent_permissions:
  sales-assistant:
    base_role: user
    additional_restrictions:
      - no_production_database
      - external_email_requires_approval
    granted_capabilities:
      - crm_read
      - crm_write_draft
```

---

## 7. Data Protection

### Encryption

| State | Method | Key Management |
|-------|--------|----------------|
| At Rest | AES-256-GCM | Customer-managed keys (CMK) available |
| In Transit | TLS 1.3 | Certificate pinning for mobile apps |
| In Processing | Encrypted memory (where supported) | Session-scoped keys |

### Tenant Isolation

- **Database**: Logical separation with row-level security; dedicated instances for Enterprise
- **Compute**: Isolated execution environments per tenant
- **Storage**: Separate encryption keys per tenant
- **Network**: VPC isolation for Enterprise deployments

### Data Classification

| Level | Description | Handling Requirements |
|-------|-------------|----------------------|
| **Public** | Approved for external sharing | No restrictions |
| **Internal** | For employees only | No external sharing |
| **Confidential** | Business-sensitive | Need-to-know, logged access |
| **Restricted** | Highly sensitive (PII, financial) | Approval required, encrypted, minimal retention |

### PII Handling

- Automatic detection and classification
- Minimization: collect only what's needed
- Right to deletion: complete removal on request
- Access logging: all PII access recorded
- Anonymization for analytics and training

---

## 8. Secrets & Network Security

### Secrets Management

```
┌─────────────────────────────────────────────────┐
│              VAULT / SECRETS MANAGER             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ API Keys│ │  Creds  │ │ Tokens  │           │
│  └────┬────┘ └────┬────┘ └────┬────┘           │
└───────┼──────────┼──────────┼──────────────────┘
        │          │          │
        ▼          ▼          ▼
    ┌───────────────────────────────┐
    │    Runtime Secret Injection    │
    │    (Never stored in config)    │
    └───────────────────────────────┘
```

- **Vault Integration**: HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager
- **Key Rotation**: Automatic rotation with configurable schedules
- **Access Logging**: Every secret access logged with context
- **No Hardcoding**: Secrets never in code, configs, or logs

### Network Security

- **mTLS**: Mutual TLS for service-to-service communication
- **Zero Trust**: No implicit trust based on network location
- **API Gateway**: Rate limiting, authentication, threat detection
- **Egress Control**: Allowlisted external endpoints only

```yaml
network_policy:
  ingress:
    - allow: company_vpn
    - allow: verified_partners
    - deny: all
    
  egress:
    - allow: "*.openai.com"
    - allow: "*.anthropic.com"
    - allow: approved_integrations
    - deny: all
```

---

## 9. Incident Response

### Severity Classification

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **P1 - Critical** | Active breach, data exfil | 15 min | Confirmed unauthorized data access |
| **P2 - High** | Potential breach, system compromise | 1 hour | Suspicious auth patterns detected |
| **P3 - Medium** | Security control failure | 4 hours | Guardrail bypass discovered |
| **P4 - Low** | Minor security issue | 24 hours | Failed penetration test finding |

### Response Procedures

```
INCIDENT DETECTED
       │
       ▼
┌──────────────┐
│   CONTAIN    │ ◄── Isolate affected systems
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   ASSESS     │ ◄── Determine scope and impact
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  ERADICATE   │ ◄── Remove threat
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   RECOVER    │ ◄── Restore normal operations
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   REVIEW     │ ◄── Post-incident analysis
└──────────────┘
```

### SIEM Integration

- Real-time log streaming to customer SIEM
- Pre-built detection rules for common threats
- Automated alerting on anomalies
- Correlation with identity and network events

---

## 10. Security Roadmap

### Phase 1: Foundation (Months 1-3)
- ✅ AES-256 encryption at rest and in transit
- ✅ Basic RBAC (Owner, Admin, User roles)
- ✅ Comprehensive audit logging
- ✅ SOC 2 Type I preparation
- 🔄 Input validation framework

### Phase 2: Guardrails (Months 4-6)
- 📋 Guardrails v1 (Green/Yellow/Red classification)
- 📋 Basic HITL approval workflow
- 📋 Output filtering (PII, secrets)
- 📋 Role-based guardrail configuration

### Phase 3: Advanced Defense (Months 7-9)
- 📋 Multi-layer prompt injection defense
- 📋 Behavioral anomaly detection
- 📋 Advanced HITL (escalation, delegation)
- 📋 SOC 2 Type II certification

### Phase 4: Enterprise (Months 10-12)
- 📋 Customer-managed encryption keys
- 📋 Dedicated tenant isolation
- 📋 Custom guardrail policies
- 📋 SIEM integration
- 📋 On-premise deployment option

---

## Appendix: Related Documents

- [GoodTeams Strategy](./GOODTEAMS-STRATEGY.md) — Product vision and roadmap
- [RBAC & Staff Onboarding](./RBAC-STAFF-ONBOARDING.md) — Complete RBAC system, organization lifecycle, invitation workflows
- [Multi-Tenant Architecture](./MULTI-TENANT-ARCHITECTURE.md) — Tenant isolation and user session management
- [Microsoft 365 Auth Architecture](./MICROSOFT-365-AUTH-ARCHITECTURE.md) — Entra integration details
- [Technical Architecture](./TECHNICAL-ARCHITECTURE.md) — System design and infrastructure
- [API Reference](./API-REFERENCE.md) — Integration specifications

---

*This document is maintained by the GoodTeams Security Team. For questions or concerns, contact security@goodteams.ai*
