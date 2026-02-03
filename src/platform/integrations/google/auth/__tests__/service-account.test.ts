/**
 * Tests for Google Service Account Authentication
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { GOOGLE_SCOPES } from "../scopes.js";
import {
  parseServiceAccountCredentials,
  getServiceAccountFromEnv,
  isServiceAccountConfigured,
  GoogleServiceAccount,
  type ServiceAccountCredentials,
} from "../service-account.js";

describe("Google Service Account", () => {
  const originalEnv = { ...process.env };

  const mockCredentials: ServiceAccountCredentials = {
    type: "service_account",
    project_id: "test-project",
    private_key_id: "key-123",
    private_key:
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MfUH8G0zFg\n-----END RSA PRIVATE KEY-----\n",
    client_email: "test-sa@test-project.iam.gserviceaccount.com",
    client_id: "123456789",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url:
      "https://www.googleapis.com/robot/v1/metadata/x509/test-sa%40test-project.iam.gserviceaccount.com",
  };

  beforeEach(() => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ===========================================================================
  // Credential Parsing Tests
  // ===========================================================================

  describe("parseServiceAccountCredentials", () => {
    test("parses valid JSON credentials", () => {
      const json = JSON.stringify(mockCredentials);
      const parsed = parseServiceAccountCredentials(json);

      expect(parsed.type).toBe("service_account");
      expect(parsed.project_id).toBe("test-project");
      expect(parsed.client_email).toBe("test-sa@test-project.iam.gserviceaccount.com");
    });

    test("throws on invalid JSON", () => {
      expect(() => parseServiceAccountCredentials("not json")).toThrow("Invalid JSON format");
    });

    test("throws on wrong credential type", () => {
      const invalid = { ...mockCredentials, type: "authorized_user" };
      expect(() => parseServiceAccountCredentials(JSON.stringify(invalid))).toThrow(
        "Invalid credential type",
      );
    });

    test("throws when client_email missing", () => {
      const invalid = { ...mockCredentials };
      delete (invalid as Record<string, unknown>).client_email;
      expect(() => parseServiceAccountCredentials(JSON.stringify(invalid))).toThrow(
        "Missing required fields",
      );
    });

    test("throws when private_key missing", () => {
      const invalid = { ...mockCredentials };
      delete (invalid as Record<string, unknown>).private_key;
      expect(() => parseServiceAccountCredentials(JSON.stringify(invalid))).toThrow(
        "Missing required fields",
      );
    });

    test("preserves optional fields", () => {
      const parsed = parseServiceAccountCredentials(JSON.stringify(mockCredentials));
      expect(parsed.private_key_id).toBe("key-123");
      expect(parsed.client_id).toBe("123456789");
    });
  });

  // ===========================================================================
  // Environment Configuration Tests
  // ===========================================================================

  describe("isServiceAccountConfigured", () => {
    test("returns false when no env vars set", () => {
      expect(isServiceAccountConfigured()).toBe(false);
    });

    test("returns true when JSON env var set", () => {
      const json = JSON.stringify(mockCredentials);
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = Buffer.from(json).toString("base64");
      expect(isServiceAccountConfigured()).toBe(true);
    });

    test("returns true when path env var set", () => {
      process.env.GOOGLE_SERVICE_ACCOUNT_PATH = "/path/to/credentials.json";
      expect(isServiceAccountConfigured()).toBe(true);
    });
  });

  describe("getServiceAccountFromEnv", () => {
    test("returns null when not configured", () => {
      expect(getServiceAccountFromEnv()).toBeNull();
    });

    test("parses base64 JSON from env", () => {
      const json = JSON.stringify(mockCredentials);
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = Buffer.from(json).toString("base64");

      const creds = getServiceAccountFromEnv();
      expect(creds).not.toBeNull();
      expect(creds?.client_email).toBe("test-sa@test-project.iam.gserviceaccount.com");
    });
  });

  // ===========================================================================
  // GoogleServiceAccount Class Tests
  // ===========================================================================

  describe("GoogleServiceAccount", () => {
    const scopes = [GOOGLE_SCOPES.DRIVE_READ];

    test("creates instance with config", () => {
      const sa = new GoogleServiceAccount({
        serviceAccountEmail: mockCredentials.client_email,
        privateKey: mockCredentials.private_key,
        scopes,
      });

      expect(sa).toBeInstanceOf(GoogleServiceAccount);
    });

    test("getEmail returns service account email", () => {
      const sa = new GoogleServiceAccount({
        serviceAccountEmail: mockCredentials.client_email,
        privateKey: mockCredentials.private_key,
        scopes,
      });

      expect(sa.getEmail()).toBe("test-sa@test-project.iam.gserviceaccount.com");
    });

    test("getProjectId returns project ID", () => {
      const sa = new GoogleServiceAccount({
        serviceAccountEmail: mockCredentials.client_email,
        privateKey: mockCredentials.private_key,
        projectId: "test-project",
        scopes,
      });

      expect(sa.getProjectId()).toBe("test-project");
    });

    test("fromCredentials creates instance", () => {
      const sa = GoogleServiceAccount.fromCredentials(mockCredentials, scopes);
      expect(sa.getEmail()).toBe(mockCredentials.client_email);
      expect(sa.getProjectId()).toBe(mockCredentials.project_id);
    });

    test("createImpersonatedClient creates JWT client", () => {
      const sa = new GoogleServiceAccount({
        serviceAccountEmail: mockCredentials.client_email,
        privateKey: mockCredentials.private_key,
        scopes,
      });

      const jwt = sa.createImpersonatedClient("user@example.com");
      expect(jwt).toBeDefined();
    });

    test("createImpersonatedClient uses custom scopes", () => {
      const sa = new GoogleServiceAccount({
        serviceAccountEmail: mockCredentials.client_email,
        privateKey: mockCredentials.private_key,
        scopes,
      });

      const customScopes = [GOOGLE_SCOPES.GMAIL_READ, GOOGLE_SCOPES.CALENDAR_READ];
      const jwt = sa.createImpersonatedClient("user@example.com", customScopes);
      expect(jwt).toBeDefined();
    });
  });

  // ===========================================================================
  // Domain Verification Tests (mocked)
  // ===========================================================================

  describe("verifyDomainWideAccess", () => {
    test("returns enabled: false when delegation not configured", async () => {
      const sa = new GoogleServiceAccount({
        serviceAccountEmail: mockCredentials.client_email,
        privateKey: mockCredentials.private_key,
        scopes: [GOOGLE_SCOPES.ADMIN_DIRECTORY_USER_READ],
      });

      // This will fail because the private key is fake
      const result = await sa.verifyDomainWideAccess("example.com");
      expect(result.enabled).toBe(false);
      expect(result.domain).toBe("example.com");
      expect(result.error).toBeDefined();
    });

    test("uses custom admin email if provided", async () => {
      const sa = new GoogleServiceAccount({
        serviceAccountEmail: mockCredentials.client_email,
        privateKey: mockCredentials.private_key,
        scopes: [GOOGLE_SCOPES.ADMIN_DIRECTORY_USER_READ],
      });

      const result = await sa.verifyDomainWideAccess("example.com", "super-admin@example.com");
      expect(result.domain).toBe("example.com");
    });
  });

  // ===========================================================================
  // Static Factory Tests
  // ===========================================================================

  describe("static factory methods", () => {
    test("fromEnv throws when not configured", () => {
      expect(() => GoogleServiceAccount.fromEnv([GOOGLE_SCOPES.DRIVE_READ])).toThrow(
        "Service account not configured",
      );
    });

    test("fromEnv creates instance when configured", () => {
      const json = JSON.stringify(mockCredentials);
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = Buffer.from(json).toString("base64");

      const sa = GoogleServiceAccount.fromEnv([GOOGLE_SCOPES.DRIVE_READ]);
      expect(sa.getEmail()).toBe(mockCredentials.client_email);
    });
  });
});
