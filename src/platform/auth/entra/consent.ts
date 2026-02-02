/**
 * Microsoft Entra Admin Consent Flow
 *
 * Handles the organization-level admin consent flow for Microsoft 365 integration.
 * When an admin grants consent, it allows GoodTeams to access resources on behalf
 * of all users in the tenant.
 *
 * Flow:
 * 1. Admin clicks "Connect Microsoft 365"
 * 2. Redirect to Microsoft admin consent URL
 * 3. Admin approves permissions
 * 4. Microsoft redirects back with tenant ID
 * 5. Store tenant ID for future SSO
 *
 * @see docs/MICROSOFT-365-AUTH-ARCHITECTURE.md
 */

import { randomUUID } from "node:crypto";
import { getEntraConfig } from "./client.js";

// =============================================================================
// STATE MANAGEMENT (CSRF Protection)
// =============================================================================

/**
 * Pending consent state with metadata
 */
interface ConsentState {
  /** Organization ID initiating consent */
  organizationId: string;
  /** User ID of admin */
  userId: string;
  /** State creation timestamp */
  createdAt: number;
  /** Redirect URL after completion */
  returnUrl?: string;
}

/**
 * In-memory store for pending consent states
 * In production, use Redis for distributed state
 */
const pendingConsentStates = new Map<string, ConsentState>();

/** State validity period: 10 minutes */
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Create and store a consent state for CSRF protection
 */
export function createConsentState(
  organizationId: string,
  userId: string,
  returnUrl?: string,
): string {
  // Clean up expired states periodically
  cleanupExpiredStates();

  const state = randomUUID();
  pendingConsentStates.set(state, {
    organizationId,
    userId,
    createdAt: Date.now(),
    returnUrl,
  });

  return state;
}

/**
 * Validate and consume a consent state
 * Returns the state data if valid, null otherwise
 */
export function consumeConsentState(state: string): ConsentState | null {
  const consentState = pendingConsentStates.get(state);
  if (!consentState) {
    return null;
  }

  // Check if expired
  if (Date.now() - consentState.createdAt > STATE_TTL_MS) {
    pendingConsentStates.delete(state);
    return null;
  }

  // Consume the state (one-time use)
  pendingConsentStates.delete(state);
  return consentState;
}

/**
 * Remove expired states from memory
 */
function cleanupExpiredStates(): void {
  const now = Date.now();
  for (const [key, value] of pendingConsentStates.entries()) {
    if (now - value.createdAt > STATE_TTL_MS) {
      pendingConsentStates.delete(key);
    }
  }
}

// =============================================================================
// ADMIN CONSENT URL
// =============================================================================

/**
 * Parameters for admin consent URL generation
 */
export interface AdminConsentUrlParams {
  /** Callback URL for consent result */
  redirectUri: string;
  /** CSRF protection state token */
  state: string;
  /** Optional tenant ID (defaults to 'common' for any tenant) */
  tenantId?: string;
}

/**
 * Generate Microsoft admin consent URL
 *
 * This URL prompts an admin to grant organization-wide permissions
 * for the GoodTeams application.
 *
 * @example
 * ```typescript
 * const state = createConsentState(orgId, userId);
 * const url = getAdminConsentUrl({
 *   redirectUri: 'https://app.goodteams.ai/api/platform/auth/entra/callback',
 *   state,
 * });
 * // Redirect user to url
 * ```
 */
export function getAdminConsentUrl(params: AdminConsentUrlParams): string {
  const config = getEntraConfig();
  const tenant = params.tenantId || "common";

  const queryParams = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
  });

  return `https://login.microsoftonline.com/${tenant}/adminconsent?${queryParams.toString()}`;
}

// =============================================================================
// CALLBACK HANDLING
// =============================================================================

/**
 * Result of admin consent callback
 */
export interface AdminConsentResult {
  /** Whether consent was granted */
  success: boolean;
  /** Microsoft tenant ID (if successful) */
  tenantId?: string;
  /** Original consent state data */
  state: ConsentState;
  /** Error message (if failed) */
  error?: string;
  /** Error description from Microsoft */
  errorDescription?: string;
}

/**
 * Admin consent callback query parameters from Microsoft
 */
export interface AdminConsentCallbackParams {
  /** CSRF state token */
  state?: string;
  /** Tenant ID on success */
  tenant?: string;
  /** Whether admin consent was granted */
  admin_consent?: string;
  /** Error code on failure */
  error?: string;
  /** Error description on failure */
  error_description?: string;
}

/**
 * Handle the admin consent callback from Microsoft
 *
 * Validates the state, extracts tenant ID, and returns the result.
 *
 * @example
 * ```typescript
 * const result = handleAdminConsentCallback({
 *   state: req.query.state,
 *   tenant: req.query.tenant,
 *   admin_consent: req.query.admin_consent,
 *   error: req.query.error,
 *   error_description: req.query.error_description,
 * });
 *
 * if (result.success) {
 *   await updateOrganization(result.state.organizationId, {
 *     externalTenantId: result.tenantId,
 *     status: 'ACTIVE',
 *   });
 * }
 * ```
 */
export function handleAdminConsentCallback(params: AdminConsentCallbackParams): AdminConsentResult {
  // Validate state parameter
  if (!params.state) {
    throw new Error("Missing state parameter in callback");
  }

  // Consume and validate the state
  const stateData = consumeConsentState(params.state);
  if (!stateData) {
    throw new Error("Invalid or expired state parameter");
  }

  // Check for errors from Microsoft
  if (params.error) {
    return {
      success: false,
      state: stateData,
      error: params.error,
      errorDescription: params.error_description,
    };
  }

  // Validate consent was granted
  if (params.admin_consent !== "True") {
    return {
      success: false,
      state: stateData,
      error: "consent_denied",
      errorDescription: "Admin consent was not granted",
    };
  }

  // Extract tenant ID
  if (!params.tenant) {
    return {
      success: false,
      state: stateData,
      error: "missing_tenant",
      errorDescription: "No tenant ID returned from Microsoft",
    };
  }

  return {
    success: true,
    tenantId: params.tenant,
    state: stateData,
  };
}

// =============================================================================
// TESTING HELPERS
// =============================================================================

/**
 * Clear all pending consent states
 * Only for testing purposes
 */
export function clearAllConsentStates(): void {
  pendingConsentStates.clear();
}

/**
 * Get count of pending consent states
 * Only for testing/monitoring
 */
export function getPendingConsentCount(): number {
  return pendingConsentStates.size;
}
