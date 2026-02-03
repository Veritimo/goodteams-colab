/**
 * Connector Service
 *
 * CRUD operations for resource connections with credential encryption/decryption
 * using AES-256-GCM. Credentials are encrypted per-organization using HKDF-derived keys.
 *
 * @see docs/IMPLEMENTATION-PLAN-PHASE6.md
 */

import * as crypto from "crypto";
import type {
  ConnectionType,
  ConnectionStatus,
  ConnectionConfig,
  ConnectionCredentials,
  ConnectorCreateInput,
  ConnectorUpdateInput,
  ConnectorWithHints,
  SchemaHintRecord,
  SchemaCacheRecord,
  SchemaTable,
  SchemaRelationship,
} from "./types.js";
import { prisma } from "../db/client.js";

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Error thrown when a connector is not found
 */
export class ConnectorNotFoundError extends Error {
  constructor(id: string) {
    super(`Connector not found: ${id}`);
    this.name = "ConnectorNotFoundError";
  }
}

/**
 * Error thrown when connector encryption key is missing
 */
export class ConnectorEncryptionKeyMissingError extends Error {
  constructor() {
    super("CONNECTOR_ENCRYPTION_KEY not set");
    this.name = "ConnectorEncryptionKeyMissingError";
  }
}

/**
 * Error thrown when credential encryption/decryption fails
 */
export class ConnectorEncryptionError extends Error {
  constructor(message = "Failed to encrypt/decrypt credentials") {
    super(message);
    this.name = "ConnectorEncryptionError";
  }
}

/**
 * Error thrown when a connector with the same name already exists
 */
export class ConnectorAlreadyExistsError extends Error {
  constructor(name: string, organizationId: string) {
    super(`Connector with name '${name}' already exists in this organization`);
    this.name = "ConnectorAlreadyExistsError";
  }
}

// =============================================================================
// ENCRYPTION HELPERS
// =============================================================================

/**
 * Get encryption key derived for a specific organization
 *
 * Uses HKDF to derive a per-organization key from the master key,
 * ensuring credential isolation between organizations.
 *
 * @param organizationId - Organization UUID used as salt
 * @returns 32-byte encryption key buffer
 * @throws ConnectorEncryptionKeyMissingError if CONNECTOR_ENCRYPTION_KEY is not set
 */
export function getEncryptionKey(organizationId: string): Buffer {
  // Use CONNECTOR_ENCRYPTION_KEY or fall back to CREDENTIAL_ENCRYPTION_KEY
  const masterKey = process.env.CONNECTOR_ENCRYPTION_KEY ?? process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!masterKey) throw new ConnectorEncryptionKeyMissingError();

  // Derive per-organization key using HKDF
  return Buffer.from(
    crypto.hkdfSync("sha256", masterKey, organizationId, "connector-credential", 32),
  );
}

/**
 * Encrypt credentials for storage
 *
 * @param organizationId - Organization UUID for key derivation
 * @param credentials - Plain credentials object
 * @returns Encrypted credentials string (iv:authTag:encrypted)
 */
export function encryptCredentials(
  organizationId: string,
  credentials: ConnectionCredentials,
): string {
  const encryptionKey = getEncryptionKey(organizationId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);

  const plaintext = JSON.stringify(credentials);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt stored credentials
 *
 * @param organizationId - Organization UUID for key derivation
 * @param encryptedValue - Encrypted credentials string
 * @returns Decrypted credentials object
 * @throws ConnectorEncryptionError if decryption fails
 */
export function decryptCredentials(
  organizationId: string,
  encryptedValue: string,
): ConnectionCredentials {
  try {
    const encryptionKey = getEncryptionKey(organizationId);
    const [ivHex, authTagHex, encryptedHex] = encryptedValue.split(":");

    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error("Invalid encrypted value format");
    }

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    const decrypted =
      decipher.update(Buffer.from(encryptedHex, "hex"), undefined, "utf8") + decipher.final("utf8");

    return JSON.parse(decrypted) as ConnectionCredentials;
  } catch (error) {
    throw new ConnectorEncryptionError(
      error instanceof Error ? error.message : "Decryption failed",
    );
  }
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Create a new connector
 *
 * @param input - Connector creation input
 * @returns Created connector (without credentials)
 */
export async function createConnector(input: ConnectorCreateInput): Promise<ConnectorWithHints> {
  const { organizationId, type, name, description, config, credentials, isReadOnly, createdBy } =
    input;

  // Encrypt credentials if provided
  let encryptedCredentials: string | null = null;
  if (credentials) {
    encryptedCredentials = encryptCredentials(organizationId, credentials);
  }

  try {
    const connector = await prisma.resourceConnection.create({
      data: {
        organizationId,
        type,
        name,
        description,
        config: config as unknown as object,
        credentials: encryptedCredentials,
        isReadOnly: isReadOnly ?? true,
        createdBy,
        status: "PENDING",
      },
      include: {
        schemaHints: true,
        schemaCache: true,
      },
    });

    return mapConnectorToResponse(connector);
  } catch (error: unknown) {
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes("Unique constraint failed")) {
      throw new ConnectorAlreadyExistsError(name, organizationId);
    }
    throw error;
  }
}

/**
 * Get a connector by ID
 *
 * @param id - Connector UUID
 * @returns Connector (without credentials)
 * @throws ConnectorNotFoundError if not found
 */
export async function getConnector(id: string): Promise<ConnectorWithHints> {
  const connector = await prisma.resourceConnection.findUnique({
    where: { id },
    include: {
      schemaHints: true,
      schemaCache: true,
    },
  });

  if (!connector) {
    throw new ConnectorNotFoundError(id);
  }

  return mapConnectorToResponse(connector);
}

/**
 * Get a connector with hints (alias for getConnector)
 *
 * @param id - Connector UUID
 * @returns Connector with schema hints
 * @throws ConnectorNotFoundError if not found
 */
export async function getConnectorWithHints(id: string): Promise<ConnectorWithHints> {
  return getConnector(id);
}

/**
 * Get connector with decrypted credentials
 *
 * Only use this internally when you need to establish a connection.
 *
 * @param id - Connector UUID
 * @returns Connector with decrypted credentials
 * @throws ConnectorNotFoundError if not found
 */
export async function getConnectorWithCredentials(id: string): Promise<{
  connector: ConnectorWithHints;
  credentials: ConnectionCredentials | null;
}> {
  const connector = await prisma.resourceConnection.findUnique({
    where: { id },
    include: {
      schemaHints: true,
      schemaCache: true,
    },
  });

  if (!connector) {
    throw new ConnectorNotFoundError(id);
  }

  let credentials: ConnectionCredentials | null = null;
  if (connector.credentials) {
    credentials = decryptCredentials(connector.organizationId, connector.credentials);
  }

  return {
    connector: mapConnectorToResponse(connector),
    credentials,
  };
}

/**
 * List connectors for an organization
 *
 * @param organizationId - Organization UUID
 * @param type - Optional filter by connection type
 * @returns Array of connectors
 */
export async function listConnectors(
  organizationId: string,
  type?: ConnectionType,
): Promise<ConnectorWithHints[]> {
  const connectors = await prisma.resourceConnection.findMany({
    where: {
      organizationId,
      ...(type && { type }),
    },
    include: {
      schemaHints: true,
      schemaCache: true,
    },
    orderBy: { name: "asc" },
  });

  return connectors.map(mapConnectorToResponse);
}

/**
 * Update a connector
 *
 * @param id - Connector UUID
 * @param input - Update input
 * @returns Updated connector
 * @throws ConnectorNotFoundError if not found
 */
export async function updateConnector(
  id: string,
  input: ConnectorUpdateInput,
): Promise<ConnectorWithHints> {
  // First verify connector exists and get org ID for encryption
  const existing = await prisma.resourceConnection.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (!existing) {
    throw new ConnectorNotFoundError(id);
  }

  const { name, description, config, credentials, isReadOnly, status } = input;

  // Encrypt new credentials if provided
  let encryptedCredentials: string | undefined;
  if (credentials) {
    encryptedCredentials = encryptCredentials(existing.organizationId, credentials);
  }

  const connector = await prisma.resourceConnection.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(config !== undefined && { config: config as unknown as object }),
      ...(encryptedCredentials !== undefined && { credentials: encryptedCredentials }),
      ...(isReadOnly !== undefined && { isReadOnly }),
      ...(status !== undefined && { status }),
    },
    include: {
      schemaHints: true,
      schemaCache: true,
    },
  });

  return mapConnectorToResponse(connector);
}

/**
 * Delete a connector
 *
 * Also deletes associated schema hints and cache due to cascade.
 *
 * @param id - Connector UUID
 * @returns True if deleted
 * @throws ConnectorNotFoundError if not found
 */
export async function deleteConnector(id: string): Promise<boolean> {
  const connector = await prisma.resourceConnection.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!connector) {
    throw new ConnectorNotFoundError(id);
  }

  await prisma.resourceConnection.delete({
    where: { id },
  });

  return true;
}

/**
 * Update connector status
 *
 * @param id - Connector UUID
 * @param status - New status
 * @param healthMessage - Optional health message
 * @returns Updated connector
 */
export async function updateConnectorStatus(
  id: string,
  status: ConnectionStatus,
  healthMessage?: string,
): Promise<ConnectorWithHints> {
  const connector = await prisma.resourceConnection.update({
    where: { id },
    data: {
      status,
      lastHealthCheck: new Date(),
      ...(healthMessage !== undefined && { healthMessage }),
    },
    include: {
      schemaHints: true,
      schemaCache: true,
    },
  });

  return mapConnectorToResponse(connector);
}

/**
 * Check if a connector exists
 *
 * @param id - Connector UUID
 * @returns True if exists
 */
export async function connectorExists(id: string): Promise<boolean> {
  const connector = await prisma.resourceConnection.findUnique({
    where: { id },
    select: { id: true },
  });
  return connector !== null;
}

/**
 * Get connectors by status
 *
 * @param status - Status to filter by
 * @returns Array of connectors
 */
export async function getConnectorsByStatus(
  status: ConnectionStatus,
): Promise<ConnectorWithHints[]> {
  const connectors = await prisma.resourceConnection.findMany({
    where: { status },
    include: {
      schemaHints: true,
      schemaCache: true,
    },
  });

  return connectors.map(mapConnectorToResponse);
}

/**
 * Count connectors for an organization
 *
 * @param organizationId - Organization UUID
 * @param type - Optional filter by type
 * @returns Count
 */
export async function countConnectors(
  organizationId: string,
  type?: ConnectionType,
): Promise<number> {
  return prisma.resourceConnection.count({
    where: {
      organizationId,
      ...(type && { type }),
    },
  });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map database connector to response type (strips credentials)
 */
function mapConnectorToResponse(connector: {
  id: string;
  organizationId: string;
  type: ConnectionType;
  name: string;
  description: string | null;
  config: unknown;
  status: ConnectionStatus;
  lastHealthCheck: Date | null;
  healthMessage: string | null;
  isReadOnly: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  schemaHints: Array<{
    id: string;
    connectionId: string;
    tableName: string;
    columnName: string | null;
    description: string;
    pattern: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
  }>;
  schemaCache: {
    id: string;
    connectionId: string;
    tables: unknown;
    relationships: unknown;
    cachedAt: Date;
    expiresAt: Date;
  } | null;
}): ConnectorWithHints {
  return {
    id: connector.id,
    organizationId: connector.organizationId,
    type: connector.type,
    name: connector.name,
    description: connector.description,
    config: connector.config as ConnectionConfig,
    status: connector.status,
    lastHealthCheck: connector.lastHealthCheck,
    healthMessage: connector.healthMessage,
    isReadOnly: connector.isReadOnly,
    createdAt: connector.createdAt,
    updatedAt: connector.updatedAt,
    createdBy: connector.createdBy,
    schemaHints: connector.schemaHints.map((hint) => ({
      id: hint.id,
      connectionId: hint.connectionId,
      tableName: hint.tableName,
      columnName: hint.columnName,
      description: hint.description,
      pattern: hint.pattern,
      createdAt: hint.createdAt,
      updatedAt: hint.updatedAt,
      createdBy: hint.createdBy,
    })),
    schemaCache: connector.schemaCache
      ? {
          id: connector.schemaCache.id,
          connectionId: connector.schemaCache.connectionId,
          tables: connector.schemaCache.tables as SchemaTable[],
          relationships: connector.schemaCache.relationships as SchemaRelationship[] | null,
          cachedAt: connector.schemaCache.cachedAt,
          expiresAt: connector.schemaCache.expiresAt,
        }
      : null,
  };
}
