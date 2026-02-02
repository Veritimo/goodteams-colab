# GoodTeams Compliance Matrix

> **Living Document** | Last Updated: February 2026 | Owner: Security & Compliance Team

---

## 1. Overview

This document maps GoodTeams platform capabilities to major regulatory and compliance framework requirements. It serves as a reference for auditors, customers conducting vendor assessments, and internal teams maintaining compliance posture.

GoodTeams is designed with compliance-first architecture, implementing controls that satisfy overlapping requirements across SOC2 Type II, GDPR, HIPAA, and ISO 27001 frameworks. Each control is mapped to specific platform features, with evidence locations documented for audit efficiency.

**Scope**: This matrix covers the GoodTeams SaaS platform, including all AI agent capabilities, data processing pipelines, and administrative interfaces. Self-hosted deployments may require additional customer-side controls.

---

## 2. SOC2 Type II Controls

SOC2 Type II certification validates that GoodTeams maintains effective controls over an extended audit period (typically 6-12 months). The following tables map Trust Service Criteria to platform implementations.

### 2.1 Common Criteria (CC) — Security

| Control ID | Criteria | GoodTeams Implementation | Evidence Location |
|------------|----------|--------------------------|-------------------|
| **CC1.1** | Integrity and ethical values | Code of conduct policy, AI guardrails configuration, ethical use guidelines | `/policies/code-of-conduct.md`, Guardrails config |
| **CC1.2** | Board oversight | Quarterly security reviews, compliance committee charter | Board minutes, committee records |
| **CC1.3** | Organizational structure | Defined security roles, RACI matrix for incident response | Org chart, `/docs/INCIDENT-RESPONSE.md` |
| **CC1.4** | Commitment to competence | Security training requirements, certification tracking | Training records, HR system |
| **CC1.5** | Accountability | Performance metrics tied to security objectives | Performance review templates |
| **CC2.1** | Information quality | Data validation pipelines, input sanitization | Code review, test suites |
| **CC2.2** | Internal communication | Security awareness program, policy distribution | Training completion logs |
| **CC2.3** | External communication | Privacy policy, terms of service, breach notification procedures | Public docs, notification templates |
| **CC3.1** | Risk assessment | Annual risk assessment, threat modeling for new features | Risk register, threat models |
| **CC3.2** | Risk identification | Vulnerability scanning, penetration testing schedule | Scan reports, pentest results |
| **CC3.3** | Fraud risk | Abuse detection systems, anomaly monitoring | Alert configurations, incident logs |
| **CC3.4** | Change impact analysis | Security review gates in CI/CD, architectural decision records | PR reviews, ADR docs |
| **CC4.1** | Monitoring activities | Continuous control monitoring, automated compliance checks | Dashboard metrics, alert history |
| **CC4.2** | Control deficiency evaluation | Issue tracking, remediation SLAs | JIRA/issue tracker, SLA reports |
| **CC5.1** | Control activities selection | Risk-based control selection, defense in depth | Security architecture docs |
| **CC5.2** | Technology controls | See CC6.x and CC7.x below | — |
| **CC5.3** | Policy deployment | Automated policy enforcement, configuration management | Policy-as-code repos |

### 2.2 Logical Access Controls (CC6)

| Control ID | Criteria | GoodTeams Implementation | Evidence Location |
|------------|----------|--------------------------|-------------------|
| **CC6.1** | Logical access security | RBAC with principle of least privilege, tenant isolation | IAM configurations, tenant schema |
| **CC6.2** | Access provisioning | Automated onboarding/offboarding, manager approval workflows | User lifecycle logs |
| **CC6.3** | Access removal | Immediate deprovisioning on termination, access reviews quarterly | Deprovisioning audit trail |
| **CC6.4** | Access restriction | Network segmentation, VPC isolation, zero-trust architecture | Network diagrams, firewall rules |
| **CC6.5** | Access authentication | MFA required, SSO integration (SAML/OIDC), session management | Auth config, session policies |
| **CC6.6** | Access authorization | Permission matrices, API scope restrictions | Permission configs, API docs |
| **CC6.7** | Data transmission security | TLS 1.3 minimum, certificate pinning for mobile | SSL configs, cert inventory |
| **CC6.8** | Unauthorized access prevention | WAF, rate limiting, intrusion detection | WAF rules, IDS alerts |

### 2.3 System Operations (CC7)

| Control ID | Criteria | GoodTeams Implementation | Evidence Location |
|------------|----------|--------------------------|-------------------|
| **CC7.1** | Infrastructure monitoring | Health checks, uptime monitoring, resource utilization tracking | Monitoring dashboards, `/docs/MONITORING.md` |
| **CC7.2** | Anomaly detection | ML-based anomaly detection, behavioral analysis, threshold alerts | Alert configurations, ML model docs |
| **CC7.3** | Security event evaluation | SIEM integration, security analyst review process | SIEM dashboards, analyst runbooks |
| **CC7.4** | Incident response | Documented IR procedures, escalation matrix, post-incident reviews | `/docs/INCIDENT-RESPONSE.md` |
| **CC7.5** | Incident recovery | Backup restoration procedures, disaster recovery testing | DR test results, RTO/RPO metrics |

### 2.4 Change Management (CC8)

| Control ID | Criteria | GoodTeams Implementation | Evidence Location |
|------------|----------|--------------------------|-------------------|
| **CC8.1** | Infrastructure changes | Infrastructure-as-code, change approval workflows, rollback procedures | Terraform repos, change tickets |

### 2.5 Risk Mitigation (CC9)

| Control ID | Criteria | GoodTeams Implementation | Evidence Location |
|------------|----------|--------------------------|-------------------|
| **CC9.1** | Risk mitigation activities | Vendor risk assessments, third-party security reviews | Vendor assessment records |
| **CC9.2** | Vendor management | Vendor security questionnaires, contractual security requirements | Vendor contracts, SLA docs |

### 2.6 Availability (A)

| Control ID | Criteria | GoodTeams Implementation | Evidence Location |
|------------|----------|--------------------------|-------------------|
| **A1.1** | Capacity management | Auto-scaling configurations, capacity planning reviews | Scaling policies, capacity plans |
| **A1.2** | Environmental protections | Cloud provider certifications (AWS/GCP/Azure SOC2) | Provider compliance docs |
| **A1.3** | Data backup | Automated backups, encryption at rest, geo-redundant storage | Backup configurations, test restores |

### 2.7 Confidentiality (C)

| Control ID | Criteria | GoodTeams Implementation | Evidence Location |
|------------|----------|--------------------------|-------------------|
| **C1.1** | Confidential information identification | Data classification scheme, PII tagging | Classification policy, data catalog |
| **C1.2** | Confidential information disposal | Secure deletion procedures, key destruction | Deletion logs, key lifecycle docs |

### 2.8 Processing Integrity (PI)

| Control ID | Criteria | GoodTeams Implementation | Evidence Location |
|------------|----------|--------------------------|-------------------|
| **PI1.1** | Processing accuracy | Input validation, output verification, reconciliation checks | Test suites, reconciliation reports |
| **PI1.2** | Processing completeness | Transaction logging, idempotency guarantees | Audit logs, transaction records |
| **PI1.3** | Processing timeliness | SLA monitoring, queue depth alerts | SLA dashboards, alert history |

---

## 3. GDPR Compliance

GoodTeams processes personal data of EU residents and maintains full GDPR compliance. The following table maps GDPR articles to platform implementations.

### 3.1 Core Principles (Articles 5-11)

| Article | Requirement | GoodTeams Implementation | Status |
|---------|-------------|--------------------------|--------|
| **Art 5(1)(a)** | Lawfulness, fairness, transparency | Clear privacy policy, consent mechanisms, processing notices | ✅ Implemented |
| **Art 5(1)(b)** | Purpose limitation | Purpose-bound data processing, no secondary use without consent | ✅ Implemented |
| **Art 5(1)(c)** | Data minimization | Configurable retention policies, auto-deletion, minimal data collection | ✅ Implemented |
| **Art 5(1)(d)** | Accuracy | User profile editing, data correction APIs | ✅ Implemented |
| **Art 5(1)(e)** | Storage limitation | Automated retention enforcement, configurable TTLs | ✅ Implemented |
| **Art 5(1)(f)** | Integrity and confidentiality | Encryption at rest/transit, access controls | ✅ Implemented |
| **Art 5(2)** | Accountability | Processing records, DPO appointment, compliance documentation | ✅ Implemented |
| **Art 6** | Lawful basis for processing | Consent management, legitimate interest assessments, contract necessity | ✅ Implemented |
| **Art 7** | Conditions for consent | Granular consent options, easy withdrawal, consent records | ✅ Implemented |
| **Art 9** | Special category data | Explicit consent required, additional safeguards, opt-in only | ✅ Implemented |
| **Art 10** | Criminal conviction data | Not processed by default, requires explicit configuration | ✅ N/A by default |

### 3.2 Data Subject Rights (Articles 12-23)

| Article | Requirement | GoodTeams Implementation | Status |
|---------|-------------|--------------------------|--------|
| **Art 12** | Transparent communication | Plain-language privacy notices, accessible request process | ✅ Implemented |
| **Art 13-14** | Information provision | Privacy policy, processing notices at collection points | ✅ Implemented |
| **Art 15** | Right of access | Self-service data export, admin data access API | ✅ Implemented |
| **Art 16** | Right to rectification | User profile editing, admin correction tools | ✅ Implemented |
| **Art 17** | Right to erasure | User data deletion API, cascade delete, backup purge | ✅ Implemented |
| **Art 18** | Right to restriction | Processing pause functionality, restriction flags | ✅ Implemented |
| **Art 19** | Notification obligation | Automated recipient notification on changes | ✅ Implemented |
| **Art 20** | Data portability | Machine-readable export (JSON/CSV), standard formats | ✅ Implemented |
| **Art 21** | Right to object | Opt-out mechanisms, processing cessation workflows | ✅ Implemented |
| **Art 22** | Automated decision-making | Human review option, explanation of AI decisions, opt-out available | ✅ Implemented |

### 3.3 Controller & Processor Obligations (Articles 24-43)

| Article | Requirement | GoodTeams Implementation | Status |
|---------|-------------|--------------------------|--------|
| **Art 24** | Controller responsibility | Security program, documented policies, regular reviews | ✅ Implemented |
| **Art 25** | Privacy by design/default | Encryption, pseudonymization, minimal defaults | ✅ Implemented |
| **Art 26** | Joint controllers | Joint controller agreements available | ✅ Template available |
| **Art 28** | Processor requirements | DPA template, sub-processor list, audit rights | ✅ Implemented |
| **Art 30** | Records of processing | Processing activity inventory, automated ROPA | ✅ Implemented |
| **Art 32** | Security measures | See `/docs/SECURITY-ARCHITECTURE.md` | ✅ Implemented |
| **Art 33** | Breach notification (authority) | 72-hour notification procedure, incident templates | 📋 Documented |
| **Art 34** | Breach notification (subjects) | Mass notification capability, template communications | 📋 Documented |
| **Art 35** | DPIA requirement | DPIA process for high-risk processing, templates | ✅ Implemented |
| **Art 37-39** | DPO requirements | DPO appointed, contact published | ✅ Implemented |

### 3.4 International Transfers (Articles 44-50)

| Article | Requirement | GoodTeams Implementation | Status |
|---------|-------------|--------------------------|--------|
| **Art 44** | Transfer principles | Transfer impact assessments, lawful transfer mechanisms | ✅ Implemented |
| **Art 46** | Appropriate safeguards | Standard Contractual Clauses (SCCs) incorporated in DPA | ✅ Implemented |
| **Art 49** | Derogations | Explicit consent for non-adequate countries, necessity assessments | ✅ Implemented |

---

## 4. HIPAA Considerations

GoodTeams can be configured for healthcare customers handling Protected Health Information (PHI). This requires additional controls and a separate deployment configuration.

### 4.1 Administrative Safeguards

| Requirement | GoodTeams Implementation | Notes |
|-------------|--------------------------|-------|
| Security management | Risk analysis, sanction policy, activity review | Standard features |
| Workforce security | Authorization procedures, termination procedures | Enhanced audit logging |
| Information access management | Access authorization, establishment/modification | RBAC with PHI-specific roles |
| Security awareness training | Customer responsibility | Training materials provided |
| Security incident procedures | Enhanced IR for PHI | 60-day breach notification |
| Contingency plan | Backup, DR, emergency mode | Healthcare-specific RTO/RPO |
| Evaluation | Periodic security evaluation | Annual assessment support |
| BAA requirements | Business Associate Agreement | **Required for PHI processing** |

### 4.2 Physical Safeguards

| Requirement | GoodTeams Implementation | Notes |
|-------------|--------------------------|-------|
| Facility access controls | Cloud provider controls (SOC2 certified) | AWS/GCP/Azure compliance |
| Workstation security | Customer responsibility | Guidance documentation |
| Device and media controls | Encryption, secure disposal | Platform-enforced |

### 4.3 Technical Safeguards

| Requirement | GoodTeams Implementation | Notes |
|-------------|--------------------------|-------|
| Access controls | Unique user ID, emergency access, auto-logoff, encryption | Enhanced for HIPAA tier |
| Audit controls | Comprehensive audit logging, tamper-evident logs | Extended retention (6 years) |
| Integrity controls | Hash verification, integrity monitoring | PHI-specific checks |
| Transmission security | TLS 1.3, end-to-end encryption option | Required for PHI |

### 4.4 HIPAA Deployment Requirements

> ⚠️ **Important**: HIPAA compliance requires:
> - Signed Business Associate Agreement (BAA)
> - Dedicated infrastructure tier (HIPAA-eligible regions)
> - Enhanced audit logging (6-year retention)
> - Additional access controls and monitoring
> - Annual risk assessments
> - Minimum necessary standard enforcement

Contact sales@goodteams.ai for HIPAA-eligible deployment options.

---

## 5. ISO 27001 Alignment

GoodTeams security controls align with ISO 27001:2022 Annex A requirements. The following provides high-level mapping to control domains.

### 5.1 Annex A Control Mapping

| Control Domain | ISO Reference | GoodTeams Implementation | Coverage |
|----------------|---------------|--------------------------|----------|
| **Organizational controls** | A.5 | Security policies, roles and responsibilities, threat intelligence, asset management | Full |
| **People controls** | A.6 | Background checks (employees), awareness training, confidentiality agreements | Full |
| **Physical controls** | A.7 | Cloud provider controls, clean desk policy (employees) | Inherited |
| **Technological controls** | A.8 | Endpoint security, access management, cryptography, secure development | Full |

### 5.2 Key Control Implementations

| Control ID | Control Name | Implementation |
|------------|--------------|----------------|
| A.5.1 | Policies for information security | Comprehensive policy suite, annual review |
| A.5.7 | Threat intelligence | Threat feed integration, security bulletins |
| A.5.23 | Information security for cloud services | Cloud security architecture, shared responsibility model |
| A.5.29 | Information security during disruption | Business continuity planning, DR procedures |
| A.8.2 | Privileged access rights | PAM implementation, just-in-time access |
| A.8.9 | Configuration management | Infrastructure-as-code, drift detection |
| A.8.12 | Data leakage prevention | DLP policies, egress monitoring |
| A.8.16 | Monitoring activities | SIEM, log aggregation, alerting |
| A.8.24 | Use of cryptography | Encryption standards, key management |
| A.8.25 | Secure development lifecycle | SSDLC, security testing gates |
| A.8.28 | Secure coding | Code review requirements, SAST/DAST |

### 5.3 Certification Status

GoodTeams maintains alignment with ISO 27001:2022. Formal certification status:
- **Current**: Controls aligned, internal audit complete
- **Planned**: Third-party certification audit Q3 2026

---

## 6. Data Residency

GoodTeams supports regional data residency requirements for customers with geographic data storage obligations.

### 6.1 Available Regions

| Region | Location | Data Center | Certifications |
|--------|----------|-------------|----------------|
| **US** | United States | AWS us-east-1, us-west-2 | SOC2, FedRAMP (planned) |
| **EU** | European Union | AWS eu-west-1, eu-central-1 | SOC2, C5 |
| **UK** | United Kingdom | AWS eu-west-2 | SOC2, Cyber Essentials |
| **APAC** | Asia-Pacific | AWS ap-southeast-1 | SOC2 |
| **AU** | Australia | AWS ap-southeast-2 | SOC2, IRAP (planned) |

### 6.2 Data Location Guarantees

- **Primary data**: Stored exclusively in selected region
- **Backups**: Geo-redundant within same regulatory zone
- **Processing**: Compute resources in same region as data
- **Metadata**: Minimal metadata may replicate globally (configurable)

### 6.3 Cross-Border Transfer Mechanisms

| Transfer Type | Mechanism | Documentation |
|---------------|-----------|---------------|
| EU → US | Standard Contractual Clauses (2021 SCCs) | Included in DPA |
| EU → UK | UK Addendum to SCCs | Included in DPA |
| Other transfers | Transfer Impact Assessment + SCCs | Available on request |

### 6.4 Data Residency Configuration

```yaml
# Example tenant configuration
data_residency:
  primary_region: eu-west-1
  backup_region: eu-central-1
  processing_region: eu-west-1
  metadata_global: false
  cross_border_transfers: 
    enabled: false
    mechanisms: [sccs]
```

---

## 7. Audit Readiness Checklist

Use this checklist to prepare for compliance audits. All items should be verified quarterly.

### 7.1 Documentation

- [ ] Information security policy current and approved
- [ ] Acceptable use policy distributed to all users
- [ ] Data classification policy implemented
- [ ] Incident response plan tested within last 12 months
- [ ] Business continuity plan documented and tested
- [ ] Vendor management policy current
- [ ] Change management procedures documented

### 7.2 Access Management

- [ ] User access reviews completed (quarterly)
- [ ] Privileged access reviews completed (monthly)
- [ ] Terminated user access removed within 24 hours
- [ ] MFA enabled for all administrative access
- [ ] Service account inventory current
- [ ] API key rotation on schedule

### 7.3 Logging & Monitoring

- [ ] Audit logs retained for required period (1 year minimum, 6 years HIPAA)
- [ ] Log integrity verification enabled
- [ ] Security alerting configured and tested
- [ ] Anomaly detection rules current
- [ ] Log review procedures followed

### 7.4 Data Protection

- [ ] Encryption at rest verified (all data stores)
- [ ] Encryption in transit verified (TLS 1.2+ minimum)
- [ ] Key management procedures documented
- [ ] Key rotation on schedule
- [ ] Backup encryption verified
- [ ] Backup restoration tested (quarterly)

### 7.5 Vulnerability Management

- [ ] Vulnerability scans completed (weekly minimum)
- [ ] Critical vulnerabilities remediated within SLA
- [ ] Penetration test completed (annual)
- [ ] Penetration test findings remediated
- [ ] Dependency scanning enabled in CI/CD

### 7.6 Incident Response

- [ ] IR team contact list current
- [ ] IR procedures reviewed (annual)
- [ ] Tabletop exercise completed (annual)
- [ ] Post-incident reviews documented
- [ ] Lessons learned incorporated

### 7.7 Vendor Management

- [ ] Critical vendor inventory current
- [ ] Vendor security assessments completed (annual)
- [ ] Vendor SOC2 reports reviewed
- [ ] Sub-processor list published and current
- [ ] Vendor contracts include security requirements

### 7.8 Training & Awareness

- [ ] Security awareness training completed (all employees, annual)
- [ ] Phishing simulation conducted (quarterly)
- [ ] Role-specific training completed (developers, admins)
- [ ] Training records retained

---

## 8. Evidence Collection Guide

For audit efficiency, evidence is organized by control domain:

| Evidence Type | Location | Retention |
|---------------|----------|-----------|
| Access logs | SIEM / CloudWatch | 1 year (6 years HIPAA) |
| Change records | Git history, JIRA | Indefinite |
| Policy documents | `/policies/` repository | Version controlled |
| Training records | HR system | 3 years |
| Vulnerability scans | Security tooling | 1 year |
| Penetration tests | Secure storage | 3 years |
| Incident reports | Incident management system | 5 years |
| Vendor assessments | Vendor management system | Contract term + 2 years |

---

## 9. Contact Information

| Role | Contact | Responsibility |
|------|---------|----------------|
| Data Protection Officer | dpo@goodteams.ai | GDPR inquiries, DPIA reviews |
| Security Team | security@goodteams.ai | Vulnerability reports, security questions |
| Compliance Team | compliance@goodteams.ai | Audit coordination, certifications |
| Privacy Inquiries | privacy@goodteams.ai | Data subject requests |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02 | Security Team | Initial compliance matrix |

---

*This document is reviewed quarterly and updated as controls evolve. For the latest version, contact the Compliance Team.*
