/**
 * Platform Authentication Routes
 *
 * Handles Microsoft Entra SSO flows:
 * - Admin consent for organization onboarding
 * - User SSO login
 * - Logout
 *
 * @see docs/MICROSOFT-365-AUTH-ARCHITECTURE.md
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";
import {
  isEntraConfigured,
  createConsentState,
  getAdminConsentUrl,
  handleAdminConsentCallback,
  createAuthState,
  getAuthCodeUrl,
  exchangeCodeForTokens,
  consumeAuthState,
  storeUserTokens,
  removeUserTokens,
  DEFAULT_USER_SCOPES,
} from "../../auth/entra/index.js";
import { prisma } from "../../db/client.js";
import { refreshSession, getUserSessions, revokeSession } from "../../session/service.js";
import { handleGoogleAuth } from "./google-auth.js";
import {
  createSessionAndSetCookies,
  clearSessionCookies,
  extractRefreshToken,
  revokeAllSessionsAndClearCookies,
} from "./session-utils.js";
import { setSessionCookies } from "./session-utils.js";
import { sendError, sendJson, parseBody, redirect } from "./utils.js";

/**
 * Handle auth routes
 * Routes:
 * - GET /api/platform/auth/entra/consent - Initiate admin consent (requires auth)
 * - GET /api/platform/auth/entra/callback - Handle consent callback (requires auth)
 * - GET /api/platform/auth/entra/onboard - Initiate onboarding consent (no auth)
 * - GET /api/platform/auth/entra/onboard/callback - Handle onboarding callback (no auth)
 * - GET /api/platform/auth/entra/login - Initiate user SSO
 * - GET /api/platform/auth/entra/login/callback - Handle SSO callback
 * - POST /api/platform/auth/logout - Clear session
 * - GET /api/platform/auth/status - Get auth status
 */
export async function handleAuth(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const subPath = url.pathname.replace("/api/platform/auth", "");
  const method = req.method ?? "GET";

  // Check Entra configuration for Entra-specific routes
  if (subPath.startsWith("/entra") && !isEntraConfigured()) {
    sendError(res, "SERVICE_UNAVAILABLE", "Microsoft Entra SSO is not configured");
    return;
  }

  // Forward Google auth routes to dedicated handler
  if (subPath.startsWith("/google")) {
    await handleGoogleAuth(req, res, ctx);
    return;
  }

  // Route matching
  if (subPath === "/entra/onboard" && method === "GET") {
    await handleOnboardingConsentInit(req, res);
  } else if (subPath === "/entra/onboard/callback" && method === "GET") {
    await handleOnboardingConsentCallback(req, res);
  } else if (subPath === "/entra/consent" && method === "GET") {
    await handleConsentInit(req, res, ctx);
  } else if (subPath === "/entra/callback" && method === "GET") {
    await handleConsentCallback(req, res, ctx);
  } else if (subPath === "/entra/login" && method === "GET") {
    await handleLoginInit(req, res, ctx);
  } else if (subPath === "/entra/login/callback" && method === "GET") {
    await handleLoginCallback(req, res, ctx);
  } else if (subPath === "/logout" && method === "POST") {
    await handleLogout(req, res, ctx);
  } else if (subPath === "/refresh" && method === "POST") {
    await handleRefresh(req, res, ctx);
  } else if (subPath === "/sessions" && method === "GET") {
    await handleListSessions(req, res, ctx);
  } else if (subPath.startsWith("/sessions/") && method === "DELETE") {
    await handleRevokeSession(req, res, ctx);
  } else if (subPath === "/status" && method === "GET") {
    await handleStatus(req, res, ctx);
  } else {
    sendError(res, "NOT_FOUND", `Auth route not found: ${method} ${subPath}`);
  }
}

// =============================================================================
// ADMIN CONSENT FLOW
// =============================================================================

/**
 * GET /api/platform/auth/entra/consent
 * Initiate admin consent flow for organization Microsoft 365 integration.
 */
async function handleConsentInit(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  try {
    // Check authentication
    if (!ctx.user) {
      sendError(res, "UNAUTHORIZED", "Authentication required");
      return;
    }

    // Check admin role (context uses lowercase: owner, admin, member, viewer)
    if (!["admin", "owner"].includes(ctx.user.role)) {
      sendError(res, "FORBIDDEN", "Admin access required to initiate consent");
      return;
    }

    // Get organization ID
    const organizationId = ctx.user.orgId;
    if (!organizationId) {
      sendError(res, "BAD_REQUEST", "User must belong to an organization");
      return;
    }

    // Get redirect URI
    const url = new URL(req.url ?? "/", "http://localhost");
    const baseUrl = process.env.APP_URL || `http://${req.headers.host}`;
    const redirectUri =
      process.env.ENTRA_REDIRECT_URI || `${baseUrl}/api/platform/auth/entra/callback`;

    // Get return URL
    const returnUrl = url.searchParams.get("returnUrl") ?? undefined;

    // Create state for CSRF protection
    const state = createConsentState(organizationId, ctx.user.id, returnUrl);

    // Generate consent URL
    const consentUrl = getAdminConsentUrl({
      redirectUri,
      state,
    });

    // Redirect to Microsoft
    redirect(res, consentUrl);
  } catch (error) {
    console.error("Admin consent initiation failed:", error);
    sendError(res, "INTERNAL_ERROR", "Failed to initiate admin consent");
  }
}

/**
 * GET /api/platform/auth/entra/callback
 * Handle admin consent callback from Microsoft.
 */
async function handleConsentCallback(
  req: IncomingMessage,
  res: ServerResponse,
  _ctx: RequestContext,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");

    const result = handleAdminConsentCallback({
      state: url.searchParams.get("state") ?? undefined,
      tenant: url.searchParams.get("tenant") ?? undefined,
      admin_consent: url.searchParams.get("admin_consent") ?? undefined,
      error: url.searchParams.get("error") ?? undefined,
      error_description: url.searchParams.get("error_description") ?? undefined,
    });

    if (!result.success) {
      console.error("Admin consent failed:", result.error, result.errorDescription);

      const errorUrl = result.state.returnUrl
        ? `${result.state.returnUrl}?error=${result.error}`
        : `/settings/integrations?error=${encodeURIComponent(result.error || "consent_failed")}`;

      redirect(res, errorUrl);
      return;
    }

    // Update organization with tenant ID
    await prisma.organization.update({
      where: { id: result.state.organizationId },
      data: {
        externalTenantId: result.tenantId,
        status: "ACTIVE",
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        organizationId: result.state.organizationId,
        actorId: result.state.userId,
        actorRole: "ADMIN",
        action: "organization.entra.connected",
        targetType: "organization",
        targetId: result.state.organizationId,
        details: {
          tenantId: result.tenantId,
        },
      },
    });

    // Redirect to success page
    const successUrl = result.state.returnUrl || "/settings/integrations?success=entra_connected";

    redirect(res, successUrl);
  } catch (error) {
    console.error("Admin consent callback failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    redirect(res, `/settings/integrations?error=${encodeURIComponent(errorMessage)}`);
  }
}

// =============================================================================
// ONBOARDING CONSENT FLOW (NO AUTH REQUIRED)
// =============================================================================

// In-memory store for onboarding states (in production, use Redis or similar)
const onboardingStates = new Map<string, { returnUrl?: string; createdAt: number }>();

// Clean up expired states periodically (5 minute expiry)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of onboardingStates) {
    if (now - value.createdAt > 5 * 60 * 1000) {
      onboardingStates.delete(key);
    }
  }
}, 60 * 1000);

/**
 * GET /api/platform/auth/entra/onboard
 * Initiate admin consent for NEW organization onboarding.
 * Does not require authentication.
 */
async function handleOnboardingConsentInit(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const baseUrl = process.env.APP_URL || `http://${req.headers.host}`;
    const redirectUri = `${baseUrl}/api/platform/auth/entra/onboard/callback`;

    // Get return URL
    const returnUrl = url.searchParams.get("returnUrl") ?? "/onboarding/setup";

    // Generate a random state for CSRF protection
    const stateId = crypto.randomUUID();
    onboardingStates.set(stateId, { returnUrl, createdAt: Date.now() });

    // Build the admin consent URL manually for onboarding
    const clientId = process.env.ENTRA_CLIENT_ID;
    if (!clientId) {
      sendError(res, "SERVICE_UNAVAILABLE", "Entra client ID not configured");
      return;
    }

    const consentUrl = new URL("https://login.microsoftonline.com/organizations/adminconsent");
    consentUrl.searchParams.set("client_id", clientId);
    consentUrl.searchParams.set("redirect_uri", redirectUri);
    consentUrl.searchParams.set("state", stateId);

    // Redirect to Microsoft
    redirect(res, consentUrl.toString());
  } catch (error) {
    console.error("Onboarding consent initiation failed:", error);
    sendError(res, "INTERNAL_ERROR", "Failed to initiate onboarding");
  }
}

/**
 * GET /api/platform/auth/entra/onboard/callback
 * Handle admin consent callback for NEW organization onboarding.
 * Creates the organization and first admin user.
 */
async function handleOnboardingConsentCallback(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const stateId = url.searchParams.get("state");
    const tenantId = url.searchParams.get("tenant");
    const adminConsent = url.searchParams.get("admin_consent");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    // Validate state
    const stateData = stateId ? onboardingStates.get(stateId) : null;
    if (!stateId || !stateData) {
      redirect(res, "/onboarding/creating?error=invalid_state");
      return;
    }

    // Clean up used state
    onboardingStates.delete(stateId);

    // Handle error from Microsoft
    if (error) {
      console.error("Onboarding consent failed:", error, errorDescription);
      redirect(res, `/onboarding/creating?error=${encodeURIComponent(error)}`);
      return;
    }

    // Validate consent was granted
    if (adminConsent !== "True" || !tenantId) {
      redirect(res, "/onboarding/creating?error=consent_denied");
      return;
    }

    // Check if organization already exists for this tenant
    const existingOrg = await prisma.organization.findFirst({
      where: { externalTenantId: tenantId },
    });

    if (existingOrg) {
      // Org already exists - redirect to login on the admin UI
      const adminUiBase = process.env.ADMIN_UI_URL || `http://${req.headers.host}`;
      redirect(res, `${adminUiBase}/admin?message=organization_exists`);
      return;
    }

    // Fetch tenant info from Microsoft Graph to get org name
    let orgName = "New Organization";
    try {
      // Note: We can't call Graph API here without a token
      // The org name will be set during the setup wizard
      // For now, use a placeholder
    } catch {
      // Ignore - use default name
    }

    // Create the organization
    const organization = await prisma.organization.create({
      data: {
        name: orgName,
        externalTenantId: tenantId,
        status: "ACTIVE",
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        actorId: "system",
        actorRole: "ADMIN",
        action: "organization.created",
        targetType: "organization",
        targetId: organization.id,
        details: {
          tenantId,
          method: "onboarding",
        },
      },
    });

    // Redirect to setup wizard with org ID
    // The user will complete SSO login as part of the setup
    // Use ADMIN_UI_URL for frontend, fallback to same host for production (when UI is served from same origin)
    const adminUiBase = process.env.ADMIN_UI_URL || `http://${req.headers.host}`;
    const setupUrl = new URL(stateData.returnUrl || "/onboarding/setup", adminUiBase);
    setupUrl.searchParams.set("org", organization.id);
    setupUrl.searchParams.set("tenant", tenantId);

    // Redirect through login to establish session
    const loginUrl = new URL("/api/platform/auth/entra/login", `http://${req.headers.host}`);
    loginUrl.searchParams.set("org", organization.id);
    // Pass full URL for dev (separate UI server) or relative path for prod
    loginUrl.searchParams.set("returnUrl", setupUrl.toString());

    redirect(res, loginUrl.toString());
  } catch (error) {
    console.error("Onboarding consent callback failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    redirect(res, `/onboarding/creating?error=${encodeURIComponent(errorMessage)}`);
  }
}

// =============================================================================
// USER SSO LOGIN
// =============================================================================

/**
 * GET /api/platform/auth/entra/login
 * Initiate user SSO login with Microsoft.
 */
async function handleLoginInit(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const baseUrl = process.env.APP_URL || `http://${req.headers.host}`;
    const redirectUri =
      process.env.ENTRA_USER_REDIRECT_URI || `${baseUrl}/api/platform/auth/entra/login/callback`;

    // Get optional parameters
    const returnUrl = url.searchParams.get("returnUrl") ?? undefined;
    const loginHint = url.searchParams.get("login_hint") ?? undefined;
    const organizationId = url.searchParams.get("org") ?? undefined;

    // Create state for CSRF protection
    const state = createAuthState({
      userId: ctx.user?.id,
      organizationId,
      returnUrl,
    });

    // Generate auth URL
    const authUrl = await getAuthCodeUrl({
      redirectUri,
      state,
      scopes: DEFAULT_USER_SCOPES,
      loginHint,
    });

    // Redirect to Microsoft
    redirect(res, authUrl);
  } catch (error) {
    console.error("User login initiation failed:", error);
    sendError(res, "INTERNAL_ERROR", "Failed to initiate SSO login");
  }
}

/**
 * GET /api/platform/auth/entra/login/callback
 * Handle user login callback from Microsoft.
 */
async function handleLoginCallback(
  req: IncomingMessage,
  res: ServerResponse,
  _ctx: RequestContext,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    // Handle error from Microsoft
    if (error) {
      console.error("User login failed:", error, errorDescription);
      redirect(res, `/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !stateParam) {
      redirect(res, "/login?error=missing_params");
      return;
    }

    // Validate state
    const stateData = consumeAuthState(stateParam);
    if (!stateData) {
      redirect(res, "/login?error=invalid_state");
      return;
    }

    // Get redirect URI
    const baseUrl = process.env.APP_URL || `http://${req.headers.host}`;
    const redirectUri =
      process.env.ENTRA_USER_REDIRECT_URI || `${baseUrl}/api/platform/auth/entra/login/callback`;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens({
      code,
      redirectUri,
      scopes: stateData.scopes,
    });

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ externalId: tokens.microsoftId }, { email: tokens.email || "" }],
      },
    });

    // Check if this is an onboarding flow (org ID in state)
    const isOnboarding = !!stateData.organizationId;

    // For onboarding, check if this is the first user for the org
    let shouldBeAdmin = false;
    if (isOnboarding && stateData.organizationId) {
      const existingOrgUsers = await prisma.user.count({
        where: { organizationId: stateData.organizationId },
      });
      shouldBeAdmin = existingOrgUsers === 0;
    }

    if (user) {
      // Update existing user - link to org if from onboarding
      const updateData: any = {
        externalId: tokens.microsoftId,
        username: tokens.displayName || user.username,
      };

      // SAFEGUARD: If user already has an org but this is an onboarding flow,
      // reconnect their existing org instead of using the newly created one
      if (isOnboarding && stateData.organizationId && user.organizationId) {
        // User already belongs to an org - this is a reconnect scenario

        // FIRST: Delete the orphaned org (it has the externalTenantId we need)
        if (stateData.organizationId !== user.organizationId) {
          try {
            await prisma.organization.delete({
              where: { id: stateData.organizationId },
            });
            console.log(
              `[auth] Cleaned up orphaned org ${stateData.organizationId} - user reconnecting to existing org ${user.organizationId}`,
            );
          } catch (e) {
            // Org might have users or other references - just log and continue
            console.warn(`[auth] Could not delete orphaned org ${stateData.organizationId}:`, e);
          }
        }

        // THEN: Update their existing org with the new tenant ID
        await prisma.organization.update({
          where: { id: user.organizationId },
          data: { externalTenantId: tokens.tenantId },
        });

        // Log audit event for reconnection
        await prisma.auditLog.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            actorRole: user.role,
            action: "organization.entra.reconnected",
            targetType: "organization",
            targetId: user.organizationId,
            details: {
              tenantId: tokens.tenantId,
              method: "onboarding_reconnect",
            },
          },
        });
      } else if (isOnboarding && stateData.organizationId && !user.organizationId) {
        // Link to org and set as admin if this is onboarding and user isn't already in an org
        updateData.organizationId = stateData.organizationId;
        if (shouldBeAdmin) {
          updateData.role = "ADMIN";
        }
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    } else {
      // Create new user
      if (!tokens.email) {
        redirect(res, "/login?error=no_email");
        return;
      }

      user = await prisma.user.create({
        data: {
          email: tokens.email,
          username: tokens.displayName,
          externalId: tokens.microsoftId,
          role: shouldBeAdmin ? "ADMIN" : "USER",
          organizationId: stateData.organizationId,
        },
      });
    }

    // Store tokens
    await storeUserTokens(user.id, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresOn: tokens.expiresOn,
      microsoftId: tokens.microsoftId,
      tenantId: tokens.tenantId,
      scopes: tokens.scopes,
    });

    // Create session and set cookies
    const sessionTokens = await createSessionAndSetCookies(res, user.id, {
      organizationId: user.organizationId,
      userAgent: req.headers["user-agent"] ?? undefined,
      ipAddress: getClientIp(req) ?? undefined,
    });

    // Log audit event
    if (user.organizationId) {
      await prisma.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorId: user.id,
          actorRole: user.role,
          action: "user.login.sso",
          targetType: "user",
          targetId: user.id,
          details: {
            method: "entra",
            tenantId: tokens.tenantId,
          },
          ipAddress: getClientIp(req),
          userAgent: req.headers["user-agent"] ?? null,
        },
      });
    }

    // Check if client wants JSON response (API client) or redirect (browser)
    const acceptHeader = req.headers.accept || "";
    if (acceptHeader.includes("application/json")) {
      sendJson(res, {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.username,
          role: user.role,
          organizationId: user.organizationId,
        },
        accessToken: sessionTokens.accessToken,
        expiresAt: sessionTokens.accessTokenExpiresAt,
        message: "Login successful. Tokens set in httpOnly cookies.",
      });
      return;
    }

    // For browser: redirect (cookies are already set)
    const successUrl = stateData.returnUrl || "/";
    const separator = successUrl.includes("?") ? "&" : "?";
    redirect(res, `${successUrl}${separator}login=success`);
  } catch (error) {
    console.error("User login callback failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    redirect(res, `/login?error=${encodeURIComponent(errorMessage)}`);
  }
}

// =============================================================================
// LOGOUT
// =============================================================================

/**
 * POST /api/platform/auth/logout
 * Clear user session and optionally Microsoft tokens.
 */
async function handleLogout(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (!ctx.user) {
      clearSessionCookies(res);
      sendJson(res, { success: true });
      return;
    }

    // Remove stored OAuth tokens (gracefully handle stub auth users that don't exist in DB)
    try {
      await removeUserTokens(ctx.user.id);
    } catch {
      // User may not exist in DB (stub auth) - that's fine
    }

    // Revoke all sessions for this user and clear cookies
    try {
      await revokeAllSessionsAndClearCookies(res, ctx.user.id, "user_logout");
    } catch {
      // Session may not exist - just clear cookies
      clearSessionCookies(res);
    }

    // Log audit event (gracefully handle missing org for stub auth)
    if (ctx.user.orgId) {
      try {
        await prisma.auditLog.create({
          data: {
            organizationId: ctx.user.orgId,
            actorId: ctx.user.id,
            actorRole: ctx.user.role.toUpperCase() as "ADMIN" | "USER",
            action: "user.logout",
            targetType: "user",
            targetId: ctx.user.id,
            details: {},
            ipAddress: getClientIp(req),
            userAgent: req.headers["user-agent"] ?? null,
          },
        });
      } catch {
        // Org may not exist in DB (stub auth) - that's fine
      }
    }

    // If federated logout requested, return redirect URL
    if (url.searchParams.get("federated") === "true") {
      const postLogoutUrl = process.env.APP_URL || `http://${req.headers.host}`;
      const logoutUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(postLogoutUrl)}`;
      sendJson(res, { success: true, redirectUrl: logoutUrl });
      return;
    }

    sendJson(res, { success: true });
  } catch (error) {
    console.error("Logout failed:", error);
    sendError(res, "INTERNAL_ERROR", "Failed to logout");
  }
}

// =============================================================================
// TOKEN REFRESH
// =============================================================================

/**
 * POST /api/platform/auth/refresh
 * Refresh access token using refresh token from cookie.
 */
async function handleRefresh(
  req: IncomingMessage,
  res: ServerResponse,
  _ctx: RequestContext,
): Promise<void> {
  try {
    // Get refresh token from cookie
    const refreshToken = extractRefreshToken(req.headers.cookie);
    if (!refreshToken) {
      sendError(res, "UNAUTHORIZED", "No refresh token provided");
      return;
    }

    // Refresh the session
    const tokens = await refreshSession(refreshToken, {
      userAgent: req.headers["user-agent"] ?? undefined,
      ipAddress: getClientIp(req) ?? undefined,
    });

    // Set new cookies
    setSessionCookies(res, tokens);

    sendJson(res, {
      success: true,
      accessToken: tokens.accessToken,
      expiresAt: tokens.accessTokenExpiresAt,
    });
  } catch (error) {
    console.error("Token refresh failed:", error);
    clearSessionCookies(res);

    if (error instanceof Error && error.message.includes("expired")) {
      sendError(res, "UNAUTHORIZED", "Session expired, please login again");
      return;
    }

    sendError(res, "UNAUTHORIZED", "Failed to refresh session");
  }
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * GET /api/platform/auth/sessions
 * List all active sessions for the current user.
 */
async function handleListSessions(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  if (!ctx.user) {
    sendError(res, "UNAUTHORIZED", "Authentication required");
    return;
  }

  try {
    const sessions = await getUserSessions(ctx.user.id);
    sendJson(res, {
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        lastUsedAt: s.lastUsedAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
      })),
    });
  } catch (error) {
    console.error("List sessions failed:", error);
    sendError(res, "INTERNAL_ERROR", "Failed to list sessions");
  }
}

/**
 * DELETE /api/platform/auth/sessions/:id
 * Revoke a specific session.
 */
async function handleRevokeSession(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  if (!ctx.user) {
    sendError(res, "UNAUTHORIZED", "Authentication required");
    return;
  }

  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const sessionId = url.pathname.split("/").pop();

    if (!sessionId) {
      sendError(res, "BAD_REQUEST", "Session ID required");
      return;
    }

    await revokeSession(sessionId, "user_revoked");
    sendJson(res, { success: true });
  } catch (error) {
    console.error("Revoke session failed:", error);
    sendError(res, "INTERNAL_ERROR", "Failed to revoke session");
  }
}

// =============================================================================
// STATUS
// =============================================================================

/**
 * GET /api/platform/auth/status
 * Get current authentication status.
 */
async function handleStatus(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> {
  sendJson(res, {
    authenticated: !!ctx.user,
    tokenExpired: ctx.tokenExpired ?? false,
    user: ctx.user
      ? {
          id: ctx.user.id,
          email: ctx.user.email,
          role: ctx.user.role,
          organizationId: ctx.user.orgId,
        }
      : null,
    entraConfigured: isEntraConfigured(),
  });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get client IP from request
 */
function getClientIp(req: IncomingMessage): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? null;
}
