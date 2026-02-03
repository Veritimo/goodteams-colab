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
import { handleGoogleAuth } from "./google-auth.js";
import { sendError, sendJson, parseBody, redirect } from "./utils.js";

/**
 * Handle auth routes
 * Routes:
 * - GET /api/platform/auth/entra/consent - Initiate admin consent
 * - GET /api/platform/auth/entra/callback - Handle consent callback
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
  if (subPath === "/entra/consent" && method === "GET") {
    await handleConsentInit(req, res, ctx);
  } else if (subPath === "/entra/callback" && method === "GET") {
    await handleConsentCallback(req, res, ctx);
  } else if (subPath === "/entra/login" && method === "GET") {
    await handleLoginInit(req, res, ctx);
  } else if (subPath === "/entra/login/callback" && method === "GET") {
    await handleLoginCallback(req, res, ctx);
  } else if (subPath === "/logout" && method === "POST") {
    await handleLogout(req, res, ctx);
  } else if (subPath === "/status" && method === "GET") {
    handleStatus(req, res, ctx);
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

    // Check admin role
    if (!["ADMIN", "SUPER_ADMIN"].includes(ctx.user.role)) {
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

    if (user) {
      // Update existing user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          externalId: tokens.microsoftId,
          username: tokens.displayName || user.username,
        },
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
          role: "USER",
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

    // Generate a stub-format token for API access
    // This allows using the same auth middleware until proper JWT sessions are implemented
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.username || user.email.split("@")[0],
      orgId: user.organizationId || "",
      role: user.role.toLowerCase(),
    };
    const stubToken = `stub:${Buffer.from(JSON.stringify(tokenPayload)).toString("base64")}`;

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
        token: stubToken,
        message: "Login successful. Use the token in Authorization: Bearer <token> header.",
      });
      return;
    }

    // For browser: redirect with token in URL (temporary until UI is built)
    const successUrl = stateData.returnUrl || "/";
    const separator = successUrl.includes("?") ? "&" : "?";
    redirect(res, `${successUrl}${separator}token=${encodeURIComponent(stubToken)}&login=success`);
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
      sendJson(res, { success: true });
      return;
    }

    // Remove stored tokens (gracefully handle stub auth users that don't exist in DB)
    try {
      await removeUserTokens(ctx.user.id);
    } catch {
      // User may not exist in DB (stub auth) - that's fine
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

    // TODO: Clear session (Phase 2B)

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
// STATUS
// =============================================================================

/**
 * GET /api/platform/auth/status
 * Get current authentication status.
 */
function handleStatus(_req: IncomingMessage, res: ServerResponse, ctx: RequestContext): void {
  sendJson(res, {
    authenticated: !!ctx.user,
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
