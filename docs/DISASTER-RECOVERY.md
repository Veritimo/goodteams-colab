# Disaster Recovery & Business Continuity

## 1. Overview

This document defines the disaster recovery (DR) and business continuity (BC) procedures for GoodTeams. It establishes recovery objectives, backup procedures, failover architecture, and incident response protocols to ensure service availability and data integrity during adverse events.

The goal is to minimize downtime and data loss while providing clear procedures for the operations team. All team members with production access must be familiar with these procedures and participate in regular DR drills.

This plan covers infrastructure failures, data corruption, security incidents, and regional outages. It should be reviewed quarterly and updated whenever significant architecture changes occur.

---

## 2. Recovery Objectives

Recovery objectives are organized into three tiers based on business criticality:

| Tier | Services | RTO | RPO | Examples |
|------|----------|-----|-----|----------|
| **Tier 1** | Core AI, Authentication | 1 hour | 5 minutes | Gateway, Control Plane, Auth Service |
| **Tier 2** | Knowledge Base, Workflows | 4 hours | 1 hour | Vector DB, Cron Scheduler, Integrations |
| **Tier 3** | Analytics, Archive | 24 hours | 24 hours | Dashboards, Cold Logs, Reports |

### Definitions

- **RTO (Recovery Time Objective):** Maximum acceptable time from incident detection to service restoration.
- **RPO (Recovery Point Objective):** Maximum acceptable data loss measured in time. An RPO of 5 minutes means we can lose at most 5 minutes of data.

### Tier 1 — Mission Critical

These services directly impact customer AI interactions. Any downtime results in complete service unavailability for end users. Gateway and Control Plane require hot standby replicas with automatic failover.

### Tier 2 — Business Critical

Services that enhance AI capabilities but don't prevent basic operation. Knowledge base unavailability degrades response quality but doesn't halt service. Workflows can queue and retry.

### Tier 3 — Operational

Supporting services for internal operations and compliance. Extended downtime is acceptable as long as data is eventually recovered.

---

## 3. Backup Procedures

### Databases

#### PostgreSQL (Primary Data Store)

- **Continuous WAL Archiving:** Write-ahead logs streamed to object storage every 60 seconds
- **Daily Snapshots:** Full database snapshots at 02:00 UTC
- **Retention:** 7 daily snapshots, 4 weekly snapshots, 12 monthly snapshots
- **Cross-Region Replication:** WAL files replicated to secondary region within 5 minutes

```bash
# Manual snapshot (emergency)
pg_basebackup -D /backup/pg_$(date +%Y%m%d) -Ft -z -P

# Verify WAL shipping status
SELECT * FROM pg_stat_replication;
```

#### Vector Database

- **Daily Exports:** Full vector index export to object storage at 03:00 UTC
- **Incremental Backups:** Hourly delta exports of modified vectors
- **Retention:** 30 daily exports, 12 monthly exports
- **Format:** Native format + portable JSON for disaster scenarios

#### Redis (Session & Cache)

- **AOF (Append-Only File):** Enabled with `everysec` fsync policy
- **RDB Snapshots:** Every 15 minutes if at least 100 keys changed
- **Retention:** 48 hours of AOF, 7 days of RDB snapshots
- **Note:** Cache data is reconstructible; prioritize fast restart over full recovery

### Configuration

#### Tenant Configurations

- **Version Control:** All tenant configs stored in Git with full history
- **Daily Backup:** Exported to encrypted object storage
- **Encryption:** AES-256 at rest, tenant-specific encryption keys

#### Secrets Management

- **Vault Snapshots:** Hourly snapshots of HashiCorp Vault
- **Key Escrow:** Master keys stored in geographically separate HSMs
- **Rotation:** Automatic key rotation every 90 days

### Artifacts

#### User Documents

- **Object Storage:** S3-compatible storage with versioning enabled
- **Retention:** All versions retained for 90 days, then latest only
- **Cross-Region:** Automatic replication to secondary region
- **Checksums:** SHA-256 verification on upload and periodic integrity scans

#### Audit Logs

- **Immutable Archive:** Write-once storage with legal hold capability
- **Retention:** 7 years for compliance
- **Format:** JSON Lines with cryptographic chaining

### Backup Verification

| Test | Frequency | Owner |
|------|-----------|-------|
| PostgreSQL restore to staging | Weekly | Database Team |
| Vector DB restore verification | Weekly | ML Platform Team |
| Full tenant data recovery drill | Monthly | SRE Team |
| Cross-region backup integrity | Monthly | Infrastructure Team |

All backup verification results are logged and reviewed. Failed verifications trigger immediate investigation and P2 incident creation.

---

## 4. Failover Architecture

### Multi-Region Topology

```
                              Global Load Balancer
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
          Primary Region (us-west)           Secondary Region (us-east)
         ┌─────────────────────────┐        ┌─────────────────────────┐
         │                         │        │                         │
         │  ┌─────────────────┐   │        │  ┌─────────────────┐   │
         │  │  Control Plane  │───┼────────┼─▶│ Control Plane   │   │
         │  │     (active)    │   │  sync  │  │   (hot standby) │   │
         │  └─────────────────┘   │        │  └─────────────────┘   │
         │                         │        │                         │
         │  ┌─────────────────┐   │        │  ┌─────────────────┐   │
         │  │  Gateway Pool   │   │        │  │  Gateway Pool   │   │
         │  │   (N instances) │   │        │  │ (warm standby)  │   │
         │  └─────────────────┘   │        │  └─────────────────┘   │
         │                         │        │                         │
         │  ┌─────────────────┐   │        │  ┌─────────────────┐   │
         │  │   PostgreSQL    │───┼────────┼─▶│   PostgreSQL    │   │
         │  │    (primary)    │   │  WAL   │  │    (replica)    │   │
         │  └─────────────────┘   │ stream │  └─────────────────┘   │
         │                         │        │                         │
         │  ┌─────────────────┐   │        │  ┌─────────────────┐   │
         │  │   Vector DB     │───┼────────┼─▶│   Vector DB     │   │
         │  │    (primary)    │   │  async │  │    (replica)    │   │
         │  └─────────────────┘   │        │  └─────────────────┘   │
         │                         │        │                         │
         └─────────────────────────┘        └─────────────────────────┘
```

### Failover Triggers

#### Automatic Failover

- **Health Check Failures:** 3 consecutive failures (30-second intervals) triggers automatic failover for stateless services
- **Database Replication Lag:** If lag exceeds 60 seconds, alerts fire; if lag exceeds 5 minutes, manual review required
- **Resource Exhaustion:** CPU > 95% or memory > 90% for 5 minutes triggers scale-out or failover

#### Manual Failover

Operator-initiated failover via runbook for:
- Planned maintenance windows
- Security incidents requiring isolation
- Partial failures not detected by automated monitoring

```bash
# Initiate manual regional failover
goodteams-ctl failover initiate --target us-east --reason "maintenance"

# Verify failover status
goodteams-ctl failover status
```

### DNS Failover

- **Primary:** Route53 health checks with 10-second intervals
- **Backup:** Cloudflare as secondary DNS with independent health monitoring
- **TTL:** 60 seconds for critical endpoints to enable fast failover
- **Failover Time:** DNS propagation typically completes within 2-5 minutes

### Standby Modes

| Component | Standby Mode | Sync Method | Activation Time |
|-----------|--------------|-------------|-----------------|
| Control Plane | Hot | Real-time state sync | < 30 seconds |
| Gateway Pool | Warm | Config sync, cold processes | 2-5 minutes |
| PostgreSQL | Hot | Streaming replication | < 1 minute |
| Vector DB | Warm | Async replication | 5-10 minutes |

---

## 5. Recovery Procedures

### Scenario 1: Single Gateway Failure

**Symptoms:** Individual gateway stops responding to health checks; tenant connections drop.

**Automated Response:**
1. Health check detects failure (30 seconds)
2. Load balancer removes instance from rotation (immediate)
3. Provisioner spawns replacement gateway (60 seconds)
4. New gateway pulls tenant configuration (30 seconds)
5. Ingress routes traffic to new instance (immediate)

**Total Recovery Time:** ~2 minutes

**Manual Intervention Required If:**
- Replacement fails to spawn after 3 attempts
- Multiple gateways fail simultaneously (escalate to Scenario 2)

```bash
# Check gateway health
goodteams-ctl gateway status --all

# Force replacement
goodteams-ctl gateway replace --id <gateway-id> --reason "manual recovery"
```

### Scenario 2: VM/Node Failure

**Symptoms:** All gateways on a single node become unreachable; node health checks fail.

**Response Procedure:**
1. **Detection** (0-2 minutes): Node health monitor detects failure
2. **Tenant Redistribution** (2-5 minutes): Control plane redistributes affected tenants to healthy nodes
3. **Capacity Assessment** (5-7 minutes): Evaluate if additional capacity needed
4. **Node Provisioning** (7-10 minutes): If needed, provision replacement node

**Total Recovery Time:** ~10 minutes

**Runbook:**
```bash
# List affected tenants
goodteams-ctl node tenants --node <node-id>

# Trigger redistribution
goodteams-ctl tenants redistribute --from <node-id>

# Provision replacement node
goodteams-ctl node provision --region us-west --size large
```

### Scenario 3: Primary Database Failure

**Symptoms:** Database connections fail; write operations error; replication alerts fire.

**Automated Response:**
1. **Detection** (0-30 seconds): Connection pool exhaustion or replication monitor alert
2. **Failover Initiation** (30-60 seconds): Automated promotion of replica
3. **Replica Promotion** (1-2 minutes): Replica becomes primary
4. **Connection String Update** (2-3 minutes): Services reconnect to new primary
5. **Verification** (3-5 minutes): Data integrity checks

**Total Recovery Time:** ~5 minutes

**Post-Failover Actions:**
- Provision new replica from promoted primary
- Investigate root cause of original primary failure
- Update runbooks if new failure mode discovered

```bash
# Check replication status
goodteams-ctl db replication-status

# Manual failover (if automated fails)
goodteams-ctl db failover --promote us-east-replica

# Verify data integrity
goodteams-ctl db verify --checksum --tables critical
```

### Scenario 4: Region Failure

**Symptoms:** Complete loss of connectivity to primary region; all services in region unreachable.

**Response Procedure:**
1. **Detection & Confirmation** (0-5 minutes): Verify actual region failure vs. network partition
2. **Decision Point** (5-10 minutes): Incident Commander authorizes regional failover
3. **DNS Failover** (10-15 minutes): Update DNS to point to secondary region
4. **Gateway Activation** (15-25 minutes): Scale up warm standby gateways
5. **Data Verification** (25-40 minutes): Verify data consistency, accept RPO data loss
6. **Customer Communication** (40-60 minutes): Status page update, customer notification

**Total Recovery Time:** 30-60 minutes

**Critical Decisions:**
- Accept potential data loss up to RPO (5 minutes for Tier 1)
- Determine if split-brain scenario is possible
- Plan for failback once primary region recovers

```bash
# Initiate regional failover
goodteams-ctl failover initiate \
  --target us-east \
  --reason "us-west region failure" \
  --ic-approval <incident-id>

# Scale secondary gateways
goodteams-ctl gateway scale --region us-east --count 20

# Verify tenant accessibility
goodteams-ctl tenants verify --all --region us-east
```

---

## 6. Communication Plan

### Status Page

- **URL:** https://status.goodteams.ai
- **Provider:** Statuspage.io with independent infrastructure
- **Updates:** Every 15 minutes during active incidents

### Internal Communication

| Channel | Purpose | Escalation Time |
|---------|---------|-----------------|
| #incidents (Slack) | Real-time coordination | Immediate |
| PagerDuty | On-call alerting | Immediate |
| Incident Bridge (Zoom) | Voice coordination | P1/P2 incidents |
| Email: incidents@goodteams.ai | Async updates | Within 1 hour |

### Customer Communication

| Incident Severity | Notification Method | Timeline |
|-------------------|--------------------| ---------|
| P1 (Tier 1 down) | Email + Status Page + In-app | Within 30 minutes |
| P2 (Tier 2 down) | Status Page + In-app | Within 1 hour |
| P3 (Tier 3 down) | Status Page | Within 4 hours |

### Communication Templates

**Initial Notification:**
> We are currently investigating an issue affecting [SERVICE]. Some users may experience [SYMPTOMS]. We will provide updates every 15 minutes.

**Resolution Notification:**
> The issue affecting [SERVICE] has been resolved. Service has been fully restored as of [TIME]. A detailed incident report will be published within 5 business days.

### Post-Incident

- **RCA (Root Cause Analysis):** Published within 5 business days for P1/P2
- **Customer Report:** Sanitized RCA shared with affected enterprise customers
- **Internal Review:** Blameless post-mortem within 72 hours

---

## 7. Testing Schedule

Regular DR testing ensures procedures remain effective and team members stay proficient.

| Test Type | Frequency | Duration | Owner | Last Passed |
|-----------|-----------|----------|-------|-------------|
| Backup Restore | Weekly | 1 hour | Database Team | — |
| Gateway Failover | Monthly | 30 min | SRE Team | — |
| Database Failover | Quarterly | 2 hours | Database Team | — |
| Region Failover | Annually | 4 hours | Infrastructure Team | — |
| Full DR Drill | Annually | 8 hours | All Teams | — |

### Test Procedures

**Weekly Backup Restore:**
- Restore latest PostgreSQL backup to isolated environment
- Verify data integrity with checksums
- Test application connectivity

**Monthly Gateway Failover:**
- Simulate gateway failure in staging
- Verify automatic replacement
- Measure actual recovery time vs. target

**Quarterly Database Failover:**
- Perform controlled failover to replica
- Measure replication lag and data loss
- Practice failback procedure

**Annual Region Failover:**
- Full regional failover drill (off-peak hours)
- Customer notification (marked as drill)
- Measure end-to-end recovery time

### Test Results

All test results must be documented with:
- Actual recovery time vs. objective
- Any issues encountered
- Action items for improvement
- Sign-off from test owner

---

## 8. Roles & Responsibilities

### Incident Response Team

#### Incident Commander (IC)

- **Responsibility:** Overall incident ownership and decision authority
- **Actions:**
  - Declares incident severity
  - Authorizes major actions (failover, customer comms)
  - Coordinates between teams
  - Conducts post-incident review

#### Technical Lead (TL)

- **Responsibility:** Technical investigation and remediation
- **Actions:**
  - Diagnoses root cause
  - Executes recovery procedures
  - Coordinates engineering resources
  - Documents technical timeline

#### Communications Lead (CL)

- **Responsibility:** Internal and external communications
- **Actions:**
  - Updates status page
  - Drafts customer notifications
  - Manages incident bridge
  - Coordinates with support team

### On-Call Rotation

| Role | Schedule | Escalation |
|------|----------|------------|
| Primary On-Call | Weekly rotation | Responds within 5 minutes |
| Secondary On-Call | Weekly rotation | Escalation after 15 minutes |
| IC On-Call | Weekly rotation | Engaged for P1/P2 |

### Escalation Matrix

| Time Since Alert | Action |
|------------------|--------|
| 0-5 minutes | Primary on-call paged |
| 5-15 minutes | Secondary on-call paged |
| 15-30 minutes | Engineering manager notified |
| 30+ minutes | VP Engineering notified |
| P1 declared | IC engaged, exec notification |

### Training Requirements

- All on-call engineers must complete DR training quarterly
- IC certification required before joining IC rotation
- Participation in at least one DR drill annually

---

## Appendix A: Quick Reference

### Emergency Contacts

| Role | Contact |
|------|---------|
| On-Call | PagerDuty: goodteams-oncall |
| IC Escalation | PagerDuty: goodteams-ic |
| Security | security@goodteams.ai |

### Critical Commands

```bash
# Check system health
goodteams-ctl health --all

# Initiate failover
goodteams-ctl failover initiate --target <region>

# Scale gateways
goodteams-ctl gateway scale --count <n>

# Database status
goodteams-ctl db status --replication
```

### Key URLs

- Status Page: https://status.goodteams.ai
- Runbooks: https://runbooks.internal.goodteams.ai
- Monitoring: https://grafana.internal.goodteams.ai

---

*Last Updated: February 2026*
*Next Review: May 2026*
*Owner: SRE Team*
