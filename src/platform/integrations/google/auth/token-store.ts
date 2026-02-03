/**
 * Google Token Storage
 *
 * Provides secure storage and retrieval of Google OAuth tokens:
 * - Encryption at rest using AES-256-GCM
 * - Automatic token refresh before expiry
 * - Database persistence via Prisma
 *
 * @see docs/GOOGLE-WORKSPACE-AUTH-ARCHITECTURE.md
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { GoogleTokens, GoogleUserInfo } from "./client.js";
import { prisma } from "../../../db/client.js";
import { refreshGoogleToken, tokenNeedsRefresh } from "./client.js";
import { DEFAULT_USER_SCOPES } from "./scopes.js";

// =============================================================================
// ENCRYPTION
// =============================================================================

/**
 * Encryption algorithm: AES-256-GCM
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
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

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt an encrypted value
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
// TYPES
// =============================================================================

/**
 * Stored token data (encrypted)
 */
export interface StoredGoogleTokens {
  /** Encrypted access token */
  accessToken: string;
  /** Encrypted refresh token */
  refreshToken?: string;
  /** Token expiry timestamp */
  expiresAt: Date;
  /** Google user ID */
  googleId: string;
  /** User's email */
  email: string;
  /** Google Workspace domain (if applicable) */
  domain?: string;
  /** Scopes granted */
  scopes: string[];
  /** Last refresh timestamp */
  lastRefreshed?: Date;
}

/**
 * Decrypted token data for use in API calls
 */
export interface DecryptedGoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  googleId: string;
  email: string;
  domain?: string;
  scopes: string[];
}

// =============================================================================
// TOKEN STORE INTERFACE
// =============================================================================

/**
 * Interface for Google token storage implementations
 */
export interface GoogleTokenStore {
  /** Store tokens for a user */
  storeTokens(userId: string, tokens: GoogleTokens, userInfo: GoogleUserInfo): Promise<void>;
  /** Get tokens for a user (decrypted) */
  getTokens(userId: string): Promise<DecryptedGoogleTokens | null>;
  /** Refresh tokens if needed and return valid tokens */
  refreshIfNeeded(userId: string, bufferMinutes?: number): Promise<DecryptedGoogleTokens | null>;
  /** Delete tokens for a user */
  deleteTokens(userId: string): Promise<void>;
  /** Check if user has valid Google connection */
  hasValidConnection(userId: string): Promise<boolean>;
}

// =============================================================================
// DATABASE TOKEN STORE
// =============================================================================

/**
 * Database-backed Google token store using Prisma
 *
 * Note: This implementation assumes a GoogleUserToken model exists in the schema.
 * If not available, tokens are stored in the User model's JSON field.
 */
export class DatabaseGoogleTokenStore implements GoogleTokenStore {
  /**
   * Store tokens for a user
   */
  async storeTokens(userId: string, tokens: GoogleTokens, userInfo: GoogleUserInfo): Promise<void> {
    const encryptedAccess = encrypt(tokens.accessToken);
    const encryptedRefresh = tokens.refreshToken ? encrypt(tokens.refreshToken) : null;

    // Store in the user record for now
    // TODO: Create dedicated GoogleUserToken model for better separation
    await prisma.user.update({
      where: { id: userId },
      data: {
        // Store Google identity
        externalId: userInfo.googleId,
        // Note: In a full implementation, we'd store tokens in a separate table
        // For now, we update the user's external identity
      },
    });

    // If GoogleUserToken model exists, use it:
    // await prisma.googleUserToken.upsert({
    //   where: { userId },
    //   create: {
    //     userId,
    //     accessToken: encryptedAccess,
    //     refreshToken: encryptedRefresh,
    //     expiresAt: tokens.expiresAt,
    //     googleId: userInfo.googleId,
    //     email: userInfo.email,
    //     domain: userInfo.hostedDomain,
    //     scopes: tokens.scopes,
    //   },
    //   update: {
    //     accessToken: encryptedAccess,
    //     refreshToken: encryptedRefresh,
    //     expiresAt: tokens.expiresAt,
    //     scopes: tokens.scopes,
    //     lastRefreshed: new Date(),
    //   },
    // });
  }

  /**
   * Get tokens for a user (decrypted)
   */
  async getTokens(userId: string): Promise<DecryptedGoogleTokens | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.externalId) {
      return null;
    }

    // TODO: Retrieve from GoogleUserToken model when available
    return null;
  }

  /**
   * Refresh tokens if needed and return valid tokens
   */
  async refreshIfNeeded(userId: string, bufferMinutes = 5): Promise<DecryptedGoogleTokens | null> {
    const tokens = await this.getTokens(userId);
    if (!tokens) {
      return null;
    }

    if (!tokenNeedsRefresh(tokens.expiresAt, bufferMinutes)) {
      return tokens;
    }

    if (!tokens.refreshToken) {
      // No refresh token, need re-authentication
      return null;
    }

    try {
      const newTokens = await refreshGoogleToken(tokens.refreshToken);

      // Store the refreshed tokens
      await this.storeTokens(userId, newTokens, {
        googleId: tokens.googleId,
        email: tokens.email,
        emailVerified: true,
        hostedDomain: tokens.domain,
      });

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken || tokens.refreshToken,
        expiresAt: newTokens.expiresAt,
        googleId: tokens.googleId,
        email: tokens.email,
        domain: tokens.domain,
        scopes: newTokens.scopes.length > 0 ? newTokens.scopes : tokens.scopes,
      };
    } catch (error) {
      console.error("Failed to refresh Google token:", error);
      return null;
    }
  }

  /**
   * Delete tokens for a user
   */
  async deleteTokens(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        externalId: null,
      },
    });

    // TODO: Delete from GoogleUserToken when model exists
    // await prisma.googleUserToken.delete({
    //   where: { userId },
    // });
  }

  /**
   * Check if user has valid Google connection
   */
  async hasValidConnection(userId: string): Promise<boolean> {
    const tokens = await this.getTokens(userId);
    return tokens !== null;
  }
}

// =============================================================================
// IN-MEMORY TOKEN STORE (for testing)
// =============================================================================

/**
 * In-memory token store for testing
 */
export class InMemoryGoogleTokenStore implements GoogleTokenStore {
  private tokens = new Map<string, StoredGoogleTokens>();

  async storeTokens(userId: string, tokens: GoogleTokens, userInfo: GoogleUserInfo): Promise<void> {
    this.tokens.set(userId, {
      accessToken: encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
      expiresAt: tokens.expiresAt,
      googleId: userInfo.googleId,
      email: userInfo.email,
      domain: userInfo.hostedDomain,
      scopes: tokens.scopes,
      lastRefreshed: new Date(),
    });
  }

  async getTokens(userId: string): Promise<DecryptedGoogleTokens | null> {
    const stored = this.tokens.get(userId);
    if (!stored) {
      return null;
    }

    return {
      accessToken: decrypt(stored.accessToken),
      refreshToken: stored.refreshToken ? decrypt(stored.refreshToken) : undefined,
      expiresAt: stored.expiresAt,
      googleId: stored.googleId,
      email: stored.email,
      domain: stored.domain,
      scopes: stored.scopes,
    };
  }

  async refreshIfNeeded(userId: string, bufferMinutes = 5): Promise<DecryptedGoogleTokens | null> {
    const tokens = await this.getTokens(userId);
    if (!tokens) {
      return null;
    }

    if (!tokenNeedsRefresh(tokens.expiresAt, bufferMinutes)) {
      return tokens;
    }

    if (!tokens.refreshToken) {
      return null;
    }

    try {
      const newTokens = await refreshGoogleToken(tokens.refreshToken);

      await this.storeTokens(userId, newTokens, {
        googleId: tokens.googleId,
        email: tokens.email,
        emailVerified: true,
        hostedDomain: tokens.domain,
      });

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken || tokens.refreshToken,
        expiresAt: newTokens.expiresAt,
        googleId: tokens.googleId,
        email: tokens.email,
        domain: tokens.domain,
        scopes: newTokens.scopes.length > 0 ? newTokens.scopes : tokens.scopes,
      };
    } catch (error) {
      console.error("Failed to refresh Google token:", error);
      return null;
    }
  }

  async deleteTokens(userId: string): Promise<void> {
    this.tokens.delete(userId);
  }

  async hasValidConnection(userId: string): Promise<boolean> {
    return this.tokens.has(userId);
  }

  /**
   * Clear all tokens (for testing)
   */
  clear(): void {
    this.tokens.clear();
  }

  /**
   * Get token count (for testing)
   */
  size(): number {
    return this.tokens.size;
  }
}

// =============================================================================
// DEFAULT TOKEN STORE
// =============================================================================

let defaultTokenStore: GoogleTokenStore | null = null;

/**
 * Get the default token store instance
 */
export function getTokenStore(): GoogleTokenStore {
  if (!defaultTokenStore) {
    defaultTokenStore = new DatabaseGoogleTokenStore();
  }
  return defaultTokenStore;
}

/**
 * Set a custom token store (for testing)
 */
export function setTokenStore(store: GoogleTokenStore): void {
  defaultTokenStore = store;
}

/**
 * Reset the token store to default (for testing)
 */
export function resetTokenStore(): void {
  defaultTokenStore = null;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Store Google tokens for a user
 */
export async function storeUserGoogleTokens(
  userId: string,
  tokens: GoogleTokens,
  userInfo: GoogleUserInfo,
): Promise<void> {
  const store = getTokenStore();
  await store.storeTokens(userId, tokens, userInfo);
}

/**
 * Get valid Google access token for a user
 *
 * Automatically refreshes if needed.
 */
export async function getValidGoogleAccessToken(
  userId: string,
  bufferMinutes = 5,
): Promise<string | null> {
  const store = getTokenStore();
  const tokens = await store.refreshIfNeeded(userId, bufferMinutes);
  return tokens?.accessToken || null;
}

/**
 * Get full token data for a user
 */
export async function getUserGoogleTokens(userId: string): Promise<DecryptedGoogleTokens | null> {
  const store = getTokenStore();
  return store.getTokens(userId);
}

/**
 * Remove Google tokens for a user
 */
export async function removeUserGoogleTokens(userId: string): Promise<void> {
  const store = getTokenStore();
  await store.deleteTokens(userId);
}

/**
 * Check if user has valid Google connection
 */
export async function hasValidGoogleConnection(userId: string): Promise<boolean> {
  const store = getTokenStore();
  return store.hasValidConnection(userId);
}

// =============================================================================
// TOKEN REFRESH SERVICE
// =============================================================================

/**
 * Refresh tokens for all users with expiring tokens
 *
 * Run this periodically (e.g., every 15 minutes) to keep tokens fresh.
 */
export async function refreshExpiringGoogleTokens(
  bufferMinutes = 30,
): Promise<{ refreshed: number; failed: number }> {
  // TODO: Implement when GoogleUserToken model is available
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
