/**
 * Tests for Google Drive client operations
 */

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { DriveFile } from "../types.js";
import {
  GoogleDriveClient,
  isFolder,
  isGoogleDocsType,
  getFileExtension,
  buildQuery,
} from "../client.js";
import { GoogleDriveError, GoogleDocsMimeTypes } from "../types.js";

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock googleapis
vi.mock("googleapis", () => {
  const mockDrive = {
    files: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      copy: vi.fn(),
      export: vi.fn(),
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
const sampleFile: DriveFile = {
  id: "file-123",
  name: "report.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  size: 12345,
  createdTime: "2024-01-01T00:00:00.000Z",
  modifiedTime: "2024-01-15T10:30:00.000Z",
  parents: ["folder-456"],
  webViewLink: "https://drive.google.com/file/d/file-123/view",
  description: "Quarterly report",
};

const sampleFolder: DriveFile = {
  id: "folder-456",
  name: "Documents",
  mimeType: GoogleDocsMimeTypes.FOLDER,
  createdTime: "2024-01-01T00:00:00.000Z",
  modifiedTime: "2024-01-15T10:30:00.000Z",
  parents: ["root"],
  webViewLink: "https://drive.google.com/drive/folders/folder-456",
};

const sampleGoogleDoc: DriveFile = {
  id: "doc-789",
  name: "Meeting Notes",
  mimeType: GoogleDocsMimeTypes.DOCUMENT,
  createdTime: "2024-01-01T00:00:00.000Z",
  modifiedTime: "2024-01-15T10:30:00.000Z",
  parents: ["folder-456"],
  webViewLink: "https://docs.google.com/document/d/doc-789/edit",
};

const mockAuth = {} as any;

// =============================================================================
// CONSTRUCTOR TESTS
// =============================================================================

describe("GoogleDriveClient constructor", () => {
  it("should create client with valid auth", () => {
    const client = new GoogleDriveClient({ auth: mockAuth });
    expect(client).toBeInstanceOf(GoogleDriveClient);
  });

  it("should throw error when auth is missing", () => {
    expect(() => new GoogleDriveClient({ auth: undefined as any })).toThrow(
      "Auth client is required",
    );
  });

  it("should throw error when auth is null", () => {
    expect(() => new GoogleDriveClient({ auth: null as any })).toThrow("Auth client is required");
  });
});

// =============================================================================
// LIST OPERATIONS TESTS
// =============================================================================

describe("listFiles", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should list files in root folder", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile, sampleFolder] },
    });

    const result = await client.listFiles();

    expect(result.files).toHaveLength(2);
    expect(result.files[0].name).toBe("report.docx");
    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "trashed = false",
      }),
    );
  });

  it("should list files in specific folder", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile] },
    });

    const result = await client.listFiles({ folderId: "folder-456" });

    expect(result.files).toHaveLength(1);
    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "trashed = false and 'folder-456' in parents",
      }),
    );
  });

  it("should list files with custom query", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile] },
    });

    const result = await client.listFiles({ query: "name contains 'report'" });

    expect(result.files).toHaveLength(1);
    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "trashed = false and (name contains 'report')",
      }),
    );
  });

  it("should handle pagination", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile], nextPageToken: "token-123" },
    });

    const result = await client.listFiles({ pageSize: 50 });

    expect(result.nextPageToken).toBe("token-123");
    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 50,
      }),
    );
  });

  it("should cap page size at 1000", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    await client.listFiles({ pageSize: 2000 });

    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 1000,
      }),
    );
  });

  it("should support page token for pagination", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile] },
    });

    await client.listFiles({ pageToken: "token-123" });

    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        pageToken: "token-123",
      }),
    );
  });

  it("should support custom orderBy", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    await client.listFiles({ orderBy: "name asc" });

    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: "name asc",
      }),
    );
  });

  it("should return empty array when no files", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    const result = await client.listFiles();

    expect(result.files).toHaveLength(0);
  });

  it("should handle undefined files response", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {},
    });

    const result = await client.listFiles();

    expect(result.files).toHaveLength(0);
  });
});

describe("listAllFiles", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
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

    const files = await client.listAllFiles();

    expect(files).toHaveLength(2);
    expect(mockDrive.files.list).toHaveBeenCalledTimes(2);
  });

  it("should respect maxResults limit", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile, sampleFolder], nextPageToken: "token-1" },
    });

    const files = await client.listAllFiles(undefined, 1);

    expect(files).toHaveLength(1);
  });
});

// =============================================================================
// GET OPERATIONS TESTS
// =============================================================================

describe("getFile", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should get file by ID", async () => {
    mockDrive.files.get.mockResolvedValue({
      data: sampleFile,
    });

    const file = await client.getFile("file-123");

    expect(file.name).toBe("report.docx");
    expect(file.id).toBe("file-123");
    expect(mockDrive.files.get).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: "file-123",
        supportsAllDrives: true,
      }),
    );
  });

  it("should throw error when file ID is empty", async () => {
    await expect(client.getFile("")).rejects.toThrow("File ID is required");
  });

  it("should include full metadata", async () => {
    mockDrive.files.get.mockResolvedValue({
      data: {
        ...sampleFile,
        owners: [{ displayName: "John Doe", emailAddress: "john@example.com" }],
        lastModifyingUser: { displayName: "Jane Doe" },
      },
    });

    const file = await client.getFile("file-123");

    expect(file.owners).toHaveLength(1);
    expect(file.owners?.[0].displayName).toBe("John Doe");
    expect(file.lastModifyingUser?.displayName).toBe("Jane Doe");
  });
});

// =============================================================================
// DOWNLOAD OPERATIONS TESTS
// =============================================================================

describe("downloadFile", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should download file content", async () => {
    const content = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

    mockDrive.files.get
      .mockResolvedValueOnce({ data: sampleFile })
      .mockResolvedValueOnce({ data: content.buffer });

    const buffer = await client.downloadFile("file-123");

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString()).toBe("Hello");
  });

  it("should throw error when downloading a folder", async () => {
    mockDrive.files.get.mockResolvedValue({
      data: sampleFolder,
    });

    await expect(client.downloadFile("folder-456")).rejects.toThrow("Cannot download a folder");
  });

  it("should throw error when downloading Google Docs file directly", async () => {
    mockDrive.files.get.mockResolvedValue({
      data: sampleGoogleDoc,
    });

    await expect(client.downloadFile("doc-789")).rejects.toThrow(
      "Cannot download Google Docs file directly",
    );
  });

  it("should throw error when file ID is empty", async () => {
    await expect(client.downloadFile("")).rejects.toThrow("File ID is required");
  });
});

describe("exportFile", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should export Google Doc as PDF", async () => {
    const pdfContent = new Uint8Array([37, 80, 68, 70]); // %PDF
    mockDrive.files.export.mockResolvedValue({ data: pdfContent.buffer });

    const buffer = await client.exportFile("doc-789", "application/pdf");

    expect(buffer).toBeInstanceOf(Buffer);
    expect(mockDrive.files.export).toHaveBeenCalledWith(
      { fileId: "doc-789", mimeType: "application/pdf" },
      { responseType: "arraybuffer" },
    );
  });

  it("should throw error when file ID is empty", async () => {
    await expect(client.exportFile("", "application/pdf")).rejects.toThrow("File ID is required");
  });

  it("should throw error when MIME type is empty", async () => {
    await expect(client.exportFile("doc-789", "")).rejects.toThrow(
      "MIME type is required for export",
    );
  });
});

// =============================================================================
// UPLOAD OPERATIONS TESTS
// =============================================================================

describe("uploadFile", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should upload file to root", async () => {
    mockDrive.files.create.mockResolvedValue({
      data: sampleFile,
    });

    const file = await client.uploadFile({
      name: "test.txt",
      content: Buffer.from("Hello, World!"),
      mimeType: "text/plain",
    });

    expect(file.name).toBe("report.docx");
    expect(mockDrive.files.create).toHaveBeenCalled();
  });

  it("should upload file to specific folder", async () => {
    mockDrive.files.create.mockResolvedValue({
      data: sampleFile,
    });

    await client.uploadFile({
      name: "test.txt",
      content: Buffer.from("Hello"),
      mimeType: "text/plain",
      folderId: "folder-456",
    });

    expect(mockDrive.files.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          parents: ["folder-456"],
        }),
      }),
    );
  });

  it("should throw error when file name is empty", async () => {
    await expect(
      client.uploadFile({
        name: "",
        content: Buffer.from("test"),
        mimeType: "text/plain",
      }),
    ).rejects.toThrow("File name is required");
  });

  it("should throw error when content is missing", async () => {
    await expect(
      client.uploadFile({
        name: "test.txt",
        content: undefined as any,
        mimeType: "text/plain",
      }),
    ).rejects.toThrow("File content is required");
  });

  it("should throw error when MIME type is missing", async () => {
    await expect(
      client.uploadFile({
        name: "test.txt",
        content: Buffer.from("test"),
        mimeType: "",
      }),
    ).rejects.toThrow("MIME type is required");
  });

  it("should include description if provided", async () => {
    mockDrive.files.create.mockResolvedValue({
      data: sampleFile,
    });

    await client.uploadFile({
      name: "test.txt",
      content: Buffer.from("test"),
      mimeType: "text/plain",
      description: "Test file description",
    });

    expect(mockDrive.files.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          description: "Test file description",
        }),
      }),
    );
  });
});

describe("updateFile", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should update file content", async () => {
    mockDrive.files.update.mockResolvedValue({
      data: sampleFile,
    });

    const file = await client.updateFile("file-123", Buffer.from("Updated"), "text/plain");

    expect(file.name).toBe("report.docx");
    expect(mockDrive.files.update).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: "file-123",
      }),
    );
  });

  it("should get existing MIME type if not provided", async () => {
    mockDrive.files.get.mockResolvedValue({
      data: { ...sampleFile, mimeType: "text/plain" },
    });
    mockDrive.files.update.mockResolvedValue({
      data: sampleFile,
    });

    await client.updateFile("file-123", Buffer.from("Updated"));

    expect(mockDrive.files.get).toHaveBeenCalled();
  });

  it("should throw error when file ID is empty", async () => {
    await expect(client.updateFile("", Buffer.from("test"))).rejects.toThrow("File ID is required");
  });

  it("should throw error when content is missing", async () => {
    await expect(client.updateFile("file-123", undefined as any)).rejects.toThrow(
      "File content is required",
    );
  });
});

// =============================================================================
// DELETE OPERATIONS TESTS
// =============================================================================

describe("deleteFile", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should trash file by default", async () => {
    mockDrive.files.update.mockResolvedValue({ data: {} });

    await client.deleteFile("file-123");

    expect(mockDrive.files.update).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: "file-123",
        requestBody: { trashed: true },
      }),
    );
  });

  it("should permanently delete when permanent=true", async () => {
    mockDrive.files.delete.mockResolvedValue({});

    await client.deleteFile("file-123", true);

    expect(mockDrive.files.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: "file-123",
      }),
    );
  });

  it("should throw error when file ID is empty", async () => {
    await expect(client.deleteFile("")).rejects.toThrow("File ID is required");
  });
});

describe("restoreFile", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should restore file from trash", async () => {
    mockDrive.files.update.mockResolvedValue({
      data: sampleFile,
    });

    const file = await client.restoreFile("file-123");

    expect(file.name).toBe("report.docx");
    expect(mockDrive.files.update).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: "file-123",
        requestBody: { trashed: false },
      }),
    );
  });

  it("should throw error when file ID is empty", async () => {
    await expect(client.restoreFile("")).rejects.toThrow("File ID is required");
  });
});

// =============================================================================
// FOLDER OPERATIONS TESTS
// =============================================================================

describe("createFolder", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should create folder in root", async () => {
    mockDrive.files.create.mockResolvedValue({
      data: sampleFolder,
    });

    const folder = await client.createFolder("New Folder");

    expect(folder.name).toBe("Documents");
    expect(mockDrive.files.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          name: "New Folder",
          mimeType: GoogleDocsMimeTypes.FOLDER,
        }),
      }),
    );
  });

  it("should create folder with parent", async () => {
    mockDrive.files.create.mockResolvedValue({
      data: sampleFolder,
    });

    await client.createFolder("Subfolder", "parent-123");

    expect(mockDrive.files.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          parents: ["parent-123"],
        }),
      }),
    );
  });

  it("should throw error when folder name is empty", async () => {
    await expect(client.createFolder("")).rejects.toThrow("Folder name is required");
  });
});

// =============================================================================
// COPY/MOVE OPERATIONS TESTS
// =============================================================================

describe("copyFile", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should copy file", async () => {
    mockDrive.files.copy.mockResolvedValue({
      data: { ...sampleFile, id: "copy-123" },
    });

    const copy = await client.copyFile("file-123");

    expect(copy.id).toBe("copy-123");
    expect(mockDrive.files.copy).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: "file-123",
      }),
    );
  });

  it("should copy file with new name", async () => {
    mockDrive.files.copy.mockResolvedValue({
      data: { ...sampleFile, name: "Copy of report.docx" },
    });

    const copy = await client.copyFile("file-123", "Copy of report.docx");

    expect(copy.name).toBe("Copy of report.docx");
    expect(mockDrive.files.copy).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          name: "Copy of report.docx",
        }),
      }),
    );
  });

  it("should copy file to different folder", async () => {
    mockDrive.files.copy.mockResolvedValue({
      data: sampleFile,
    });

    await client.copyFile("file-123", undefined, "folder-789");

    expect(mockDrive.files.copy).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          parents: ["folder-789"],
        }),
      }),
    );
  });

  it("should throw error when file ID is empty", async () => {
    await expect(client.copyFile("")).rejects.toThrow("File ID is required");
  });
});

describe("moveFile", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should move file to new folder", async () => {
    mockDrive.files.get.mockResolvedValue({
      data: sampleFile,
    });
    mockDrive.files.update.mockResolvedValue({
      data: { ...sampleFile, parents: ["new-folder"] },
    });

    const moved = await client.moveFile("file-123", "new-folder");

    expect(moved.parents).toContain("new-folder");
    expect(mockDrive.files.update).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: "file-123",
        addParents: "new-folder",
        removeParents: "folder-456",
      }),
    );
  });

  it("should throw error when file ID is empty", async () => {
    await expect(client.moveFile("", "folder-123")).rejects.toThrow("File ID is required");
  });

  it("should throw error when new parent ID is empty", async () => {
    await expect(client.moveFile("file-123", "")).rejects.toThrow("New parent ID is required");
  });
});

describe("renameFile", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should rename file", async () => {
    mockDrive.files.update.mockResolvedValue({
      data: { ...sampleFile, name: "new-name.docx" },
    });

    const renamed = await client.renameFile("file-123", "new-name.docx");

    expect(renamed.name).toBe("new-name.docx");
    expect(mockDrive.files.update).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: "file-123",
        requestBody: { name: "new-name.docx" },
      }),
    );
  });

  it("should throw error when file ID is empty", async () => {
    await expect(client.renameFile("", "new-name")).rejects.toThrow("File ID is required");
  });

  it("should throw error when new name is empty", async () => {
    await expect(client.renameFile("file-123", "")).rejects.toThrow("New name is required");
  });
});

// =============================================================================
// SEARCH OPERATIONS TESTS
// =============================================================================

describe("searchByName", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should search files by name", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile] },
    });

    const results = await client.searchByName("report");

    expect(results.files).toHaveLength(1);
    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("name contains 'report'"),
      }),
    );
  });

  it("should escape single quotes in search term", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [] },
    });

    await client.searchByName("John's report");

    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("name contains 'John\\'s report'"),
      }),
    );
  });

  it("should throw error when search term is empty", async () => {
    await expect(client.searchByName("")).rejects.toThrow("Search term is required");
  });
});

describe("searchByContent", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should search files by content", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleFile] },
    });

    const results = await client.searchByContent("quarterly");

    expect(results.files).toHaveLength(1);
    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("fullText contains 'quarterly'"),
      }),
    );
  });

  it("should throw error when search term is empty", async () => {
    await expect(client.searchByContent("")).rejects.toThrow("Search term is required");
  });
});

describe("getFilesByMimeType", () => {
  let client: GoogleDriveClient;
  let mockDrive: ReturnType<typeof getMockDrive>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({ auth: mockAuth });
    mockDrive = getMockDrive();
  });

  it("should get files by MIME type", async () => {
    mockDrive.files.list.mockResolvedValue({
      data: { files: [sampleGoogleDoc] },
    });

    const results = await client.getFilesByMimeType(GoogleDocsMimeTypes.DOCUMENT);

    expect(results.files).toHaveLength(1);
    expect(mockDrive.files.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining(`mimeType = '${GoogleDocsMimeTypes.DOCUMENT}'`),
      }),
    );
  });

  it("should throw error when MIME type is empty", async () => {
    await expect(client.getFilesByMimeType("")).rejects.toThrow("MIME type is required");
  });
});

// =============================================================================
// HELPER FUNCTION TESTS
// =============================================================================

describe("isFolder", () => {
  it("should return true for folders", () => {
    expect(isFolder(sampleFolder)).toBe(true);
  });

  it("should return false for files", () => {
    expect(isFolder(sampleFile)).toBe(false);
  });

  it("should return false for Google Docs", () => {
    expect(isFolder(sampleGoogleDoc)).toBe(false);
  });
});

describe("isGoogleDocsType", () => {
  it("should return true for Google Docs", () => {
    expect(isGoogleDocsType(sampleGoogleDoc)).toBe(true);
  });

  it("should return true for folders", () => {
    expect(isGoogleDocsType(sampleFolder)).toBe(true);
  });

  it("should return false for regular files", () => {
    expect(isGoogleDocsType(sampleFile)).toBe(false);
  });
});

describe("getFileExtension", () => {
  it("should return extension from fileExtension field", () => {
    const file = { ...sampleFile, fileExtension: "docx" };
    expect(getFileExtension(file)).toBe("docx");
  });

  it("should extract extension from name", () => {
    expect(getFileExtension(sampleFile)).toBe("docx");
  });

  it("should return undefined for files without extension", () => {
    const file = { ...sampleFile, name: "README", fileExtension: undefined };
    expect(getFileExtension(file)).toBeUndefined();
  });

  it("should handle multiple dots in filename", () => {
    const file = { ...sampleFile, name: "report.2024.final.pdf", fileExtension: undefined };
    expect(getFileExtension(file)).toBe("pdf");
  });

  it("should return lowercase extension", () => {
    const file = { ...sampleFile, fileExtension: "DOCX" };
    expect(getFileExtension(file)).toBe("docx");
  });
});

describe("buildQuery", () => {
  it("should build query with mimeType", () => {
    const query = buildQuery({ mimeType: "text/plain" });
    expect(query).toBe("mimeType = 'text/plain'");
  });

  it("should build query with multiple mimeTypes", () => {
    const query = buildQuery({ mimeTypes: ["text/plain", "application/pdf"] });
    expect(query).toBe("(mimeType = 'text/plain' or mimeType = 'application/pdf')");
  });

  it("should build query with nameContains", () => {
    const query = buildQuery({ nameContains: "report" });
    expect(query).toBe("name contains 'report'");
  });

  it("should escape quotes in nameContains", () => {
    const query = buildQuery({ nameContains: "John's" });
    expect(query).toBe("name contains 'John\\'s'");
  });

  it("should build query with fullTextContains", () => {
    const query = buildQuery({ fullTextContains: "quarterly" });
    expect(query).toBe("fullText contains 'quarterly'");
  });

  it("should build query with parentId", () => {
    const query = buildQuery({ parentId: "folder-123" });
    expect(query).toBe("'folder-123' in parents");
  });

  it("should build query with starred", () => {
    const query = buildQuery({ starred: true });
    expect(query).toBe("starred = true");
  });

  it("should build query with trashed", () => {
    const query = buildQuery({ trashed: false });
    expect(query).toBe("trashed = false");
  });

  it("should build query with sharedWithMe", () => {
    const query = buildQuery({ sharedWithMe: true });
    expect(query).toBe("sharedWithMe = true");
  });

  it("should build query with modifiedAfter", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    const query = buildQuery({ modifiedAfter: date });
    expect(query).toBe("modifiedTime > '2024-01-01T00:00:00.000Z'");
  });

  it("should build query with modifiedBefore", () => {
    const date = new Date("2024-12-31T23:59:59.000Z");
    const query = buildQuery({ modifiedBefore: date });
    expect(query).toBe("modifiedTime < '2024-12-31T23:59:59.000Z'");
  });

  it("should combine multiple conditions with and", () => {
    const query = buildQuery({
      mimeType: "text/plain",
      nameContains: "report",
      starred: true,
    });
    expect(query).toBe("mimeType = 'text/plain' and name contains 'report' and starred = true");
  });

  it("should return empty string for empty options", () => {
    const query = buildQuery({});
    expect(query).toBe("");
  });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe("error handling", () => {
  it("should create GoogleDriveError with correct properties", () => {
    const error = new GoogleDriveError("Test error", "TestCode", 404);

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TestCode");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("GoogleDriveError");
  });
});
