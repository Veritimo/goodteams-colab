/**
 * JWT Utilities
 *
 * Sign and verify JWTs using the `jose` library.
 * Uses HS256 with a shared secret for simplicity.
 */

import * as jose from "jose";
import type { AccessTokenPayload, RefreshTokenPayload } from "./types.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "goodteams";
const JWT_AUDIENCE = "goodteams-platform";

/**
 * Get the JWT secret from environment.
 * Falls back to a derived key from CREDENTIAL_ENCRYPTION_KEY if not set.
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("JWT_SECRET or CREDENTIAL_ENCRYPTION_KEY environment variable is required");
  }
  // Use first 32 bytes (256 bits) for HS256
  return new TextEncoder().encode(secret.slice(0, 64).padEnd(64, "0"));
}

// =============================================================================
// ACCESS TOKEN
// =============================================================================

/**
 * Sign an access token JWT
 */
export async function signAccessToken(
  payload: AccessTokenPayload,
  expiresInMinutes: number,
): Promise<string> {
  const secret = getJwtSecret();

  const jwt = await new jose.SignJWT({
    ...payload,
    type: "access",
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(`${expiresInMinutes}m`)
    .sign(secret);

  return jwt;
}

/**
 * Verify and decode an access token
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const secret = getJwtSecret();

  try {
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    // Validate payload structure
    if (payload.type !== "access") {
      throw new Error("Invalid token type");
    }

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      orgId: payload.orgId as string | null,
      role: payload.role as AccessTokenPayload["role"],
      type: "access",
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new JwtError("Access token expired", "EXPIRED");
    }
    if (error instanceof jose.errors.JWTInvalid) {
      throw new JwtError("Invalid access token", "INVALID");
    }
    throw new JwtError("Token verification failed", "INVALID");
  }
}

// =============================================================================
// REFRESH TOKEN
// =============================================================================

/**
 * Sign a refresh token JWT
 *
 * Note: The refresh token is also stored hashed in the DB.
 * The JWT format allows stateless validation of structure,
 * but we still check the DB for revocation.
 */
export async function signRefreshToken(
  payload: RefreshTokenPayload,
  expiresInDays: number,
): Promise<string> {
  const secret = getJwtSecret();

  // Generate a unique JWT ID to ensure each token is unique
  // This is critical for token rotation to work properly
  const jti = crypto.randomUUID();

  const jwt = await new jose.SignJWT({
    ...payload,
    type: "refresh",
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setJti(jti)
    .setExpirationTime(`${expiresInDays}d`)
    .sign(secret);

  return jwt;
}

/**
 * Verify and decode a refresh token
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const secret = getJwtSecret();

  try {
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (payload.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    return {
      sid: payload.sid as string,
      sub: payload.sub as string,
      type: "refresh",
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new JwtError("Refresh token expired", "EXPIRED");
    }
    if (error instanceof jose.errors.JWTInvalid) {
      throw new JwtError("Invalid refresh token", "INVALID");
    }
    throw new JwtError("Token verification failed", "INVALID");
  }
}

// =============================================================================
// TOKEN HASHING
// =============================================================================

/**
 * Hash a refresh token for storage
 * Uses SHA-256 for fast, secure hashing
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// =============================================================================
// ERRORS
// =============================================================================

export type JwtErrorCode = "EXPIRED" | "INVALID" | "MISSING";

export class JwtError extends Error {
  constructor(
    message: string,
    public code: JwtErrorCode,
  ) {
    super(message);
    this.name = "JwtError";
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Decode a JWT without verification (for debugging/logging)
 */
export function decodeToken(token: string): jose.JWTPayload | null {
  try {
    return jose.decodeJwt(token);
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired without full verification
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;
  return payload.exp * 1000 < Date.now();
}
