/**
 * Microsoft Entra (Azure AD) MSAL Client
 *
 * Provides a confidential client for OAuth 2.0 flows with Microsoft identity platform.
 * Used for both admin consent and user authentication flows.
 *
 * @see docs/MICROSOFT-365-AUTH-ARCHITECTURE.md
 */

import { ConfidentialClientApplication, Configuration, LogLevel } from "@azure/msal-node";

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Required environment variables for Entra integration
 */
export interface EntraConfig {
  clientId: string;
  clientSecret: string;
  /** Authority URL - defaults to common for multi-tenant */
  authority?: string;
  /** Redirect URI for admin consent callback */
  redirectUri?: string;
  /** Redirect URI for user auth callback */
  userRedirectUri?: string;
}

/**
 * Get Entra configuration from environment variables
 * Throws if required variables are missing
 */
export function getEntraConfig(): EntraConfig {
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing required Entra configuration: ENTRA_CLIENT_ID and ENTRA_CLIENT_SECRET must be set",
    );
  }

  return {
    clientId,
    clientSecret,
    authority: process.env.ENTRA_AUTHORITY || "https://login.microsoftonline.com/common",
    redirectUri: process.env.ENTRA_REDIRECT_URI,
    userRedirectUri: process.env.ENTRA_USER_REDIRECT_URI,
  };
}

/**
 * Check if Entra integration is configured
 */
export function isEntraConfigured(): boolean {
  return !!(process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET);
}

// =============================================================================
// MSAL CLIENT
// =============================================================================

/**
 * Create MSAL configuration from Entra config
 */
function createMsalConfig(config: EntraConfig): Configuration {
  return {
    auth: {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authority: config.authority || "https://login.microsoftonline.com/common",
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          const logLevel = process.env.NODE_ENV === "development" ? "debug" : "info";
          if (level === LogLevel.Error) {
            console.error(`[MSAL] ${message}`);
          } else if (logLevel === "debug" && level === LogLevel.Info) {
            console.log(`[MSAL] ${message}`);
          }
        },
        piiLoggingEnabled: false,
        logLevel: process.env.NODE_ENV === "development" ? LogLevel.Verbose : LogLevel.Warning,
      },
    },
  };
}

// Singleton MSAL client instance
let msalClient: ConfidentialClientApplication | null = null;

/**
 * Get or create the MSAL Confidential Client Application
 *
 * Uses singleton pattern to reuse the client across requests.
 * Throws if Entra is not configured.
 */
export function getMsalClient(): ConfidentialClientApplication {
  if (!msalClient) {
    const config = getEntraConfig();
    msalClient = new ConfidentialClientApplication(createMsalConfig(config));
  }
  return msalClient;
}

/**
 * Create a tenant-specific MSAL client
 *
 * Used when you need to authenticate against a specific tenant
 * rather than the common endpoint.
 */
export function createTenantMsalClient(tenantId: string): ConfidentialClientApplication {
  const config = getEntraConfig();
  const tenantConfig = {
    ...config,
    authority: `https://login.microsoftonline.com/${tenantId}`,
  };
  return new ConfidentialClientApplication(createMsalConfig(tenantConfig));
}

/**
 * Reset the MSAL client singleton
 * Useful for testing or when configuration changes
 */
export function resetMsalClient(): void {
  msalClient = null;
}

// =============================================================================
// SCOPES
// =============================================================================

/**
 * Microsoft Graph API scopes for user authentication
 */
export const GRAPH_SCOPES = {
  /** Basic user profile read */
  USER_READ: "User.Read",
  /** Read all users in directory */
  USER_READ_ALL: "User.Read.All",
  /** Read basic user info in directory */
  USER_READ_BASIC_ALL: "User.ReadBasic.All",
  /** Read SharePoint sites */
  SITES_READ_ALL: "Sites.Read.All",
  /** Full control of SharePoint sites */
  SITES_FULL_CONTROL: "Sites.FullControl.All",
  /** Read OneDrive files */
  FILES_READ_ALL: "Files.Read.All",
  /** Read/write OneDrive files */
  FILES_READ_WRITE_ALL: "Files.ReadWrite.All",
  /** Read calendars */
  CALENDARS_READ: "Calendars.Read",
  /** Read/write calendars */
  CALENDARS_READ_WRITE: "Calendars.ReadWrite",
  /** Read mail */
  MAIL_READ: "Mail.Read",
  /** Read/write mail */
  MAIL_READ_WRITE: "Mail.ReadWrite",
  /** Send mail */
  MAIL_SEND: "Mail.Send",
  /** Read Teams meetings */
  ONLINE_MEETINGS_READ: "OnlineMeetings.Read",
  /** Read meeting transcripts */
  MEETING_TRANSCRIPTS_READ: "OnlineMeetingTranscript.Read.All",
  /** OpenID Connect scopes */
  OPENID: "openid",
  PROFILE: "profile",
  EMAIL: "email",
  OFFLINE_ACCESS: "offline_access",
} as const;

/**
 * Default scopes for user SSO login
 */
export const DEFAULT_USER_SCOPES = [
  GRAPH_SCOPES.OPENID,
  GRAPH_SCOPES.PROFILE,
  GRAPH_SCOPES.EMAIL,
  GRAPH_SCOPES.OFFLINE_ACCESS,
  GRAPH_SCOPES.USER_READ,
];

/**
 * Scopes for directory search (requires admin consent)
 */
export const DIRECTORY_SEARCH_SCOPES = [GRAPH_SCOPES.USER_READ_ALL];

/**
 * Full Microsoft 365 integration scopes
 */
export const FULL_M365_SCOPES = [
  ...DEFAULT_USER_SCOPES,
  GRAPH_SCOPES.SITES_READ_ALL,
  GRAPH_SCOPES.FILES_READ_ALL,
  GRAPH_SCOPES.CALENDARS_READ,
  GRAPH_SCOPES.MAIL_READ_WRITE,
  GRAPH_SCOPES.MAIL_SEND,
];
