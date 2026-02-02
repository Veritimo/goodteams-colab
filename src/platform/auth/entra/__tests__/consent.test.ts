/**
 * Tests for Entra admin consent flow
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createConsentState,
  consumeConsentState,
  getAdminConsentUrl,
  handleAdminConsentCallback,
  clearAllConsentStates,
  getPendingConsentCount,
} from "../consent.js";

describe("Entra Admin Consent", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearAllConsentStates();
    process.env.ENTRA_CLIENT_ID = "test-client-id";
    process.env.ENTRA_CLIENT_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    clearAllConsentStates();
  });

  describe("createConsentState", () => {
    test("creates unique state tokens", () => {
      const state1 = createConsentState("org-1", "user-1");
      const state2 = createConsentState("org-2", "user-2");
      expect(state1).not.toBe(state2);
    });

    test("stores state with metadata", () => {
      const state = createConsentState("org-123", "user-456", "/dashboard");
      expect(getPendingConsentCount()).toBe(1);

      const consumed = consumeConsentState(state);
      expect(consumed).not.toBeNull();
      expect(consumed?.organizationId).toBe("org-123");
      expect(consumed?.userId).toBe("user-456");
      expect(consumed?.returnUrl).toBe("/dashboard");
    });
  });

  describe("consumeConsentState", () => {
    test("returns null for unknown state", () => {
      const result = consumeConsentState("unknown-state");
      expect(result).toBeNull();
    });

    test("consumes state only once", () => {
      const state = createConsentState("org-1", "user-1");

      const first = consumeConsentState(state);
      expect(first).not.toBeNull();

      const second = consumeConsentState(state);
      expect(second).toBeNull();
    });

    test("returns null for expired state", async () => {
      // Mock Date.now to simulate expiry
      const now = Date.now();
      const mockNow = vi.spyOn(Date, "now");

      // Create state at "now"
      mockNow.mockReturnValue(now);
      const state = createConsentState("org-1", "user-1");

      // Fast forward 11 minutes
      mockNow.mockReturnValue(now + 11 * 60 * 1000);

      const result = consumeConsentState(state);
      expect(result).toBeNull();

      mockNow.mockRestore();
    });
  });

  describe("getAdminConsentUrl", () => {
    test("generates valid URL", () => {
      const url = getAdminConsentUrl({
        redirectUri: "https://app.example.com/callback",
        state: "test-state",
      });

      expect(url).toContain("https://login.microsoftonline.com/common/adminconsent");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback");
      expect(url).toContain("state=test-state");
    });

    test("uses custom tenant when provided", () => {
      const url = getAdminConsentUrl({
        redirectUri: "https://app.example.com/callback",
        state: "test-state",
        tenantId: "contoso.onmicrosoft.com",
      });

      expect(url).toContain(
        "https://login.microsoftonline.com/contoso.onmicrosoft.com/adminconsent",
      );
    });
  });

  describe("handleAdminConsentCallback", () => {
    test("throws for missing state", () => {
      expect(() => handleAdminConsentCallback({})).toThrow("Missing state parameter");
    });

    test("throws for invalid state", () => {
      expect(() => handleAdminConsentCallback({ state: "invalid-state" })).toThrow(
        "Invalid or expired state",
      );
    });

    test("returns error result for Microsoft error", () => {
      const state = createConsentState("org-1", "user-1");

      const result = handleAdminConsentCallback({
        state,
        error: "access_denied",
        error_description: "The user denied access",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("access_denied");
      expect(result.errorDescription).toBe("The user denied access");
      expect(result.state.organizationId).toBe("org-1");
    });

    test("returns error result when consent not granted", () => {
      const state = createConsentState("org-1", "user-1");

      const result = handleAdminConsentCallback({
        state,
        admin_consent: "False",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("consent_denied");
    });

    test("returns error result when tenant missing", () => {
      const state = createConsentState("org-1", "user-1");

      const result = handleAdminConsentCallback({
        state,
        admin_consent: "True",
        // tenant missing
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("missing_tenant");
    });

    test("returns success result with tenant ID", () => {
      const state = createConsentState("org-1", "user-1", "/dashboard");

      const result = handleAdminConsentCallback({
        state,
        admin_consent: "True",
        tenant: "tenant-guid-123",
      });

      expect(result.success).toBe(true);
      expect(result.tenantId).toBe("tenant-guid-123");
      expect(result.state.organizationId).toBe("org-1");
      expect(result.state.userId).toBe("user-1");
      expect(result.state.returnUrl).toBe("/dashboard");
    });
  });

  describe("clearAllConsentStates", () => {
    test("removes all pending states", () => {
      createConsentState("org-1", "user-1");
      createConsentState("org-2", "user-2");
      expect(getPendingConsentCount()).toBe(2);

      clearAllConsentStates();
      expect(getPendingConsentCount()).toBe(0);
    });
  });
});
