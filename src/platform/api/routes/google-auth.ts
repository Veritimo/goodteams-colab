/**
 * Google OAuth routes for platform API
 *
 * Endpoints:
 * - GET /api/platform/auth/google/login - Initiate Google OAuth
 * - GET /api/platform/auth/google/callback - Handle OAuth callback
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../middleware/context.js";
import { prisma } from "../../db/client.js";
import {
  isGoogleAuthConfigured,
  getGoogleAuthUrl,
  exchangeGoogleCode,
  createOAuthState,
  consumeOAuthState,
  GoogleAuthClient,
  getGoogleAuthConfig,
  GOOGLE_SCOPES,
  storeUserGoogleTokens,
} from "../../integrations/google/auth/index.js";
import { sendJson, sendError, type RouteHandler } from "./utils.js";

// Helper to redirect
function redirect(res: ServerResponse, url: string): void {
  res.writeHead(302, { Location: url });
  res.end();
}

// Helper to get client IP
function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

/**
 * Handle Google auth routes
 */
export const handleGoogleAuth: RouteHandler = async (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
): Promise<void> => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const subPath = url.pathname.replace("/api/platform/auth/google", "");
  const method = req.method ?? "GET";

  // Check Google configuration
  if (!isGoogleAuthConfigured()) {
    sendError(res, "SERVICE_UNAVAILABLE", "Google OAuth is not configured");
    return;
  }

  if (subPath === "/login" && method === "GET") {
    await handleGoogleLogin(req, res, ctx);
  } else if (subPath === "/callback" && method === "GET") {
    await handleGoogleCallback(req, res, ctx);
  } else {
    sendError(res, "NOT_FOUND", `Google auth route not found: ${method} ${subPath}`);
  }
};

/**
 * GET /api/platform/auth/google/login
 * Initiate Google OAuth flow
 */
async function handleGoogleLogin(
  req: IncomingMessage,
  res: ServerResponse,
  _ctx: RequestContext,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const returnUrl = url.searchParams.get("return_url") || "/";
    const loginHint = url.searchParams.get("login_hint") || undefined;

    // Define scopes for full Google Workspace access
    const scopes = [
      GOOGLE_SCOPES.OPENID,
      GOOGLE_SCOPES.EMAIL,
      GOOGLE_SCOPES.PROFILE,
      GOOGLE_SCOPES.DRIVE_READ,
      GOOGLE_SCOPES.GMAIL_READ,
      GOOGLE_SCOPES.GMAIL_SEND,
      GOOGLE_SCOPES.CALENDAR_READ,
      GOOGLE_SCOPES.CALENDAR_EVENTS,
    ];

    // Create state for CSRF protection
    const state = createOAuthState({
      returnUrl,
      scopes,
    });

    // Get authorization URL
    const authUrl = getGoogleAuthUrl({
      scopes,
      state,
      loginHint,
      prompt: "consent", // Force consent to get refresh token
    });

    redirect(res, authUrl);
  } catch (error) {
    console.error("Google login initiation failed:", error);
    sendError(res, "INTERNAL_ERROR", "Failed to initiate Google login");
  }
}

/**
 * GET /api/platform/auth/google/callback
 * Handle OAuth callback from Google
 */
async function handleGoogleCallback(
  req: IncomingMessage,
  res: ServerResponse,
  _ctx: RequestContext,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Google login failed:", error);
      redirect(res, `/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !stateParam) {
      redirect(res, "/login?error=missing_params");
      return;
    }

    // Validate state
    const stateData = consumeOAuthState(stateParam);
    if (!stateData) {
      redirect(res, "/login?error=invalid_state");
      return;
    }

    // Exchange code for tokens
    const tokens = await exchangeGoogleCode(code);

    // Get user info from Google
    const authClient = new GoogleAuthClient(getGoogleAuthConfig());
    const userInfo = await authClient.getUserInfo(tokens.accessToken);

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ email: userInfo.email }],
      },
    });

    if (user) {
      // Update existing user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          username: userInfo.name || user.username,
        },
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          username: userInfo.name,
          role: "USER",
        },
      });
    }

    // Store Google tokens using the proper token store
    await storeUserGoogleTokens(user.id, tokens, userInfo);

    // Log audit event
    if (user.organizationId) {
      try {
        await prisma.auditLog.create({
          data: {
            organizationId: user.organizationId,
            actorId: user.id,
            actorRole: user.role,
            action: "user.login.google",
            targetType: "user",
            targetId: user.id,
            details: { method: "google" },
            ipAddress: getClientIp(req),
            userAgent: req.headers["user-agent"] ?? null,
          },
        });
      } catch {
        // Ignore audit errors
      }
    }

    // Generate stub token for API access
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.username || user.email.split("@")[0],
      orgId: user.organizationId || "",
      role: user.role.toLowerCase(),
    };
    const stubToken = `stub:${Buffer.from(JSON.stringify(tokenPayload)).toString("base64")}`;

    // Check if client wants JSON
    const acceptHeader = req.headers.accept || "";
    if (acceptHeader.includes("application/json")) {
      sendJson(res, {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.username,
          role: user.role,
        },
        token: stubToken,
      });
      return;
    }

    // Redirect with token
    const successUrl = stateData.returnUrl || "/";
    const separator = successUrl.includes("?") ? "&" : "?";
    redirect(
      res,
      `${successUrl}${separator}token=${encodeURIComponent(stubToken)}&login=success&provider=google`,
    );
  } catch (error) {
    console.error("Google callback failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    redirect(res, `/login?error=${encodeURIComponent(errorMessage)}`);
  }
}
