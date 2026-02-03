/**
 * Tests for Google Shared Drives client operations
 */

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { SharedDrive, DriveFile } from "../types.js";
import { SharedDrivesClient } from "../shared-drives.js";
import { GoogleDriveError, GoogleDocsMimeTypes } from "../types.js";

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock googleapis
vi.mock("googleapis", () => {
  const mockDrive = {
    drives: {
      list: vi.fn(),
      get: vi.fn(),
      hide: vi.fn(),
      unhide: vi.fn(),
    },
    files: {
      list: vi.fn(),
    },
  };

  return {
    google: {
      drive: vi.fn(() => mockDrive),
    },
  };
});

// Get mock references
import { google } from "googleapis";

function getMockDrive() {
  return (google.drive as Mock)();
}

// Sample test data
const sampleSharedDrive: SharedDrive = {
  id: "drive-123",
  name: "Engineering Team",
  colorRgb: "#4285F4",
  createdTime: "2024-01-01T00:00:00.000Z",
  hidden: false,
  capabilities: {
    canAddChildren: true,
    canComment: true,
    canCopy: true,
    canDeleteChildren: true,
    canDeleteDrive: false,
    canDownload: true,
    canEdit: true,
    canListChildren: true,
    canManageMembers: false,
    canReadRevisions: true,
    canRename: true,
    canRenameDrive: false,
    canShare: true,
    canTrashChildren: true,
  },
  restrictions: {
    adminManagedRestrictions: false,
    copyRequiresWriterPermission: false,
    domainUsersOnly: true,
    driveMembersOnly: false,
  },
};

const sampleSharedDrive2: SharedDrive = {
  id: "drive-456",
  name: "Marketing Team",
  colorRgb: "#EA4335",
  createdTime: "2024-02-01T00:00:00.000Z",
  hidden: false,
};

const sampleFile: DriveFile = {
  id: "file-123",
  name: "roadmap.xlsx",
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  size: 54321,
  createdTime: "2024-01-15T00:00:00.000Z",
  modifiedTime: "2024-01-20T10:30:00.000Z",
  parents: ["drive-123"],
  webViewLink: "https://drive.google.com/file/d/file-123/view",
  driveId: "drive-123",
};

const sampleFolder: DriveFile = {
  id: "folder-789",
  name: "Projects",
  mimeType: GoogleDocsMimeTypes.FOLDER,
  createdTime: "2024-01-05T00:00:00.000Z",
  modifiedTime: "2024-01-10T00:00:00.000Z",
  parents: ["drive-123"],
  driveId: "drive-123",
};

const mockAuth = {} as any;

// =============================================================================
// CONSTRUCTOR TESTS
// =============================================================================

describe("SharedDrivesClient constructor", () => {
  it("should create client with valid auth", () => {
    const client = new SharedDrivesClient({ auth: mockAuth });
    expect(client).toBeInstanceOf(SharedDrivesClient);
  });

  it("should throw error when auth is missing", () => {
    expect(() => new SharedDrivesClient({ auth: undefined as any })).toThrow(
      "Auth client is required",
    );
  });

  it("should throw error when auth is null", () => {
    expect(() => new SharedDrivesClient({ auth: null as any })).toThrow("Auth client is required");
  });
});

// =============================================================================
// LIST SHARED DRIVES TESTS
// =============================================================================

describe("listSharedDrives", () => {
  let client: SharedDrivesClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SharedDrivesClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should list shared drives", async () => {
    mockDrive.drives.list.mockResolvedValue({
      data: { drives: [sampleSharedDrive, sampleSharedDrive2] },
    });

    const result = await client.listSharedDrives();

    expect(result.drives).toHaveLength(2);
    expect(result.drives[0].name).toBe("Engineering Team");
    expect(result.drives[1].name).toBe("Marketing Team");
  });

  it("should handle pagination", async () => {
    mockDrive.drives.list.mockResolvedValue({
      data: { drives: [sampleSharedDrive], nextPageToken: "token-123" },
    });

    const result = await client.listSharedDrives(50);

    expect(result.nextPageToken).toBe("token-123");
    expect(mockDrive.drives.list).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 50,
      }),
    );
  });

  it("should cap page size at 100", async () => {
    mockDrive.drives.list.mockResolvedValue({
      data: { drives: [] },
    });

    await client.listSharedDrives(200);

    expect(mockDrive.drives.list).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 100,
      }),
    );
  });

  it("should support page token", async () => {
    mockDrive.drives.list.mockResolvedValue({
      data: { drives: [sampleSharedDrive2] },
    });

    await client.listSharedDrives(100, "token-123");

    expect(mockDrive.drives.list).toHaveBeenCalledWith(
      expect.objectContaining({
        pageToken: "token-123",
      }),
    );
  });

  it("should return empty array when no drives", async () => {
    mockDrive.drives.list.mockResolvedValue({
      data: { drives: [] },
    });

    const result = await client.listSharedDrives();

    expect(result.drives).toHaveLength(0);
  });

  it("should handle undefined drives response", async () => {
    mockDrive.drives.list.mockResolvedValue({
      data: {},
    });

    const result = await client.listSharedDrives();

    expect(result.drives).toHaveLength(0);
  });

  it("should map capabilities correctly", async () => {
    mockDrive.drives.list.mockResolvedValue({
      data: { drives: [sampleSharedDrive] },
    });

    const result = await client.listSharedDrives();

    expect(result.drives[0].capabilities?.canManageMembers).toBe(false);
    expect(result.drives[0].capabilities?.canEdit).toBe(true);
  });

  it("should map restrictions correctly", async () => {
    mockDrive.drives.list.mockResolvedValue({
      data: { drives: [sampleSharedDrive] },
    });

    const result = await client.listSharedDrives();

    expect(result.drives[0].restrictions?.domainUsersOnly).toBe(true);
    expect(result.drives[0].restrictions?.driveMembersOnly).toBe(false);
  });
});

describe("listAllSharedDrives", () => {
  let client: SharedDrivesClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SharedDrivesClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should list all drives with pagination", async () => {
    mockDrive.drives.list
      .mockResolvedValueOnce({
        data: { drives: [sampleSharedDrive], nextPageToken: "token-1" },
      })
      .mockResolvedValueOnce({
        data: { drives: [sampleSharedDrive2], nextPageToken: undefined },
      });

    const drives = await client.listAllSharedDrives();

    expect(drives).toHaveLength(2);
    expect(mockDrive.drives.list).toHaveBeenCalledTimes(2);
  });

  it("should respect maxResults limit", async () => {
    mockDrive.drives.list.mockResolvedValue({
      data: { drives: [sampleSharedDrive, sampleSharedDrive2], nextPageToken: "token-1" },
    });

    const drives = await client.listAllSharedDrives(1);

    expect(drives).toHaveLength(1);
  });
});

// =============================================================================
// GET SHARED DRIVE TESTS
// =============================================================================

describe("getSharedDrive", () => {
  let client: SharedDrivesClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SharedDrivesClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should get shared drive by ID", async () => {
    mockDrive.drives.get.mockResolvedValue({
      data: sampleSharedDrive,
    });

    const drive = await client.getSharedDrive("drive-123");

    expect(drive.name).toBe("Engineering Team");
    expect(drive.id).toBe("drive-123");
    expect(mockDrive.drives.get).toHaveBeenCalledWith(
      expect.objectContaining({
        driveId: "drive-123",
      }),
    );
  });

  it("should throw error when drive ID is empty", async () => {
    await expect(client.getSharedDrive("")).rejects.toThrow("Drive ID is required");
  });

  it("should include capabilities and restrictions", async () => {
    mockDrive.drives.get.mockResolvedValue({
      data: sampleSharedDrive,
    });

    const drive = await client.getSharedDrive("drive-123");

    expect(drive.capabilities).toBeDefined();
    expect(drive.restrictions).toBeDefined();
  });
});

// =============================================================================
// SEARCH SHARED DRIVES TESTS
// =============================================================================

describe("searchSharedDrives", () => {
  let client: SharedDrivesClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SharedDrivesClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should search shared drives by name", async () => {
    mockDrive.drives.list.mockResolvedValue({
      data: { drives: [sampleSharedDrive] },
    });

    const result = await client.searchSharedDrives("Engineering");

    expect(result.drives).toHaveLength(1);
    expect(mockDrive.drives.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "name contains 'Engineering'",
      }),
    );
  });

  it("should escape single quotes in search term", async () => {
    mockDrive.drives.list.mockResolvedValue({
      data: { drives: [] },
    });

    await client.searchSharedDrives("John's Team");

    expect(mockDrive.drives.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "name contains 'John\\'s Team'",
      }),
    );
  });

  it("should throw error when search term is empty", async () => {
    await expect(client.searchSharedDrives("")).rejects.toThrow("Search term is required");
  });
});

// =============================================================================
// LIST SHARED DRIVE FILES TESTS
// =============================================================================

describe("listSharedDriveFiles", () => {
  let client: SharedDrivesClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SharedDrivesClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should list files in shared drive root", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile, sampleFolder] },
    });

    const result = await client.listSharedDriveFiles("drive-123");

    expect(result.files).toHaveLength(2);
    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        driveId: "drive-123",
        corpora: "drive",
        q: "trashed = false and 'drive-123' in parents",
      }),
    );
  });

  it("should list files in specific folder", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile] },
    });

    const result = await client.listSharedDriveFiles("drive-123", {
      folderId: "folder-789",
    });

    expect(result.files).toHaveLength(1);
    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "trashed = false and 'folder-789' in parents",
      }),
    );
  });

  it("should handle pagination", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile], nextPageToken: "file-token-123" },
    });

    const result = await client.listSharedDriveFiles("drive-123", { pageSize: 50 });

    expect(result.nextPageToken).toBe("file-token-123");
    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 50,
      }),
    );
  });

  it("should support custom query", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile] },
    });

    await client.listSharedDriveFiles("drive-123", {
      query: "name contains 'roadmap'",
    });

    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("name contains 'roadmap'"),
      }),
    );
  });

  it("should throw error when drive ID is empty", async () => {
    await expect(client.listSharedDriveFiles("")).rejects.toThrow("Drive ID is required");
  });

  it("should include driveId in file metadata", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile] },
    });

    const result = await client.listSharedDriveFiles("drive-123");

    expect(result.files[0].driveId).toBe("drive-123");
  });
});

describe("listAllSharedDriveFiles", () => {
  let client: SharedDrivesClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SharedDrivesClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should list all files with pagination", async () => {
    mockDrive.files.list
      .mockResolvedValueOnce({
        data: { files: [sampleFile], nextPageToken: "token-1" },
      })
      .mockResolvedValueOnce({
        data: { files: [sampleFolder], nextPageToken: undefined },
      });

    const files = await client.listAllSharedDriveFiles("drive-123");

    expect(files).toHaveLength(2);
    expect(mockDrive.files.list).toHaveBeenCalledTimes(2);
  });

  it("should respect maxResults limit", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile, sampleFolder], nextPageToken: "token-1" },
    });

    const files = await client.listAllSharedDriveFiles("drive-123", undefined, 1);

    expect(files).toHaveLength(1);
  });
});

// =============================================================================
// SEARCH SHARED DRIVE FILES TESTS
// =============================================================================

describe("searchSharedDriveFiles", () => {
  let client: SharedDrivesClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SharedDrivesClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should search files by name in shared drive", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile] },
    });

    const result = await client.searchSharedDriveFiles("drive-123", "roadmap");

    expect(result.files).toHaveLength(1);
    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        driveId: "drive-123",
        q: expect.stringContaining("name contains 'roadmap'"),
      }),
    );
  });

  it("should escape single quotes in search term", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    await client.searchSharedDriveFiles("drive-123", "Q1'24 report");

    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("name contains 'Q1\\'24 report'"),
      }),
    );
  });

  it("should throw error when drive ID is empty", async () => {
    await expect(client.searchSharedDriveFiles("", "query")).rejects.toThrow(
      "Drive ID is required",
    );
  });

  it("should throw error when search term is empty", async () => {
    await expect(client.searchSharedDriveFiles("drive-123", "")).rejects.toThrow(
      "Search term is required",
    );
  });
});

describe("searchSharedDriveByContent", () => {
  let client: SharedDrivesClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SharedDrivesClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should search files by content in shared drive", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile] },
    });

    const result = await client.searchSharedDriveByContent("drive-123", "quarterly");

    expect(result.files).toHaveLength(1);
    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("fullText contains 'quarterly'"),
      }),
    );
  });

  it("should throw error when drive ID is empty", async () => {
    await expect(client.searchSharedDriveByContent("", "query")).rejects.toThrow(
      "Drive ID is required",
    );
  });

  it("should throw error when search term is empty", async () => {
    await expect(client.searchSharedDriveByContent("drive-123", "")).rejects.toThrow(
      "Search term is required",
    );
  });
});

describe("getSharedDriveFilesByMimeType", () => {
  let client: SharedDrivesClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SharedDrivesClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should get files by MIME type in shared drive", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFolder] },
    });

    const result = await client.getSharedDriveFilesByMimeType(
      "drive-123",
      GoogleDocsMimeTypes.FOLDER,
    );

    expect(result.files).toHaveLength(1);
    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining(`mimeType = '${GoogleDocsMimeTypes.FOLDER}'`),
      }),
    );
  });

  it("should throw error when drive ID is empty", async () => {
    await expect(
      client.getSharedDriveFilesByMimeType("", GoogleDocsMimeTypes.FOLDER),
    ).rejects.toThrow("Drive ID is required");
  });

  it("should throw error when MIME type is empty", async () => {
    await expect(client.getSharedDriveFilesByMimeType("drive-123", "")).rejects.toThrow(
      "MIME type is required",
    );
  });
});

// =============================================================================
// UTILITY METHODS TESTS
// =============================================================================

describe("hasCapability", () => {
  let client: SharedDrivesClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SharedDrivesClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should return true for existing capability", async () => {
    mockDrive.drives.get.mockResolvedValue({
      data: sampleSharedDrive,
    });

    const result = await client.hasCapability("drive-123", "canEdit");

    expect(result).toBe(true);
  });

  it("should return false for missing capability", async () => {
    mockDrive.drives.get.mockResolvedValue({
      data: sampleSharedDrive,
    });

    const result = await client.hasCapability("drive-123", "canManageMembers");

    expect(result).toBe(false);
  });

  it("should return false when capabilities are undefined", async () => {
    mockDrive.drives.get.mockResolvedValue({
      data: { ...sampleSharedDrive, capabilities: undefined },
    });

    const result = await client.hasCapability("drive-123", "canEdit");

    expect(result).toBe(false);
  });
});

describe("isHidden", () => {
  let client: SharedDrivesClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SharedDrivesClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should return false for visible drive", async () => {
    mockDrive.drives.get.mockResolvedValue({
      data: sampleSharedDrive,
    });

    const result = await client.isHidden("drive-123");

    expect(result).toBe(false);
  });

  it("should return true for hidden drive", async () => {
    mockDrive.drives.get.mockResolvedValue({
      data: { ...sampleSharedDrive, hidden: true },
    });

    const result = await client.isHidden("drive-123");

    expect(result).toBe(true);
  });
});

describe("hideSharedDrive", () => {
  let client: SharedDrivesClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SharedDrivesClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should hide shared drive", async () => {
    mockDrive.drives.hide.mockResolvedValue({});

    await client.hideSharedDrive("drive-123");

    expect(mockDrive.drives.hide).toHaveBeenCalledWith({
      driveId: "drive-123",
    });
  });

  it("should throw error when drive ID is empty", async () => {
    await expect(client.hideSharedDrive("")).rejects.toThrow("Drive ID is required");
  });
});

describe("unhideSharedDrive", () => {
  let client: SharedDrivesClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new SharedDrivesClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should unhide shared drive", async () => {
    mockDrive.drives.unhide.mockResolvedValue({
      data: { ...sampleSharedDrive, hidden: false },
    });

    const drive = await client.unhideSharedDrive("drive-123");

    expect(drive.hidden).toBe(false);
    expect(mockDrive.drives.unhide).toHaveBeenCalledWith({
      driveId: "drive-123",
    });
  });

  it("should throw error when drive ID is empty", async () => {
    await expect(client.unhideSharedDrive("")).rejects.toThrow("Drive ID is required");
  });
});

// =============================================================================
// RAW CLIENT ACCESS TESTS
// =============================================================================

describe("getRawClient", () => {
  it("should return the raw Drive client", () => {
    const client = new SharedDrivesClient({ auth: mockAuth });
    const rawClient = client.getRawClient();

    expect(rawClient).toBeDefined();
    expect(rawClient.drives).toBeDefined();
    expect(rawClient.files).toBeDefined();
  });
});
