/**
 * Entity Metadata Manager
 *
 * Manages entity schema metadata for Dataverse. Provides caching,
 * refresh capabilities, and LLM-friendly context building.
 */

import { RestClient } from "./rest-client.js";
import { EntityMetadata, AttributeMetadata, SchemaHint } from "./types.js";

/**
 * Cache entry for entity metadata
 */
interface MetadataCacheEntry {
  metadata: EntityMetadata;
  cachedAt: Date;
  expiresAt: Date;
}

/**
 * Schema context for LLM query generation
 */
export interface SchemaContext {
  /** List of entities with their attributes */
  entities: EntitySchemaInfo[];
  /** Business rules and hints */
  hints: string[];
  /** SQL dialect notes */
  dialectNotes: string[];
}

/**
 * Entity schema info for LLM context
 */
export interface EntitySchemaInfo {
  /** Entity logical name */
  name: string;
  /** Entity display name */
  displayName: string;
  /** Primary ID column */
  primaryId: string;
  /** Primary name column */
  primaryName: string;
  /** Column definitions */
  columns: ColumnSchemaInfo[];
}

/**
 * Column schema info for LLM context
 */
export interface ColumnSchemaInfo {
  /** Column logical name */
  name: string;
  /** Column display name */
  displayName: string;
  /** Data type */
  type: string;
  /** Whether column is required */
  required: boolean;
  /** Related entity for lookups */
  relatedTo?: string;
}

/**
 * Metadata manager options
 */
export interface MetadataManagerOptions {
  /** REST client for API calls */
  restClient: RestClient;
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTtlMs?: number;
}

/**
 * Default cache TTL (1 hour)
 */
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Entity Metadata Manager
 *
 * Provides schema information for Dataverse entities with caching.
 */
export class EntityMetadataManager {
  private restClient: RestClient;
  private cacheTtlMs: number;
  private cache: Map<string, MetadataCacheEntry> = new Map();

  constructor(options: MetadataManagerOptions) {
    this.restClient = options.restClient;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  /**
   * Get metadata for an entity (from cache or API)
   */
  async getMetadata(entityName: string): Promise<EntityMetadata> {
    const normalizedName = entityName.toLowerCase();

    // Check cache
    const cached = this.cache.get(normalizedName);
    if (cached && new Date() < cached.expiresAt) {
      return cached.metadata;
    }

    // Fetch from API
    const metadata = await this.restClient.getEntityMetadata(normalizedName);

    // Store in cache
    this.cache.set(normalizedName, {
      metadata,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + this.cacheTtlMs),
    });

    return metadata;
  }

  /**
   * Get metadata for multiple entities
   */
  async getMetadataBatch(entityNames: string[]): Promise<Map<string, EntityMetadata>> {
    const results = new Map<string, EntityMetadata>();

    // Fetch all in parallel
    await Promise.all(
      entityNames.map(async (name) => {
        try {
          const metadata = await this.getMetadata(name);
          results.set(name.toLowerCase(), metadata);
        } catch (error) {
          // Log error but continue with other entities
          console.warn(`Failed to fetch metadata for ${name}:`, error);
        }
      }),
    );

    return results;
  }

  /**
   * Force refresh metadata for specified entities
   */
  async refreshMetadata(entityNames: string[]): Promise<void> {
    // Clear from cache
    for (const name of entityNames) {
      this.cache.delete(name.toLowerCase());
    }

    // Re-fetch all
    await this.getMetadataBatch(entityNames);
  }

  /**
   * Clear all cached metadata
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get list of cached entity names
   */
  getCachedEntities(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if entity is in cache and not expired
   */
  isCached(entityName: string): boolean {
    const entry = this.cache.get(entityName.toLowerCase());
    return entry !== undefined && new Date() < entry.expiresAt;
  }

  /**
   * Build schema context for LLM query generation
   */
  async buildSchemaContext(
    entityNames: string[],
    hints: SchemaHint[] = [],
  ): Promise<SchemaContext> {
    const metadataMap = await this.getMetadataBatch(entityNames);
    const entities: EntitySchemaInfo[] = [];

    for (const [name, metadata] of metadataMap) {
      entities.push({
        name: metadata.logicalName,
        displayName: metadata.displayName,
        primaryId: metadata.primaryIdAttribute,
        primaryName: metadata.primaryNameAttribute,
        columns: this.mapAttributesToColumns(metadata.attributes),
      });
    }

    // Build hints context
    const hintsText = hints.map((h) => {
      const prefix = h.columnName ? `${h.entityName}.${h.columnName}` : h.entityName;
      return `${prefix}: ${h.description}${h.pattern ? ` (e.g., ${h.pattern})` : ""}`;
    });

    return {
      entities,
      hints: hintsText,
      dialectNotes: this.getDataverseDialectNotes(),
    };
  }

  /**
   * Format schema context as text for LLM prompt
   */
  formatSchemaContextForPrompt(context: SchemaContext): string {
    let text = "## Database Schema\n\n";

    // Entity definitions
    for (const entity of context.entities) {
      text += `### ${entity.displayName} (${entity.name})\n`;
      text += `Primary ID: ${entity.primaryId}\n`;
      text += `Primary Name: ${entity.primaryName}\n`;
      text += `Columns:\n`;

      for (const col of entity.columns) {
        const required = col.required ? " (required)" : "";
        const related = col.relatedTo ? ` → ${col.relatedTo}` : "";
        text += `  - ${col.name} (${col.type})${required}${related}: ${col.displayName}\n`;
      }
      text += "\n";
    }

    // Business rules / hints
    if (context.hints.length > 0) {
      text += "## Business Rules\n\n";
      for (const hint of context.hints) {
        text += `- ${hint}\n`;
      }
      text += "\n";
    }

    // Dialect notes
    if (context.dialectNotes.length > 0) {
      text += "## SQL Notes (Dataverse TDS)\n\n";
      for (const note of context.dialectNotes) {
        text += `- ${note}\n`;
      }
    }

    return text;
  }

  /**
   * Map Dataverse attributes to column schema info
   */
  private mapAttributesToColumns(attributes: AttributeMetadata[]): ColumnSchemaInfo[] {
    return attributes
      .filter((attr) => attr.isValidForCreate || attr.isValidForUpdate)
      .map((attr) => ({
        name: attr.logicalName,
        displayName: attr.displayName,
        type: this.mapAttributeType(attr.attributeType),
        required: attr.isRequired ?? false,
        relatedTo: attr.targets?.[0],
      }));
  }

  /**
   * Map Dataverse attribute types to friendly names
   */
  private mapAttributeType(type: string): string {
    const typeMap: Record<string, string> = {
      String: "string",
      Integer: "integer",
      BigInt: "bigint",
      Decimal: "decimal",
      Double: "float",
      Money: "money",
      Boolean: "boolean",
      DateTime: "datetime",
      Lookup: "lookup (GUID)",
      Customer: "customer (GUID)",
      Owner: "owner (GUID)",
      Picklist: "choice (integer)",
      State: "state (integer)",
      Status: "status (integer)",
      Memo: "text (multiline)",
      UniqueIdentifier: "guid",
      Virtual: "virtual",
      CalendarRules: "calendar",
      PartyList: "party list",
    };
    return typeMap[type] ?? type.toLowerCase();
  }

  /**
   * Get Dataverse-specific SQL dialect notes
   */
  private getDataverseDialectNotes(): string[] {
    return [
      "Dataverse TDS supports read-only SELECT queries",
      "Use statecode = 0 for active records, statecode = 1 for inactive",
      "Lookup columns return GUIDs; use _value suffix for ID (e.g., ownerid_value)",
      "DateTime columns are in UTC",
      "TOP is supported; OFFSET/FETCH has limited support",
      "Standard JOINs work between related entities",
      "Aggregate functions (COUNT, SUM, AVG, MIN, MAX) are supported",
    ];
  }

  /**
   * Get common entity relationships for query hints
   */
  getCommonRelationships(entityName: string): { from: string; to: string; via: string }[] {
    const commonRelations: Record<string, { from: string; to: string; via: string }[]> = {
      contact: [
        { from: "contact", to: "account", via: "parentcustomerid" },
        { from: "contact", to: "systemuser", via: "ownerid" },
      ],
      account: [
        { from: "account", to: "contact", via: "primarycontactid" },
        { from: "account", to: "systemuser", via: "ownerid" },
        { from: "account", to: "account", via: "parentaccountid" },
      ],
      opportunity: [
        { from: "opportunity", to: "account", via: "parentaccountid" },
        { from: "opportunity", to: "contact", via: "parentcontactid" },
        { from: "opportunity", to: "systemuser", via: "ownerid" },
      ],
      lead: [
        { from: "lead", to: "account", via: "parentaccountid" },
        { from: "lead", to: "contact", via: "parentcontactid" },
        { from: "lead", to: "systemuser", via: "ownerid" },
      ],
      incident: [
        { from: "incident", to: "account", via: "customerid" },
        { from: "incident", to: "contact", via: "primarycontactid" },
        { from: "incident", to: "systemuser", via: "ownerid" },
      ],
    };

    return commonRelations[entityName.toLowerCase()] ?? [];
  }
}

/**
 * Create a metadata manager from a REST client
 */
export function createMetadataManager(
  restClient: RestClient,
  cacheTtlMs?: number,
): EntityMetadataManager {
  return new EntityMetadataManager({ restClient, cacheTtlMs });
}
