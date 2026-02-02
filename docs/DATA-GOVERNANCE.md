# Data Governance

This document defines how GoodTeams handles data throughout its lifecycle—from creation to deletion. It establishes the classification framework, retention policies, residency requirements, and data subject rights that govern all information processed by the platform.

Data governance is foundational to trust. Customers entrust GoodTeams with sensitive organizational knowledge, conversations, and business context. This policy ensures we handle that data responsibly, compliantly, and transparently. It applies to all GoodTeams employees, contractors, and systems that process customer data.

---

## Data Classification

GoodTeams uses a four-level classification system to ensure appropriate handling of all data types. Classification determines access controls, encryption requirements, audit depth, and retention rules.

### Classification Levels

| Level | Label | Description | Examples | Controls |
|-------|-------|-------------|----------|----------|
| 1 | **Public** | No restrictions on access or distribution | Marketing content, public documentation, blog posts | None required |
| 2 | **Internal** | Organization-only access | Meeting notes, internal communications, team wikis | Authentication required |
| 3 | **Confidential** | Need-to-know basis within organization | Customer data, financial records, PII, contracts | RBAC + audit logging |
| 4 | **Restricted** | Highest sensitivity, maximum protection | Credentials, API keys, health data (PHI), legal holds | Encryption + HITL approval + full audit |

### Classification Rules

**Default Classification:** Each data type has a default classification level assigned at creation. User profiles default to Confidential. Chat messages default to Confidential. Knowledge base documents inherit classification from their source or default to Internal.

**User Override (Upward Only):** Users may elevate classification levels at any time. A document marked Internal can be reclassified as Confidential or Restricted by any user with edit access. This enables teams to protect sensitive content discovered after initial upload.

**Downgrade Requires Approval:** Reducing classification level requires approval from the data owner or a designated data steward. This prevents accidental exposure of sensitive information. Downgrade requests trigger an audit log entry and notification to the original classifier.

**Auto-Detection:** GoodTeams employs automated classification assistance:
- **PII Scanner:** Detects personal identifiable information (names, emails, phone numbers, SSNs, credit card numbers) and suggests Confidential classification
- **Credential Detection:** Identifies API keys, tokens, and passwords; flags for Restricted classification
- **Regex Patterns:** Custom tenant-defined patterns for industry-specific sensitive data (e.g., medical record numbers, case IDs)
- **Keyword Triggers:** Configurable keywords that suggest elevated classification (e.g., "attorney-client privilege," "under NDA")

Auto-detection provides recommendations; users make final classification decisions. When auto-detection identifies Restricted-level content, the system requires explicit user acknowledgment before proceeding.

---

## Data Inventory

GoodTeams processes multiple categories of data, each with specific handling requirements. This inventory provides transparency into what data exists, where it lives, and who owns it.

### Primary Data Types

| Data Type | Classification | Storage Location | Retention | Owner |
|-----------|---------------|------------------|-----------|-------|
| User profiles | Confidential | PostgreSQL (primary) | Account lifetime + 30 days | Identity Team |
| Chat history | Confidential | PostgreSQL | Per tenant policy (default: 1 year) | Product Team |
| Knowledge base documents | Varies (default: Internal) | S3 + Vector DB | Per tenant policy (default: indefinite) | Customer |
| Audit logs | Internal | PostgreSQL + S3 (archive) | 1-5 years (regulatory dependent) | Security Team |
| AI model outputs | Internal | Ephemeral (memory only) | Session duration only | AI Team |
| Document embeddings | Internal | Vector DB (Pinecone/pgvector) | Source document lifetime | AI Team |
| Session tokens | Restricted | Redis | 24 hours (configurable) | Identity Team |
| API credentials | Restricted | Vault (encrypted) | Until rotation/revocation | Security Team |
| Analytics events | Internal | ClickHouse | 2 years | Product Team |
| File attachments | Inherits from parent | S3 (encrypted) | Parent document lifetime | Customer |
| Webhook payloads | Confidential | PostgreSQL | 30 days | Integrations Team |
| Search indices | Internal | Elasticsearch | Source document lifetime | Platform Team |

### Data Flow

Customer data enters GoodTeams through defined channels: direct upload, API ingestion, chat messages, or third-party integrations. Upon ingestion, data is classified, encrypted at rest, and routed to appropriate storage. Embeddings are generated for searchable content and stored separately from source documents. All access is logged.

Data exits through export (user-initiated), API retrieval, deletion, or regulatory request. Exit points enforce classification-appropriate controls and generate audit records.

---

## Retention Policies

Retention policies balance operational needs, compliance requirements, and customer expectations. GoodTeams maintains data only as long as necessary for its intended purpose.

### Default Retention by Data Type

| Data Type | Default Retention | Minimum | Maximum | Justification |
|-----------|-------------------|---------|---------|---------------|
| User profile data | Account lifetime + 30 days | 30 days | 7 years | GDPR right to erasure + legal hold allowance |
| Chat messages | 1 year | 30 days | 7 years | Business continuity + compliance discovery |
| Audit logs | 2 years | 1 year | 7 years | Regulatory compliance (SOX, HIPAA) |
| Knowledge base content | Indefinite | — | — | Customer-controlled business asset |
| Session data | 24 hours | 1 hour | 7 days | Security + performance |
| Analytics | 2 years | 90 days | 5 years | Product improvement + billing verification |
| AI outputs | Session only | — | — | Privacy by design; no persistence |
| Embeddings | Source document lifetime | — | — | Derived data; follows source |

### Tenant Policy Overrides

Tenants may customize retention within defined bounds:

**Extension:** Tenants can extend retention up to the maximum allowed. Extended retention may incur additional storage costs. Extension requests are logged and require administrator approval.

**Reduction:** Tenants can shorten retention down to the minimum. Shortened retention takes effect after the next scheduled cleanup cycle (daily). Reducing retention does not retroactively delete data already past the new threshold—a separate purge request is required.

**Legal Hold:** Legal holds override all retention policies. Data under legal hold is preserved indefinitely regardless of tenant policy or user deletion requests. Legal holds can only be placed or lifted by designated legal administrators. Hold status is tracked but not visible to regular users to preserve investigation integrity.

### Deletion Procedures

Deletion follows a staged process to prevent accidental data loss:

1. **Soft Delete:** User or system initiates deletion. Data is marked deleted but remains in storage. Not visible in normal queries. Recoverable by administrator.

2. **Grace Period:** 30-day window before permanent deletion. Allows recovery from accidental deletion. Grace period can be shortened by tenant policy (minimum 7 days) or extended for compliance.

3. **Hard Delete:** Data permanently removed from primary storage. Backup copies removed on next backup rotation cycle (typically 30-90 days). Deletion logged and verifiable.

**Cascade Behavior:**
- User deletion triggers deletion of their chat messages (anonymization available as alternative)
- Document deletion triggers deletion of associated embeddings
- Tenant deletion triggers complete data purge across all systems
- Cascade operations are atomic—full completion or rollback

**Verification:** All deletions generate a deletion certificate containing timestamp, scope, verification hash, and operator identity. Certificates are retained for audit purposes (7 years).

---

## Data Residency

GoodTeams supports data residency requirements for regulatory compliance and customer preference. Data residency governs where data is stored and processed.

### Available Regions

| Region Code | Location | Availability | Compliance |
|-------------|----------|--------------|------------|
| `us-east` | Virginia, USA | GA | SOC 2, HIPAA eligible |
| `us-west` | Oregon, USA | GA | SOC 2, HIPAA eligible |
| `eu-west` | Ireland | GA | GDPR, SOC 2 |
| `eu-central` | Frankfurt, Germany | GA | GDPR, SOC 2, C5 |
| `ap-southeast` | Singapore | GA | SOC 2, PDPA |

### Residency Guarantees

**Data at Rest:** All customer data at rest remains within the designated region. This includes primary databases, object storage, backups, and search indices. No automatic replication crosses regional boundaries without explicit configuration.

**Data in Transit:** Processing occurs within the designated region. API requests are routed to regional endpoints. AI model inference uses regional deployments where available; where not available, data is processed in the nearest region with the model capability (with explicit tenant consent).

**Cross-Region Restrictions:** Cross-region data transfer occurs only for:
- Disaster recovery (when explicitly configured and consented)
- Customer-initiated export
- Regulatory or legal requirement with proper authorization

### Configuration

Tenants configure data residency at onboarding. Changes require migration and are subject to review.

```yaml
tenant:
  data_residency:
    primary: eu-west
    dr_allowed:
      - eu-central
    cross_border: false
    ai_processing:
      allowed_regions:
        - eu-west
        - eu-central
      fallback: none  # or 'nearest' with consent
```

**Migration:** Region migration is supported but non-trivial. Migration involves data copy (not move) to new region, validation, cutover, and source deletion. Typical migration window: 24-72 hours depending on data volume. During migration, the tenant operates in read-only mode for approximately 15-30 minutes at cutover.

---

## Data Subject Rights

GoodTeams supports data subject rights under GDPR, CCPA, and similar regulations. These rights apply to personal data of end users whose information is processed by the platform.

### Right to Access (Subject Access Request)

Individuals may request a copy of all personal data held about them.

**Process:**
1. Request submitted via privacy portal, API, or support ticket
2. Identity verification (email confirmation + additional factor for sensitive data)
3. Data compilation across all systems
4. Review by privacy team (for Restricted data)
5. Delivery via secure download link

**Format:** Export includes JSON (machine-readable) and human-readable summary (PDF). Export covers profile data, chat messages where the individual is a participant, documents they uploaded, and activity logs.

**Timeline:** 30 calendar days from verified request. Extension to 60 days available for complex requests with notification to requester.

### Right to Erasure (Right to be Forgotten)

Individuals may request deletion of their personal data.

**Scope:** Erasure covers all PII, derived data (embeddings, summaries), and references in chat history. Audit logs are anonymized rather than deleted to maintain system integrity.

**Cascade Handling:**
- Chat messages: Anonymized (author replaced with "Deleted User") or deleted based on tenant policy
- Knowledge base contributions: Transferred to tenant ownership or deleted
- Embeddings: Regenerated without the individual's content

**Verification:** Upon completion, a deletion certificate is issued confirming scope and timestamp. Certificate is cryptographically signed and serves as proof of compliance.

**Exceptions:** Erasure may be declined or delayed for legal holds, ongoing disputes, or legitimate business interest (with notification to requester and documentation of basis).

### Right to Rectification

Individuals may correct inaccurate personal data.

**Self-Service:** Users can directly edit their profile information (name, email, contact details) through the application interface. Changes take effect immediately and propagate to all systems.

**Assisted Rectification:** For historical data (past chat messages, documents), users submit correction requests via support. Corrections are applied as amendments, preserving original content for audit purposes where legally required.

### Right to Data Portability

Individuals may receive their data in a portable, machine-readable format.

**Format:** Standard JSON export compatible with common data interchange formats. Includes profile, messages, documents, and activity history.

**Delivery:** Secure download link valid for 7 days. Webhook notification available for automated workflows.

**Scope:** Portability covers data provided by the individual and data generated through their use of the service. It does not include proprietary analytics, aggregated insights, or data about the individual provided by third parties.

---

## Data Processing Agreements

GoodTeams maintains Data Processing Agreements (DPAs) with all customers processing personal data under GDPR and similar regulations.

### DPA Availability

A standard DPA is available for all customers on Business and Enterprise plans. The DPA covers GoodTeams' obligations as a data processor, including security measures, breach notification, subprocessor management, and audit rights. Custom DPA terms are available for Enterprise customers with specific regulatory requirements.

### Subprocessor Management

GoodTeams maintains a current list of subprocessors at `docs.goodteams.ai/legal/subprocessors`. The list includes:
- Cloud infrastructure providers (AWS, GCP)
- AI model providers (where applicable)
- Analytics and monitoring services
- Support tooling

**Notification:** Customers receive 30 days advance notice before new subprocessor engagement. Notification is sent to the designated privacy contact and posted to the subprocessor list. Customers may object to new subprocessors; objections trigger a review process and, if unresolved, provide grounds for contract termination without penalty.

### Audit Rights

Enterprise customers have audit rights as specified in their DPA. Audits may be conducted by the customer or a mutually agreed third party. GoodTeams provides SOC 2 Type II reports annually and makes them available to customers under NDA. On-site audits require 30 days notice and are scheduled to minimize operational disruption.

---

## Review and Updates

This policy is reviewed annually and updated as needed for regulatory changes, platform evolution, or customer feedback. Material changes are communicated to customers 30 days in advance. The current version is always available at `docs.goodteams.ai/data-governance`.

**Last Updated:** February 2026  
**Owner:** Security & Compliance Team  
**Approved By:** Chief Privacy Officer
