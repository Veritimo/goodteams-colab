/**
 * SOQL Generator
 *
 * Generates SOQL queries from natural language using LLM:
 * - Build context from object metadata + hints
 * - Handle Salesforce-specific patterns
 * - Generate valid SOQL queries
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE6.md
 */

import type { MetadataClient } from "./metadata-client.js";
import type { SObjectMetadata, SFieldMetadata, SoqlHint, GeneratedSoql } from "./types.js";
import { SalesforceConnectorError } from "./salesforce-connector.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * LLM provider interface for SOQL generation
 */
export interface LlmProvider {
  generate(prompt: string, systemPrompt?: string): Promise<string>;
}

/**
 * Options for SOQL generation
 */
export interface SoqlGenerationOptions {
  /** Natural language query */
  prompt: string;
  /** Objects to include in context (if not provided, uses relevant objects) */
  objects?: string[];
  /** Business rule hints */
  hints?: SoqlHint[];
  /** Maximum fields to include per object in context */
  maxFieldsPerObject?: number;
  /** Include record types in context */
  includeRecordTypes?: boolean;
  /** Include relationships in context */
  includeRelationships?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default max fields to include in context per object */
const DEFAULT_MAX_FIELDS_PER_OBJECT = 50;

/** Common Salesforce objects for context inference */
const COMMON_OBJECTS = [
  "Account",
  "Contact",
  "Lead",
  "Opportunity",
  "Case",
  "Task",
  "Event",
  "User",
  "Campaign",
  "CampaignMember",
  "Product2",
  "Pricebook2",
  "PricebookEntry",
  "Order",
  "OrderItem",
  "Asset",
  "Contract",
];

/** Salesforce-specific patterns for SOQL */
const SALESFORCE_PATTERNS = {
  activeRecords: "IsDeleted = false",
  closedWon: "StageName = 'Closed Won'",
  closedLost: "StageName = 'Closed Lost'",
  openOpportunities: "IsClosed = false",
  activeContacts: "IsDeleted = false",
  today: "TODAY",
  thisWeek: "THIS_WEEK",
  thisMonth: "THIS_MONTH",
  thisQuarter: "THIS_FISCAL_QUARTER",
  thisYear: "THIS_FISCAL_YEAR",
  lastNDays: "LAST_N_DAYS:",
  nextNDays: "NEXT_N_DAYS:",
};

// =============================================================================
// SOQL GENERATOR CLASS
// =============================================================================

/**
 * SOQL Generator
 *
 * Generates SOQL queries from natural language prompts.
 *
 * @example
 * ```typescript
 * const generator = new SoqlGenerator(metadataClient, llmProvider);
 *
 * // Generate SOQL from natural language
 * const result = await generator.generateSoql({
 *   prompt: 'Show me all opportunities worth more than $100k closing this quarter',
 *   hints: [
 *     { objectName: 'Opportunity', description: 'Amount is in USD' }
 *   ],
 * });
 *
 * console.log(result.soql);
 * // SELECT Id, Name, Amount, CloseDate FROM Opportunity
 * // WHERE Amount > 100000 AND CloseDate = THIS_FISCAL_QUARTER
 * ```
 */
export class SoqlGenerator {
  private metadataClient: MetadataClient;
  private llmProvider: LlmProvider;

  constructor(metadataClient: MetadataClient, llmProvider: LlmProvider) {
    this.metadataClient = metadataClient;
    this.llmProvider = llmProvider;
  }

  // ===========================================================================
  // MAIN GENERATION
  // ===========================================================================

  /**
   * Generate SOQL from natural language prompt
   */
  async generateSoql(options: SoqlGenerationOptions): Promise<GeneratedSoql> {
    const {
      prompt,
      objects,
      hints = [],
      maxFieldsPerObject = DEFAULT_MAX_FIELDS_PER_OBJECT,
      includeRecordTypes = true,
      includeRelationships = true,
    } = options;

    if (!prompt || prompt.trim() === "") {
      throw new SalesforceConnectorError("Prompt is required", "INVALID_PROMPT", 400);
    }

    try {
      // 1. Determine relevant objects
      const relevantObjects = objects ?? (await this.inferRelevantObjects(prompt));

      // 2. Get metadata for objects
      const metadata = await this.getObjectsMetadata(relevantObjects, {
        maxFields: maxFieldsPerObject,
        includeRecordTypes,
        includeRelationships,
      });

      // 3. Build context for LLM
      const context = this.buildContext(metadata, hints);

      // 4. Generate SOQL via LLM
      const systemPrompt = this.buildSystemPrompt(context);
      const llmResponse = await this.llmProvider.generate(prompt, systemPrompt);

      // 5. Extract and validate SOQL
      const soql = this.extractSoql(llmResponse);

      // 6. Build result
      return {
        soql,
        explanation: this.extractExplanation(llmResponse),
        objectsUsed: this.extractObjectsFromSoql(soql),
        fieldsUsed: this.extractFieldsFromSoql(soql),
        confidence: this.estimateConfidence(soql, metadata),
      };
    } catch (error) {
      if (error instanceof SalesforceConnectorError) {
        throw error;
      }
      throw new SalesforceConnectorError(
        `SOQL generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "GENERATION_ERROR",
        500,
        error,
      );
    }
  }

  /**
   * Generate SOQL for a specific connector (uses stored hints)
   */
  async generateSoqlForConnector(
    prompt: string,
    connectorId: string,
    getHints: (connectorId: string) => Promise<SoqlHint[]>,
  ): Promise<GeneratedSoql> {
    const hints = await getHints(connectorId);
    return this.generateSoql({ prompt, hints });
  }

  // ===========================================================================
  // CONTEXT BUILDING
  // ===========================================================================

  /**
   * Infer relevant objects from prompt
   */
  private async inferRelevantObjects(prompt: string): Promise<string[]> {
    const lowerPrompt = prompt.toLowerCase();
    const relevantObjects: string[] = [];

    // Check for common object names in prompt
    const objectKeywords: Record<string, string[]> = {
      Account: ["account", "accounts", "company", "companies", "customer", "customers"],
      Contact: ["contact", "contacts", "person", "people", "individual"],
      Lead: ["lead", "leads", "prospect", "prospects"],
      Opportunity: [
        "opportunity",
        "opportunities",
        "deal",
        "deals",
        "pipeline",
        "revenue",
        "sales",
      ],
      Case: ["case", "cases", "ticket", "tickets", "support", "issue", "issues"],
      Task: ["task", "tasks", "to-do", "todo", "activity", "activities"],
      Event: ["event", "events", "meeting", "meetings", "appointment", "appointments"],
      Campaign: ["campaign", "campaigns", "marketing"],
      User: ["user", "users", "rep", "reps", "owner", "owners", "assigned"],
    };

    for (const [objectName, keywords] of Object.entries(objectKeywords)) {
      for (const keyword of keywords) {
        if (lowerPrompt.includes(keyword)) {
          if (!relevantObjects.includes(objectName)) {
            relevantObjects.push(objectName);
          }
          break;
        }
      }
    }

    // If no objects found, use common defaults
    if (relevantObjects.length === 0) {
      return ["Account", "Contact", "Opportunity"];
    }

    return relevantObjects;
  }

  /**
   * Get metadata for specified objects
   */
  private async getObjectsMetadata(
    objectNames: string[],
    options: {
      maxFields: number;
      includeRecordTypes: boolean;
      includeRelationships: boolean;
    },
  ): Promise<Map<string, SObjectMetadata>> {
    const metadata = new Map<string, SObjectMetadata>();

    for (const objectName of objectNames) {
      try {
        const objectMeta = await this.metadataClient.describeSObject(objectName);

        // Trim fields if needed
        if (objectMeta.fields.length > options.maxFields) {
          objectMeta.fields = this.prioritizeFields(objectMeta.fields, options.maxFields);
        }

        // Optionally remove record types
        if (!options.includeRecordTypes) {
          objectMeta.recordTypeInfos = undefined;
        }

        // Optionally remove relationships
        if (!options.includeRelationships) {
          objectMeta.childRelationships = undefined;
          objectMeta.fields = objectMeta.fields.filter((f) => f.type !== "reference");
        }

        metadata.set(objectName, objectMeta);
      } catch {
        // Skip objects that can't be described
      }
    }

    return metadata;
  }

  /**
   * Prioritize fields for context (keep most useful)
   */
  private prioritizeFields(fields: SFieldMetadata[], maxFields: number): SFieldMetadata[] {
    // Sort by priority
    const sorted = [...fields].sort((a, b) => {
      // Always include Id and Name
      if (a.name === "Id") return -1;
      if (b.name === "Id") return 1;
      if (a.nameField) return -1;
      if (b.nameField) return 1;

      // Prefer queryable/updateable fields
      const aScore =
        (a.createable ? 1 : 0) + (a.updateable ? 1 : 0) + (a.type === "reference" ? 1 : 0);
      const bScore =
        (b.createable ? 1 : 0) + (b.updateable ? 1 : 0) + (b.type === "reference" ? 1 : 0);

      return bScore - aScore;
    });

    return sorted.slice(0, maxFields);
  }

  /**
   * Build context string for LLM
   */
  private buildContext(metadata: Map<string, SObjectMetadata>, hints: SoqlHint[]): string {
    const parts: string[] = [];

    // Add object schemas
    parts.push("## Available Objects and Fields\n");

    for (const [name, meta] of metadata) {
      parts.push(`### ${name} (${meta.label})`);

      // List fields
      const fieldList = meta.fields
        .map((f) => `  - ${f.name} (${f.type}${f.nillable ? ", nullable" : ""})`)
        .join("\n");
      parts.push(fieldList);

      // Add relationships
      if (meta.childRelationships && meta.childRelationships.length > 0) {
        const relationships = meta.childRelationships
          .filter((r) => r.relationshipName)
          .slice(0, 10)
          .map((r) => `  - ${r.relationshipName} -> ${r.childSObject}`)
          .join("\n");
        if (relationships) {
          parts.push(`  Child Relationships:\n${relationships}`);
        }
      }

      parts.push("");
    }

    // Add hints
    if (hints.length > 0) {
      parts.push("## Business Rules\n");
      for (const hint of hints) {
        const fieldNote = hint.fieldName ? `.${hint.fieldName}` : "";
        parts.push(`- ${hint.objectName}${fieldNote}: ${hint.description}`);
        if (hint.pattern) {
          parts.push(`  Example: ${hint.pattern}`);
        }
      }
      parts.push("");
    }

    // Add Salesforce-specific patterns
    parts.push("## Salesforce Date Literals\n");
    parts.push("Use these date literals in WHERE clauses:");
    parts.push("- TODAY - Current day");
    parts.push("- THIS_WEEK - Current week");
    parts.push("- THIS_MONTH - Current month");
    parts.push("- THIS_QUARTER - Current fiscal quarter");
    parts.push("- THIS_FISCAL_QUARTER - Current fiscal quarter");
    parts.push("- THIS_YEAR - Current fiscal year");
    parts.push("- LAST_N_DAYS:n - Last n days");
    parts.push("- NEXT_N_DAYS:n - Next n days");
    parts.push("");

    return parts.join("\n");
  }

  /**
   * Build system prompt for LLM
   */
  private buildSystemPrompt(context: string): string {
    return `You are a Salesforce SOQL query generator. Generate valid SOQL queries based on natural language requests.

${context}

## Rules
1. Generate ONLY valid SOQL syntax
2. Always include Id in SELECT unless aggregating
3. Use proper date literals (TODAY, THIS_WEEK, etc.)
4. Add IsDeleted = false for objects with soft delete unless user asks for deleted records
5. Use LIMIT for large datasets unless user specifies otherwise
6. Prefer selective queries (use indexed fields in WHERE when possible)

## Response Format
Respond with:
1. The SOQL query in a code block
2. A brief explanation of what the query does

Example:
\`\`\`soql
SELECT Id, Name, Amount FROM Opportunity WHERE Amount > 100000
\`\`\`
This query retrieves opportunities with amounts greater than $100,000.`;
  }

  // ===========================================================================
  // RESPONSE PARSING
  // ===========================================================================

  /**
   * Extract SOQL from LLM response
   */
  private extractSoql(response: string): string {
    // Try to find SOQL in code block
    const codeBlockMatch = response.match(/```(?:soql|sql)?\n?([\s\S]*?)```/i);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to find SELECT statement directly
    const selectMatch = response.match(/SELECT\s+[\s\S]+?(?:FROM\s+[\s\S]+?)(?:$|(?=\n\n))/i);
    if (selectMatch) {
      return selectMatch[0].trim();
    }

    throw new SalesforceConnectorError(
      "Could not extract SOQL from LLM response",
      "EXTRACTION_ERROR",
      500,
    );
  }

  /**
   * Extract explanation from LLM response
   */
  private extractExplanation(response: string): string | undefined {
    // Remove code blocks
    const withoutCode = response.replace(/```[\s\S]*?```/g, "");

    // Get remaining text
    const explanation = withoutCode.trim();

    return explanation || undefined;
  }

  /**
   * Extract object names from SOQL
   */
  private extractObjectsFromSoql(soql: string): string[] {
    const objects: string[] = [];

    // Find main FROM clause
    const fromMatch = soql.match(/FROM\s+(\w+)/i);
    if (fromMatch) {
      objects.push(fromMatch[1]);
    }

    // Find subqueries
    const subqueryMatches = soql.matchAll(/\(SELECT\s+.+?\s+FROM\s+(\w+)/gi);
    for (const match of subqueryMatches) {
      if (!objects.includes(match[1])) {
        objects.push(match[1]);
      }
    }

    return objects;
  }

  /**
   * Extract field names from SOQL
   */
  private extractFieldsFromSoql(soql: string): string[] {
    const fields: string[] = [];

    // Extract SELECT clause
    const selectMatch = soql.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
    if (selectMatch) {
      const fieldList = selectMatch[1];

      // Split by comma and clean up
      const fieldParts = fieldList.split(",").map((f) => f.trim());

      for (const part of fieldParts) {
        // Skip subqueries
        if (part.includes("(")) continue;

        // Remove any aliases
        const fieldName = part.split(/\s+/)[0];

        // Handle relationship fields (e.g., Account.Name)
        fields.push(fieldName);
      }
    }

    return fields;
  }

  /**
   * Estimate confidence in the generated query
   */
  private estimateConfidence(soql: string, metadata: Map<string, SObjectMetadata>): number {
    let confidence = 0.5; // Base confidence

    // Check if main object exists in metadata
    const objectsUsed = this.extractObjectsFromSoql(soql);
    for (const obj of objectsUsed) {
      if (metadata.has(obj)) {
        confidence += 0.1;
      }
    }

    // Check if fields exist
    const mainObject = objectsUsed[0];
    const objectMeta = metadata.get(mainObject);
    if (objectMeta) {
      const fieldsUsed = this.extractFieldsFromSoql(soql);
      const validFields = fieldsUsed.filter((f) =>
        objectMeta.fields.some((mf) => mf.name.toLowerCase() === f.toLowerCase()),
      );
      confidence += (validFields.length / Math.max(fieldsUsed.length, 1)) * 0.2;
    }

    // Reduce confidence for complex queries
    if (soql.includes("HAVING")) confidence -= 0.1;
    if (soql.includes("OFFSET")) confidence -= 0.05;

    // Cap confidence
    return Math.min(Math.max(confidence, 0), 1);
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a SOQL generator
 */
export function createSoqlGenerator(
  metadataClient: MetadataClient,
  llmProvider: LlmProvider,
): SoqlGenerator {
  return new SoqlGenerator(metadataClient, llmProvider);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Build basic SOQL SELECT query programmatically
 */
export function buildSoqlSelect(options: {
  object: string;
  fields: string[];
  where?: string;
  orderBy?: string;
  limit?: number;
  offset?: number;
}): string {
  const parts = [`SELECT ${options.fields.join(", ")}`, `FROM ${options.object}`];

  if (options.where) {
    parts.push(`WHERE ${options.where}`);
  }

  if (options.orderBy) {
    parts.push(`ORDER BY ${options.orderBy}`);
  }

  if (options.limit !== undefined) {
    parts.push(`LIMIT ${options.limit}`);
  }

  if (options.offset !== undefined) {
    parts.push(`OFFSET ${options.offset}`);
  }

  return parts.join(" ");
}

/**
 * Get Salesforce date literal for common time periods
 */
export function getDateLiteral(
  period: "today" | "thisWeek" | "thisMonth" | "thisQuarter" | "thisYear",
): string {
  const literals: Record<string, string> = {
    today: "TODAY",
    thisWeek: "THIS_WEEK",
    thisMonth: "THIS_MONTH",
    thisQuarter: "THIS_FISCAL_QUARTER",
    thisYear: "THIS_FISCAL_YEAR",
  };
  return literals[period] ?? "TODAY";
}

/**
 * Get Salesforce date literal for N days
 */
export function getLastNDaysLiteral(days: number): string {
  return `LAST_N_DAYS:${days}`;
}

/**
 * Get Salesforce date literal for next N days
 */
export function getNextNDaysLiteral(days: number): string {
  return `NEXT_N_DAYS:${days}`;
}
