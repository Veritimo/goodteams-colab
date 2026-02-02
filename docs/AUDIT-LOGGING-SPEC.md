# Audit Logging Specification

## 1. Overview

GoodTeams implements a comprehensive audit logging system designed to meet enterprise compliance requirements, enable effective debugging, and provide robust security monitoring capabilities. Every significant action within the platform—whether initiated by users, AI agents, or automated systems—generates an immutable audit record. These records serve as the authoritative source of truth for understanding system behavior, investigating security incidents, demonstrating regulatory compliance (SOC 2, HIPAA, GDPR), and supporting forensic analysis. The audit system is designed for high throughput, low latency writes, and efficient querying across billions of events.

---

## 2. Event Schema

All audit events conform to a standardized JSON schema that ensures consistency, queryability, and interoperability with external security tools. The schema is versioned to support backward-compatible evolution.

### Standard Event Format

```json
{
  "schema_version": "1.0",
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-02-01T23:45:12.847Z",
  "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "actor": {
    "type": "user",
    "id": "u_abc123def456",
    "email": "alice@acmecorp.com",
    "name": "Alice Chen",
    "roles": ["analyst", "kb_editor"]
  },
  "action": "document.read",
  "resource": {
    "type": "document",
    "id": "doc_xyz789",
    "name": "Q4 Financial Summary",
    "path": "/knowledge-base/finance/reports"
  },
  "outcome": "success",
  "details": {
    "access_method": "search_result",
    "query_id": "qry_456",
    "sections_accessed": ["summary", "appendix_a"]
  },
  "risk_level": "low",
  "session_id": "sess_def456ghi789",
  "request_id": "req_unique123",
  "ip_address": "203.0.113.42",
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "geo": {
    "country": "US",
    "region": "CA",
    "city": "San Francisco"
  },
  "correlation_id": "corr_workflow_abc"
}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema_version` | string | Yes | Schema version for forward compatibility |
| `event_id` | UUID | Yes | Globally unique identifier for this event |
| `timestamp` | ISO8601 | Yes | UTC timestamp with millisecond precision |
| `tenant_id` | UUID | Yes | Organization/tenant identifier |
| `actor.type` | enum | Yes | `user`, `agent`, `system`, or `anonymous` |
| `actor.id` | string | Yes | Unique identifier for the actor |
| `actor.email` | string | No | Email address (users only) |
| `actor.name` | string | No | Display name |
| `actor.roles` | array | No | Active roles at time of action |
| `action` | string | Yes | Action identifier in `resource.verb` format |
| `resource.type` | enum | Yes | Resource category being acted upon |
| `resource.id` | string | Yes | Unique identifier of the resource |
| `resource.name` | string | No | Human-readable resource name |
| `resource.path` | string | No | Hierarchical path or location |
| `outcome` | enum | Yes | `success`, `failure`, `pending`, or `partial` |
| `details` | object | No | Action-specific metadata (schema varies by action) |
| `risk_level` | enum | Yes | `low`, `medium`, `high`, or `critical` |
| `session_id` | UUID | No | Session identifier for correlation |
| `request_id` | UUID | No | Unique request identifier |
| `ip_address` | string | No | Client IP address (may be anonymized) |
| `user_agent` | string | No | Client user agent string |
| `geo` | object | No | Geolocation derived from IP |
| `correlation_id` | string | No | Links related events across workflows |

### Actor Types

- **user**: Human users authenticated via SSO/SAML
- **agent**: AI agents executing tasks on behalf of users
- **system**: Automated processes (cron jobs, maintenance tasks)
- **anonymous**: Unauthenticated access attempts

### Resource Types

- **document**: Knowledge base articles, uploaded files
- **query**: SQL queries, search queries, AI prompts
- **message**: Emails, chat messages, notifications
- **workflow**: Automated workflows and approval chains
- **config**: System and security configuration
- **user**: User accounts and profiles
- **role**: Permission roles and assignments
- **integration**: External service connections

---

## 3. Event Catalog

The following table enumerates all audited events in GoodTeams, organized by category.

### Authentication Events

| Event | Action | Risk | Retention | Description |
|-------|--------|------|-----------|-------------|
| User login | `auth.login` | low | 1yr | Successful user authentication |
| Failed login | `auth.login_failed` | medium | 1yr | Authentication failure (wrong password, expired token) |
| Logout | `auth.logout` | low | 90d | User-initiated session termination |
| Session timeout | `auth.session_expired` | low | 90d | Automatic session expiration |
| MFA challenge | `auth.mfa_prompted` | low | 1yr | Multi-factor authentication requested |
| MFA success | `auth.mfa_verified` | low | 1yr | MFA successfully completed |
| MFA failure | `auth.mfa_failed` | high | 1yr | MFA verification failed |
| Password reset request | `auth.password_reset_requested` | medium | 1yr | User requested password reset |
| Password changed | `auth.password_changed` | medium | 1yr | Password successfully changed |
| SSO login | `auth.sso_login` | low | 1yr | Authentication via enterprise SSO |
| API key used | `auth.api_key_used` | low | 1yr | API key authentication |
| API key created | `auth.api_key_created` | medium | 2yr | New API key generated |
| API key revoked | `auth.api_key_revoked` | medium | 2yr | API key invalidated |

### Document & Knowledge Base Events

| Event | Action | Risk | Retention | Description |
|-------|--------|------|-----------|-------------|
| Document access | `document.read` | low | 90d | Knowledge base document accessed |
| Document created | `document.create` | low | 1yr | New document added to KB |
| Document updated | `document.update` | low | 1yr | Document content modified |
| Document deleted | `document.delete` | medium | 2yr | Document removed from KB |
| Document shared | `document.share` | medium | 1yr | Document shared with users/groups |
| Document downloaded | `document.download` | medium | 1yr | Document exported/downloaded |
| Bulk export | `document.bulk_export` | high | 2yr | Multiple documents exported |
| Sensitive doc access | `document.read_sensitive` | high | 2yr | PII/confidential document accessed |

### Query & AI Events

| Event | Action | Risk | Retention | Description |
|-------|--------|------|-----------|-------------|
| SQL query executed | `query.execute` | medium | 1yr | Database query run via natural language |
| Query result viewed | `query.result_viewed` | low | 90d | Query results displayed to user |
| Query result exported | `query.result_exported` | medium | 1yr | Query results downloaded/exported |
| AI prompt submitted | `query.ai_prompt` | low | 1yr | User submitted prompt to AI |
| AI response generated | `query.ai_response` | low | 1yr | AI generated response |
| Query failed | `query.failed` | low | 90d | Query execution error |
| Large result set | `query.large_result` | medium | 1yr | Query returned >10k rows |

### Messaging Events

| Event | Action | Risk | Retention | Description |
|-------|--------|------|-----------|-------------|
| Internal message sent | `message.send_internal` | low | 90d | Message to internal recipient |
| External email sent | `message.send_external` | high | 2yr | Email sent outside organization |
| Message with attachment | `message.attachment_sent` | medium | 1yr | Message included file attachment |
| Bulk messaging | `message.bulk_send` | high | 2yr | Mass communication triggered |
| Message recalled | `message.recalled` | medium | 1yr | Message deleted after sending |

### Workflow & Approval Events

| Event | Action | Risk | Retention | Description |
|-------|--------|------|-----------|-------------|
| Workflow started | `workflow.started` | low | 1yr | Automated workflow initiated |
| Workflow completed | `workflow.completed` | low | 1yr | Workflow finished successfully |
| Workflow failed | `workflow.failed` | medium | 1yr | Workflow encountered error |
| HITL approval requested | `approval.requested` | medium | 2yr | Human-in-the-loop approval needed |
| HITL approval granted | `approval.granted` | high | 2yr | Human approved pending action |
| HITL approval denied | `approval.denied` | high | 2yr | Human rejected pending action |
| Approval timeout | `approval.timeout` | medium | 2yr | Approval request expired |

### Guardrail & Security Events

| Event | Action | Risk | Retention | Description |
|-------|--------|------|-----------|-------------|
| Guardrail triggered | `guardrail.triggered` | high | 2yr | Action blocked by guardrail |
| Guardrail override | `guardrail.override` | critical | 5yr | Guardrail bypassed with approval |
| Rate limit hit | `guardrail.rate_limited` | medium | 1yr | Request throttled |
| PII detected | `guardrail.pii_detected` | high | 2yr | Sensitive data identified |
| Anomaly detected | `security.anomaly` | high | 2yr | Unusual behavior flagged |
| Privilege escalation | `security.privilege_escalation` | critical | 5yr | User gained elevated permissions |

### Configuration Events

| Event | Action | Risk | Retention | Description |
|-------|--------|------|-----------|-------------|
| Config updated | `config.update` | critical | 5yr | Security configuration changed |
| Role created | `config.role_created` | high | 2yr | New permission role defined |
| Role modified | `config.role_modified` | high | 2yr | Role permissions changed |
| Role deleted | `config.role_deleted` | high | 2yr | Permission role removed |
| User role assigned | `config.role_assigned` | high | 2yr | User granted role |
| User role revoked | `config.role_revoked` | high | 2yr | Role removed from user |
| Integration added | `config.integration_added` | high | 2yr | External service connected |
| Integration removed | `config.integration_removed` | high | 2yr | External service disconnected |
| Guardrail configured | `config.guardrail_updated` | critical | 5yr | Guardrail rules modified |

---

## 4. Log Storage

### Storage Architecture

GoodTeams employs a tiered storage architecture optimized for both real-time querying and long-term retention:

**Hot Storage (PostgreSQL)**
- Primary storage for recent events (0-90 days)
- Partitioned by `tenant_id` and `timestamp` for query performance
- Indexed on `actor.id`, `action`, `resource.type`, `risk_level`
- Optimized for sub-second query response on recent data
- Automatic partition management with daily rotation

**Cold Storage (S3/Azure Blob)**
- Archival storage for events beyond hot retention
- Parquet format for efficient compression (typically 10:1 ratio)
- Organized by `tenant_id/year/month/day/` prefix
- Lifecycle policies automatically transition data based on age
- Cross-region replication for disaster recovery

### Security Controls

**Encryption**
- At rest: AES-256 encryption for all storage tiers
- In transit: TLS 1.3 for all data movement
- Customer-managed keys (CMK) available for enterprise tenants

**Immutability**
- Write-once storage policies prevent modification
- Cryptographic checksums verify integrity
- Deletion requires dual-approval workflow
- Compliance hold prevents deletion during legal hold

**Access Controls**
- Audit log access requires explicit `audit:read` permission
- All access to audit logs is itself audited (meta-auditing)
- Tenant isolation enforced at query layer
- Break-glass procedures for emergency access

---

## 5. SIEM Integration

GoodTeams supports real-time streaming of audit events to enterprise Security Information and Event Management (SIEM) systems.

### Splunk Integration

Configure the HTTP Event Collector (HEC) endpoint in GoodTeams:

```yaml
# goodteams-config.yaml
siem:
  provider: splunk
  splunk:
    hec_endpoint: "https://splunk.acmecorp.com:8088/services/collector"
    hec_token: "${SPLUNK_HEC_TOKEN}"  # From environment/secrets
    index: "goodteams_audit"
    source: "goodteams"
    sourcetype: "goodteams:audit:json"
    batch_size: 100
    flush_interval_ms: 5000
    tls_verify: true
    ca_cert_path: "/etc/ssl/certs/splunk-ca.pem"  # Optional
```

**Splunk Search Examples:**
```spl
index=goodteams_audit action="auth.login_failed" 
| stats count by actor.email, ip_address 
| where count > 5

index=goodteams_audit risk_level="critical" 
| timechart span=1h count by action
```

### Microsoft Sentinel Integration

Use the Azure Monitor Data Collector API:

```yaml
# goodteams-config.yaml
siem:
  provider: sentinel
  sentinel:
    workspace_id: "${AZURE_LOG_ANALYTICS_WORKSPACE_ID}"
    shared_key: "${AZURE_LOG_ANALYTICS_KEY}"
    log_type: "GoodTeamsAudit"
    azure_resource_id: "/subscriptions/.../resourceGroups/.../providers/..."
    batch_size: 100
    flush_interval_ms: 5000
```

**KQL Query Examples:**
```kusto
GoodTeamsAudit_CL
| where action_s == "guardrail.triggered"
| summarize count() by actor_email_s, bin(TimeGenerated, 1h)

GoodTeamsAudit_CL
| where risk_level_s in ("high", "critical")
| project TimeGenerated, actor_email_s, action_s, resource_name_s
| order by TimeGenerated desc
```

### Generic Webhook/Syslog

For other SIEM platforms or custom integrations:

```yaml
# goodteams-config.yaml
siem:
  provider: webhook
  webhook:
    endpoint: "https://siem.acmecorp.com/api/events"
    auth_header: "Authorization"
    auth_value: "Bearer ${SIEM_API_TOKEN}"
    format: "json"  # or "cef" for Common Event Format
    batch_size: 50
    flush_interval_ms: 3000
    retry_attempts: 3
    retry_backoff_ms: 1000

# Alternative: Syslog (RFC 5424)
siem:
  provider: syslog
  syslog:
    host: "syslog.acmecorp.com"
    port: 514
    protocol: "tcp"  # tcp, udp, or tls
    facility: "local0"
    format: "cef"  # cef or json
    tls_verify: true
```

### Event Filtering

Reduce noise by filtering events sent to SIEM:

```yaml
siem:
  filters:
    include_risk_levels: ["medium", "high", "critical"]
    include_actions: ["auth.*", "guardrail.*", "config.*"]
    exclude_actions: ["document.read"]
```

---

## 6. Query Examples

### GoodTeams Admin Console Queries

**All actions by a specific user in the last 7 days:**
```sql
SELECT timestamp, action, resource_type, resource_name, outcome, risk_level
FROM audit_events
WHERE tenant_id = :tenant_id
  AND actor_id = :user_id
  AND timestamp > NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC
LIMIT 1000;
```

**All guardrail triggers with details:**
```sql
SELECT 
  timestamp,
  actor_email,
  action,
  details->>'guardrail_name' as guardrail,
  details->>'blocked_action' as blocked_action,
  details->>'reason' as reason
FROM audit_events
WHERE tenant_id = :tenant_id
  AND action LIKE 'guardrail.%'
  AND timestamp > NOW() - INTERVAL '30 days'
ORDER BY timestamp DESC;
```

**All external communications:**
```sql
SELECT 
  timestamp,
  actor_email,
  resource_name,
  details->>'recipient' as recipient,
  details->>'subject' as subject
FROM audit_events
WHERE tenant_id = :tenant_id
  AND action = 'message.send_external'
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

**Failed authentication attempts with geographic context:**
```sql
SELECT 
  timestamp,
  actor_email,
  ip_address,
  geo->>'country' as country,
  geo->>'city' as city,
  details->>'failure_reason' as reason
FROM audit_events
WHERE tenant_id = :tenant_id
  AND action = 'auth.login_failed'
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

**High-risk activity summary by user:**
```sql
SELECT 
  actor_email,
  COUNT(*) as event_count,
  array_agg(DISTINCT action) as actions
FROM audit_events
WHERE tenant_id = :tenant_id
  AND risk_level IN ('high', 'critical')
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY actor_email
ORDER BY event_count DESC
LIMIT 20;
```

---

## 7. Retention Policies

Retention periods are configured per event category to balance compliance requirements, storage costs, and operational needs.

### Default Retention Schedule

| Event Category | Hot Storage | Cold Storage | Total Retention | Compliance Driver |
|----------------|-------------|--------------|-----------------|-------------------|
| Authentication events | 90 days | 275 days | 1 year | SOC 2, ISO 27001 |
| Data access (routine) | 90 days | — | 90 days | Operational |
| Data access (sensitive) | 1 year | 1 year | 2 years | HIPAA, GDPR |
| Security events | 1 year | 1 year | 2 years | SOC 2, PCI-DSS |
| Guardrail triggers | 1 year | 1 year | 2 years | Internal policy |
| Configuration changes | 2 years | 3 years | 5 years | SOC 2, audit trail |
| HITL approvals | 1 year | 1 year | 2 years | Compliance, liability |
| External communications | 1 year | 1 year | 2 years | eDiscovery, compliance |

### Tenant Overrides

Enterprise tenants may configure extended retention to meet industry-specific requirements:

```yaml
# Tenant-specific retention override
retention:
  overrides:
    "auth.*": "7y"      # Financial services requirement
    "config.*": "10y"   # Regulatory requirement
    "document.read_sensitive": "7y"  # HIPAA extended
```

### Legal Hold

When litigation or investigation requires preservation:
- Legal hold suspends automatic deletion
- Applied at tenant or user scope
- Requires `compliance:legal_hold` permission
- Hold release requires dual approval
- All holds are themselves audited

### Data Deletion

Upon retention expiry or valid deletion request:
- Soft delete marks records for removal
- 30-day grace period before hard delete
- Cryptographic erasure for cold storage
- Deletion confirmation logged
- Cannot be reversed after hard delete

---

## Appendix: Schema Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-01 | Initial schema release |

---

*Document version: 1.0 | Last updated: 2026-02-01*
