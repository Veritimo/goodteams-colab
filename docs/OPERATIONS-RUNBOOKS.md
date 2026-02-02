# Operations Runbooks

Standardized procedures for operating GoodTeams in production environments. This document covers incident response, routine maintenance, and common operational tasks. All team members with production access should be familiar with these procedures.

**Scope:** Production operations for GoodTeams SaaS platform including tenant management, gateway operations, and incident response.

**Audience:** Operations engineers, on-call responders, and platform administrators.

---

## Incident Classification

All production incidents must be classified by severity to ensure appropriate response times and escalation paths. When in doubt, classify higher and downgrade after assessment.

| Severity | Name | Criteria | Response Time | Examples |
|----------|------|----------|---------------|----------|
| **P1** | Critical | Complete service outage affecting all tenants, data breach, or security incident | 15 minutes | Total platform outage, database corruption, security breach, data exposure |
| **P2** | High | Major feature broken affecting multiple tenants, authentication failures, or AI capabilities unavailable | 1 hour | Auth provider down, AI model failures, gateway crashes, payment processing broken |
| **P3** | Medium | Degraded performance, partial outage, or single tenant affected | 4 hours | Slow query performance, single gateway unhealthy, webhook delays, minor data sync issues |
| **P4** | Low | Minor issues with workarounds available, cosmetic bugs, non-critical features | 24 hours | UI rendering bugs, documentation errors, non-critical integrations, feature requests |

**Classification Guidelines:**
- Customer-reported issues start at P3 minimum until assessed
- Security-related issues start at P2 minimum
- Data integrity issues are always P1
- When multiple severities apply, use the highest

---

## Incident Response Playbook

### P1/P2 Response Procedure

```
1. ALERT RECEIVED
   └─▶ Acknowledge in PagerDuty (5 min SLA)
   └─▶ Join incident bridge: #incident-room (Slack huddle)
   └─▶ Claim incident commander role

2. ASSESS
   └─▶ Check status dashboard: https://status.goodteams.ai/internal
   └─▶ Review recent deployments: goodteams deploy list --last 24h
   └─▶ Identify affected tenants: goodteams tenant list --status unhealthy
   └─▶ Classify severity (upgrade/downgrade as needed)
   └─▶ Document initial findings in incident channel

3. COMMUNICATE
   └─▶ Update status page (public): https://status.goodteams.ai
   └─▶ Post to internal Slack: #incidents
   └─▶ Customer notification via email (P1 only, within 30 min)
   └─▶ Executive notification (P1 only, within 15 min)

4. MITIGATE
   └─▶ Apply immediate fix if known and safe
   └─▶ Rollback recent deployment: goodteams deploy rollback --confirm
   └─▶ Failover to secondary: goodteams failover execute --region backup
   └─▶ Escalate if mitigation fails after 30 min

5. RESOLVE
   └─▶ Verify fix across all affected tenants
   └─▶ Run health checks: goodteams health check --comprehensive
   └─▶ Update status page to "Resolved"
   └─▶ Close PagerDuty incident
   └─▶ Send all-clear to stakeholders

6. POST-MORTEM (within 5 business days)
   └─▶ Create incident document from template
   └─▶ Build detailed timeline
   └─▶ Identify root cause (5 Whys analysis)
   └─▶ Define action items with owners and due dates
   └─▶ Schedule post-mortem review meeting
   └─▶ Share learnings in #engineering
```

### P3/P4 Response Procedure

```
1. ACKNOWLEDGE
   └─▶ Respond to alert/ticket within SLA
   └─▶ Assign owner

2. INVESTIGATE
   └─▶ Gather logs and metrics
   └─▶ Reproduce if possible
   └─▶ Document findings

3. RESOLVE
   └─▶ Apply fix or schedule for next sprint
   └─▶ Update ticket with resolution
   └─▶ Notify reporter
```

### Escalation Matrix

| Role | P1 | P2 | P3 | P4 |
|------|----|----|----|----|
| On-call engineer | Immediate | Immediate | Next business day | Next sprint |
| Engineering lead | 15 min | 1 hour | As needed | - |
| VP Engineering | 30 min | 4 hours | - | - |
| CEO | 1 hour | As needed | - | - |
| Legal/Compliance | 1 hour (security) | 4 hours (security) | - | - |
| Customer Success | 30 min | 2 hours | Next business day | - |

### Incident Commander Responsibilities

- Own the incident until resolution or handoff
- Coordinate response across teams
- Make go/no-go decisions on mitigation steps
- Ensure communications are sent on schedule
- Document key decisions and timestamps
- Initiate post-mortem process

---

## Common Operations

### Tenant Onboarding

Complete procedure for provisioning a new enterprise tenant.

```bash
# 1. Create tenant record
goodteams tenant create \
  --name "Acme Corp" \
  --slug acme-corp \
  --plan enterprise \
  --contact-email admin@acme.com

# 2. Provision gateway in preferred region
goodteams gateway provision \
  --tenant acme-corp \
  --region us-west \
  --size medium

# 3. Configure authentication provider
goodteams auth setup \
  --tenant acme-corp \
  --provider entra \
  --tenant-id <azure-tenant-id> \
  --client-id <app-client-id>

# 4. Set up guardrails and policies
goodteams guardrails set \
  --tenant acme-corp \
  --max-tokens 100000 \
  --allowed-models "gpt-4,claude-3"

# 5. Configure integrations
goodteams integrations enable \
  --tenant acme-corp \
  --integration slack \
  --webhook-url <slack-webhook>

# 6. Verify tenant is healthy
goodteams tenant status --name acme-corp --verbose

# 7. Send welcome email
goodteams tenant notify \
  --name acme-corp \
  --template welcome \
  --to admin@acme.com
```

**Verification Checklist:**
- [ ] Gateway responds to health checks
- [ ] Authentication flow works end-to-end
- [ ] AI model access confirmed
- [ ] Integrations connected
- [ ] Admin user can log in
- [ ] Welcome email delivered

### Tenant Offboarding

Procedure for decommissioning a tenant with data retention compliance.

```bash
# 1. Disable tenant (starts grace period)
goodteams tenant disable \
  --name acme-corp \
  --grace-days 30 \
  --reason "Contract ended"

# 2. Notify tenant admins
goodteams tenant notify \
  --name acme-corp \
  --template offboarding \
  --to admin@acme.com

# 3. Export data if requested (within grace period)
goodteams data export \
  --tenant acme-corp \
  --format json \
  --include conversations,users,audit-logs \
  --output /exports/acme-corp-$(date +%Y%m%d).tar.gz

# 4. After grace period: delete tenant and all data
goodteams tenant delete \
  --name acme-corp \
  --confirm \
  --audit-reason "Offboarding complete per ticket #12345"
```

**Important:** Data exports must be delivered via secure channel. Never email exports directly.

### Gateway Maintenance

Routine gateway operations for health and performance.

```bash
# Rolling restart (zero downtime)
goodteams gateway restart \
  --tenant acme-corp \
  --rolling \
  --delay 30s

# Update gateway version
goodteams gateway update \
  --tenant acme-corp \
  --version 2.1.0 \
  --rolling

# Scale gateway resources (vertical)
goodteams gateway scale \
  --tenant acme-corp \
  --memory 512MB \
  --cpu 0.5

# Scale gateway replicas (horizontal)
goodteams gateway replicas \
  --tenant acme-corp \
  --count 3

# View gateway logs
goodteams gateway logs \
  --tenant acme-corp \
  --since 1h \
  --level error

# Check gateway metrics
goodteams gateway metrics \
  --tenant acme-corp \
  --period 24h
```

### Emergency Procedures

Use these commands only during active incidents.

```bash
# Force kill runaway gateway process
goodteams gateway kill \
  --tenant acme-corp \
  --force \
  --reason "Runaway process consuming 100% CPU"

# Disable AI capabilities for tenant (safety measure)
goodteams guardrails set \
  --tenant acme-corp \
  --ai-enabled false \
  --reason "Safety incident investigation"

# Enable maintenance mode (blocks user access)
goodteams tenant maintenance \
  --name acme-corp \
  --enable \
  --message "Scheduled maintenance in progress. Back shortly."

# Disable maintenance mode
goodteams tenant maintenance \
  --name acme-corp \
  --disable

# Emergency failover to backup region
goodteams failover execute \
  --tenant acme-corp \
  --target-region us-east \
  --confirm

# Quarantine tenant (security incident)
goodteams tenant quarantine \
  --name acme-corp \
  --reason "Security investigation" \
  --ticket SEC-456
```

---

## Monitoring and Alerts

### Key Metrics

| Metric | Warning Threshold | Critical Threshold | Recommended Action |
|--------|-------------------|--------------------|--------------------|
| Gateway health | <99% | <95% | Restart unhealthy instances, investigate logs |
| Response latency p99 | >2s | >5s | Scale up resources, check for slow queries |
| Error rate (5xx) | >1% | >5% | Investigate errors, consider rollback |
| CPU usage | >70% | >90% | Scale up or add replicas |
| Memory usage | >75% | >90% | Restart to clear leaks, scale up |
| Disk usage | >80% | >90% | Run cleanup, expand storage |
| Queue depth | >1000 | >5000 | Scale consumers, investigate backlog |
| Active connections | >80% pool | >95% pool | Scale database, check for leaks |
| Certificate expiry | <30 days | <7 days | Renew certificates immediately |

### Alert Routing

| Severity | Primary Channel | Secondary | Notification |
|----------|-----------------|-----------|--------------|
| P1 | PagerDuty (phone) | Slack #incidents | All stakeholders |
| P2 | PagerDuty (push) | Slack #incidents | Engineering lead |
| P3 | Slack #alerts | Jira ticket | On-call only |
| P4 | Jira ticket | - | Assigned engineer |

### Dashboard Links

- **Operations Dashboard:** https://grafana.goodteams.ai/d/ops
- **Tenant Health:** https://grafana.goodteams.ai/d/tenants
- **Gateway Metrics:** https://grafana.goodteams.ai/d/gateways
- **Error Tracking:** https://sentry.goodteams.ai
- **Status Page (internal):** https://status.goodteams.ai/internal
- **Status Page (public):** https://status.goodteams.ai

---

## Maintenance Windows

### Standard Maintenance

- **Window:** Sunday 02:00-06:00 UTC
- **Advance Notice:** 72 hours minimum
- **Scope:** Non-breaking updates, routine maintenance, security patches

### Emergency Maintenance

- **Window:** As needed for P1 incidents
- **Advance Notice:** 4 hours when possible, immediate if critical
- **Scope:** Security patches, critical fixes, data integrity issues

### Maintenance Process

```
1. ANNOUNCE (72h before standard, 4h before emergency)
   └─▶ Update status page: "Scheduled Maintenance"
   └─▶ Email affected tenants
   └─▶ Post to #announcements

2. EXECUTE (during window)
   └─▶ Enable maintenance mode for affected services
   └─▶ Perform maintenance tasks
   └─▶ Run verification tests

3. VERIFY
   └─▶ Health checks pass: goodteams health check --all
   └─▶ Smoke tests pass: goodteams test smoke --production
   └─▶ Monitor error rates for 15 minutes

4. CLOSE
   └─▶ Disable maintenance mode
   └─▶ Update status page: "Operational"
   └─▶ Send completion notification
   └─▶ Document any issues encountered
```

### Change Freeze Periods

- 2 weeks before and after major product launches
- Last 2 weeks of each quarter (finance close)
- Major holidays (company calendar)

Emergency security patches exempt from freeze with VP approval.

---

## Runbook Template

Use this template when creating new runbooks for specific procedures.

```markdown
# Runbook: [Descriptive Name]

**Owner:** [Team or individual]
**Last Updated:** [YYYY-MM-DD]
**Review Frequency:** [Quarterly/Annually]
**Related Incidents:** [Link to relevant past incidents]

## Purpose

Brief description of what this runbook accomplishes and when to use it.

## Prerequisites

- Required access levels
- Tools needed
- Environment requirements
- Dependencies

## Procedure

Step-by-step instructions with commands and expected output.

## Verification

How to confirm the procedure completed successfully.

## Rollback

Steps to undo changes if something goes wrong.

## Troubleshooting

Common issues and their solutions.

## Related

- Links to related runbooks
- External documentation
- Relevant architecture docs
```

---

## Quick Reference

### Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-call | PagerDuty | Automatic |
| Security | security@goodteams.ai | P1 immediate |
| Legal | legal@goodteams.ai | Data breach |
| Customer Success | cs@goodteams.ai | Customer comms |

### Common Commands

```bash
# Check overall system health
goodteams health check --all

# List unhealthy tenants
goodteams tenant list --status unhealthy

# View recent deployments
goodteams deploy list --last 24h

# Rollback last deployment
goodteams deploy rollback --confirm

# Emergency: disable all AI
goodteams guardrails global --ai-enabled false --confirm
```

---

*Last updated: 2026-02-01*
*Document owner: Platform Operations Team*
