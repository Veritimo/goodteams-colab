/**
 * Tests for SharePoint search operations
 */

import { describe, expect, it, vi } from "vitest";
import type { GraphClient, GraphRequest, DriveItem, SearchResult } from "../types.js";
import {
  searchFiles,
  searchInSite,
  searchInDrive,
  getRecentFiles,
  getSharedWithMe,
  buildSearchQuery,
  extractFileTypes,
} from "../search.js";

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
const sampleFile: DriveItem = {
  id: "item-123",
  name: "quarterly-report.docx",
  size: 12345,
  webUrl: "https://contoso.sharepoint.com/sites/marketing/Documents/quarterly-report.docx",
  createdDateTime: "2024-01-01T00:00:00Z",
  lastModifiedDateTime: "2024-01-15T00:00:00Z",
  file: {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  parentReference: {
    driveId: "drive-123",
    path: "/drive/root:/Documents",
  },
};

const sampleExcel: DriveItem = {
  id: "item-456",
  name: "budget.xlsx",
  size: 54321,
  webUrl: "https://contoso.sharepoint.com/sites/marketing/Documents/budget.xlsx",
  createdDateTime: "2024-01-05T00:00:00Z",
  lastModifiedDateTime: "2024-01-20T00:00:00Z",
  file: {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  parentReference: {
    driveId: "drive-123",
    path: "/drive/root:/Documents",
  },
};

const driveId = "drive-123";
const siteId = "site-123";

// =============================================================================
// SEARCH FILES TESTS
// =============================================================================

describe("searchFiles", () => {
  it("should search files across all sites", async () => {
    const searchResponse = {
      value: [
        {
          hitsContainers: [
            {
              hits: [
                { rank: 1, resource: sampleFile },
                { rank: 2, resource: sampleExcel },
              ],
              total: 2,
            },
          ],
        },
      ],
    };
    const client = createMockClient(searchResponse);

    const results = await searchFiles(client, "quarterly report");

    expect(results).toHaveLength(2);
    expect(results[0]?.driveItem.name).toBe("quarterly-report.docx");
    expect(client.api).toHaveBeenCalledWith("/search/query");
  });

  it("should throw error when query is empty", async () => {
    const client = createMockClient({});

    await expect(searchFiles(client, "")).rejects.toThrow("Search query is required");
  });

  it("should filter by file types", async () => {
    const mockRequest = createMockRequest({
      value: [{ hitsContainers: [{ hits: [] }] }],
    });
    const client: GraphClient = {
      api: vi.fn().mockReturnValue(mockRequest),
    };

    await searchFiles(client, "report", { fileTypes: ["docx", "pdf"] });

    expect(mockRequest.post).toHaveBeenCalled();
    // The query should include file type filters
    const postCall = (mockRequest.post as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(postCall?.requests[0]?.query?.queryString).toContain("filetype:docx");
    expect(postCall?.requests[0]?.query?.queryString).toContain("filetype:pdf");
  });

  it("should use drive search when driveId is specified", async () => {
    const client = createMockClient({ value: [sampleFile] });

    const results = await searchFiles(client, "report", { driveId });

    expect(client.api).toHaveBeenCalledWith(
      `/drives/${driveId}/root/search(q='${encodeURIComponent("report")}')`,
    );
  });

  it("should respect limit option", async () => {
    const mockRequest = createMockRequest({
      value: [{ hitsContainers: [{ hits: [] }] }],
    });
    const client: GraphClient = {
      api: vi.fn().mockReturnValue(mockRequest),
    };

    await searchFiles(client, "report", { limit: 10 });

    const postCall = (mockRequest.post as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(postCall?.requests[0]?.size).toBe(10);
  });
});

// =============================================================================
// SEARCH IN SITE TESTS
// =============================================================================

describe("searchInSite", () => {
  it("should search files within a specific site", async () => {
    // First API call returns drives, subsequent calls return search results
    const mockRequest = createMockRequest({ value: [{ id: driveId }] });
    mockRequest.get = vi
      .fn()
      .mockResolvedValueOnce({ value: [{ id: driveId }] }) // listDrives
      .mockResolvedValueOnce({ value: [sampleFile] }); // search

    const client: GraphClient = {
      api: vi.fn().mockReturnValue(mockRequest),
    };

    const results = await searchInSite(client, siteId, "project plan");

    expect(results.length).toBeGreaterThanOrEqual(0);
    expect(client.api).toHaveBeenCalledWith(`/sites/${siteId}/drives`);
  });

  it("should throw error when site ID is empty", async () => {
    const client = createMockClient({});

    await expect(searchInSite(client, "", "query")).rejects.toThrow("Site ID is required");
  });

  it("should throw error when query is empty", async () => {
    const client = createMockClient({});

    await expect(searchInSite(client, siteId, "")).rejects.toThrow("Search query is required");
  });
});

// =============================================================================
// SEARCH IN DRIVE TESTS
// =============================================================================

describe("searchInDrive", () => {
  it("should search files within a specific drive", async () => {
    const client = createMockClient({ value: [sampleFile] });

    const results = await searchInDrive(client, driveId, "report");

    expect(results).toHaveLength(1);
    expect(results[0]?.driveItem.name).toBe("quarterly-report.docx");
  });

  it("should search with folder scope", async () => {
    const client = createMockClient({ value: [] });

    await searchInDrive(client, driveId, "report", { folderScope: "/Documents" });

    expect(client.api).toHaveBeenCalledWith(
      `/drives/${driveId}/root:/Documents:/search(q='${encodeURIComponent("report")}')`,
    );
  });

  it("should filter results by file type", async () => {
    const client = createMockClient({ value: [sampleFile, sampleExcel] });

    const results = await searchInDrive(client, driveId, "data", { fileTypes: ["xlsx"] });

    expect(results).toHaveLength(1);
    expect(results[0]?.driveItem.name).toBe("budget.xlsx");
  });

  it("should throw error when drive ID is empty", async () => {
    const client = createMockClient({});

    await expect(searchInDrive(client, "", "query")).rejects.toThrow("Drive ID is required");
  });

  it("should throw error when query is empty", async () => {
    const client = createMockClient({});

    await expect(searchInDrive(client, driveId, "")).rejects.toThrow("Search query is required");
  });

  it("should apply limit to results", async () => {
    const mockRequest = createMockRequest({ value: [] });
    const client: GraphClient = {
      api: vi.fn().mockReturnValue(mockRequest),
    };

    await searchInDrive(client, driveId, "report", { limit: 5 });

    expect(mockRequest.top).toHaveBeenCalledWith(5);
  });
});

// =============================================================================
// RECENT FILES TESTS
// =============================================================================

describe("getRecentFiles", () => {
  it("should return recently accessed files", async () => {
    const client = createMockClient({ value: [sampleFile, sampleExcel] });

    const files = await getRecentFiles(client);

    expect(files).toHaveLength(2);
    expect(client.api).toHaveBeenCalledWith("/me/drive/recent");
  });

  it("should respect limit parameter", async () => {
    const mockRequest = createMockRequest({ value: [] });
    const client: GraphClient = {
      api: vi.fn().mockReturnValue(mockRequest),
    };

    await getRecentFiles(client, 10);

    expect(mockRequest.top).toHaveBeenCalledWith(10);
  });

  it("should cap limit at 200", async () => {
    const mockRequest = createMockRequest({ value: [] });
    const client: GraphClient = {
      api: vi.fn().mockReturnValue(mockRequest),
    };

    await getRecentFiles(client, 500);

    expect(mockRequest.top).toHaveBeenCalledWith(200);
  });
});

// =============================================================================
// SHARED WITH ME TESTS
// =============================================================================

describe("getSharedWithMe", () => {
  it("should return files shared with user", async () => {
    const client = createMockClient({ value: [sampleFile] });

    const files = await getSharedWithMe(client);

    expect(files).toHaveLength(1);
    expect(client.api).toHaveBeenCalledWith("/me/drive/sharedWithMe");
  });

  it("should respect limit parameter", async () => {
    const mockRequest = createMockRequest({ value: [] });
    const client: GraphClient = {
      api: vi.fn().mockReturnValue(mockRequest),
    };

    await getSharedWithMe(client, 15);

    expect(mockRequest.top).toHaveBeenCalledWith(15);
  });
});

// =============================================================================
// HELPER FUNCTION TESTS
// =============================================================================

describe("buildSearchQuery", () => {
  it("should build simple query", () => {
    const query = buildSearchQuery("annual report");

    expect(query).toBe("annual report");
  });

  it("should add file type filters", () => {
    const query = buildSearchQuery("report", { fileTypes: ["docx", "pdf"] });

    expect(query).toContain("report");
    expect(query).toContain("FileExtension:docx");
    expect(query).toContain("FileExtension:pdf");
  });

  it("should add author filter", () => {
    const query = buildSearchQuery("project", { author: "John Doe" });

    expect(query).toContain('Author:"John Doe"');
  });

  it("should add date filters", () => {
    const after = new Date("2024-01-01");
    const before = new Date("2024-12-31");

    const query = buildSearchQuery("budget", {
      modifiedAfter: after,
      modifiedBefore: before,
    });

    expect(query).toContain("LastModifiedTime>=2024-01-01");
    expect(query).toContain("LastModifiedTime<=2024-12-31");
  });

  it("should add size filters", () => {
    const query = buildSearchQuery("large files", {
      sizeGreaterThan: 1000000,
      sizeLessThan: 10000000,
    });

    expect(query).toContain("Size>1000000");
    expect(query).toContain("Size<10000000");
  });

  it("should combine multiple filters", () => {
    const query = buildSearchQuery("report", {
      fileTypes: ["xlsx"],
      author: "Jane",
      sizeGreaterThan: 5000,
    });

    expect(query).toContain("report");
    expect(query).toContain("FileExtension:xlsx");
    expect(query).toContain('Author:"Jane"');
    expect(query).toContain("Size>5000");
  });
});

describe("extractFileTypes", () => {
  it("should extract file types from search results", () => {
    const results: SearchResult[] = [
      { driveItem: sampleFile, rank: 1 },
      { driveItem: sampleExcel, rank: 2 },
      { driveItem: { ...sampleFile, name: "notes.docx" }, rank: 3 },
    ];

    const types = extractFileTypes(results);

    expect(types.get("docx")).toBe(2);
    expect(types.get("xlsx")).toBe(1);
  });

  it("should return empty map for no results", () => {
    const types = extractFileTypes([]);

    expect(types.size).toBe(0);
  });

  it("should handle files without extensions", () => {
    const results: SearchResult[] = [
      { driveItem: { id: "1", name: "README" }, rank: 1 },
      { driveItem: sampleFile, rank: 2 },
    ];

    const types = extractFileTypes(results);

    expect(types.get("docx")).toBe(1);
    expect(types.size).toBe(1);
  });

  it("should normalize extensions to lowercase", () => {
    const results: SearchResult[] = [
      { driveItem: { ...sampleFile, name: "Report.DOCX" }, rank: 1 },
      { driveItem: { ...sampleFile, name: "notes.docx" }, rank: 2 },
    ];

    const types = extractFileTypes(results);

    expect(types.get("docx")).toBe(2);
  });
});
