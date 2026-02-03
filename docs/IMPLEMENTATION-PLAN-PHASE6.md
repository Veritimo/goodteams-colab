# Phase 6: Database & CRM Integration

> SQL Server, PostgreSQL, Dynamics CRM/Dataverse, and Salesforce

**Duration:** 6 weeks  
**Status:** Planning  
**Dependencies:** Phase 2 Security ✅ (auth, RBAC)

---

## Overview

Phase 6 adds enterprise data source integrations:

- **SQL Databases** — SQL Server, PostgreSQL with natural language → SQL
- **Dynamics CRM/Dataverse** — Microsoft's enterprise CRM via TDS endpoint
- **Salesforce** — World's largest CRM platform

All integrations follow a **connector pattern**:
1. Admin configures connector (credentials, connection string)
2. Tools consume connectors via unified interface
3. SchemaHints enhance query generation with business rules
4. Gated bulk operations require explicit permissions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GoodTeams Platform                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Connector Layer                          │ │
│  │                                                             │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐│ │
│  │  │ SQL         │  │ Dataverse   │  │ Salesforce          ││ │
│  │  │ Connector   │  │ Connector   │  │ Connector           ││ │
│  │  │             │  │             │  │                     ││ │
│  │  │ • MSSQL     │  │ • TDS SQL   │  │ • SOQL              ││ │
│  │  │ • Postgres  │  │ • REST API  │  │ • Bulk API          ││ │
│  │  │ • MySQL     │  │ • Bulk ops  │  │ • Metadata API      ││ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘│ │
│  │         │                │                   │             │ │
│  │         └────────────────┼───────────────────┘             │ │
│  │                          ▼                                  │ │
│  │  ┌────────────────────────────────────────────────────────┐│ │
│  │  │              SchemaHints Engine                        ││ │
│  │  │                                                        ││ │
│  │  │  • Per-connector schema cache                          ││ │
│  │  │  • Business rules → query patterns                     ││ │
│  │  │  • Natural language → SQL/SOQL generation              ││ │
│  │  └────────────────────────────────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      Agent Tools                            │ │
│  │                                                             │ │
│  │  SQL: generate_sql, execute_sql, run_sql_analysis          │ │
│  │  CRM: generate_crm_query, execute_crm_query, bulk_*        │ │
│  │  SF:  generate_soql, execute_soql, salesforce_*            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Streams

### Stream A: Connector Framework
**Owner:** Agent A  
**Duration:** Week 1

| Task | Description |
|------|-------------|
| Connector model | Prisma schema for ResourceConnection |
| Connector service | CRUD, credential encryption, health check |
| Connector API | REST endpoints for management |
| Connection pooling | Per-connector pool management |
| Admin UI types | TypeScript interfaces for settings |

### Stream B: SQL Integration  
**Owner:** Agent B  
**Duration:** Weeks 1-2

| Task | Description |
|------|-------------|
| SQL Server driver | mssql package integration |
| PostgreSQL driver | pg package integration |
| Query execution | Parameterized queries, timeout |
| Schema introspection | Tables, columns, relationships |
| SchemaHints | Per-table business rules |
| Query generation | Natural language → SQL via LLM |

### Stream C: Dynamics CRM/Dataverse
**Owner:** Agent C  
**Duration:** Weeks 2-3

| Task | Description |
|------|-------------|
| TDS client | SQL queries via Dataverse TDS endpoint |
| REST client | Fallback for non-TDS operations |
| Azure auth | ClientSecretCredential integration |
| Entity metadata | Schema cache + refresh |
| CRM SchemaHints | Entity-specific query rules |
| Bulk operations | Create/Update/Delete with batching |

### Stream D: Salesforce
**Owner:** Agent D  
**Duration:** Weeks 3-4

| Task | Description |
|------|-------------|
| OAuth flow | Salesforce OAuth 2.0 |
| SOQL execution | Query with pagination |
| Metadata API | Object/field introspection |
| Salesforce hints | Object-specific rules |
| Bulk API | Large data operations |
| Report access | Read Salesforce reports |

---

## Database Schema

### New Tables

```prisma
// Resource Connection (unified connector storage)
model ResourceConnection {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  // Connection type
  type            ConnectionType
  name            String
  description     String?
  
  // Configuration (encrypted)
  config          Json     // { url, database, schema, tdsPort, etc. }
  credentials     Json?    // Encrypted: { username, password, clientId, clientSecret }
  
  // Status
  status          ConnectionStatus @default(PENDING)
  lastHealthCheck DateTime?
  healthMessage   String?
  
  // Security
  isReadOnly      Boolean  @default(true)
  
  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdBy       String?
  
  // Relations
  schemaHints     SchemaHint[]
  
  @@unique([organizationId, name])
  @@index([organizationId, type])
}

enum ConnectionType {
  SQL_SERVER
  POSTGRESQL
  MYSQL
  DATAVERSE    // Dynamics CRM
  SALESFORCE
}

enum ConnectionStatus {
  PENDING
  CONNECTED
  ERROR
  DISABLED
}

// Schema Hints (business rules for query generation)
model SchemaHint {
  id              String   @id @default(uuid())
  connectionId    String
  connection      ResourceConnection @relation(fields: [connectionId], references: [id])
  
  // Scope
  tableName       String   // Table/Entity logical name
  columnName      String?  // Optional: specific column
  
  // Hint content
  description     String   // Natural language rule
  pattern         String?  // SQL/SOQL pattern example
  
  // Metadata
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdBy       String?
  
  @@unique([connectionId, tableName, description])
  @@index([connectionId])
}

// Schema Cache (for performance)
model SchemaCache {
  id              String   @id @default(uuid())
  connectionId    String
  
  // Cached schema
  tables          Json     // Array of { name, columns: [{ name, type, nullable }] }
  relationships   Json?    // Foreign key relationships
  
  // Cache management
  cachedAt        DateTime @default(now())
  expiresAt       DateTime
  
  @@unique([connectionId])
}
```

---

## File Structure

```
src/platform/
├── connectors/
│   ├── index.ts                    # Barrel exports
│   ├── types.ts                    # Shared types
│   ├── connector-service.ts        # CRUD, encryption, health
│   ├── connection-pool.ts          # Pool management
│   │
│   ├── sql/
│   │   ├── index.ts
│   │   ├── sql-connector.ts        # Base SQL connector
│   │   ├── mssql-client.ts         # SQL Server specific
│   │   ├── postgres-client.ts      # PostgreSQL specific
│   │   ├── query-generator.ts      # NL → SQL via LLM
│   │   ├── schema-introspector.ts  # Schema discovery
│   │   └── __tests__/
│   │
│   ├── dataverse/
│   │   ├── index.ts
│   │   ├── dataverse-connector.ts  # Main connector
│   │   ├── tds-client.ts           # SQL via TDS endpoint
│   │   ├── rest-client.ts          # REST API fallback
│   │   ├── entity-metadata.ts      # Schema cache
│   │   ├── bulk-operations.ts      # Batch CRUD
│   │   └── __tests__/
│   │
│   ├── salesforce/
│   │   ├── index.ts
│   │   ├── salesforce-connector.ts # Main connector
│   │   ├── soql-client.ts          # SOQL execution
│   │   ├── bulk-api.ts             # Bulk operations
│   │   ├── metadata-api.ts         # Schema discovery
│   │   └── __tests__/
│   │
│   └── schema-hints/
│       ├── index.ts
│       ├── hints-service.ts        # CRUD for hints
│       ├── hints-engine.ts         # Apply hints to queries
│       └── __tests__/
│
├── api/routes/
│   ├── connectors.ts               # Connector CRUD API
│   └── schema-hints.ts             # Hints management API
│
└── tools/
    ├── sql-tools.ts                # Agent tools for SQL
    ├── crm-tools.ts                # Agent tools for CRM
    └── salesforce-tools.ts         # Agent tools for Salesforce
```

---

## Agent Tools

### SQL Tools
```typescript
// Read operations (category: "read")
sql_list_connectors     // List available SQL connectors
sql_generate_query      // Natural language → SQL
sql_execute_query       // Execute SQL (read-only by default)
sql_run_analysis        // Generate + Execute + Explain
sql_get_schema          // Get table/column info

// Admin operations (category: "admin")
sql_refresh_schema      // Refresh cached schema
sql_manage_hints        // Add/remove schema hints
```

### CRM Tools (Dataverse)
```typescript
// Read operations (category: "read")
crm_list_connectors     // List Dataverse connectors
crm_generate_query      // Natural language → SQL (TDS)
crm_execute_query       // Execute via TDS endpoint
crm_get_metadata        // Entity schema info
crm_read_audit          // Audit history for record

// Write operations (category: "write", gated)
crm_bulk_create         // Batch create records
crm_bulk_update         // Batch update records
crm_bulk_delete         // Batch delete records

// Admin operations (category: "admin")
crm_refresh_metadata    // Refresh entity cache
crm_manage_hints        // Entity-specific rules
```

### Salesforce Tools
```typescript
// Read operations (category: "read")
sf_list_connectors      // List Salesforce connectors
sf_generate_soql        // Natural language → SOQL
sf_execute_soql         // Execute SOQL query
sf_get_metadata         // Object/field info
sf_read_report          // Fetch report data

// Write operations (category: "write", gated)
sf_create_records       // Create via Bulk API
sf_update_records       // Update via Bulk API
sf_delete_records       // Delete via Bulk API

// Admin operations (category: "admin")
sf_refresh_metadata     // Refresh object cache
sf_manage_hints         // Object-specific rules
```

---

## SchemaHints System

SchemaHints teach the AI about business-specific query patterns:

```typescript
interface SchemaHint {
  tableName: string;       // "contact" or "Account"
  columnName?: string;     // Optional specific column
  description: string;     // Natural language rule
  pattern?: string;        // SQL/SOQL example
}

// Example hints for Dynamics CRM
const dynamicsHints = [
  {
    tableName: "contact",
    description: "Active contacts have statecode = 0",
    pattern: "WHERE statecode = 0"
  },
  {
    tableName: "account", 
    description: "Customer accounts have customertypecode = 1",
    pattern: "WHERE customertypecode = 1"
  },
  {
    tableName: "opportunity",
    columnName: "estimatedclosedate",
    description: "Use estimatedclosedate for opportunity timeline queries"
  }
];

// Example hints for Salesforce
const salesforceHints = [
  {
    tableName: "Opportunity",
    description: "Closed Won opportunities have StageName = 'Closed Won'",
    pattern: "WHERE StageName = 'Closed Won'"
  },
  {
    tableName: "Account",
    description: "Active accounts have IsDeleted = false",
    pattern: "WHERE IsDeleted = false"
  }
];
```

### Hints Engine

```typescript
// Query generation with hints
async function generateQuery(
  connector: ResourceConnection,
  prompt: string,
  hints: SchemaHint[]
): Promise<string> {
  
  // 1. Get schema context
  const schema = await getSchemaCache(connector.id);
  
  // 2. Build hints context
  const hintsContext = hints.map(h => 
    `- ${h.tableName}${h.columnName ? `.${h.columnName}` : ''}: ${h.description}`
  ).join('\n');
  
  // 3. Generate via LLM
  const sql = await llm.generate({
    prompt: `Generate SQL for: "${prompt}"`,
    context: {
      dialect: connector.type,
      schema: schema.tables,
      businessRules: hintsContext
    }
  });
  
  return sql;
}
```

---

## Dataverse TDS Integration

Dynamics CRM/Dataverse supports SQL queries via TDS (Tabular Data Stream) endpoint:

```typescript
// TDS Client for Dataverse
import { Connection, Request } from 'tedious';
import { ClientSecretCredential } from '@azure/identity';

interface DataverseTdsConfig {
  environmentUrl: string;  // e.g., "org123.crm.dynamics.com"
  tenantId: string;
  clientId: string;
  clientSecret: string;
  tdsPort?: number;        // Default: 5558
}

class DataverseTdsClient {
  private credential: ClientSecretCredential;
  private config: DataverseTdsConfig;
  
  constructor(config: DataverseTdsConfig) {
    this.config = config;
    this.credential = new ClientSecretCredential(
      config.tenantId,
      config.clientId,
      config.clientSecret
    );
  }
  
  async executeQuery(sql: string): Promise<any[]> {
    // 1. Get access token
    const token = await this.credential.getToken(
      `https://${this.config.environmentUrl}/.default`
    );
    
    // 2. Connect via TDS
    const connection = new Connection({
      server: this.config.environmentUrl,
      authentication: {
        type: 'azure-active-directory-access-token',
        options: { token: token.token }
      },
      options: {
        port: this.config.tdsPort || 5558,
        encrypt: true,
        database: this.config.environmentUrl.split('.')[0] // org name
      }
    });
    
    // 3. Execute query
    return new Promise((resolve, reject) => {
      const rows: any[] = [];
      
      connection.on('connect', (err) => {
        if (err) return reject(err);
        
        const request = new Request(sql, (err) => {
          if (err) return reject(err);
          resolve(rows);
        });
        
        request.on('row', (columns) => {
          const row: any = {};
          columns.forEach((col) => {
            row[col.metadata.colName] = col.value;
          });
          rows.push(row);
        });
        
        connection.execSql(request);
      });
      
      connection.connect();
    });
  }
}
```

---

## Permission Gating

Write operations require explicit permissions:

```typescript
// Permission constants
const CRM_PERMISSIONS = {
  CREATE: 'CRM_CREATE',
  UPDATE: 'CRM_UPDATE', 
  DELETE: 'CRM_DELETE'
};

// Check before bulk operations
async function crmBulkCreate(
  userId: string,
  connectorId: string,
  entityName: string,
  records: any[]
): Promise<BulkResult> {
  
  // 1. Check connector read-only flag
  const connector = await getConnector(connectorId);
  if (connector.isReadOnly) {
    throw new Error('Connector is in read-only mode');
  }
  
  // 2. Check user permission
  const hasPermission = await checkPermission(userId, CRM_PERMISSIONS.CREATE);
  if (!hasPermission) {
    throw new Error('CRM_CREATE permission required');
  }
  
  // 3. Execute with batching
  return await executeBulkCreate(connector, entityName, records, {
    batchSize: 500,
    maxRetries: 3
  });
}
```

---

## Testing Requirements

### Unit Tests (per file)
- `connector-service.test.ts` (20+ tests)
- `sql-connector.test.ts` (15+ tests)
- `query-generator.test.ts` (15+ tests)
- `schema-introspector.test.ts` (10+ tests)
- `dataverse-connector.test.ts` (15+ tests)
- `tds-client.test.ts` (12+ tests)
- `bulk-operations.test.ts` (15+ tests)
- `salesforce-connector.test.ts` (15+ tests)
- `soql-client.test.ts` (12+ tests)
- `hints-service.test.ts` (10+ tests)
- `hints-engine.test.ts` (12+ tests)

### Integration Tests
- Connector CRUD lifecycle
- Query generation with hints
- Permission gating for writes

### E2E Scenarios
- `sql_query` — Generate and execute SQL
- `crm_query` — Generate and execute Dataverse query
- `salesforce_crud` — SOQL + Bulk operations

---

## Phase 6 Checkpoint

| Criterion | Requirement |
|-----------|-------------|
| Connectors | CRUD works, credentials encrypted |
| SQL | Query SQL Server + PostgreSQL |
| Dataverse | Query via TDS, bulk ops work |
| Salesforce | SOQL + Bulk API work |
| SchemaHints | Hints improve query accuracy |
| Permissions | Writes gated by RBAC |
| Tests | All unit + integration pass |

---

## Dependencies

```bash
# SQL
pnpm add mssql pg tedious

# Azure (for Dataverse)
pnpm add @azure/identity

# Salesforce
pnpm add jsforce
```

---

## Reference Implementation

See goodteams-ai for patterns:
- `engine/app/tools/crm_tools.py` — CRM tool implementations
- `engine/app/tools/sql_tools.py` — SQL tool implementations  
- `engine/app/agents/tools/dataverse.py` — Dataverse client with TDS
- `engine/app/tools/registry.py` — Tool registration with categories/scopes
