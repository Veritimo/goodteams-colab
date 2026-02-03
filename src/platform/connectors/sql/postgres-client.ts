/**
 * PostgreSQL Client
 *
 * PostgreSQL connector implementation using the pg package.
 * Supports connection pooling and parameterized queries.
 */

import { Pool, type PoolConfig, type QueryResult, type PoolClient } from "pg";
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
 * PostgreSQL connector implementation
 */
export class PostgresClient extends SqlConnector {
  private pool: Pool | null = null;

  constructor(config: SqlConnectorConfig, credentials: SqlCredentials) {
    super(mergeWithDefaults(config), credentials);
  }

  get dialect(): SqlDialect {
    return "postgres";
  }

  get defaultSchema(): string {
    return "public";
  }

  /**
   * Connect to PostgreSQL
   */
  async connect(): Promise<void> {
    if (this.connected && this.pool) {
      return;
    }

    const poolConfig: PoolConfig = {
      user: this.credentials.username,
      password: this.credentials.password,
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      ssl: this.config.encrypt
        ? {
            rejectUnauthorized: !this.config.trustServerCertificate,
          }
        : undefined,
      connectionTimeoutMillis: this.config.connectionTimeout ?? 30000,
      idleTimeoutMillis: this.config.poolIdleTimeout ?? 30000,
      max: this.config.poolMax ?? 10,
      min: this.config.poolMin ?? 0,
    };

    this.pool = new Pool(poolConfig);

    // Test the connection
    const client = await this.pool.connect();
    client.release();
    this.connected = true;
  }

  /**
   * Disconnect from PostgreSQL
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
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

    // Convert named parameters to positional parameters for pg
    const { text, values } = this.convertNamedParams(sql, params);

    const result: QueryResult = await this.pool.query(text, values);

    return {
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
      fields: this.normalizeFieldMetadata(result.fields ?? []),
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
        t.table_name,
        t.table_schema,
        obj_description(pgc.oid) as table_description
      FROM information_schema.tables t
      LEFT JOIN pg_catalog.pg_class pgc ON pgc.relname = t.table_name
      LEFT JOIN pg_catalog.pg_namespace pgn ON pgn.oid = pgc.relnamespace 
        AND pgn.nspname = t.table_schema
      WHERE t.table_type = 'BASE TABLE'
        AND t.table_schema = $1
      ORDER BY t.table_name
    `;

    const columnsQuery = `
      SELECT 
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length as max_length,
        c.numeric_precision as precision,
        c.numeric_scale as scale,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
        CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
        fk.foreign_table_name as ref_table,
        fk.foreign_column_name as ref_column,
        fk.foreign_table_schema as ref_schema,
        col_description(
          (c.table_schema || '.' || c.table_name)::regclass, 
          c.ordinal_position
        ) as column_description
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1
      ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
      LEFT JOIN (
        SELECT 
          kcu.table_name,
          kcu.column_name,
          ccu.table_name as foreign_table_name,
          ccu.column_name as foreign_column_name,
          ccu.table_schema as foreign_table_schema
        FROM information_schema.referential_constraints rc
        JOIN information_schema.key_column_usage kcu
          ON rc.constraint_name = kcu.constraint_name
          AND rc.constraint_schema = kcu.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
          ON rc.unique_constraint_name = ccu.constraint_name
          AND rc.unique_constraint_schema = ccu.constraint_schema
        WHERE kcu.table_schema = $1
      ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
      WHERE c.table_schema = $1
      ORDER BY c.table_name, c.ordinal_position
    `;

    const [tablesResult, columnsResult] = await Promise.all([
      this.pool!.query(tablesQuery, [schema]),
      this.pool!.query(columnsQuery, [schema]),
    ]);

    // Group columns by table
    const columnsByTable = new Map<string, ColumnSchema[]>();
    for (const row of columnsResult.rows) {
      const tableName = row.table_name as string;
      if (!columnsByTable.has(tableName)) {
        columnsByTable.set(tableName, []);
      }

      const column: ColumnSchema = {
        name: row.column_name,
        dataType: this.mapDataType(row.udt_name || row.data_type),
        nullable: row.is_nullable === "YES",
        isPrimaryKey: Boolean(row.is_primary_key),
        isForeignKey: Boolean(row.is_foreign_key),
        defaultValue: row.column_default ?? undefined,
        description: row.column_description ?? undefined,
        maxLength: row.max_length ?? undefined,
        precision: row.precision ?? undefined,
        scale: row.scale ?? undefined,
      };

      if (row.ref_table) {
        column.references = {
          table: row.ref_table,
          column: row.ref_column,
          schema: row.ref_schema,
        };
      }

      columnsByTable.get(tableName)!.push(column);
    }

    // Build table schemas
    return tablesResult.rows.map((row) => ({
      name: row.table_name,
      schema: row.table_schema,
      columns: columnsByTable.get(row.table_name) ?? [],
      description: row.table_description ?? undefined,
    }));
  }

  /**
   * Get all foreign key relationships
   */
  async getRelationships(): Promise<TableRelationship[]> {
    const schema = this.getSchema();

    const query = `
      SELECT
        tc.constraint_name,
        kcu.table_name as from_table,
        kcu.table_schema as from_schema,
        kcu.column_name as from_column,
        ccu.table_name as to_table,
        ccu.table_schema as to_schema,
        ccu.column_name as to_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
      ORDER BY tc.constraint_name
    `;

    const result = await this.pool!.query(query, [schema]);

    return result.rows.map((row) => ({
      name: row.constraint_name,
      fromTable: row.from_table,
      fromSchema: row.from_schema,
      fromColumn: row.from_column,
      toTable: row.to_table,
      toSchema: row.to_schema,
      toColumn: row.to_column,
    }));
  }

  /**
   * Quote an identifier for PostgreSQL
   */
  quoteIdentifier(identifier: string): string {
    // Escape any existing double quotes
    const escaped = identifier.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  /**
   * Convert named parameters (@name) to positional parameters ($1, $2, ...)
   */
  private convertNamedParams(
    sql: string,
    params?: Record<string, unknown>,
  ): { text: string; values: unknown[] } {
    if (!params || Object.keys(params).length === 0) {
      return { text: sql, values: [] };
    }

    const values: unknown[] = [];
    const paramMap = new Map<string, number>();

    // Replace @paramName with $N
    const text = sql.replace(/@(\w+)/g, (_, name) => {
      if (!paramMap.has(name)) {
        if (!(name in params)) {
          throw new Error(`Missing parameter: @${name}`);
        }
        paramMap.set(name, values.length + 1);
        values.push(params[name]);
      }
      return `$${paramMap.get(name)}`;
    });

    return { text, values };
  }

  /**
   * Normalize PostgreSQL field metadata to common format
   */
  protected normalizeFieldMetadata(fields: unknown): FieldMetadata[] {
    if (!Array.isArray(fields)) {
      return [];
    }

    return fields.map((field: unknown) => {
      const f = field as Record<string, unknown>;
      return {
        name: String(f.name ?? ""),
        dataType: this.mapDataType(String(f.dataTypeID ?? f.format ?? "unknown")),
        nullable: true, // pg doesn't provide this in result fields
      };
    });
  }

  /**
   * Map PostgreSQL data types to normalized types
   */
  protected mapDataType(nativeType: string): string {
    const type = nativeType.toLowerCase();

    // Integer types
    if (
      ["int2", "int4", "int8", "smallint", "integer", "bigint", "serial", "bigserial"].includes(
        type,
      )
    ) {
      return "integer";
    }

    // Decimal types
    if (["numeric", "decimal", "money"].includes(type)) {
      return "decimal";
    }

    // Float types
    if (["float4", "float8", "real", "double precision"].includes(type)) {
      return "float";
    }

    // String types
    if (
      ["char", "varchar", "text", "bpchar", "name"].includes(type) ||
      type.startsWith("varchar")
    ) {
      return "string";
    }

    // Date/time types
    if (["timestamp", "timestamptz", "date"].includes(type)) {
      return "datetime";
    }

    if (["time", "timetz"].includes(type)) {
      return "time";
    }

    if (type === "interval") {
      return "interval";
    }

    // Boolean
    if (["bool", "boolean"].includes(type)) {
      return "boolean";
    }

    // Binary
    if (type === "bytea") {
      return "binary";
    }

    // UUID
    if (type === "uuid") {
      return "uuid";
    }

    // JSON types
    if (["json", "jsonb"].includes(type)) {
      return "json";
    }

    // Array types
    if (type.startsWith("_") || type.endsWith("[]")) {
      return "array";
    }

    // XML
    if (type === "xml") {
      return "xml";
    }

    // Geometric types
    if (["point", "line", "lseg", "box", "path", "polygon", "circle"].includes(type)) {
      return "geometry";
    }

    // Network types
    if (["inet", "cidr", "macaddr", "macaddr8"].includes(type)) {
      return "network";
    }

    return type;
  }
}

/**
 * Create a new PostgreSQL client instance
 */
export function createPostgresClient(
  config: SqlConnectorConfig,
  credentials: SqlCredentials,
): PostgresClient {
  return new PostgresClient(config, credentials);
}
