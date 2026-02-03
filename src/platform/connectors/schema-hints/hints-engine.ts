/**
 * Hints Engine
 *
 * Apply schema hints to query context and format for LLM consumption.
 * Provides intelligent hint selection and formatting for query generation.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE6.md
 */

import type { SchemaHintRecord, SchemaTable, SchemaColumn, ConnectionType } from "../types.js";
import { listSchemaHints, getSchemaCache } from "./hints-service.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Query context with hints applied
 */
export interface QueryContext {
  /** Connection type for dialect-specific formatting */
  connectionType: ConnectionType;
  /** Schema tables */
  tables: SchemaTable[];
  /** Relevant hints for the query */
  hints: SchemaHintRecord[];
  /** Formatted hints string for LLM */
  formattedHints: string;
  /** Schema summary for LLM */
  schemaSummary: string;
}

/**
 * Options for hint formatting
 */
export interface HintFormatOptions {
  /** Include SQL/SOQL patterns */
  includePatterns?: boolean;
  /** Maximum hints to include */
  maxHints?: number;
  /** Group hints by table */
  groupByTable?: boolean;
  /** Format style */
  style?: "markdown" | "text" | "json";
}

/**
 * Options for getting relevant hints
 */
export interface RelevantHintsOptions {
  /** Tables mentioned in the query */
  tables?: string[];
  /** Columns mentioned in the query */
  columns?: string[];
  /** Keywords in the query */
  keywords?: string[];
  /** Maximum hints to return */
  maxHints?: number;
}

// =============================================================================
// HINTS ENGINE CLASS
// =============================================================================

/**
 * Engine for applying and formatting schema hints
 */
export class HintsEngine {
  private hintCache: Map<string, SchemaHintRecord[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private cacheTtlMs: number;

  constructor(cacheTtlMs = 60000) {
    this.cacheTtlMs = cacheTtlMs;
  }

  /**
   * Build query context with hints
   *
   * @param connectionId - Connection UUID
   * @param connectionType - Connection type
   * @param options - Options for hint selection
   * @returns Query context with hints
   */
  async buildContext(
    connectionId: string,
    connectionType: ConnectionType,
    options?: RelevantHintsOptions,
  ): Promise<QueryContext> {
    // Get hints (with caching)
    const allHints = await this.getHints(connectionId);

    // Get relevant hints based on options
    const hints = options ? this.filterRelevantHints(allHints, options) : allHints;

    // Get schema cache
    const schemaCache = await getSchemaCache(connectionId);
    const tables = schemaCache?.tables ?? [];

    // Format hints
    const formattedHints = this.formatHints(hints, { style: "markdown", includePatterns: true });

    // Build schema summary
    const schemaSummary = this.buildSchemaSummary(tables, connectionType);

    return {
      connectionType,
      tables,
      hints,
      formattedHints,
      schemaSummary,
    };
  }

  /**
   * Get hints for a connection (with caching)
   *
   * @param connectionId - Connection UUID
   * @returns Array of hints
   */
  async getHints(connectionId: string): Promise<SchemaHintRecord[]> {
    const now = Date.now();
    const expiry = this.cacheExpiry.get(connectionId);

    // Return cached if valid
    if (expiry && expiry > now) {
      const cached = this.hintCache.get(connectionId);
      if (cached) {
        return cached;
      }
    }

    // Fetch fresh hints
    const hints = await listSchemaHints(connectionId);

    // Update cache
    this.hintCache.set(connectionId, hints);
    this.cacheExpiry.set(connectionId, now + this.cacheTtlMs);

    return hints;
  }

  /**
   * Invalidate cache for a connection
   *
   * @param connectionId - Connection UUID
   */
  invalidateCache(connectionId: string): void {
    this.hintCache.delete(connectionId);
    this.cacheExpiry.delete(connectionId);
  }

  /**
   * Clear all cached hints
   */
  clearCache(): void {
    this.hintCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Filter relevant hints based on options
   */
  private filterRelevantHints(
    hints: SchemaHintRecord[],
    options: RelevantHintsOptions,
  ): SchemaHintRecord[] {
    const { tables, columns, keywords, maxHints } = options;

    let filtered = hints;

    // Filter by tables
    if (tables && tables.length > 0) {
      const tableSet = new Set(tables.map((t) => t.toLowerCase()));
      filtered = filtered.filter((h) => tableSet.has(h.tableName.toLowerCase()));
    }

    // Filter by columns
    if (columns && columns.length > 0) {
      const columnSet = new Set(columns.map((c) => c.toLowerCase()));
      filtered = filtered.filter((h) => !h.columnName || columnSet.has(h.columnName.toLowerCase()));
    }

    // Filter by keywords (search in description)
    if (keywords && keywords.length > 0) {
      const lowerKeywords = keywords.map((k) => k.toLowerCase());
      filtered = filtered.filter((h) =>
        lowerKeywords.some(
          (k) =>
            h.description.toLowerCase().includes(k) ||
            h.tableName.toLowerCase().includes(k) ||
            (h.columnName && h.columnName.toLowerCase().includes(k)),
        ),
      );
    }

    // Limit results
    if (maxHints && filtered.length > maxHints) {
      filtered = filtered.slice(0, maxHints);
    }

    return filtered;
  }

  /**
   * Format hints as string
   */
  formatHints(hints: SchemaHintRecord[], options?: HintFormatOptions): string {
    const opts: Required<HintFormatOptions> = {
      includePatterns: options?.includePatterns ?? true,
      maxHints: options?.maxHints ?? 50,
      groupByTable: options?.groupByTable ?? true,
      style: options?.style ?? "markdown",
    };

    const limitedHints = hints.slice(0, opts.maxHints);

    if (opts.style === "json") {
      return JSON.stringify(limitedHints, null, 2);
    }

    if (opts.groupByTable) {
      return this.formatHintsGrouped(limitedHints, opts);
    }

    return this.formatHintsFlat(limitedHints, opts);
  }

  /**
   * Format hints grouped by table
   */
  private formatHintsGrouped(
    hints: SchemaHintRecord[],
    options: Required<HintFormatOptions>,
  ): string {
    const groups = new Map<string, SchemaHintRecord[]>();

    for (const hint of hints) {
      const existing = groups.get(hint.tableName) ?? [];
      existing.push(hint);
      groups.set(hint.tableName, existing);
    }

    const lines: string[] = [];

    if (options.style === "markdown") {
      lines.push("## Business Rules\n");
    } else {
      lines.push("Business Rules:");
    }

    for (const [tableName, tableHints] of groups) {
      if (options.style === "markdown") {
        lines.push(`### ${tableName}\n`);
      } else {
        lines.push(`\n${tableName}:`);
      }

      for (const hint of tableHints) {
        const prefix = hint.columnName ? `${hint.columnName}: ` : "";
        const pattern =
          options.includePatterns && hint.pattern ? ` (Pattern: \`${hint.pattern}\`)` : "";

        if (options.style === "markdown") {
          lines.push(`- ${prefix}${hint.description}${pattern}`);
        } else {
          lines.push(`  - ${prefix}${hint.description}${pattern}`);
        }
      }

      if (options.style === "markdown") {
        lines.push("");
      }
    }

    return lines.join("\n").trim();
  }

  /**
   * Format hints as flat list
   */
  private formatHintsFlat(hints: SchemaHintRecord[], options: Required<HintFormatOptions>): string {
    const lines: string[] = [];

    if (options.style === "markdown") {
      lines.push("## Business Rules\n");
    } else {
      lines.push("Business Rules:");
    }

    for (const hint of hints) {
      const scope = hint.columnName ? `${hint.tableName}.${hint.columnName}` : hint.tableName;
      const pattern =
        options.includePatterns && hint.pattern ? ` (Pattern: \`${hint.pattern}\`)` : "";

      if (options.style === "markdown") {
        lines.push(`- **${scope}**: ${hint.description}${pattern}`);
      } else {
        lines.push(`- ${scope}: ${hint.description}${pattern}`);
      }
    }

    return lines.join("\n").trim();
  }

  /**
   * Build schema summary for LLM
   */
  buildSchemaSummary(tables: SchemaTable[], connectionType: ConnectionType): string {
    if (tables.length === 0) {
      return "No schema information available.";
    }

    const lines: string[] = [];
    lines.push(`## Database Schema (${connectionType})\n`);

    for (const table of tables) {
      const schemaPrefix = table.schema ? `${table.schema}.` : "";
      lines.push(`### ${schemaPrefix}${table.name}\n`);

      if (table.columns.length > 0) {
        lines.push("| Column | Type | Nullable | Key |");
        lines.push("|--------|------|----------|-----|");

        for (const col of table.columns) {
          const keyInfo = col.isPrimaryKey ? "PK" : col.isForeignKey ? "FK" : "";
          lines.push(`| ${col.name} | ${col.type} | ${col.nullable ? "Yes" : "No"} | ${keyInfo} |`);
        }

        lines.push("");
      }

      if (table.rowCount !== undefined) {
        lines.push(`*Approximate rows: ${table.rowCount.toLocaleString()}*\n`);
      }
    }

    return lines.join("\n").trim();
  }
}

// =============================================================================
// STANDALONE FUNCTIONS
// =============================================================================

/**
 * Apply hints to query context
 *
 * @param connectionId - Connection UUID
 * @param connectionType - Connection type
 * @param options - Options for hint selection
 * @returns Query context with hints
 */
export async function applyHintsToContext(
  connectionId: string,
  connectionType: ConnectionType,
  options?: RelevantHintsOptions,
): Promise<QueryContext> {
  const engine = new HintsEngine();
  return engine.buildContext(connectionId, connectionType, options);
}

/**
 * Format hints for LLM consumption
 *
 * @param hints - Schema hints
 * @param options - Format options
 * @returns Formatted string
 */
export function formatHintsForLLM(hints: SchemaHintRecord[], options?: HintFormatOptions): string {
  const engine = new HintsEngine();
  return engine.formatHints(hints, options);
}

/**
 * Get relevant hints for a query
 *
 * @param connectionId - Connection UUID
 * @param options - Options for hint selection
 * @returns Array of relevant hints
 */
export async function getRelevantHints(
  connectionId: string,
  options: RelevantHintsOptions,
): Promise<SchemaHintRecord[]> {
  const allHints = await listSchemaHints(connectionId);
  const engine = new HintsEngine();
  return (engine as any).filterRelevantHints(allHints, options);
}

/**
 * Build complete prompt context for query generation
 *
 * @param connectionId - Connection UUID
 * @param connectionType - Connection type
 * @param userPrompt - User's natural language query
 * @param options - Options
 * @returns Complete prompt context
 */
export async function buildQueryPromptContext(
  connectionId: string,
  connectionType: ConnectionType,
  userPrompt: string,
  options?: RelevantHintsOptions,
): Promise<string> {
  const context = await applyHintsToContext(connectionId, connectionType, options);

  const parts: string[] = [];

  // Add schema summary
  if (context.schemaSummary) {
    parts.push(context.schemaSummary);
    parts.push("");
  }

  // Add business rules
  if (context.formattedHints) {
    parts.push(context.formattedHints);
    parts.push("");
  }

  // Add user prompt
  parts.push("## User Query\n");
  parts.push(userPrompt);

  return parts.join("\n");
}
