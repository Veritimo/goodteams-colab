/**
 * Schema Hints Module
 *
 * CRUD for schema hints and hint engine for query context building.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE6.md
 */

// Re-export types needed by consumers
export type {
  SchemaTable,
  SchemaRelationship,
  SchemaHintInput,
  SchemaHintUpdateInput,
  SchemaHintRecord,
  SchemaCacheRecord,
} from "../types.js";

// Hints Service - CRUD operations
export {
  createSchemaHint,
  getSchemaHint,
  listSchemaHints,
  updateSchemaHint,
  deleteSchemaHint,
  deleteAllSchemaHints,
  bulkCreateSchemaHints,
  countSchemaHints,
  getSchemaCache,
  updateSchemaCache,
  invalidateSchemaCache,
  refreshSchemaCache,
  SchemaHintNotFoundError,
  SchemaHintDuplicateError,
  ConnectionNotFoundError,
} from "./hints-service.js";

// Hints Engine - Context building and formatting
export {
  HintsEngine,
  applyHintsToContext,
  formatHintsForLLM,
  getRelevantHints,
  buildQueryPromptContext,
} from "./hints-engine.js";

export type { QueryContext, HintFormatOptions, RelevantHintsOptions } from "./hints-engine.js";
