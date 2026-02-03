/**
 * SQL Server (MSSQL) Client
 *
 * SQL Server connector implementation using the mssql package.
 * Supports connection pooling and parameterized queries.
 */

import * as mssql from "mssql";
import type {
  SqlConnectorConfig,
  SqlCredentials,
  SqlQueryResult,
  TableSchema,
  TableRelationship,
  ColumnSchema,
  SqlDialect,
  FieldMetadata,
} from "./types.js";
import { SqlConnector, mergeWithDefaults } from "./sql-connector.js";

/**
 * SQL Server connector implementation
 */
export class MssqlClient extends SqlConnector {
  private pool: mssql.ConnectionPool | null = null;

  constructor(config: SqlConnectorConfig, credentials: SqlCredentials) {
    super(mergeWithDefaults(config), credentials);
  }

  get dialect(): SqlDialect {
    return "mssql";
  }

  get defaultSchema(): string {
    return "dbo";
  }

  /**
   * Connect to SQL Server
   */
  async connect(): Promise<void> {
    if (this.connected && this.pool) {
      return;
    }

    const mssqlConfig: mssql.config = {
      user: this.credentials.username,
      password: this.credentials.password,
      server: this.config.host,
      port: this.config.port,
      database: this.config.database,
      options: {
        encrypt: this.config.encrypt ?? true,
        trustServerCertificate: this.config.trustServerCertificate ?? false,
      },
      connectionTimeout: this.config.connectionTimeout ?? 30000,
      requestTimeout: this.config.requestTimeout ?? 30000,
      pool: {
        max: this.config.poolMax ?? 10,
        min: this.config.poolMin ?? 0,
        idleTimeoutMillis: this.config.poolIdleTimeout ?? 30000,
      },
    };

    this.pool = new mssql.ConnectionPool(mssqlConfig);
    await this.pool.connect();
    this.connected = true;
  }

  /**
   * Disconnect from SQL Server
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
    this.connected = false;
  }

  /**
   * Execute a parameterized query
   */
  async executeQuery(sql: string, params?: Record<string, unknown>): Promise<SqlQueryResult> {
    if (!this.pool || !this.connected) {
      throw new Error("Not connected to database. Call connect() first.");
    }

    const startTime = Date.now();
    const request = this.pool.request();

    // Add parameters with type inference
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        request.input(key, this.inferSqlType(value), value);
      }
    }

    const result = await request.query(sql);

    return {
      rows: result.recordset ?? [],
      rowCount: result.rowsAffected?.[0] ?? result.recordset?.length ?? 0,
      fields: this.normalizeFieldMetadata(result.recordset?.columns ?? {}),
      executionTime: Date.now() - startTime,
    };
  }

  protected getTestQuery(): string {
    return "SELECT 1 AS test";
  }

  /**
   * Get all tables with their columns
   */
  async getTables(): Promise<TableSchema[]> {
    const schema = this.getSchema();

    const tablesQuery = `
      SELECT 
        t.TABLE_NAME as table_name,
        t.TABLE_SCHEMA as table_schema
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE t.TABLE_TYPE = 'BASE TABLE'
        AND t.TABLE_SCHEMA = @schema
      ORDER BY t.TABLE_NAME
    `;

    const columnsQuery = `
      SELECT 
        c.TABLE_NAME as table_name,
        c.COLUMN_NAME as column_name,
        c.DATA_TYPE as data_type,
        c.IS_NULLABLE as is_nullable,
        c.COLUMN_DEFAULT as column_default,
        c.CHARACTER_MAXIMUM_LENGTH as max_length,
        c.NUMERIC_PRECISION as precision,
        c.NUMERIC_SCALE as scale,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as is_primary_key,
        CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as is_foreign_key,
        fk.REFERENCED_TABLE_NAME as ref_table,
        fk.REFERENCED_COLUMN_NAME as ref_column,
        fk.REFERENCED_TABLE_SCHEMA as ref_schema
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (
        SELECT ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND tc.TABLE_SCHEMA = @schema
      ) pk ON c.TABLE_NAME = pk.TABLE_NAME AND c.COLUMN_NAME = pk.COLUMN_NAME
      LEFT JOIN (
        SELECT 
          cu.TABLE_NAME,
          cu.COLUMN_NAME,
          cu2.TABLE_NAME as REFERENCED_TABLE_NAME,
          cu2.COLUMN_NAME as REFERENCED_COLUMN_NAME,
          cu2.TABLE_SCHEMA as REFERENCED_TABLE_SCHEMA
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE cu
          ON rc.CONSTRAINT_NAME = cu.CONSTRAINT_NAME
        JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE cu2
          ON rc.UNIQUE_CONSTRAINT_NAME = cu2.CONSTRAINT_NAME
        WHERE cu.TABLE_SCHEMA = @schema
      ) fk ON c.TABLE_NAME = fk.TABLE_NAME AND c.COLUMN_NAME = fk.COLUMN_NAME
      WHERE c.TABLE_SCHEMA = @schema
      ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
    `;

    const [tablesResult, columnsResult] = await Promise.all([
      this.executeQuery(tablesQuery, { schema }),
      this.executeQuery(columnsQuery, { schema }),
    ]);

    // Group columns by table
    const columnsByTable = new Map<string, ColumnSchema[]>();
    for (const row of columnsResult.rows) {
      const tableName = row.table_name as string;
      if (!columnsByTable.has(tableName)) {
        columnsByTable.set(tableName, []);
      }

      const column: ColumnSchema = {
        name: row.column_name as string,
        dataType: this.mapDataType(row.data_type as string),
        nullable: (row.is_nullable as string) === "YES",
        isPrimaryKey: Boolean(row.is_primary_key),
        isForeignKey: Boolean(row.is_foreign_key),
        defaultValue: row.column_default as string | undefined,
        maxLength: row.max_length as number | undefined,
        precision: row.precision as number | undefined,
        scale: row.scale as number | undefined,
      };

      if (row.ref_table) {
        column.references = {
          table: row.ref_table as string,
          column: row.ref_column as string,
          schema: row.ref_schema as string,
        };
      }

      columnsByTable.get(tableName)!.push(column);
    }

    // Build table schemas
    return tablesResult.rows.map((row) => ({
      name: row.table_name as string,
      schema: row.table_schema as string,
      columns: columnsByTable.get(row.table_name as string) ?? [],
    }));
  }

  /**
   * Get all foreign key relationships
   */
  async getRelationships(): Promise<TableRelationship[]> {
    const schema = this.getSchema();

    const query = `
      SELECT 
        fk.name as constraint_name,
        tp.name as parent_table,
        SCHEMA_NAME(tp.schema_id) as parent_schema,
        cp.name as parent_column,
        tr.name as referenced_table,
        SCHEMA_NAME(tr.schema_id) as referenced_schema,
        cr.name as referenced_column
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
      INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
      INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      WHERE SCHEMA_NAME(tp.schema_id) = @schema
      ORDER BY fk.name
    `;

    const result = await this.executeQuery(query, { schema });

    return result.rows.map((row) => ({
      name: row.constraint_name as string,
      fromTable: row.parent_table as string,
      fromSchema: row.parent_schema as string,
      fromColumn: row.parent_column as string,
      toTable: row.referenced_table as string,
      toSchema: row.referenced_schema as string,
      toColumn: row.referenced_column as string,
    }));
  }

  /**
   * Quote an identifier for SQL Server
   */
  quoteIdentifier(identifier: string): string {
    // Escape any existing brackets
    const escaped = identifier.replace(/\]/g, "]]");
    return `[${escaped}]`;
  }

  /**
   * Normalize MSSQL column metadata to common format
   */
  protected normalizeFieldMetadata(columns: unknown): FieldMetadata[] {
    if (!columns || typeof columns !== "object" || Array.isArray(columns)) {
      return [];
    }

    const columnsRecord = columns as Record<string, unknown>;
    const fields: FieldMetadata[] = [];
    for (const [name, col] of Object.entries(columnsRecord)) {
      const column = col as Record<string, unknown>;
      const columnType = column.type as Record<string, unknown> | undefined;
      fields.push({
        name,
        dataType: this.mapDataType(String(columnType?.name ?? column.type ?? "unknown")),
        nullable: column.nullable as boolean | undefined,
      });
    }
    return fields;
  }

  /**
   * Map SQL Server data types to normalized types
   */
  protected mapDataType(nativeType: string): string {
    const type = nativeType.toLowerCase();

    // Integer types
    if (["int", "bigint", "smallint", "tinyint"].includes(type)) {
      return "integer";
    }

    // Decimal types
    if (["decimal", "numeric", "money", "smallmoney"].includes(type)) {
      return "decimal";
    }

    // Float types
    if (["float", "real"].includes(type)) {
      return "float";
    }

    // String types
    if (["char", "varchar", "nchar", "nvarchar", "text", "ntext"].includes(type)) {
      return "string";
    }

    // Date/time types
    if (["date", "datetime", "datetime2", "smalldatetime", "datetimeoffset"].includes(type)) {
      return "datetime";
    }

    if (type === "time") {
      return "time";
    }

    // Boolean
    if (type === "bit") {
      return "boolean";
    }

    // Binary
    if (["binary", "varbinary", "image"].includes(type)) {
      return "binary";
    }

    // UUID
    if (type === "uniqueidentifier") {
      return "uuid";
    }

    // XML/JSON
    if (type === "xml") {
      return "xml";
    }

    return type;
  }

  /**
   * Infer mssql type from JavaScript value
   */
  private inferSqlType(value: unknown): mssql.ISqlTypeWithLength {
    if (value === null || value === undefined) {
      return mssql.NVarChar as unknown as mssql.ISqlTypeWithLength;
    }

    switch (typeof value) {
      case "number":
        return Number.isInteger(value)
          ? (mssql.Int as unknown as mssql.ISqlTypeWithLength)
          : (mssql.Float as unknown as mssql.ISqlTypeWithLength);
      case "boolean":
        return mssql.Bit as unknown as mssql.ISqlTypeWithLength;
      case "string":
        return mssql.NVarChar as unknown as mssql.ISqlTypeWithLength;
      case "object":
        if (value instanceof Date) {
          return mssql.DateTime as unknown as mssql.ISqlTypeWithLength;
        }
        if (Buffer.isBuffer(value)) {
          return mssql.VarBinary as unknown as mssql.ISqlTypeWithLength;
        }
        return mssql.NVarChar as unknown as mssql.ISqlTypeWithLength;
      default:
        return mssql.NVarChar as unknown as mssql.ISqlTypeWithLength;
    }
  }
}

/**
 * Create a new MSSQL client instance
 */
export function createMssqlClient(
  config: SqlConnectorConfig,
  credentials: SqlCredentials,
): MssqlClient {
  return new MssqlClient(config, credentials);
}
