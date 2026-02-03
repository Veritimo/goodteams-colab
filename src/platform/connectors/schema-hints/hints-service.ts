/**
 * Schema Hints Service
 *
 * CRUD operations for SchemaHint records.
 * Schema hints provide business rules and patterns to improve query generation.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE6.md
 */

import type {
  SchemaHintInput,
  SchemaHintUpdateInput,
  SchemaHintRecord,
  SchemaCacheRecord,
  SchemaTable,
  SchemaRelationship,
} from "../types.js";
import { prisma } from "../../db/client.js";

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Error thrown when a schema hint is not found
 */
export class SchemaHintNotFoundError extends Error {
  constructor(id: string) {
    super(`Schema hint not found: ${id}`);
    this.name = "SchemaHintNotFoundError";
  }
}

/**
 * Error thrown when a duplicate schema hint is created
 */
export class SchemaHintDuplicateError extends Error {
  constructor(connectionId: string, tableName: string, description: string) {
    super(
      `Schema hint already exists for table '${tableName}' with description '${description}' in connection ${connectionId}`,
    );
    this.name = "SchemaHintDuplicateError";
  }
}

/**
 * Error thrown when connection is not found
 */
export class ConnectionNotFoundError extends Error {
  constructor(id: string) {
    super(`Connection not found: ${id}`);
    this.name = "ConnectionNotFoundError";
  }
}

// =============================================================================
// SCHEMA HINT CRUD
// =============================================================================

/**
 * Create a new schema hint
 *
 * @param input - Schema hint creation input
 * @returns Created schema hint
 */
export async function createSchemaHint(input: SchemaHintInput): Promise<SchemaHintRecord> {
  const { connectionId, tableName, columnName, description, pattern, createdBy } = input;

  // Verify connection exists
  const connection = await prisma.resourceConnection.findUnique({
    where: { id: connectionId },
    select: { id: true },
  });

  if (!connection) {
    throw new ConnectionNotFoundError(connectionId);
  }

  try {
    const hint = await prisma.schemaHint.create({
      data: {
        connectionId,
        tableName,
        columnName,
        description,
        pattern,
        createdBy,
      },
    });

    return mapHintToRecord(hint);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Unique constraint failed")) {
      throw new SchemaHintDuplicateError(connectionId, tableName, description);
    }
    throw error;
  }
}

/**
 * Get a schema hint by ID
 *
 * @param id - Schema hint UUID
 * @returns Schema hint
 * @throws SchemaHintNotFoundError if not found
 */
export async function getSchemaHint(id: string): Promise<SchemaHintRecord> {
  const hint = await prisma.schemaHint.findUnique({
    where: { id },
  });

  if (!hint) {
    throw new SchemaHintNotFoundError(id);
  }

  return mapHintToRecord(hint);
}

/**
 * List schema hints for a connection
 *
 * @param connectionId - Connection UUID
 * @param tableName - Optional filter by table name
 * @returns Array of schema hints
 */
export async function listSchemaHints(
  connectionId: string,
  tableName?: string,
): Promise<SchemaHintRecord[]> {
  const hints = await prisma.schemaHint.findMany({
    where: {
      connectionId,
      ...(tableName && { tableName }),
    },
    orderBy: [{ tableName: "asc" }, { columnName: "asc" }],
  });

  return hints.map(mapHintToRecord);
}

/**
 * Update a schema hint
 *
 * @param id - Schema hint UUID
 * @param input - Update input
 * @returns Updated schema hint
 * @throws SchemaHintNotFoundError if not found
 */
export async function updateSchemaHint(
  id: string,
  input: SchemaHintUpdateInput,
): Promise<SchemaHintRecord> {
  const existing = await prisma.schemaHint.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new SchemaHintNotFoundError(id);
  }

  const { tableName, columnName, description, pattern } = input;

  const hint = await prisma.schemaHint.update({
    where: { id },
    data: {
      ...(tableName !== undefined && { tableName }),
      ...(columnName !== undefined && { columnName }),
      ...(description !== undefined && { description }),
      ...(pattern !== undefined && { pattern }),
    },
  });

  return mapHintToRecord(hint);
}

/**
 * Delete a schema hint
 *
 * @param id - Schema hint UUID
 * @returns True if deleted
 * @throws SchemaHintNotFoundError if not found
 */
export async function deleteSchemaHint(id: string): Promise<boolean> {
  const existing = await prisma.schemaHint.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new SchemaHintNotFoundError(id);
  }

  await prisma.schemaHint.delete({
    where: { id },
  });

  return true;
}

/**
 * Delete all schema hints for a connection
 *
 * @param connectionId - Connection UUID
 * @returns Number of hints deleted
 */
export async function deleteAllSchemaHints(connectionId: string): Promise<number> {
  const result = await prisma.schemaHint.deleteMany({
    where: { connectionId },
  });

  return result.count;
}

/**
 * Bulk create schema hints
 *
 * @param hints - Array of schema hint inputs
 * @returns Number of hints created
 */
export async function bulkCreateSchemaHints(hints: SchemaHintInput[]): Promise<number> {
  // Verify all connections exist
  const connectionIds = [...new Set(hints.map((h) => h.connectionId))];
  const connections = await prisma.resourceConnection.findMany({
    where: { id: { in: connectionIds } },
    select: { id: true },
  });

  const foundIds = new Set(connections.map((c) => c.id));
  const missingId = connectionIds.find((id) => !foundIds.has(id));
  if (missingId) {
    throw new ConnectionNotFoundError(missingId);
  }

  const result = await prisma.schemaHint.createMany({
    data: hints.map((h) => ({
      connectionId: h.connectionId,
      tableName: h.tableName,
      columnName: h.columnName,
      description: h.description,
      pattern: h.pattern,
      createdBy: h.createdBy,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

/**
 * Count schema hints for a connection
 *
 * @param connectionId - Connection UUID
 * @returns Count of hints
 */
export async function countSchemaHints(connectionId: string): Promise<number> {
  return prisma.schemaHint.count({
    where: { connectionId },
  });
}

// =============================================================================
// SCHEMA CACHE OPERATIONS
// =============================================================================

/**
 * Get schema cache for a connection
 *
 * @param connectionId - Connection UUID
 * @returns Schema cache or null if not cached
 */
export async function getSchemaCache(connectionId: string): Promise<SchemaCacheRecord | null> {
  const cache = await prisma.schemaCache.findUnique({
    where: { connectionId },
  });

  if (!cache) {
    return null;
  }

  // Check if expired
  if (cache.expiresAt < new Date()) {
    return null;
  }

  return {
    id: cache.id,
    connectionId: cache.connectionId,
    tables: cache.tables as unknown as SchemaTable[],
    relationships: cache.relationships as unknown as SchemaRelationship[] | null,
    cachedAt: cache.cachedAt,
    expiresAt: cache.expiresAt,
  };
}

/**
 * Update or create schema cache
 *
 * @param connectionId - Connection UUID
 * @param tables - Schema tables
 * @param relationships - Schema relationships
 * @param ttlMs - Time to live in milliseconds (default: 1 hour)
 * @returns Schema cache record
 */
export async function updateSchemaCache(
  connectionId: string,
  tables: SchemaTable[],
  relationships?: SchemaRelationship[],
  ttlMs = 3600000, // 1 hour
): Promise<SchemaCacheRecord> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  const cache = await prisma.schemaCache.upsert({
    where: { connectionId },
    create: {
      connectionId,
      tables: tables as unknown as object,
      relationships: relationships as unknown as object | undefined,
      cachedAt: now,
      expiresAt,
    },
    update: {
      tables: tables as unknown as object,
      relationships: relationships as unknown as object | undefined,
      cachedAt: now,
      expiresAt,
    },
  });

  return {
    id: cache.id,
    connectionId: cache.connectionId,
    tables: cache.tables as unknown as SchemaTable[],
    relationships: cache.relationships as unknown as SchemaRelationship[] | null,
    cachedAt: cache.cachedAt,
    expiresAt: cache.expiresAt,
  };
}

/**
 * Invalidate schema cache
 *
 * @param connectionId - Connection UUID
 * @returns True if cache was deleted
 */
export async function invalidateSchemaCache(connectionId: string): Promise<boolean> {
  const result = await prisma.schemaCache.deleteMany({
    where: { connectionId },
  });

  return result.count > 0;
}

/**
 * Refresh schema cache - placeholder for actual implementation
 * This will be implemented by each connector type
 *
 * @param connectionId - Connection UUID
 * @param introspector - Function to introspect schema
 * @returns Updated schema cache
 */
export async function refreshSchemaCache(
  connectionId: string,
  introspector: () => Promise<{ tables: SchemaTable[]; relationships?: SchemaRelationship[] }>,
): Promise<SchemaCacheRecord> {
  const { tables, relationships } = await introspector();
  return updateSchemaCache(connectionId, tables, relationships);
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map database hint to record type
 */
function mapHintToRecord(hint: {
  id: string;
  connectionId: string;
  tableName: string;
  columnName: string | null;
  description: string;
  pattern: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}): SchemaHintRecord {
  return {
    id: hint.id,
    connectionId: hint.connectionId,
    tableName: hint.tableName,
    columnName: hint.columnName,
    description: hint.description,
    pattern: hint.pattern,
    createdAt: hint.createdAt,
    updatedAt: hint.updatedAt,
    createdBy: hint.createdBy,
  };
}
