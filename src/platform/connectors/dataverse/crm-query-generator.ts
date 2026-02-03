/**
 * CRM Query Generator
 *
 * Generates SQL queries for Dataverse from natural language prompts.
 * Uses entity metadata and schema hints for accurate query generation.
 */

import { EntityMetadataManager, SchemaContext } from "./entity-metadata.js";
import { SchemaHint } from "./types.js";

/**
 * Query generation options
 */
export interface QueryGenerationOptions {
  /** Maximum number of results */
  maxResults?: number;
  /** Additional context for the LLM */
  additionalContext?: string;
}

/**
 * Query generation result
 */
export interface QueryGenerationResult {
  /** Generated SQL query */
  sql: string;
  /** Entities involved in the query */
  entities: string[];
  /** Confidence score (0-1) */
  confidence: number;
  /** Explanation of the query */
  explanation?: string;
  /** Warnings about potential issues */
  warnings?: string[];
}

/**
 * LLM interface for query generation
 */
export interface LLMProvider {
  generate(prompt: string, systemPrompt?: string): Promise<string>;
}

/**
 * Simple LLM provider that returns a static response (for testing)
 */
export class MockLLMProvider implements LLMProvider {
  private responses: Map<string, string> = new Map();

  setResponse(prompt: string, response: string): void {
    this.responses.set(prompt, response);
  }

  async generate(prompt: string): Promise<string> {
    // Check for exact match
    if (this.responses.has(prompt)) {
      return this.responses.get(prompt)!;
    }

    // Generate a simple query based on common patterns
    const promptLower = prompt.toLowerCase();

    if (promptLower.includes("active") && promptLower.includes("contact")) {
      return "SELECT TOP 100 contactid, fullname, emailaddress1, telephone1 FROM contact WHERE statecode = 0";
    }

    if (promptLower.includes("account") && promptLower.includes("revenue")) {
      return "SELECT TOP 100 accountid, name, revenue FROM account WHERE statecode = 0 ORDER BY revenue DESC";
    }

    if (promptLower.includes("opportunity") && promptLower.includes("won")) {
      return "SELECT TOP 100 opportunityid, name, actualvalue FROM opportunity WHERE statecode = 1 AND statuscode = 3";
    }

    // Default fallback
    return "SELECT TOP 100 * FROM contact WHERE statecode = 0";
  }
}

/**
 * CRM Query Generator
 *
 * Generates SQL queries for Dataverse from natural language prompts
 * using entity metadata and schema hints.
 */
export class CrmQueryGenerator {
  private metadataManager: EntityMetadataManager;
  private llmProvider: LLMProvider;
  private hints: Map<string, SchemaHint[]> = new Map(); // connectorId -> hints

  constructor(metadataManager: EntityMetadataManager, llmProvider: LLMProvider) {
    this.metadataManager = metadataManager;
    this.llmProvider = llmProvider;
  }

  /**
   * Generate a SQL query from natural language
   */
  async generateQuery(
    prompt: string,
    connectorId: string,
    options: QueryGenerationOptions = {},
  ): Promise<QueryGenerationResult> {
    // Detect entities from prompt
    const detectedEntities = this.detectEntities(prompt);

    // Get schema context
    const hints = this.hints.get(connectorId) ?? [];
    const schemaContext = await this.metadataManager.buildSchemaContext(detectedEntities, hints);

    // Build LLM prompt
    const systemPrompt = this.buildSystemPrompt(schemaContext, options);
    const userPrompt = this.buildUserPrompt(prompt, schemaContext);

    // Generate query via LLM
    const response = await this.llmProvider.generate(userPrompt, systemPrompt);

    // Parse response
    const sql = this.extractSql(response);
    const explanation = this.extractExplanation(response);
    const warnings = this.validateQuery(sql, schemaContext);

    return {
      sql,
      entities: detectedEntities,
      confidence: this.calculateConfidence(sql, detectedEntities, schemaContext),
      explanation,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Detect likely entities from the prompt
   */
  private detectEntities(prompt: string): string[] {
    const promptLower = prompt.toLowerCase();
    const detected: string[] = [];

    // Common CRM entities
    const entityKeywords: Record<string, string[]> = {
      contact: ["contact", "contacts", "person", "people", "customer"],
      account: ["account", "accounts", "company", "companies", "organization"],
      lead: ["lead", "leads", "prospect"],
      opportunity: ["opportunity", "opportunities", "deal", "deals", "pipeline"],
      incident: ["case", "cases", "incident", "incidents", "ticket", "tickets"],
      task: ["task", "tasks", "activity", "activities"],
      appointment: ["appointment", "appointments", "meeting", "meetings"],
      email: ["email", "emails"],
      phonecall: ["call", "calls", "phone"],
      systemuser: ["user", "users", "owner", "team member"],
    };

    for (const [entity, keywords] of Object.entries(entityKeywords)) {
      if (keywords.some((kw) => promptLower.includes(kw))) {
        detected.push(entity);
      }
    }

    // Default to contact if no entities detected
    if (detected.length === 0) {
      detected.push("contact");
    }

    return detected;
  }

  /**
   * Build system prompt for query generation
   */
  private buildSystemPrompt(context: SchemaContext, options: QueryGenerationOptions): string {
    return `You are a SQL query generator for Microsoft Dataverse (Dynamics CRM).
Generate SQL queries that can be executed via the Dataverse TDS endpoint.

IMPORTANT RULES:
1. Only generate SELECT queries (TDS is read-only)
2. Use TOP ${options.maxResults ?? 100} to limit results
3. Always filter by statecode = 0 for active records unless specifically asked for inactive
4. Use proper column names from the schema (case-sensitive)
5. Wrap your SQL in \`\`\`sql code blocks

${context.dialectNotes.map((n) => `- ${n}`).join("\n")}

${context.hints.length > 0 ? `\nBUSINESS RULES:\n${context.hints.map((h) => `- ${h}`).join("\n")}` : ""}

Respond with:
1. The SQL query in a code block
2. A brief explanation of what the query does`;
  }

  /**
   * Build user prompt with schema context
   */
  private buildUserPrompt(prompt: string, context: SchemaContext): string {
    let userPrompt = `Generate a SQL query for: "${prompt}"\n\nAvailable entities:\n`;

    for (const entity of context.entities) {
      userPrompt += `\n${entity.name} (${entity.displayName})\n`;
      userPrompt += `  Primary ID: ${entity.primaryId}\n`;
      userPrompt += `  Columns: ${entity.columns.map((c) => c.name).join(", ")}\n`;
    }

    return userPrompt;
  }

  /**
   * Extract SQL from LLM response
   */
  private extractSql(response: string): string {
    // Try to extract from code block
    const sqlBlockMatch = response.match(/```sql\n?([\s\S]*?)```/i);
    if (sqlBlockMatch) {
      return sqlBlockMatch[1].trim();
    }

    // Try to extract from generic code block
    const codeBlockMatch = response.match(/```\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to find SELECT statement
    const selectMatch = response.match(/SELECT[\s\S]*?(?:;|$)/i);
    if (selectMatch) {
      return selectMatch[0].replace(/;$/, "").trim();
    }

    // Return cleaned response
    return response.trim();
  }

  /**
   * Extract explanation from LLM response
   */
  private extractExplanation(response: string): string | undefined {
    // Look for text after the code block
    const afterCodeBlock = response.split("```").pop()?.trim();
    if (afterCodeBlock && afterCodeBlock.length > 10) {
      return afterCodeBlock;
    }
    return undefined;
  }

  /**
   * Validate query and return warnings
   */
  private validateQuery(sql: string, context: SchemaContext): string[] {
    const warnings: string[] = [];
    const sqlUpper = sql.toUpperCase();

    // Check for missing statecode filter
    if (!sql.toLowerCase().includes("statecode")) {
      warnings.push(
        'Query does not filter by statecode. Consider adding "statecode = 0" for active records.',
      );
    }

    // Check for TOP clause
    if (!sqlUpper.includes("TOP")) {
      warnings.push("Query does not include TOP clause. Results may be large.");
    }

    // Check for SELECT * (handles SELECT TOP n * pattern)
    if (/SELECT\s+(TOP\s+\d+\s+)?\*/i.test(sql)) {
      warnings.push("Using SELECT * may return unnecessary columns. Consider specifying columns.");
    }

    // Check for write operations
    const writeOps = ["INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER"];
    for (const op of writeOps) {
      if (sqlUpper.includes(op)) {
        warnings.push(
          `Query contains ${op} which is not supported by Dataverse TDS. Use REST API for write operations.`,
        );
      }
    }

    return warnings;
  }

  /**
   * Calculate confidence score for generated query
   */
  private calculateConfidence(sql: string, entities: string[], context: SchemaContext): number {
    let score = 0.5; // Base score

    // Boost for having required elements
    if (sql.toUpperCase().includes("SELECT")) score += 0.1;
    if (sql.toLowerCase().includes("statecode")) score += 0.1;
    if (sql.toUpperCase().includes("TOP")) score += 0.05;

    // Boost for using known entities
    for (const entity of entities) {
      if (sql.toLowerCase().includes(entity.toLowerCase())) {
        score += 0.1;
      }
    }

    // Penalty for SELECT *
    if (sql.toUpperCase().includes("SELECT *")) score -= 0.1;

    // Penalty for write operations
    const writeOps = ["INSERT", "UPDATE", "DELETE"];
    for (const op of writeOps) {
      if (sql.toUpperCase().includes(op)) score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Add schema hints for a connector
   */
  addHints(connectorId: string, hints: SchemaHint[]): void {
    const existing = this.hints.get(connectorId) ?? [];
    this.hints.set(connectorId, [...existing, ...hints]);
  }

  /**
   * Remove hints for a connector
   */
  removeHints(connectorId: string, descriptions: string[]): void {
    const existing = this.hints.get(connectorId) ?? [];
    this.hints.set(
      connectorId,
      existing.filter((h) => !descriptions.includes(h.description)),
    );
  }

  /**
   * Get hints for a connector
   */
  getHints(connectorId: string): SchemaHint[] {
    return this.hints.get(connectorId) ?? [];
  }

  /**
   * Clear all hints for a connector
   */
  clearHints(connectorId: string): void {
    this.hints.delete(connectorId);
  }

  /**
   * Get default hints for common CRM patterns
   */
  static getDefaultHints(): SchemaHint[] {
    return [
      {
        entityName: "contact",
        description: "Active contacts have statecode = 0",
        pattern: "WHERE statecode = 0",
      },
      {
        entityName: "account",
        description: "Active accounts have statecode = 0",
        pattern: "WHERE statecode = 0",
      },
      {
        entityName: "opportunity",
        description: "Open opportunities have statecode = 0, Won = statecode 1 AND statuscode 3",
        pattern: "WHERE statecode = 1 AND statuscode = 3 -- for Won",
      },
      {
        entityName: "lead",
        description: "Open leads have statecode = 0, Qualified = statecode 1",
        pattern: "WHERE statecode = 0 -- for Open",
      },
      {
        entityName: "incident",
        description: "Active cases have statecode = 0",
        pattern: "WHERE statecode = 0",
      },
    ];
  }
}

/**
 * Create a CRM query generator
 */
export function createQueryGenerator(
  metadataManager: EntityMetadataManager,
  llmProvider?: LLMProvider,
): CrmQueryGenerator {
  return new CrmQueryGenerator(metadataManager, llmProvider ?? new MockLLMProvider());
}
