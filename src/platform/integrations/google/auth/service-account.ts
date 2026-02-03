/**
 * Google Service Account Authentication
 *
 * Provides service account authentication with domain-wide delegation
 * for accessing Google Workspace data on behalf of users.
 *
 * Domain-wide delegation allows the service account to impersonate
 * any user within a Google Workspace domain without individual user consent.
 *
 * @see https://developers.google.com/identity/protocols/oauth2/service-account
 * @see docs/GOOGLE-WORKSPACE-AUTH-ARCHITECTURE.md
 */

import { GoogleAuth, JWT, Impersonated } from "google-auth-library";
import { ADMIN_DIRECTORY_SCOPES } from "./scopes.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Service account configuration
 */
export interface ServiceAccountConfig {
  /** Service account email address */
  serviceAccountEmail: string;
  /** Private key (PEM format) */
  privateKey: string;
  /** Private key ID */
  privateKeyId?: string;
  /** Project ID */
  projectId?: string;
  /** Default scopes for this service account */
  scopes: string[];
}

/**
 * Service account credentials from JSON key file
 */
export interface ServiceAccountCredentials {
  type: "service_account";
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain?: string;
}

/**
 * Result of domain verification
 */
export interface DomainVerificationResult {
  /** Whether delegation is enabled */
  enabled: boolean;
  /** Domain that was checked */
  domain: string;
  /** Scopes that are authorized (if enabled) */
  authorizedScopes?: string[];
  /** Error message if verification failed */
  error?: string;
}

/**
 * Impersonated token result
 */
export interface ImpersonatedTokenResult {
  /** Access token for API calls */
  accessToken: string;
  /** Token expiry timestamp */
  expiresAt: Date;
  /** Email of the impersonated user */
  impersonatedEmail: string;
  /** Scopes granted */
  scopes: string[];
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Parse service account credentials from JSON string
 */
export function parseServiceAccountCredentials(json: string): ServiceAccountCredentials {
  try {
    const parsed = JSON.parse(json);

    if (parsed.type !== "service_account") {
      throw new Error("Invalid credential type: expected 'service_account'");
    }

    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Missing required fields: client_email and private_key");
    }

    return parsed as ServiceAccountCredentials;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON format for service account credentials");
    }
    throw error;
  }
}

/**
 * Get service account credentials from environment
 */
export function getServiceAccountFromEnv(): ServiceAccountCredentials | null {
  // Try base64-encoded JSON first
  const jsonBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonBase64) {
    const json = Buffer.from(jsonBase64, "base64").toString("utf-8");
    return parseServiceAccountCredentials(json);
  }

  // Try file path
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  if (filePath) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    const json = fs.readFileSync(filePath, "utf-8");
    return parseServiceAccountCredentials(json);
  }

  return null;
}

/**
 * Check if service account is configured
 */
export function isServiceAccountConfigured(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_PATH);
}

// =============================================================================
// SERVICE ACCOUNT CLASS
// =============================================================================

/**
 * Google Service Account Client
 *
 * Handles service account authentication with optional domain-wide delegation
 * for impersonating Google Workspace users.
 */
export class GoogleServiceAccount {
  private credentials: ServiceAccountCredentials;
  private scopes: string[];
  private auth: GoogleAuth;

  constructor(config: ServiceAccountConfig) {
    this.credentials = {
      type: "service_account",
      project_id: config.projectId || "",
      private_key_id: config.privateKeyId || "",
      private_key: config.privateKey,
      client_email: config.serviceAccountEmail,
      client_id: "",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(config.serviceAccountEmail)}`,
    };
    this.scopes = config.scopes;

    this.auth = new GoogleAuth({
      credentials: this.credentials,
      scopes: this.scopes,
    });
  }

  /**
   * Create a service account from credentials object
   */
  static fromCredentials(
    credentials: ServiceAccountCredentials,
    scopes: string[],
  ): GoogleServiceAccount {
    return new GoogleServiceAccount({
      serviceAccountEmail: credentials.client_email,
      privateKey: credentials.private_key,
      privateKeyId: credentials.private_key_id,
      projectId: credentials.project_id,
      scopes,
    });
  }

  /**
   * Create a service account from environment configuration
   */
  static fromEnv(scopes: string[]): GoogleServiceAccount {
    const credentials = getServiceAccountFromEnv();
    if (!credentials) {
      throw new Error(
        "Service account not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_PATH",
      );
    }
    return GoogleServiceAccount.fromCredentials(credentials, scopes);
  }

  /**
   * Get service account email
   */
  getEmail(): string {
    return this.credentials.client_email;
  }

  /**
   * Get project ID
   */
  getProjectId(): string {
    return this.credentials.project_id;
  }

  /**
   * Get an access token for the service account itself (not impersonating)
   */
  async getAccessToken(): Promise<string> {
    const client = await this.auth.getClient();
    const tokenResponse = await client.getAccessToken();

    if (!tokenResponse.token) {
      throw new Error("Failed to get access token for service account");
    }

    return tokenResponse.token;
  }

  /**
   * Get an impersonated access token for a user
   *
   * Requires domain-wide delegation to be configured in the Google Admin Console.
   *
   * @param userEmail - Email of the user to impersonate
   * @param scopes - Optional scopes to override default scopes
   * @returns Access token that can be used to make API calls as the user
   */
  async getImpersonatedToken(
    userEmail: string,
    scopes?: string[],
  ): Promise<ImpersonatedTokenResult> {
    const effectiveScopes = scopes || this.scopes;

    // Create JWT client with subject (impersonated user)
    const jwtClient = new JWT({
      email: this.credentials.client_email,
      key: this.credentials.private_key,
      scopes: effectiveScopes,
      subject: userEmail,
    });

    const credentials = await jwtClient.authorize();

    if (!credentials.access_token) {
      throw new Error(`Failed to get impersonated token for ${userEmail}`);
    }

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    return {
      accessToken: credentials.access_token,
      expiresAt,
      impersonatedEmail: userEmail,
      scopes: effectiveScopes,
    };
  }

  /**
   * Create an authenticated JWT client for a specific user
   *
   * Use this when you need to make multiple API calls as the same user.
   *
   * @param userEmail - Email of the user to impersonate
   * @param scopes - Optional scopes to override default scopes
   * @returns Authenticated JWT client
   */
  createImpersonatedClient(userEmail: string, scopes?: string[]): JWT {
    const effectiveScopes = scopes || this.scopes;

    return new JWT({
      email: this.credentials.client_email,
      key: this.credentials.private_key,
      scopes: effectiveScopes,
      subject: userEmail,
    });
  }

  /**
   * Verify that domain-wide delegation is enabled for a domain
   *
   * Attempts to impersonate an admin user and check access.
   * This is a best-effort check - it may fail for reasons other than
   * delegation not being enabled.
   *
   * @param domain - Domain to check (e.g., "example.com")
   * @param adminEmail - Optional admin email to test (defaults to admin@domain)
   * @returns Verification result
   */
  async verifyDomainWideAccess(
    domain: string,
    adminEmail?: string,
  ): Promise<DomainVerificationResult> {
    const testEmail = adminEmail || `admin@${domain}`;

    try {
      // Try to get an impersonated token with minimal scopes
      const testScopes = ADMIN_DIRECTORY_SCOPES;

      const jwtClient = new JWT({
        email: this.credentials.client_email,
        key: this.credentials.private_key,
        scopes: [...testScopes],
        subject: testEmail,
      });

      await jwtClient.authorize();

      return {
        enabled: true,
        domain,
        authorizedScopes: testScopes as string[],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Check for specific delegation errors
      if (
        message.includes("unauthorized_client") ||
        message.includes("access_denied") ||
        message.includes("delegation")
      ) {
        return {
          enabled: false,
          domain,
          error: `Domain-wide delegation not configured for ${this.credentials.client_email}`,
        };
      }

      // Check for user not found
      if (message.includes("invalid_grant") || message.includes("user not found")) {
        return {
          enabled: false,
          domain,
          error: `User ${testEmail} not found in domain`,
        };
      }

      return {
        enabled: false,
        domain,
        error: message,
      };
    }
  }

  /**
   * Get a list of users in a domain (requires Admin SDK scope)
   *
   * This is a convenience method for verifying domain access.
   *
   * @param domain - Domain to list users from
   * @param adminEmail - Admin user to impersonate
   * @param maxResults - Maximum number of users to return
   * @returns Array of user emails
   */
  async listDomainUsers(domain: string, adminEmail: string, maxResults = 10): Promise<string[]> {
    const token = await this.getImpersonatedToken(adminEmail, ADMIN_DIRECTORY_SCOPES as string[]);

    const response = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/users?domain=${encodeURIComponent(domain)}&maxResults=${maxResults}`,
      {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to list domain users: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return (data.users || []).map((user: { primaryEmail: string }) => user.primaryEmail);
  }

  /**
   * Check if a specific scope is authorized for the service account
   *
   * @param scope - Scope to check
   * @param testEmail - User email to test impersonation
   */
  async isScopeAuthorized(scope: string, testEmail: string): Promise<boolean> {
    try {
      const jwtClient = new JWT({
        email: this.credentials.client_email,
        key: this.credentials.private_key,
        scopes: [scope],
        subject: testEmail,
      });

      await jwtClient.authorize();
      return true;
    } catch {
      return false;
    }
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Get an impersonated token using environment-configured service account
 */
export async function getImpersonatedToken(userEmail: string, scopes: string[]): Promise<string> {
  const serviceAccount = GoogleServiceAccount.fromEnv(scopes);
  const result = await serviceAccount.getImpersonatedToken(userEmail);
  return result.accessToken;
}

/**
 * Verify domain-wide delegation for environment-configured service account
 */
export async function verifyDomainWideDelegation(
  domain: string,
  adminEmail?: string,
): Promise<DomainVerificationResult> {
  const serviceAccount = GoogleServiceAccount.fromEnv(ADMIN_DIRECTORY_SCOPES as string[]);
  return serviceAccount.verifyDomainWideAccess(domain, adminEmail);
}

/**
 * Create an impersonated JWT client using environment-configured service account
 */
export function createImpersonatedClient(userEmail: string, scopes: string[]): JWT {
  const serviceAccount = GoogleServiceAccount.fromEnv(scopes);
  return serviceAccount.createImpersonatedClient(userEmail);
}
