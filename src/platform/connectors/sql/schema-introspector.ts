/**
 * Schema Introspector
 *
 * Discovers and caches database schema information.
 * Used for query generation context and schema exploration.
 */

import type { SqlConnector } from "./sql-connector.js";
import type { TableSchema, TableRelationship, SchemaCache, SqlDialect } from "./types.js";

/**
 * Schema introspector for SQL databases
 */
export class SchemaIntrospector {
  private cache = new Map<string, SchemaCache>();
  private defaultCacheTtlMs = 60 * 60 * 1000; // 1 hour

  /**
   * Get all tables from a connector
   */
  async getTables(connector: SqlConnector): Promise<TableSchema[]> {
    return connector.getTables();
  }

  /**
   * Get all foreign key relationships from a connector
   */
  async getRelationships(connector: SqlConnector): Promise<TableRelationship[]> {
    return connector.getRelationships();
  }

  /**
   * Get cached schema or refresh if expired
   */
  async getSchemaWithCache(
    connectorId: string,
    connector: SqlConnector,
    forceRefresh = false,
  ): Promise<SchemaCache> {
    const existing = this.cache.get(connectorId);

    if (!forceRefresh && existing && existing.expiresAt > new Date()) {
      return existing;
    }

    return this.refreshSchemaCache(connectorId, connector);
  }

  /**
   * Refresh the schema cache for a connector
   */
  async refreshSchemaCache(
    connectorId: string,
    connector: SqlConnector,
    ttlMs = this.defaultCacheTtlMs,
  ): Promise<SchemaCache> {
    const [tables, relationships] = await Promise.all([
      connector.getTables(),
      connector.getRelationships(),
    ]);

    const now = new Date();
    const cache: SchemaCache = {
      connectorId,
      tables,
      relationships,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
    };

    this.cache.set(connectorId, cache);
    return cache;
  }

  /**
   * Invalidate the cache for a connector
   */
  invalidateCache(connectorId: string): boolean {
    return this.cache.delete(connectorId);
  }

  /**
   * Clear all cached schemas
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Check if cache exists and is valid
   */
  isCacheValid(connectorId: string): boolean {
    const existing = this.cache.get(connectorId);
    return existing !== undefined && existing.expiresAt > new Date();
  }

  /**
   * Get cached schema (returns undefined if not cached or expired)
   */
  getCachedSchema(connectorId: string): SchemaCache | undefined {
    const existing = this.cache.get(connectorId);
    if (existing && existing.expiresAt > new Date()) {
      return existing;
    }
    return undefined;
  }

  /**
   * Build a text summary of the schema for LLM context
   */
  buildSchemaContext(cache: SchemaCache, dialect: SqlDialect): string {
    const lines: string[] = [];

    lines.push(`Database dialect: ${dialect}`);
    lines.push(`Tables (${cache.tables.length}):`);
    lines.push("");

    for (const table of cache.tables) {
      const fullName = `${table.schema}.${table.name}`;
      lines.push(`Table: ${fullName}`);

      if (table.description) {
        lines.push(`  Description: ${table.description}`);
      }

      lines.push(`  Columns:`);
      for (const column of table.columns) {
        let columnLine = `    - ${column.name}: ${column.dataType}`;

        if (!column.nullable) {
          columnLine += " NOT NULL";
        }

        if (column.isPrimaryKey) {
          columnLine += " (PK)";
        }

        if (column.isForeignKey && column.references) {
          columnLine += ` -> ${column.references.table}.${column.references.column}`;
        }

        if (column.description) {
          columnLine += ` -- ${column.description}`;
        }

        lines.push(columnLine);
      }
      lines.push("");
    }

    if (cache.relationships.length > 0) {
      lines.push(`Relationships (${cache.relationships.length}):`);
      for (const rel of cache.relationships) {
        lines.push(
          `  ${rel.fromSchema}.${rel.fromTable}.${rel.fromColumn} -> ` +
            `${rel.toSchema}.${rel.toTable}.${rel.toColumn}`,
        );
      }
    }

    return lines.join("\n");
  }

  /**
   * Build a compact schema summary for smaller context windows
   */
  buildCompactSchemaContext(cache: SchemaCache): string {
    const lines: string[] = [];

    for (const table of cache.tables) {
      const pkColumns = table.columns
        .filter((c) => c.isPrimaryKey)
        .map((c) => c.name)
        .join(", ");

      const columnNames = table.columns.map((c) => c.name).join(", ");

      lines.push(`${table.schema}.${table.name} (${pkColumns || "no pk"}): ${columnNames}`);
    }

    return lines.join("\n");
  }

  /**
   * Find tables that match a search term
   */
  findTables(cache: SchemaCache, searchTerm: string): TableSchema[] {
    const term = searchTerm.toLowerCase();

    return cache.tables.filter(
      (table) =>
        table.name.toLowerCase().includes(term) ||
        table.description?.toLowerCase().includes(term) ||
        table.columns.some(
          (col) =>
            col.name.toLowerCase().includes(term) || col.description?.toLowerCase().includes(term),
        ),
    );
  }

  /**
   * Get a specific table by name
   */
  findTable(cache: SchemaCache, tableName: string, schemaName?: string): TableSchema | undefined {
    const normalizedName = tableName.toLowerCase();
    const normalizedSchema = schemaName?.toLowerCase();

    return cache.tables.find(
      (table) =>
        table.name.toLowerCase() === normalizedName &&
        (normalizedSchema === undefined || table.schema.toLowerCase() === normalizedSchema),
    );
  }

  /**
   * Get relationships for a specific table
   */
  getTableRelationships(
    cache: SchemaCache,
    tableName: string,
    schemaName?: string,
  ): { incoming: TableRelationship[]; outgoing: TableRelationship[] } {
    const normalizedName = tableName.toLowerCase();
    const normalizedSchema = schemaName?.toLowerCase();

    const matchesTable = (table: string, schema: string) =>
      table.toLowerCase() === normalizedName &&
      (normalizedSchema === undefined || schema.toLowerCase() === normalizedSchema);

    return {
      incoming: cache.relationships.filter((rel) => matchesTable(rel.toTable, rel.toSchema)),
      outgoing: cache.relationships.filter((rel) => matchesTable(rel.fromTable, rel.fromSchema)),
    };
  }

  /**
   * Generate dialect-specific introspection queries
   */
  static getIntrospectionQueries(dialect: SqlDialect): {
    tables: string;
    columns: string;
    relationships: string;
  } {
    if (dialect === "mssql") {
      return {
        tables: `
          SELECT TABLE_NAME, TABLE_SCHEMA
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_NAME
        `,
        columns: `
          SELECT 
            TABLE_NAME, COLUMN_NAME, DATA_TYPE, 
            IS_NULLABLE, COLUMN_DEFAULT,
            CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
          FROM INFORMATION_SCHEMA.COLUMNS
          ORDER BY TABLE_NAME, ORDINAL_POSITION
        `,
        relationships: `
          SELECT 
            fk.name as constraint_name,
            tp.name as parent_table,
            cp.name as parent_column,
            tr.name as referenced_table,
            cr.name as referenced_column
          FROM sys.foreign_keys fk
          INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
          INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
          INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id 
            AND fkc.parent_column_id = cp.column_id
          INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
          INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id 
            AND fkc.referenced_column_id = cr.column_id
        `,
      };
    }

    // PostgreSQL
    return {
      tables: `
        SELECT table_name, table_schema
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
          AND table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_name
      `,
      columns: `
        SELECT 
          table_name, column_name, data_type, udt_name,
          is_nullable, column_default,
          character_maximum_length, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_name, ordinal_position
      `,
      relationships: `
        SELECT
          tc.constraint_name,
          kcu.table_name as from_table,
          kcu.column_name as from_column,
          ccu.table_name as to_table,
          ccu.column_name as to_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
      `,
    };
  }
}

/**
 * Create a new schema introspector instance
 */
export function createSchemaIntrospector(): SchemaIntrospector {
  return new SchemaIntrospector();
}
