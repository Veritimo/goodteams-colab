/**
 * Encrypted Token Storage for Microsoft Entra
 *
 * Provides secure storage and retrieval of OAuth tokens:
 * - Encryption at rest using AES-256-GCM
 * - Automatic token refresh before expiry
 * - Database persistence via Prisma
 *
 * @see docs/MICROSOFT-365-AUTH-ARCHITECTURE.md
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { prisma } from "../../db/client.js";
import { DEFAULT_USER_SCOPES } from "./client.js";
import { refreshAccessToken, tokenNeedsRefresh } from "./user-auth.js";

// =============================================================================
// ENCRYPTION
// =============================================================================

/**
 * Encryption algorithm: AES-256-GCM
 * - 256-bit key
 * - 96-bit IV (12 bytes)
 * - 128-bit auth tag
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 * Must be a 32-byte (256-bit) key, hex or base64 encoded
 */
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error("TOKEN_ENCRYPTION_KEY environment variable is required for token storage");
  }

  // Try hex first (64 chars), then base64 (44 chars)
  const key = keyEnv.length === 64 ? Buffer.from(keyEnv, "hex") : Buffer.from(keyEnv, "base64");

  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte key (64 hex chars or 44 base64 chars)");
  }

  return key;
}

/**
 * Encrypt a string value
 * Returns: iv:authTag:ciphertext (all base64)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt an encrypted value
 * Input format: iv:authTag:ciphertext (all base64)
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ciphertext = parts[2];

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid IV or auth tag length");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// =============================================================================
// TOKEN STORAGE INTERFACE
// =============================================================================

/**
 * Stored token data for a user
 */
export interface StoredTokens {
  /** Encrypted access token */
  accessToken: string;
  /** Encrypted refresh token (optional) */
  refreshToken?: string;
  /** Token expiry timestamp */
  expiresOn: Date;
  /** Microsoft object ID */
  microsoftId: string;
  /** User's tenant ID */
  tenantId: string;
  /** Scopes granted */
  scopes: string[];
}

/**
 * Decrypted token data for use in API calls
 */
export interface DecryptedTokens {
  accessToken: string;
  refreshToken?: string;
  expiresOn: Date;
  microsoftId: string;
  tenantId: string;
  scopes: string[];
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Store or update tokens for a user
 *
 * Encrypts tokens before storage.
 */
export async function storeUserTokens(
  userId: string,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresOn: Date;
    microsoftId: string;
    tenantId: string;
    scopes?: string[];
  },
): Promise<void> {
  const encryptedAccess = encrypt(tokens.accessToken);
  const encryptedRefresh = tokens.refreshToken ? encrypt(tokens.refreshToken) : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      externalId: tokens.microsoftId,
      // Note: We need to add these fields to the User model
      // For now, we'll store in a separate table or JSON field
      // This is a placeholder - actual implementation depends on schema
    },
  });

  // Store tokens in a dedicated table (to be added in migration)
  // For now, we'll use the User model's externalId to track MS identity
  // Full token storage requires adding UserToken model
}

/**
 * Get valid tokens for a user
 *
 * Returns decrypted tokens if valid, refreshes if needed.
 * Returns null if user has no tokens or refresh fails.
 */
export async function getValidUserTokens(userId: string): Promise<DecryptedTokens | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.externalId) {
    return null;
  }

  // TODO: Implement full token retrieval when UserToken model is added
  // For now, return null as tokens aren't stored in the User model
  return null;
}

/**
 * Auto-refresh tokens if needed
 *
 * Checks if token is expiring soon and refreshes it.
 * Returns the valid access token.
 */
export async function getValidAccessToken(
  userId: string,
  refreshBufferMinutes = 5,
): Promise<string | null> {
  const tokens = await getValidUserTokens(userId);
  if (!tokens) {
    return null;
  }

  // Check if token needs refresh
  if (tokenNeedsRefresh(tokens.expiresOn, refreshBufferMinutes)) {
    if (!tokens.refreshToken) {
      // No refresh token, need re-auth
      return null;
    }

    try {
      const newTokens = await refreshAccessToken({
        refreshToken: tokens.refreshToken,
        scopes: tokens.scopes || DEFAULT_USER_SCOPES,
        tenantId: tokens.tenantId,
      });

      // Store the new tokens
      await storeUserTokens(userId, {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresOn: newTokens.expiresOn,
        microsoftId: newTokens.microsoftId,
        tenantId: newTokens.tenantId,
        scopes: newTokens.scopes,
      });

      return newTokens.accessToken;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      return null;
    }
  }

  return tokens.accessToken;
}

/**
 * Remove stored tokens for a user
 */
export async function removeUserTokens(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      externalId: null,
    },
  });

  // TODO: Remove from UserToken table when added
}

/**
 * Check if user has valid Microsoft connection
 */
export async function hasValidMicrosoftConnection(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { externalId: true },
  });

  return !!user?.externalId;
}

// =============================================================================
// TOKEN REFRESH SERVICE
// =============================================================================

/**
 * Refresh tokens for all users with expiring tokens
 *
 * Run this periodically (e.g., every 15 minutes) to keep tokens fresh.
 * This prevents users from experiencing auth delays during normal use.
 */
export async function refreshExpiringTokens(
  bufferMinutes = 30,
): Promise<{ refreshed: number; failed: number }> {
  // TODO: Implement when UserToken model is available
  // Query for tokens expiring within buffer period
  // Attempt refresh for each
  // Track success/failure counts

  return { refreshed: 0, failed: 0 };
}

// =============================================================================
// TESTING HELPERS
// =============================================================================

/**
 * Generate a random encryption key for testing
 * Returns a 32-byte hex string
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Verify encryption is working correctly
 */
export function testEncryption(testValue: string): boolean {
  try {
    const encrypted = encrypt(testValue);
    const decrypted = decrypt(encrypted);
    return decrypted === testValue;
  } catch {
    return false;
  }
}
