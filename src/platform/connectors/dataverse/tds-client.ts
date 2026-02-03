/**
 * Dataverse TDS Client
 *
 * SQL query execution via Dataverse's TDS (Tabular Data Stream) endpoint.
 * Uses tedious package for the TDS protocol with Azure AD token authentication.
 */

import { ClientSecretCredential } from "@azure/identity";
import { Connection, Request, TYPES, type ConnectionConfiguration } from "tedious";
import {
  DataverseConfig,
  DataverseCredentials,
  QueryResult,
  ColumnInfo,
  TdsConnectionError,
  TdsQueryError,
  DATAVERSE_DEFAULTS,
} from "./types.js";

/**
 * TDS Client options
 */
export interface TdsClientOptions {
  /** Dataverse configuration */
  config: DataverseConfig;
  /** Azure AD credentials */
  credentials: DataverseCredentials;
}

/**
 * TDS Client for executing SQL queries against Dataverse
 */
export class TdsClient {
  private config: DataverseConfig;
  private credentials: DataverseCredentials;
  private credential: ClientSecretCredential;
  private connection: Connection | null = null;

  constructor(options: TdsClientOptions) {
    this.config = options.config;
    this.credentials = options.credentials;
    this.credential = new ClientSecretCredential(
      options.credentials.tenantId,
      options.credentials.clientId,
      options.credentials.clientSecret,
    );
  }

  /**
   * Get Azure AD access token for Dataverse
   */
  private async getAccessToken(): Promise<string> {
    const scope = `https://${this.config.environmentUrl}/.default`;
    const tokenResponse = await this.credential.getToken(scope);
    if (!tokenResponse?.token) {
      throw new TdsConnectionError("Failed to acquire Azure AD token");
    }
    return tokenResponse.token;
  }

  /**
   * Build TDS connection configuration
   */
  private async buildConnectionOptions(): Promise<ConnectionConfiguration> {
    const token = await this.getAccessToken();

    // Extract org name from URL (e.g., "org123" from "org123.crm.dynamics.com")
    const orgName = this.config.environmentUrl.split(".")[0];

    return {
      server: this.config.environmentUrl,
      authentication: {
        type: "azure-active-directory-access-token",
        options: {
          token,
        },
      },
      options: {
        port: this.config.tdsPort ?? DATAVERSE_DEFAULTS.TDS_PORT,
        database: orgName,
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: this.config.timeoutMs ?? DATAVERSE_DEFAULTS.TIMEOUT_MS,
        requestTimeout: this.config.timeoutMs ?? DATAVERSE_DEFAULTS.TIMEOUT_MS,
        rowCollectionOnRequestCompletion: true,
      },
    };
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<Connection> {
    const config = await this.buildConnectionOptions();

    return new Promise((resolve, reject) => {
      const connection = new Connection(config);

      connection.on("connect", (err) => {
        if (err) {
          reject(
            new TdsConnectionError(`Failed to connect to Dataverse TDS endpoint: ${err.message}`, {
              originalError: err,
            }),
          );
        } else {
          resolve(connection);
        }
      });

      connection.on("error", (err) => {
        reject(new TdsConnectionError(`Connection error: ${err.message}`, { originalError: err }));
      });

      connection.connect();
    });
  }

  /**
   * Execute a SQL query against Dataverse
   */
  async executeQuery(sql: string): Promise<QueryResult> {
    const startTime = Date.now();

    // Clean query - remove markdown code blocks if present
    const cleanedSql = sql
      .replace(/```sql\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();

    // Create fresh connection for each query
    const connection = await this.createConnection();

    try {
      const result = await this.runQuery(connection, cleanedSql);
      result.executionTimeMs = Date.now() - startTime;
      return result;
    } finally {
      // Always close the connection
      connection.close();
    }
  }

  /**
   * Run a query on an existing connection
   */
  private runQuery(connection: Connection, sql: string): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      const rows: Record<string, unknown>[] = [];
      const columns: ColumnInfo[] = [];
      let rowsAffected = 0;

      const request = new Request(sql, (err, rowCount) => {
        if (err) {
          reject(
            new TdsQueryError(`Query execution failed: ${err.message}`, {
              sql,
              originalError: err,
            }),
          );
        } else {
          rowsAffected = rowCount ?? 0;
          resolve({
            rows,
            columns,
            rowsAffected,
          });
        }
      });

      // Capture column metadata
      request.on("columnMetadata", (columnMetadata) => {
        // tedious columnMetadata can be array or object - normalize to array
        const cols = Array.isArray(columnMetadata) ? columnMetadata : Object.values(columnMetadata);
        for (const col of cols) {
          // tedious ColumnMetadata type doesn't include nullable, but it's present at runtime
          const colAny = col as typeof col & { nullable?: boolean };
          columns.push({
            name: col.colName,
            type: this.mapTdsType(col.type.name),
            nullable: colAny.nullable ?? true,
          });
        }
      });

      // Capture row data
      request.on("row", (rowColumns) => {
        const row: Record<string, unknown> = {};
        for (const col of rowColumns) {
          row[col.metadata.colName] = this.transformValue(col.value, col.metadata.type.name);
        }
        rows.push(row);
      });

      connection.execSql(request);
    });
  }

  /**
   * Map TDS type names to friendly names
   */
  private mapTdsType(tdsType: string): string {
    const typeMap: Record<string, string> = {
      Int: "integer",
      BigInt: "bigint",
      SmallInt: "smallint",
      TinyInt: "tinyint",
      Float: "float",
      Real: "real",
      Decimal: "decimal",
      Numeric: "numeric",
      Money: "money",
      SmallMoney: "smallmoney",
      Bit: "boolean",
      VarChar: "string",
      NVarChar: "string",
      Char: "string",
      NChar: "string",
      Text: "string",
      NText: "string",
      DateTime: "datetime",
      DateTime2: "datetime",
      DateTimeOffset: "datetimeoffset",
      Date: "date",
      Time: "time",
      SmallDateTime: "datetime",
      UniqueIdentifier: "guid",
      Binary: "binary",
      VarBinary: "binary",
      Image: "binary",
      Xml: "xml",
    };
    return typeMap[tdsType] ?? tdsType.toLowerCase();
  }

  /**
   * Transform values from TDS format
   */
  private transformValue(value: unknown, type: string): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle Buffer (binary data)
    if (Buffer.isBuffer(value)) {
      return value.toString("base64");
    }

    return value;
  }

  /**
   * Test connection health
   */
  async testConnection(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();
    try {
      const connection = await this.createConnection();
      connection.close();
      return {
        healthy: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a simple validation query
   */
  async validateQuery(sql: string): Promise<{ valid: boolean; error?: string }> {
    // For Dataverse, we can check basic SQL syntax
    // Note: Dataverse SQL has some limitations vs standard T-SQL
    const disallowedPatterns = [
      /\bINSERT\b/i,
      /\bUPDATE\b/i,
      /\bDELETE\b/i,
      /\bDROP\b/i,
      /\bCREATE\b/i,
      /\bALTER\b/i,
      /\bTRUNCATE\b/i,
      /\bEXEC\b/i,
      /\bEXECUTE\b/i,
    ];

    for (const pattern of disallowedPatterns) {
      if (pattern.test(sql)) {
        return {
          valid: false,
          error: `Dataverse TDS endpoint does not support ${pattern.source.replace(/\\b/g, "")} statements. Use REST API for write operations.`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get Dataverse-specific SQL hints
   */
  static getDialectHints(): string[] {
    return [
      "Dataverse TDS supports read-only SQL queries (SELECT only)",
      "Use statecode = 0 for active records, statecode = 1 for inactive",
      "Use statuscode for more detailed status values",
      "Lookup columns end with _value (e.g., ownerid_value)",
      "Date columns are in UTC",
      "Use LIKE with % for partial string matching",
      "TOP is supported but OFFSET/FETCH is limited",
      "JOINs are supported between related entities",
      "Aggregate functions (COUNT, SUM, AVG, MIN, MAX) are supported",
      "Window functions have limited support",
    ];
  }
}

/**
 * Create a TDS client from config and credentials
 */
export function createTdsClient(
  config: DataverseConfig,
  credentials: DataverseCredentials,
): TdsClient {
  return new TdsClient({ config, credentials });
}
