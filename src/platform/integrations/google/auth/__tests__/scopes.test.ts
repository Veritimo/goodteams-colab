/**
 * Tests for Google API Scopes
 */

import { describe, test, expect } from "vitest";
import {
  GOOGLE_SCOPES,
  IDENTITY_SCOPES,
  DEFAULT_USER_SCOPES,
  DRIVE_READ_SCOPES,
  DRIVE_FILE_SCOPES,
  GMAIL_READ_SCOPES,
  GMAIL_SEND_SCOPES,
  CALENDAR_READ_SCOPES,
  CALENDAR_WRITE_SCOPES,
  DOCS_READ_SCOPES,
  ADMIN_DIRECTORY_SCOPES,
  FULL_WORKSPACE_SCOPES,
  GOODTEAMS_USER_SCOPES,
  requiresDomainWideDelegation,
  isSensitiveScope,
  getScopeDisplayName,
  validateScopes,
  mergeScopes,
} from "../scopes.js";

describe("Google Scopes", () => {
  // ===========================================================================
  // Individual Scopes Tests
  // ===========================================================================

  describe("GOOGLE_SCOPES", () => {
    test("contains OpenID Connect scopes", () => {
      expect(GOOGLE_SCOPES.OPENID).toBe("openid");
      expect(GOOGLE_SCOPES.EMAIL).toBe("email");
      expect(GOOGLE_SCOPES.PROFILE).toBe("profile");
    });

    test("contains Drive scopes", () => {
      expect(GOOGLE_SCOPES.DRIVE_READ).toBe("https://www.googleapis.com/auth/drive.readonly");
      expect(GOOGLE_SCOPES.DRIVE_FILE).toBe("https://www.googleapis.com/auth/drive.file");
      expect(GOOGLE_SCOPES.DRIVE_FULL).toBe("https://www.googleapis.com/auth/drive");
    });

    test("contains Gmail scopes", () => {
      expect(GOOGLE_SCOPES.GMAIL_READ).toBe("https://www.googleapis.com/auth/gmail.readonly");
      expect(GOOGLE_SCOPES.GMAIL_SEND).toBe("https://www.googleapis.com/auth/gmail.send");
      expect(GOOGLE_SCOPES.GMAIL_COMPOSE).toBe("https://www.googleapis.com/auth/gmail.compose");
      expect(GOOGLE_SCOPES.GMAIL_MODIFY).toBe("https://www.googleapis.com/auth/gmail.modify");
    });

    test("contains Calendar scopes", () => {
      expect(GOOGLE_SCOPES.CALENDAR_READ).toBe("https://www.googleapis.com/auth/calendar.readonly");
      expect(GOOGLE_SCOPES.CALENDAR_EVENTS).toBe("https://www.googleapis.com/auth/calendar.events");
      expect(GOOGLE_SCOPES.CALENDAR_FULL).toBe("https://www.googleapis.com/auth/calendar");
    });

    test("contains Docs/Sheets/Slides scopes", () => {
      expect(GOOGLE_SCOPES.DOCS_READ).toBe("https://www.googleapis.com/auth/documents.readonly");
      expect(GOOGLE_SCOPES.SHEETS_READ).toBe(
        "https://www.googleapis.com/auth/spreadsheets.readonly",
      );
      expect(GOOGLE_SCOPES.SLIDES_READ).toBe(
        "https://www.googleapis.com/auth/presentations.readonly",
      );
    });

    test("contains Admin SDK scopes", () => {
      expect(GOOGLE_SCOPES.ADMIN_DIRECTORY_USER_READ).toBe(
        "https://www.googleapis.com/auth/admin.directory.user.readonly",
      );
      expect(GOOGLE_SCOPES.ADMIN_DIRECTORY_GROUP_READ).toBe(
        "https://www.googleapis.com/auth/admin.directory.group.readonly",
      );
    });
  });

  // ===========================================================================
  // Scope Groups Tests
  // ===========================================================================

  describe("scope groups", () => {
    test("IDENTITY_SCOPES contains OIDC scopes", () => {
      expect(IDENTITY_SCOPES).toContain("openid");
      expect(IDENTITY_SCOPES).toContain("email");
      expect(IDENTITY_SCOPES).toContain("profile");
    });

    test("DEFAULT_USER_SCOPES matches identity scopes", () => {
      expect(DEFAULT_USER_SCOPES).toEqual(IDENTITY_SCOPES);
    });

    test("DRIVE_READ_SCOPES contains drive.readonly", () => {
      expect(DRIVE_READ_SCOPES).toContain(GOOGLE_SCOPES.DRIVE_READ);
    });

    test("DRIVE_FILE_SCOPES contains drive.file", () => {
      expect(DRIVE_FILE_SCOPES).toContain(GOOGLE_SCOPES.DRIVE_FILE);
    });

    test("GMAIL_READ_SCOPES contains gmail.readonly", () => {
      expect(GMAIL_READ_SCOPES).toContain(GOOGLE_SCOPES.GMAIL_READ);
    });

    test("GMAIL_SEND_SCOPES contains read, send, compose", () => {
      expect(GMAIL_SEND_SCOPES).toContain(GOOGLE_SCOPES.GMAIL_READ);
      expect(GMAIL_SEND_SCOPES).toContain(GOOGLE_SCOPES.GMAIL_SEND);
      expect(GMAIL_SEND_SCOPES).toContain(GOOGLE_SCOPES.GMAIL_COMPOSE);
    });

    test("CALENDAR_READ_SCOPES contains calendar.readonly", () => {
      expect(CALENDAR_READ_SCOPES).toContain(GOOGLE_SCOPES.CALENDAR_READ);
    });

    test("CALENDAR_WRITE_SCOPES contains calendar.events", () => {
      expect(CALENDAR_WRITE_SCOPES).toContain(GOOGLE_SCOPES.CALENDAR_EVENTS);
    });

    test("DOCS_READ_SCOPES contains docs, sheets, slides readonly", () => {
      expect(DOCS_READ_SCOPES).toContain(GOOGLE_SCOPES.DOCS_READ);
      expect(DOCS_READ_SCOPES).toContain(GOOGLE_SCOPES.SHEETS_READ);
      expect(DOCS_READ_SCOPES).toContain(GOOGLE_SCOPES.SLIDES_READ);
    });

    test("ADMIN_DIRECTORY_SCOPES contains user and group read", () => {
      expect(ADMIN_DIRECTORY_SCOPES).toContain(GOOGLE_SCOPES.ADMIN_DIRECTORY_USER_READ);
      expect(ADMIN_DIRECTORY_SCOPES).toContain(GOOGLE_SCOPES.ADMIN_DIRECTORY_GROUP_READ);
    });

    test("FULL_WORKSPACE_SCOPES includes comprehensive access", () => {
      expect(FULL_WORKSPACE_SCOPES).toContain(GOOGLE_SCOPES.OPENID);
      expect(FULL_WORKSPACE_SCOPES).toContain(GOOGLE_SCOPES.DRIVE_READ);
      expect(FULL_WORKSPACE_SCOPES).toContain(GOOGLE_SCOPES.GMAIL_READ);
      expect(FULL_WORKSPACE_SCOPES).toContain(GOOGLE_SCOPES.CALENDAR_READ);
    });

    test("GOODTEAMS_USER_SCOPES includes balanced permissions", () => {
      expect(GOODTEAMS_USER_SCOPES).toContain(GOOGLE_SCOPES.OPENID);
      expect(GOODTEAMS_USER_SCOPES).toContain(GOOGLE_SCOPES.DRIVE_READ);
      expect(GOODTEAMS_USER_SCOPES).toContain(GOOGLE_SCOPES.DRIVE_FILE);
      expect(GOODTEAMS_USER_SCOPES).toContain(GOOGLE_SCOPES.GMAIL_SEND);
      expect(GOODTEAMS_USER_SCOPES).toContain(GOOGLE_SCOPES.CALENDAR_EVENTS);
    });
  });

  // ===========================================================================
  // Utility Functions Tests
  // ===========================================================================

  describe("requiresDomainWideDelegation", () => {
    test("returns true for admin directory scopes", () => {
      expect(requiresDomainWideDelegation(GOOGLE_SCOPES.ADMIN_DIRECTORY_USER_READ)).toBe(true);
      expect(requiresDomainWideDelegation(GOOGLE_SCOPES.ADMIN_DIRECTORY_GROUP_READ)).toBe(true);
    });

    test("returns false for regular scopes", () => {
      expect(requiresDomainWideDelegation(GOOGLE_SCOPES.DRIVE_READ)).toBe(false);
      expect(requiresDomainWideDelegation(GOOGLE_SCOPES.GMAIL_READ)).toBe(false);
      expect(requiresDomainWideDelegation(GOOGLE_SCOPES.OPENID)).toBe(false);
    });
  });

  describe("isSensitiveScope", () => {
    test("returns true for gmail modify scopes", () => {
      expect(isSensitiveScope(GOOGLE_SCOPES.GMAIL_MODIFY)).toBe(true);
      expect(isSensitiveScope(GOOGLE_SCOPES.GMAIL_COMPOSE)).toBe(true);
      expect(isSensitiveScope(GOOGLE_SCOPES.GMAIL_SEND)).toBe(true);
    });

    test("returns true for full drive access", () => {
      expect(isSensitiveScope(GOOGLE_SCOPES.DRIVE_FULL)).toBe(true);
    });

    test("returns true for admin scopes", () => {
      expect(isSensitiveScope(GOOGLE_SCOPES.ADMIN_DIRECTORY_USER_READ)).toBe(true);
    });

    test("returns false for openid scopes", () => {
      expect(isSensitiveScope(GOOGLE_SCOPES.OPENID)).toBe(false);
      expect(isSensitiveScope(GOOGLE_SCOPES.EMAIL)).toBe(false);
      expect(isSensitiveScope(GOOGLE_SCOPES.PROFILE)).toBe(false);
    });

    test("returns false for readonly scopes", () => {
      expect(isSensitiveScope(GOOGLE_SCOPES.GMAIL_READ)).toBe(false);
    });
  });

  describe("getScopeDisplayName", () => {
    test("returns human-readable names for known scopes", () => {
      expect(getScopeDisplayName(GOOGLE_SCOPES.OPENID)).toBe("OpenID (Sign In)");
      expect(getScopeDisplayName(GOOGLE_SCOPES.EMAIL)).toBe("Email Address");
      expect(getScopeDisplayName(GOOGLE_SCOPES.DRIVE_READ)).toBe("Read Google Drive Files");
      expect(getScopeDisplayName(GOOGLE_SCOPES.GMAIL_SEND)).toBe("Send Gmail Messages");
    });

    test("returns scope URL for unknown scopes", () => {
      const unknownScope = "https://www.googleapis.com/auth/unknown.scope";
      expect(getScopeDisplayName(unknownScope)).toBe(unknownScope);
    });
  });

  describe("validateScopes", () => {
    test("returns valid: true for valid scopes", () => {
      const result = validateScopes([GOOGLE_SCOPES.OPENID, GOOGLE_SCOPES.EMAIL]);
      expect(result.valid).toBe(true);
      expect(result.invalid).toHaveLength(0);
    });

    test("returns valid: false for invalid scopes", () => {
      const result = validateScopes([GOOGLE_SCOPES.OPENID, "invalid-scope"]);
      expect(result.valid).toBe(false);
      expect(result.invalid).toContain("invalid-scope");
    });

    test("returns all invalid scopes", () => {
      const result = validateScopes(["invalid1", GOOGLE_SCOPES.OPENID, "invalid2"]);
      expect(result.valid).toBe(false);
      expect(result.invalid).toEqual(["invalid1", "invalid2"]);
    });

    test("handles empty array", () => {
      const result = validateScopes([]);
      expect(result.valid).toBe(true);
      expect(result.invalid).toHaveLength(0);
    });
  });

  describe("mergeScopes", () => {
    test("merges multiple scope arrays", () => {
      const merged = mergeScopes(
        [GOOGLE_SCOPES.OPENID],
        [GOOGLE_SCOPES.EMAIL],
        [GOOGLE_SCOPES.PROFILE],
      );

      expect(merged).toContain(GOOGLE_SCOPES.OPENID);
      expect(merged).toContain(GOOGLE_SCOPES.EMAIL);
      expect(merged).toContain(GOOGLE_SCOPES.PROFILE);
    });

    test("removes duplicates", () => {
      const merged = mergeScopes(
        [GOOGLE_SCOPES.OPENID, GOOGLE_SCOPES.EMAIL],
        [GOOGLE_SCOPES.EMAIL, GOOGLE_SCOPES.PROFILE],
      );

      expect(merged.filter((s) => s === GOOGLE_SCOPES.EMAIL)).toHaveLength(1);
    });

    test("handles empty arrays", () => {
      const merged = mergeScopes([], [GOOGLE_SCOPES.OPENID], []);
      expect(merged).toEqual([GOOGLE_SCOPES.OPENID]);
    });

    test("handles readonly arrays", () => {
      const merged = mergeScopes(IDENTITY_SCOPES, DRIVE_READ_SCOPES);
      expect(merged.length).toBe(IDENTITY_SCOPES.length + DRIVE_READ_SCOPES.length);
    });
  });
});
