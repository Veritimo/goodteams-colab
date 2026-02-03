/**
 * Tests for SharePoint file operations
 */

import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import type { GraphClient, GraphRequest, DriveItem } from "../types.js";
import {
  listFiles,
  listFilesByPath,
  getFile,
  getFileByPath,
  downloadFile,
  downloadFileByPath,
  uploadFile,
  updateFile,
  deleteFile,
  deleteFileByPath,
  createFolder,
  copyFile,
  moveFile,
  isFile,
  isFolder,
  getFileExtension,
  getMimeType,
} from "../files.js";

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
  name: "report.docx",
  size: 12345,
  webUrl: "https://contoso.sharepoint.com/sites/marketing/Documents/report.docx",
  createdDateTime: "2024-01-01T00:00:00Z",
  lastModifiedDateTime: "2024-01-15T00:00:00Z",
  file: {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  parentReference: {
    driveId: "drive-123",
    path: "/drive/root:/Documents",
  },
  "@microsoft.graph.downloadUrl": "https://download.example.com/file",
};

const sampleFolder: DriveItem = {
  id: "folder-456",
  name: "Documents",
  webUrl: "https://contoso.sharepoint.com/sites/marketing/Documents",
  createdDateTime: "2024-01-01T00:00:00Z",
  lastModifiedDateTime: "2024-01-15T00:00:00Z",
  folder: {
    childCount: 10,
  },
  parentReference: {
    driveId: "drive-123",
    path: "/drive/root:",
  },
};

const driveId = "drive-123";

// =============================================================================
// LIST OPERATIONS TESTS
// =============================================================================

describe("listFiles", () => {
  it("should list files in root folder", async () => {
    const client = createMockClient({ value: [sampleFile, sampleFolder] });

    const items = await listFiles(client, driveId);

    expect(items).toHaveLength(2);
    expect(client.api).toHaveBeenCalledWith(`/drives/${driveId}/root/children`);
  });

  it("should list files in specific folder", async () => {
    const client = createMockClient({ value: [sampleFile] });
    const folderId = "folder-456";

    const items = await listFiles(client, driveId, folderId);

    expect(items).toHaveLength(1);
    expect(client.api).toHaveBeenCalledWith(`/drives/${driveId}/items/${folderId}/children`);
  });

  it("should throw error when drive ID is empty", async () => {
    const client = createMockClient({ value: [] });

    await expect(listFiles(client, "")).rejects.toThrow("Drive ID is required");
  });

  it("should return empty array when folder is empty", async () => {
    const client = createMockClient({ value: [] });

    const items = await listFiles(client, driveId);

    expect(items).toHaveLength(0);
  });
});

describe("listFilesByPath", () => {
  it("should list files by path", async () => {
    const client = createMockClient({ value: [sampleFile] });

    const items = await listFilesByPath(client, driveId, "/Documents");

    expect(items).toHaveLength(1);
    expect(client.api).toHaveBeenCalledWith(`/drives/${driveId}/root:/Documents:/children`);
  });

  it("should normalize path without leading slash", async () => {
    const client = createMockClient({ value: [sampleFile] });

    await listFilesByPath(client, driveId, "Documents/Reports");

    expect(client.api).toHaveBeenCalledWith(`/drives/${driveId}/root:/Documents/Reports:/children`);
  });

  it("should throw error when path is empty", async () => {
    const client = createMockClient({ value: [] });

    await expect(listFilesByPath(client, driveId, "")).rejects.toThrow("Path is required");
  });
});

// =============================================================================
// GET OPERATIONS TESTS
// =============================================================================

describe("getFile", () => {
  it("should return file metadata by ID", async () => {
    const client = createMockClient(sampleFile);

    const item = await getFile(client, driveId, sampleFile.id);

    expect(item.name).toBe("report.docx");
    expect(client.api).toHaveBeenCalledWith(`/drives/${driveId}/items/${sampleFile.id}`);
  });

  it("should throw error when item ID is empty", async () => {
    const client = createMockClient(sampleFile);

    await expect(getFile(client, driveId, "")).rejects.toThrow("Item ID is required");
  });
});

describe("getFileByPath", () => {
  it("should return file metadata by path", async () => {
    const client = createMockClient(sampleFile);

    const item = await getFileByPath(client, driveId, "/Documents/report.docx");

    expect(item.name).toBe("report.docx");
    expect(client.api).toHaveBeenCalledWith(`/drives/${driveId}/root:/Documents/report.docx`);
  });

  it("should throw error when path is empty", async () => {
    const client = createMockClient(sampleFile);

    await expect(getFileByPath(client, driveId, "")).rejects.toThrow("Path is required");
  });
});

// =============================================================================
// DOWNLOAD OPERATIONS TESTS
// =============================================================================

describe("downloadFile", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should download file content using download URL", async () => {
    const client = createMockClient(sampleFile);
    const content = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(content.buffer),
    });

    const buffer = await downloadFile(client, driveId, sampleFile.id);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString()).toBe("Hello");
    expect(global.fetch).toHaveBeenCalledWith(sampleFile["@microsoft.graph.downloadUrl"]);
  });

  it("should throw error for folder download", async () => {
    const client = createMockClient(sampleFolder);

    await expect(downloadFile(client, driveId, sampleFolder.id)).rejects.toThrow(
      "Cannot download a folder",
    );
  });

  it("should handle download failure", async () => {
    const client = createMockClient(sampleFile);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(downloadFile(client, driveId, sampleFile.id)).rejects.toThrow(
      "Failed to download file",
    );
  });

  it("should throw error when drive ID is empty", async () => {
    const client = createMockClient(sampleFile);

    await expect(downloadFile(client, "", sampleFile.id)).rejects.toThrow("Drive ID is required");
  });
});

// =============================================================================
// UPLOAD OPERATIONS TESTS
// =============================================================================

describe("uploadFile", () => {
  it("should upload file to root folder", async () => {
    const client = createMockClient(sampleFile);
    const content = Buffer.from("Hello, World!");

    const item = await uploadFile(client, driveId, "/", "test.txt", content);

    expect(item.name).toBe("report.docx");
    expect(client.api).toHaveBeenCalledWith(`/drives/${driveId}/root:/test.txt:/content`);
  });

  it("should upload file to specific folder", async () => {
    const client = createMockClient(sampleFile);
    const content = Buffer.from("Hello, World!");

    await uploadFile(client, driveId, "/Documents", "test.txt", content);

    expect(client.api).toHaveBeenCalledWith(`/drives/${driveId}/root:/Documents/test.txt:/content`);
  });

  it("should upload string content", async () => {
    const client = createMockClient(sampleFile);

    await uploadFile(client, driveId, "/", "test.txt", "Hello, World!");

    expect(client.api).toHaveBeenCalled();
  });

  it("should throw error when filename is empty", async () => {
    const client = createMockClient(sampleFile);

    await expect(uploadFile(client, driveId, "/", "", Buffer.from("test"))).rejects.toThrow(
      "Filename is required",
    );
  });

  it("should handle conflict behavior option", async () => {
    const mockRequest = createMockRequest(sampleFile);
    const client: GraphClient = {
      api: vi.fn().mockReturnValue(mockRequest),
    };

    await uploadFile(client, driveId, "/", "test.txt", "content", { conflictBehavior: "rename" });

    expect(mockRequest.query).toHaveBeenCalledWith({
      "@microsoft.graph.conflictBehavior": "rename",
    });
  });
});

describe("updateFile", () => {
  it("should update existing file content", async () => {
    const client = createMockClient(sampleFile);
    const content = Buffer.from("Updated content");

    const item = await updateFile(client, driveId, sampleFile.id, content);

    expect(item.name).toBe("report.docx");
    expect(client.api).toHaveBeenCalledWith(`/drives/${driveId}/items/${sampleFile.id}/content`);
  });

  it("should update with string content", async () => {
    const client = createMockClient(sampleFile);

    await updateFile(client, driveId, sampleFile.id, "Updated content");

    expect(client.api).toHaveBeenCalled();
  });

  it("should throw error when item ID is empty", async () => {
    const client = createMockClient(sampleFile);

    await expect(updateFile(client, driveId, "", "content")).rejects.toThrow("Item ID is required");
  });
});

// =============================================================================
// DELETE OPERATIONS TESTS
// =============================================================================

describe("deleteFile", () => {
  it("should delete file by ID", async () => {
    const client = createMockClient(undefined);

    await deleteFile(client, driveId, sampleFile.id);

    expect(client.api).toHaveBeenCalledWith(`/drives/${driveId}/items/${sampleFile.id}`);
  });

  it("should throw error when item ID is empty", async () => {
    const client = createMockClient(undefined);

    await expect(deleteFile(client, driveId, "")).rejects.toThrow("Item ID is required");
  });
});

describe("deleteFileByPath", () => {
  it("should delete file by path", async () => {
    // Mock needs to return file on getFileByPath, then delete
    const mockRequest = createMockRequest(sampleFile);
    mockRequest.delete = vi.fn().mockResolvedValue(undefined);
    const client: GraphClient = {
      api: vi.fn().mockReturnValue(mockRequest),
    };

    await deleteFileByPath(client, driveId, "/Documents/report.docx");

    expect(mockRequest.delete).toHaveBeenCalled();
  });
});

// =============================================================================
// FOLDER OPERATIONS TESTS
// =============================================================================

describe("createFolder", () => {
  it("should create folder in root", async () => {
    const client = createMockClient(sampleFolder);

    const folder = await createFolder(client, driveId, "/", "NewFolder");

    expect(folder.name).toBe("Documents");
    expect(client.api).toHaveBeenCalledWith(`/drives/${driveId}/root/children`);
  });

  it("should create folder in specific path", async () => {
    const client = createMockClient(sampleFolder);

    await createFolder(client, driveId, "/Documents", "Reports");

    expect(client.api).toHaveBeenCalledWith(`/drives/${driveId}/root:/Documents:/children`);
  });

  it("should throw error when folder name is empty", async () => {
    const client = createMockClient(sampleFolder);

    await expect(createFolder(client, driveId, "/", "")).rejects.toThrow("Folder name is required");
  });
});

// =============================================================================
// COPY/MOVE OPERATIONS TESTS
// =============================================================================

describe("copyFile", () => {
  it("should copy file to destination", async () => {
    const mockRequest = createMockRequest(sampleFile);
    mockRequest.post = vi.fn().mockResolvedValue({ monitorUrl: "https://monitor.example.com" });
    const client: GraphClient = {
      api: vi.fn().mockReturnValue(mockRequest),
    };

    const monitorUrl = await copyFile(client, driveId, sampleFile.id, "/Archive");

    expect(monitorUrl).toBe("https://monitor.example.com");
  });

  it("should copy with new name", async () => {
    const mockRequest = createMockRequest(sampleFile);
    mockRequest.post = vi.fn().mockResolvedValue({ monitorUrl: "" });
    const client: GraphClient = {
      api: vi.fn().mockReturnValue(mockRequest),
    };

    await copyFile(client, driveId, sampleFile.id, "/Archive", "backup.docx");

    expect(mockRequest.post).toHaveBeenCalled();
  });
});

describe("moveFile", () => {
  it("should move file to destination", async () => {
    const movedFile = { ...sampleFile, parentReference: { driveId, path: "/drive/root:/Archive" } };
    const client = createMockClient(movedFile);

    const item = await moveFile(client, driveId, sampleFile.id, "/Archive");

    expect(item.parentReference?.path).toBe("/drive/root:/Archive");
  });

  it("should move with new name", async () => {
    const mockRequest = createMockRequest(sampleFile);
    const client: GraphClient = {
      api: vi.fn().mockReturnValue(mockRequest),
    };

    await moveFile(client, driveId, sampleFile.id, "/Archive", "renamed.docx");

    expect(mockRequest.patch).toHaveBeenCalled();
  });
});

// =============================================================================
// HELPER FUNCTION TESTS
// =============================================================================

describe("isFile", () => {
  it("should return true for file items", () => {
    expect(isFile(sampleFile)).toBe(true);
  });

  it("should return false for folder items", () => {
    expect(isFile(sampleFolder)).toBe(false);
  });
});

describe("isFolder", () => {
  it("should return true for folder items", () => {
    expect(isFolder(sampleFolder)).toBe(true);
  });

  it("should return false for file items", () => {
    expect(isFolder(sampleFile)).toBe(false);
  });
});

describe("getFileExtension", () => {
  it("should return file extension", () => {
    expect(getFileExtension(sampleFile)).toBe("docx");
  });

  it("should return undefined for folder", () => {
    expect(getFileExtension(sampleFolder)).toBeUndefined();
  });

  it("should return undefined for file without extension", () => {
    const noExtFile = { ...sampleFile, name: "README" };
    expect(getFileExtension(noExtFile)).toBeUndefined();
  });

  it("should handle multiple dots in filename", () => {
    const multiDotFile = { ...sampleFile, name: "report.2024.final.docx" };
    expect(getFileExtension(multiDotFile)).toBe("docx");
  });
});

describe("getMimeType", () => {
  it("should return MIME type for files", () => {
    expect(getMimeType(sampleFile)).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("should return undefined for folders", () => {
    expect(getMimeType(sampleFolder)).toBeUndefined();
  });
});
