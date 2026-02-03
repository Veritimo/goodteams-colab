/**
 * Tests for SharePoint site operations
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphClient, GraphRequest, Site, Drive } from "../types.js";
import {
  listSites,
  getSite,
  getSiteByPath,
  getRootSite,
  searchSites,
  listDrives,
  getDrive,
  getDefaultDrive,
  getMyDrive,
  isCompoundSiteId,
  parseCompoundSiteId,
  buildCompoundSiteId,
} from "../sites.js";

// =============================================================================
// MOCK SETUP
// =============================================================================

function createMockRequest(returnValue: unknown): GraphRequest {
  const mockRequest: GraphRequest = {
    get: vi.fn().mockResolvedValue(returnValue),
    post: vi.fn().mockResolvedValue(returnValue),
    put: vi.fn().mockResolvedValue(returnValue),
    patch: vi.fn().mockResolvedValue(returnValue),
    delete: vi.fn().mockResolvedValue(undefined),
    header: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    expand: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    top: vi.fn().mockReturnThis(),
    orderby: vi.fn().mockReturnThis(),
    search: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnThis(),
  };
  return mockRequest;
}

function createMockClient(returnValue: unknown): GraphClient {
  const mockRequest = createMockRequest(returnValue);
  return {
    api: vi.fn().mockReturnValue(mockRequest),
  };
}

// Sample test data
const sampleSite: Site = {
  id: "contoso.sharepoint.com,abc123,def456",
  displayName: "Marketing Site",
  name: "marketing",
  webUrl: "https://contoso.sharepoint.com/sites/marketing",
  description: "Marketing team site",
  createdDateTime: "2024-01-01T00:00:00Z",
  lastModifiedDateTime: "2024-01-15T00:00:00Z",
};

const sampleDrive: Drive = {
  id: "drive-123",
  name: "Documents",
  driveType: "documentLibrary",
  description: "Default document library",
  webUrl: "https://contoso.sharepoint.com/sites/marketing/Documents",
  createdDateTime: "2024-01-01T00:00:00Z",
  lastModifiedDateTime: "2024-01-15T00:00:00Z",
  quota: {
    total: 1073741824,
    used: 536870912,
    remaining: 536870912,
    state: "normal",
  },
};

// =============================================================================
// SITE TESTS
// =============================================================================

describe("listSites", () => {
  it("should return list of sites", async () => {
    const client = createMockClient({ value: [sampleSite] });

    const sites = await listSites(client);

    expect(sites).toHaveLength(1);
    expect(sites[0]?.displayName).toBe("Marketing Site");
    expect(client.api).toHaveBeenCalledWith("/sites");
  });

  it("should return empty array when no sites found", async () => {
    const client = createMockClient({ value: [] });

    const sites = await listSites(client);

    expect(sites).toHaveLength(0);
  });

  it("should handle undefined value in response", async () => {
    const client = createMockClient({});

    const sites = await listSites(client);

    expect(sites).toHaveLength(0);
  });
});

describe("getSite", () => {
  it("should return site by ID", async () => {
    const client = createMockClient(sampleSite);

    const site = await getSite(client, sampleSite.id);

    expect(site.displayName).toBe("Marketing Site");
    expect(client.api).toHaveBeenCalledWith(`/sites/${encodeURIComponent(sampleSite.id)}`);
  });

  it("should throw error when site ID is empty", async () => {
    const client = createMockClient(sampleSite);

    await expect(getSite(client, "")).rejects.toThrow("Site ID is required");
  });

  it("should encode special characters in site ID", async () => {
    const client = createMockClient(sampleSite);
    const siteIdWithSpecials = "site/with/slashes";

    await getSite(client, siteIdWithSpecials);

    expect(client.api).toHaveBeenCalledWith(`/sites/${encodeURIComponent(siteIdWithSpecials)}`);
  });
});

describe("getSiteByPath", () => {
  it("should return site by hostname and path", async () => {
    const client = createMockClient(sampleSite);

    const site = await getSiteByPath(client, "contoso.sharepoint.com", "/sites/marketing");

    expect(site.displayName).toBe("Marketing Site");
    expect(client.api).toHaveBeenCalledWith("/sites/contoso.sharepoint.com:/sites/marketing");
  });

  it("should normalize path without leading slash", async () => {
    const client = createMockClient(sampleSite);

    await getSiteByPath(client, "contoso.sharepoint.com", "sites/marketing");

    expect(client.api).toHaveBeenCalledWith("/sites/contoso.sharepoint.com:/sites/marketing");
  });

  it("should throw error when hostname is empty", async () => {
    const client = createMockClient(sampleSite);

    await expect(getSiteByPath(client, "", "/sites/marketing")).rejects.toThrow(
      "Hostname is required",
    );
  });

  it("should throw error when site path is empty", async () => {
    const client = createMockClient(sampleSite);

    await expect(getSiteByPath(client, "contoso.sharepoint.com", "")).rejects.toThrow(
      "Site path is required",
    );
  });
});

describe("getRootSite", () => {
  it("should return root site", async () => {
    const rootSite = { ...sampleSite, name: "root" };
    const client = createMockClient(rootSite);

    const site = await getRootSite(client);

    expect(site.name).toBe("root");
    expect(client.api).toHaveBeenCalledWith("/sites/root");
  });
});

describe("searchSites", () => {
  it("should search sites with query", async () => {
    const client = createMockClient({ value: [sampleSite] });

    const sites = await searchSites(client, "marketing");

    expect(sites).toHaveLength(1);
    expect(sites[0]?.displayName).toBe("Marketing Site");
  });

  it("should list all sites when query is empty", async () => {
    const client = createMockClient({ value: [sampleSite] });

    const sites = await searchSites(client, "");

    expect(sites).toHaveLength(1);
  });
});

// =============================================================================
// DRIVE TESTS
// =============================================================================

describe("listDrives", () => {
  it("should return list of drives for a site", async () => {
    const client = createMockClient({ value: [sampleDrive] });

    const drives = await listDrives(client, sampleSite.id);

    expect(drives).toHaveLength(1);
    expect(drives[0]?.name).toBe("Documents");
    expect(client.api).toHaveBeenCalledWith(`/sites/${encodeURIComponent(sampleSite.id)}/drives`);
  });

  it("should throw error when site ID is empty", async () => {
    const client = createMockClient({ value: [] });

    await expect(listDrives(client, "")).rejects.toThrow("Site ID is required");
  });

  it("should return empty array when no drives found", async () => {
    const client = createMockClient({ value: [] });

    const drives = await listDrives(client, sampleSite.id);

    expect(drives).toHaveLength(0);
  });
});

describe("getDrive", () => {
  it("should return drive by ID", async () => {
    const client = createMockClient(sampleDrive);

    const drive = await getDrive(client, sampleDrive.id);

    expect(drive.name).toBe("Documents");
    expect(client.api).toHaveBeenCalledWith(`/drives/${sampleDrive.id}`);
  });

  it("should throw error when drive ID is empty", async () => {
    const client = createMockClient(sampleDrive);

    await expect(getDrive(client, "")).rejects.toThrow("Drive ID is required");
  });
});

describe("getDefaultDrive", () => {
  it("should return default drive for a site", async () => {
    const client = createMockClient(sampleDrive);

    const drive = await getDefaultDrive(client, sampleSite.id);

    expect(drive.name).toBe("Documents");
    expect(client.api).toHaveBeenCalledWith(`/sites/${encodeURIComponent(sampleSite.id)}/drive`);
  });

  it("should throw error when site ID is empty", async () => {
    const client = createMockClient(sampleDrive);

    await expect(getDefaultDrive(client, "")).rejects.toThrow("Site ID is required");
  });
});

describe("getMyDrive", () => {
  it("should return user's OneDrive", async () => {
    const myDrive = { ...sampleDrive, driveType: "personal" as const };
    const client = createMockClient(myDrive);

    const drive = await getMyDrive(client);

    expect(drive.driveType).toBe("personal");
    expect(client.api).toHaveBeenCalledWith("/me/drive");
  });
});

// =============================================================================
// HELPER FUNCTION TESTS
// =============================================================================

describe("isCompoundSiteId", () => {
  it("should return true for compound site ID", () => {
    expect(isCompoundSiteId("contoso.sharepoint.com,abc123,def456")).toBe(true);
  });

  it("should return false for simple ID", () => {
    expect(isCompoundSiteId("abc123")).toBe(false);
  });
});

describe("parseCompoundSiteId", () => {
  it("should parse compound site ID correctly", () => {
    const result = parseCompoundSiteId("contoso.sharepoint.com,abc123,def456");

    expect(result).toEqual({
      hostname: "contoso.sharepoint.com",
      siteGuid: "abc123",
      webGuid: "def456",
    });
  });

  it("should return null for invalid format", () => {
    expect(parseCompoundSiteId("invalid")).toBeNull();
    expect(parseCompoundSiteId("only,two")).toBeNull();
    expect(parseCompoundSiteId("one,two,three,four")).toBeNull();
  });
});

describe("buildCompoundSiteId", () => {
  it("should build compound site ID from components", () => {
    const result = buildCompoundSiteId("contoso.sharepoint.com", "abc123", "def456");

    expect(result).toBe("contoso.sharepoint.com,abc123,def456");
  });
});
