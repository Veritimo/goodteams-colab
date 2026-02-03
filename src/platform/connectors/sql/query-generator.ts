/**
 * Query Generator
 *
 * Generates SQL queries from natural language prompts using LLM.
 * Includes schema context and business rules (hints) for accurate query generation.
 */

import type {
  SchemaCache,
  QueryGenerationHint,
  QueryGenerationOptions,
  GeneratedSqlResult,
  SqlDialect,
  SqlValidationResult,
} from "./types.js";
import { SchemaIntrospector } from "./schema-introspector.js";

/**
 * LLM interface for query generation
 * This can be injected for different LLM providers
 */
export interface LlmProvider {
  generate(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string>;
}

/**
 * Default mock LLM provider for testing
 */
export class MockLlmProvider implements LlmProvider {
  async generate(prompt: string): Promise<string> {
    // Simple pattern matching for testing
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes("all users") || lowerPrompt.includes("list users")) {
      return JSON.stringify({
        sql: "SELECT * FROM users",
        explanation: "Retrieves all rows from the users table",
        confidence: 0.9,
      });
    }

    if (lowerPrompt.includes("count")) {
      return JSON.stringify({
        sql: "SELECT COUNT(*) as count FROM users",
        explanation: "Counts all rows in the users table",
        confidence: 0.95,
      });
    }

    return JSON.stringify({
      sql: "SELECT * FROM table_name LIMIT 100",
      explanation: "Generic query - please provide more context",
      confidence: 0.5,
      warnings: ["Low confidence query - please verify"],
    });
  }
}

/**
 * Query generator for natural language to SQL conversion
 */
export class QueryGenerator {
  private llmProvider: LlmProvider;
  private schemaIntrospector: SchemaIntrospector;

  constructor(llmProvider?: LlmProvider, schemaIntrospector?: SchemaIntrospector) {
    this.llmProvider = llmProvider ?? new MockLlmProvider();
    this.schemaIntrospector = schemaIntrospector ?? new SchemaIntrospector();
  }

  /**
   * Generate SQL from a natural language prompt
   */
  async generateSql(
    prompt: string,
    schemaCache: SchemaCache,
    dialect: SqlDialect,
    hints: QueryGenerationHint[] = [],
    options: QueryGenerationOptions = {},
  ): Promise<GeneratedSqlResult> {
    // Build the context for the LLM
    const llmPrompt = this.buildLlmPrompt(prompt, schemaCache, dialect, hints, options);

    // Generate the SQL
    const response = await this.llmProvider.generate(llmPrompt, {
      temperature: 0.1, // Low temperature for deterministic SQL generation
      maxTokens: 2000,
    });

    // Parse the response
    const result = this.parseGeneratedResult(response, options);

    // Validate the SQL if read-only mode is enabled
    if (options.readOnly !== false) {
      const validation = this.validateSql(result.sql);
      if (!validation.valid) {
        result.warnings = [...(result.warnings ?? []), ...validation.errors];
      }
      if (validation.queryType && validation.queryType !== "SELECT") {
        result.warnings = [
          ...(result.warnings ?? []),
          `Query type ${validation.queryType} detected. Only SELECT queries are allowed in read-only mode.`,
        ];
      }
    }

    return result;
  }

  /**
   * Build the LLM prompt with schema context and hints
   */
  private buildLlmPrompt(
    userPrompt: string,
    schemaCache: SchemaCache,
    dialect: SqlDialect,
    hints: QueryGenerationHint[],
    options: QueryGenerationOptions,
  ): string {
    const schemaContext = this.schemaIntrospector.buildSchemaContext(schemaCache, dialect);

    const hintsContext =
      hints.length > 0
        ? `
Business Rules and Hints:
${hints.map((h) => `- ${h.tableName}${h.columnName ? `.${h.columnName}` : ""}: ${h.description}${h.pattern ? ` (Example: ${h.pattern})` : ""}`).join("\n")}
`
        : "";

    const constraintsContext = `
Constraints:
- Generate ${dialect.toUpperCase()} compatible SQL
- ${options.readOnly !== false ? "Only generate SELECT queries (read-only mode)" : "Writes allowed if necessary"}
- ${options.suggestedLimit ? `Include LIMIT ${options.suggestedLimit} unless user specifies otherwise` : "Use LIMIT 1000 as default unless user specifies otherwise"}
- Use proper parameter placeholders (@paramName for MSSQL, $1 for PostgreSQL will be converted)
- Always qualify column names with table aliases when joining
`;

    return `You are a SQL query generator. Generate a SQL query based on the user's request.

Schema:
${schemaContext}

${hintsContext}

${constraintsContext}

User Request: "${userPrompt}"

Respond with a JSON object containing:
- sql: The generated SQL query
- explanation: A brief explanation of what the query does
- parameters: Any extracted parameters as an object (optional)
- confidence: A confidence score from 0 to 1
- warnings: Any warnings or suggestions (optional array)

JSON Response:`;
  }

  /**
   * Parse the LLM response into a GeneratedSqlResult
   */
  private parseGeneratedResult(
    response: string,
    options: QueryGenerationOptions,
  ): GeneratedSqlResult {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(response.trim());

      return {
        sql: parsed.sql || "",
        explanation: parsed.explanation || "Query generated",
        parameters: parsed.parameters,
        confidence: parsed.confidence ?? 0.5,
        warnings: parsed.warnings,
      };
    } catch {
      // If not valid JSON, try to extract SQL from the response
      const sqlMatch = response.match(/```sql\s*([\s\S]*?)\s*```/);
      const sql = sqlMatch ? sqlMatch[1].trim() : response.trim();

      return {
        sql,
        explanation: "Query extracted from response",
        confidence: 0.3,
        warnings: ["Response was not in expected JSON format"],
      };
    }
  }

  /**
   * Validate SQL for safety and correctness
   */
  validateSql(sql: string): SqlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let queryType: string | undefined;
    const referencedTables: string[] = [];

    if (!sql || sql.trim().length === 0) {
      return {
        valid: false,
        errors: ["SQL query is empty"],
        warnings,
        queryType,
        referencedTables,
      };
    }

    const normalizedSql = sql.trim().toUpperCase();

    // Detect query type
    if (normalizedSql.startsWith("SELECT")) {
      queryType = "SELECT";
    } else if (normalizedSql.startsWith("INSERT")) {
      queryType = "INSERT";
    } else if (normalizedSql.startsWith("UPDATE")) {
      queryType = "UPDATE";
    } else if (normalizedSql.startsWith("DELETE")) {
      queryType = "DELETE";
    } else if (normalizedSql.startsWith("DROP")) {
      queryType = "DROP";
      errors.push("DROP statements are not allowed");
    } else if (normalizedSql.startsWith("TRUNCATE")) {
      queryType = "TRUNCATE";
      errors.push("TRUNCATE statements are not allowed");
    } else if (normalizedSql.startsWith("ALTER")) {
      queryType = "ALTER";
      errors.push("ALTER statements are not allowed");
    } else if (normalizedSql.startsWith("CREATE")) {
      queryType = "CREATE";
      errors.push("CREATE statements are not allowed");
    } else if (normalizedSql.startsWith("EXEC") || normalizedSql.startsWith("EXECUTE")) {
      queryType = "EXEC";
      errors.push("EXEC/EXECUTE statements are not allowed");
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      {
        pattern: /;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE|EXEC|EXECUTE)/i,
        message: "Multiple statements with dangerous operations detected",
      },
      { pattern: /--/g, message: "SQL comments detected - potential injection" },
      { pattern: /\/\*/g, message: "Block comments detected - potential injection" },
      { pattern: /xp_cmdshell/i, message: "xp_cmdshell is not allowed" },
      { pattern: /sp_executesql/i, message: "Dynamic SQL execution is not allowed" },
      { pattern: /INTO\s+OUTFILE/i, message: "File operations are not allowed" },
      { pattern: /LOAD_FILE/i, message: "File operations are not allowed" },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(sql)) {
        errors.push(message);
      }
    }

    // Extract table references (simplified)
    const fromMatch = sql.match(/FROM\s+([^\s,]+)/gi);
    const joinMatch = sql.match(/JOIN\s+([^\s]+)/gi);

    if (fromMatch) {
      for (const match of fromMatch) {
        const table = match.replace(/FROM\s+/i, "").replace(/[[\]"`]/g, "");
        referencedTables.push(table);
      }
    }

    if (joinMatch) {
      for (const match of joinMatch) {
        const table = match.replace(/JOIN\s+/i, "").replace(/[[\]"`]/g, "");
        referencedTables.push(table);
      }
    }

    // Warn about SELECT *
    if (/SELECT\s+\*/i.test(sql)) {
      warnings.push("SELECT * detected - consider specifying column names for better performance");
    }

    // Warn about missing WHERE clause in UPDATE/DELETE
    if ((queryType === "UPDATE" || queryType === "DELETE") && !/WHERE/i.test(sql)) {
      warnings.push(`${queryType} without WHERE clause - this will affect all rows`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      queryType,
      referencedTables: Array.from(new Set(referencedTables)),
    };
  }

  /**
   * Sanitize SQL by removing or escaping dangerous content
   */
  sanitizeSql(sql: string): string {
    // Remove multiple statements
    const firstStatement = sql.split(";")[0];

    // Remove comments
    let sanitized = firstStatement
      .replace(/--.*$/gm, "") // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ""); // Remove block comments

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Apply default LIMIT if not present
   */
  applyDefaultLimit(sql: string, limit: number): string {
    const normalizedSql = sql.toUpperCase();

    // Only apply to SELECT queries without existing LIMIT
    if (!normalizedSql.startsWith("SELECT") || /LIMIT\s+\d+/i.test(sql)) {
      return sql;
    }

    // Check for TOP clause (MSSQL)
    if (/SELECT\s+TOP\s+\d+/i.test(sql)) {
      return sql;
    }

    // Add LIMIT clause
    return `${sql.trim()}\nLIMIT ${limit}`;
  }

  /**
   * Convert LIMIT to TOP for MSSQL
   */
  convertLimitToTop(sql: string): string {
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (!limitMatch) {
      return sql;
    }

    const limit = limitMatch[1];
    let converted = sql.replace(/LIMIT\s+\d+/i, "");

    // Insert TOP after SELECT
    converted = converted.replace(/^SELECT/i, `SELECT TOP ${limit}`);

    return converted.trim();
  }
}

/**
 * Create a new query generator instance
 */
export function createQueryGenerator(
  llmProvider?: LlmProvider,
  schemaIntrospector?: SchemaIntrospector,
): QueryGenerator {
  return new QueryGenerator(llmProvider, schemaIntrospector);
}
