/**
 * Tenant Credential Vault
 *
 * Encrypted credential storage per tenant using AES-256-GCM.
 * Each organization has isolated credentials with per-tenant encryption keys
 * derived using HKDF from a master key.
 */

import * as crypto from "crypto";
import { prisma } from "../db/client.js";

/**
 * Error thrown when credential encryption key is missing
 */
export class CredentialKeyMissingError extends Error {
  constructor() {
    super("CREDENTIAL_ENCRYPTION_KEY not set");
    this.name = "CredentialKeyMissingError";
  }
}

/**
 * Error thrown when credential decryption fails (tampered or invalid)
 */
export class CredentialDecryptionError extends Error {
  constructor(message = "Failed to decrypt credential") {
    super(message);
    this.name = "CredentialDecryptionError";
  }
}

/**
 * Get encryption key derived for a specific organization
 *
 * Uses HKDF to derive a per-tenant key from the master key,
 * ensuring credential isolation between tenants.
 *
 * @param organizationId - Organization UUID used as salt
 * @returns 32-byte encryption key buffer
 * @throws CredentialKeyMissingError if CREDENTIAL_ENCRYPTION_KEY is not set
 */
export function getEncryptionKey(organizationId: string): Buffer {
  const masterKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!masterKey) throw new CredentialKeyMissingError();
  // Derive per-tenant key using HKDF
  return Buffer.from(crypto.hkdfSync("sha256", masterKey, organizationId, "credential", 32));
}

/**
 * Store or update an encrypted credential
 *
 * @param organizationId - Organization UUID
 * @param key - Credential key/name
 * @param value - Plain text credential value to encrypt
 */
export async function setCredential(
  organizationId: string,
  key: string,
  value: string,
): Promise<void> {
  const encryptionKey = getEncryptionKey(organizationId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);

  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encryptedValue = `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;

  await prisma.tenantCredential.upsert({
    where: { organizationId_key: { organizationId, key } },
    create: { organizationId, key, encryptedValue },
    update: { encryptedValue, updatedAt: new Date() },
  });
}

/**
 * Retrieve and decrypt a credential
 *
 * @param organizationId - Organization UUID
 * @param key - Credential key/name
 * @returns Decrypted credential value, or null if not found
 * @throws CredentialDecryptionError if decryption fails
 */
export async function getCredential(organizationId: string, key: string): Promise<string | null> {
  const credential = await prisma.tenantCredential.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  if (!credential) return null;

  try {
    const encryptionKey = getEncryptionKey(organizationId);
    const [ivHex, authTagHex, encryptedHex] = credential.encryptedValue.split(":");

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    return (
      decipher.update(Buffer.from(encryptedHex, "hex"), undefined, "utf8") + decipher.final("utf8")
    );
  } catch (error) {
    throw new CredentialDecryptionError(
      error instanceof Error ? error.message : "Decryption failed",
    );
  }
}

/**
 * Delete a credential
 *
 * @param organizationId - Organization UUID
 * @param key - Credential key/name
 * @returns True if credential was deleted, false if it didn't exist
 */
export async function deleteCredential(organizationId: string, key: string): Promise<boolean> {
  const result = await prisma.tenantCredential.deleteMany({
    where: { organizationId, key },
  });
  return result.count > 0;
}

/**
 * List all credential keys for an organization (not values)
 *
 * @param organizationId - Organization UUID
 * @returns Array of credential key names
 */
export async function listCredentialKeys(organizationId: string): Promise<string[]> {
  const credentials = await prisma.tenantCredential.findMany({
    where: { organizationId },
    select: { key: true },
  });
  return credentials.map((c) => c.key);
}

/**
 * Rotate a credential with a new value
 *
 * Updates the credential value and sets the rotatedAt timestamp.
 *
 * @param organizationId - Organization UUID
 * @param key - Credential key/name
 * @param newValue - New plain text credential value
 */
export async function rotateCredential(
  organizationId: string,
  key: string,
  newValue: string,
): Promise<void> {
  await setCredential(organizationId, key, newValue);
  await prisma.tenantCredential.update({
    where: { organizationId_key: { organizationId, key } },
    data: { rotatedAt: new Date() },
  });
}

/**
 * Check if a credential exists
 *
 * @param organizationId - Organization UUID
 * @param key - Credential key/name
 * @returns True if credential exists
 */
export async function hasCredential(organizationId: string, key: string): Promise<boolean> {
  const credential = await prisma.tenantCredential.findUnique({
    where: { organizationId_key: { organizationId, key } },
    select: { id: true },
  });
  return credential !== null;
}

/**
 * Delete all credentials for an organization
 *
 * @param organizationId - Organization UUID
 * @returns Number of credentials deleted
 */
export async function deleteAllCredentials(organizationId: string): Promise<number> {
  const result = await prisma.tenantCredential.deleteMany({
    where: { organizationId },
  });
  return result.count;
}
