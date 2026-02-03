/**
 * Google Drive Client
 *
 * Provides file operations for Google Drive via the Drive API v3.
 * @see https://developers.google.com/drive/api/reference/rest/v3
 */

import { google, type drive_v3 } from "googleapis";
import type {
  GoogleAuth,
  DriveFile,
  DriveFileList,
  ListFilesOptions,
  UploadFileOptions,
  CreateFolderOptions,
} from "./types.js";
import { GoogleDriveError, GoogleDocsMimeTypes } from "./types.js";

// =============================================================================
// CLIENT OPTIONS
// =============================================================================

/**
 * Options for creating a Google Drive client
 */
export interface DriveClientOptions {
  /** Google OAuth2 client or Service Account */
  auth: GoogleAuth;
}

// =============================================================================
// GOOGLE DRIVE CLIENT
// =============================================================================

/**
 * Client for interacting with Google Drive API
 *
 * @example
 * ```typescript
 * import { GoogleDriveClient } from "@platform/integrations/google/drive";
 *
 * const client = new GoogleDriveClient({ auth: oauth2Client });
 *
 * // List files
 * const { files } = await client.listFiles();
 *
 * // Upload a file
 * const file = await client.uploadFile({
 *   name: "report.txt",
 *   content: Buffer.from("Hello, World!"),
 *   mimeType: "text/plain",
 * });
 * ```
 */
export class GoogleDriveClient {
  private drive: drive_v3.Drive;

  constructor(options: DriveClientOptions) {
    if (!options.auth) {
      throw new GoogleDriveError("Auth client is required", "InvalidArgument");
    }

    this.drive = google.drive({
      version: "v3",
      auth: options.auth,
    });
  }

  // ===========================================================================
  // LIST OPERATIONS
  // ===========================================================================

  /**
   * List files in Drive or a specific folder
   *
   * @param options - Listing options
   * @returns Paginated list of files
   *
   * @example
   * ```typescript
   * // List all files in root
   * const { files } = await client.listFiles();
   *
   * // List files in a folder
   * const { files, nextPageToken } = await client.listFiles({
   *   folderId: "folder-id",
   *   pageSize: 50,
   * });
   *
   * // Search for files
   * const { files } = await client.listFiles({
   *   query: "name contains 'report'",
   * });
   * ```
   */
  async listFiles(options: ListFilesOptions = {}): Promise<DriveFileList> {
    const { folderId, query, pageSize = 100, pageToken, orderBy } = options;

    // Build query string
    let q = "trashed = false";

    if (folderId) {
      q += ` and '${folderId}' in parents`;
    }

    if (query) {
      q += ` and (${query})`;
    }

    const response = await this.drive.files.list({
      q,
      pageSize: Math.min(pageSize, 1000),
      pageToken,
      orderBy: orderBy ?? "modifiedTime desc",
      fields:
        "nextPageToken, incompleteSearch, files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, description, starred, trashed, md5Checksum, fileExtension, iconLink, thumbnailLink, driveId)",
      supportsAllDrives: options.supportsAllDrives ?? true,
      includeItemsFromAllDrives: options.includeItemsFromAllDrives ?? true,
    });

    const files = (response.data.files ?? []).map(mapDriveFile);

    return {
      files,
      nextPageToken: response.data.nextPageToken ?? undefined,
      incompleteSearch: response.data.incompleteSearch ?? undefined,
    };
  }

  /**
   * List all files in a folder, handling pagination automatically
   *
   * @param folderId - Folder ID (or undefined for root)
   * @param maxResults - Maximum number of files to return (default: all)
   * @returns Array of all files
   */
  async listAllFiles(folderId?: string, maxResults?: number): Promise<DriveFile[]> {
    const allFiles: DriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const result = await this.listFiles({
        folderId,
        pageToken,
        pageSize: Math.min(1000, maxResults ? maxResults - allFiles.length : 1000),
      });

      allFiles.push(...result.files);
      pageToken = result.nextPageToken;

      if (maxResults && allFiles.length >= maxResults) {
        break;
      }
    } while (pageToken);

    return maxResults ? allFiles.slice(0, maxResults) : allFiles;
  }

  // ===========================================================================
  // GET OPERATIONS
  // ===========================================================================

  /**
   * Get file metadata by ID
   *
   * @param fileId - The unique identifier of the file
   * @returns File metadata
   *
   * @example
   * ```typescript
   * const file = await client.getFile("file-id");
   * console.log(`${file.name}: ${file.size} bytes`);
   * ```
   */
  async getFile(fileId: string): Promise<DriveFile> {
    if (!fileId) {
      throw new GoogleDriveError("File ID is required", "InvalidArgument");
    }

    const response = await this.drive.files.get({
      fileId,
      fields:
        "id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, description, starred, trashed, lastModifyingUser, owners, md5Checksum, fileExtension, originalFilename, iconLink, thumbnailLink, viewersCanCopyContent, writersCanShare, permissions, driveId",
      supportsAllDrives: true,
    });

    return mapDriveFile(response.data);
  }

  // ===========================================================================
  // DOWNLOAD OPERATIONS
  // ===========================================================================

  /**
   * Download file content as a Buffer
   *
   * Note: For Google Docs (Docs, Sheets, Slides), use `exportFile` instead.
   *
   * @param fileId - The unique identifier of the file
   * @returns File content as Buffer
   *
   * @example
   * ```typescript
   * const content = await client.downloadFile("file-id");
   * await fs.writeFile("local-file.txt", content);
   * ```
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    if (!fileId) {
      throw new GoogleDriveError("File ID is required", "InvalidArgument");
    }

    // First check if it's a folder or Google Workspace file (which requires export)
    const file = await this.getFile(fileId);

    // Check for folder first (folders are technically Google Docs types)
    if (file.mimeType === GoogleDocsMimeTypes.FOLDER) {
      throw new GoogleDriveError("Cannot download a folder", "InvalidOperation");
    }

    if (isGoogleDocsFile(file.mimeType)) {
      throw new GoogleDriveError(
        `Cannot download Google Docs file directly. Use exportFile() with a target MIME type. File MIME type: ${file.mimeType}`,
        "InvalidOperation",
      );
    }

    const response = await this.drive.files.get(
      {
        fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      {
        responseType: "arraybuffer",
      },
    );

    return Buffer.from(response.data as ArrayBuffer);
  }

  /**
   * Export a Google Docs file to a different format
   *
   * @param fileId - The unique identifier of the file
   * @param mimeType - Target MIME type for export
   * @returns Exported content as Buffer
   *
   * @example
   * ```typescript
   * import { ExportMimeTypes } from "@platform/integrations/google/drive";
   *
   * // Export Google Doc as PDF
   * const pdf = await client.exportFile("doc-id", ExportMimeTypes.PDF);
   *
   * // Export Google Sheet as Excel
   * const xlsx = await client.exportFile("sheet-id", ExportMimeTypes.XLSX);
   * ```
   */
  async exportFile(fileId: string, mimeType: string): Promise<Buffer> {
    if (!fileId) {
      throw new GoogleDriveError("File ID is required", "InvalidArgument");
    }
    if (!mimeType) {
      throw new GoogleDriveError("MIME type is required for export", "InvalidArgument");
    }

    const response = await this.drive.files.export(
      {
        fileId,
        mimeType,
      },
      {
        responseType: "arraybuffer",
      },
    );

    return Buffer.from(response.data as ArrayBuffer);
  }

  // ===========================================================================
  // UPLOAD OPERATIONS
  // ===========================================================================

  /**
   * Upload a new file to Drive
   *
   * @param options - Upload options
   * @returns Created file metadata
   *
   * @example
   * ```typescript
   * const file = await client.uploadFile({
   *   name: "report.txt",
   *   content: Buffer.from("Hello, World!"),
   *   mimeType: "text/plain",
   *   folderId: "parent-folder-id",
   * });
   * console.log(`Uploaded: ${file.webViewLink}`);
   * ```
   */
  async uploadFile(options: UploadFileOptions): Promise<DriveFile> {
    if (!options.name) {
      throw new GoogleDriveError("File name is required", "InvalidArgument");
    }
    if (!options.content) {
      throw new GoogleDriveError("File content is required", "InvalidArgument");
    }
    if (!options.mimeType) {
      throw new GoogleDriveError("MIME type is required", "InvalidArgument");
    }

    const { name, content, mimeType, folderId, description, keepRevisionForever } = options;

    const fileMetadata: drive_v3.Schema$File = {
      name,
      description,
    };

    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType,
        body: bufferToReadable(content),
      },
      fields:
        "id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, description, md5Checksum",
      keepRevisionForever,
      supportsAllDrives: options.supportsAllDrives ?? true,
    });

    return mapDriveFile(response.data);
  }

  /**
   * Update an existing file's content
   *
   * @param fileId - The unique identifier of the file to update
   * @param content - New file content as Buffer
   * @param mimeType - Optional new MIME type
   * @returns Updated file metadata
   *
   * @example
   * ```typescript
   * const updated = await client.updateFile(
   *   "file-id",
   *   Buffer.from("Updated content"),
   *   "text/plain"
   * );
   * ```
   */
  async updateFile(fileId: string, content: Buffer, mimeType?: string): Promise<DriveFile> {
    if (!fileId) {
      throw new GoogleDriveError("File ID is required", "InvalidArgument");
    }
    if (!content) {
      throw new GoogleDriveError("File content is required", "InvalidArgument");
    }

    // Get existing file info if mimeType not provided
    const existingFile = mimeType ? undefined : await this.getFile(fileId);
    const actualMimeType = mimeType ?? existingFile?.mimeType ?? "application/octet-stream";

    const response = await this.drive.files.update({
      fileId,
      media: {
        mimeType: actualMimeType,
        body: bufferToReadable(content),
      },
      fields:
        "id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, description, md5Checksum",
      supportsAllDrives: true,
    });

    return mapDriveFile(response.data);
  }

  // ===========================================================================
  // DELETE OPERATIONS
  // ===========================================================================

  /**
   * Delete a file (move to trash or permanently delete)
   *
   * @param fileId - The unique identifier of the file to delete
   * @param permanent - If true, permanently delete; otherwise move to trash
   *
   * @example
   * ```typescript
   * // Move to trash
   * await client.deleteFile("file-id");
   *
   * // Permanently delete
   * await client.deleteFile("file-id", true);
   * ```
   */
  async deleteFile(fileId: string, permanent = false): Promise<void> {
    if (!fileId) {
      throw new GoogleDriveError("File ID is required", "InvalidArgument");
    }

    if (permanent) {
      await this.drive.files.delete({
        fileId,
        supportsAllDrives: true,
      });
    } else {
      await this.drive.files.update({
        fileId,
        requestBody: {
          trashed: true,
        },
        supportsAllDrives: true,
      });
    }
  }

  /**
   * Restore a file from trash
   *
   * @param fileId - The unique identifier of the file to restore
   * @returns Restored file metadata
   */
  async restoreFile(fileId: string): Promise<DriveFile> {
    if (!fileId) {
      throw new GoogleDriveError("File ID is required", "InvalidArgument");
    }

    const response = await this.drive.files.update({
      fileId,
      requestBody: {
        trashed: false,
      },
      fields:
        "id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, description",
      supportsAllDrives: true,
    });

    return mapDriveFile(response.data);
  }

  // ===========================================================================
  // FOLDER OPERATIONS
  // ===========================================================================

  /**
   * Create a new folder
   *
   * @param name - Name for the folder
   * @param parentId - Optional parent folder ID
   * @returns Created folder metadata
   *
   * @example
   * ```typescript
   * // Create folder in root
   * const folder = await client.createFolder("My Folder");
   *
   * // Create folder in specific parent
   * const subfolder = await client.createFolder("Subfolder", "parent-id");
   * ```
   */
  async createFolder(name: string, parentId?: string): Promise<DriveFile> {
    if (!name) {
      throw new GoogleDriveError("Folder name is required", "InvalidArgument");
    }

    const fileMetadata: drive_v3.Schema$File = {
      name,
      mimeType: GoogleDocsMimeTypes.FOLDER,
    };

    if (parentId) {
      fileMetadata.parents = [parentId];
    }

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      fields: "id, name, mimeType, createdTime, modifiedTime, parents, webViewLink",
      supportsAllDrives: true,
    });

    return mapDriveFile(response.data);
  }

  // ===========================================================================
  // COPY/MOVE OPERATIONS
  // ===========================================================================

  /**
   * Copy a file to a new location
   *
   * @param fileId - The file to copy
   * @param name - Optional new name for the copy
   * @param folderId - Optional destination folder ID
   * @returns Created copy metadata
   *
   * @example
   * ```typescript
   * const copy = await client.copyFile("file-id", "Copy of File", "folder-id");
   * ```
   */
  async copyFile(fileId: string, name?: string, folderId?: string): Promise<DriveFile> {
    if (!fileId) {
      throw new GoogleDriveError("File ID is required", "InvalidArgument");
    }

    const requestBody: drive_v3.Schema$File = {};

    if (name) {
      requestBody.name = name;
    }
    if (folderId) {
      requestBody.parents = [folderId];
    }

    const response = await this.drive.files.copy({
      fileId,
      requestBody,
      fields:
        "id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, description",
      supportsAllDrives: true,
    });

    return mapDriveFile(response.data);
  }

  /**
   * Move a file to a different folder
   *
   * @param fileId - The file to move
   * @param newParentId - Destination folder ID
   * @param removeFromCurrentParent - Whether to remove from current parent (default: true)
   * @returns Updated file metadata
   *
   * @example
   * ```typescript
   * const moved = await client.moveFile("file-id", "new-folder-id");
   * ```
   */
  async moveFile(
    fileId: string,
    newParentId: string,
    removeFromCurrentParent = true,
  ): Promise<DriveFile> {
    if (!fileId) {
      throw new GoogleDriveError("File ID is required", "InvalidArgument");
    }
    if (!newParentId) {
      throw new GoogleDriveError("New parent ID is required", "InvalidArgument");
    }

    // Get current parents
    const file = await this.getFile(fileId);
    const previousParents = file.parents?.join(",") ?? "";

    const response = await this.drive.files.update({
      fileId,
      addParents: newParentId,
      removeParents: removeFromCurrentParent ? previousParents : undefined,
      fields:
        "id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, description",
      supportsAllDrives: true,
    });

    return mapDriveFile(response.data);
  }

  /**
   * Rename a file
   *
   * @param fileId - The file to rename
   * @param newName - New name for the file
   * @returns Updated file metadata
   */
  async renameFile(fileId: string, newName: string): Promise<DriveFile> {
    if (!fileId) {
      throw new GoogleDriveError("File ID is required", "InvalidArgument");
    }
    if (!newName) {
      throw new GoogleDriveError("New name is required", "InvalidArgument");
    }

    const response = await this.drive.files.update({
      fileId,
      requestBody: {
        name: newName,
      },
      fields:
        "id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, description",
      supportsAllDrives: true,
    });

    return mapDriveFile(response.data);
  }

  // ===========================================================================
  // SEARCH OPERATIONS
  // ===========================================================================

  /**
   * Search for files by name
   *
   * @param searchTerm - Term to search for in file names
   * @param options - Additional listing options
   * @returns Search results
   *
   * @example
   * ```typescript
   * const results = await client.searchByName("quarterly report");
   * ```
   */
  async searchByName(searchTerm: string, options: ListFilesOptions = {}): Promise<DriveFileList> {
    if (!searchTerm) {
      throw new GoogleDriveError("Search term is required", "InvalidArgument");
    }

    const escapedTerm = searchTerm.replace(/'/g, "\\'");
    const query = `name contains '${escapedTerm}'`;

    return this.listFiles({
      ...options,
      query: options.query ? `(${options.query}) and (${query})` : query,
    });
  }

  /**
   * Search for files by full-text content
   *
   * @param searchTerm - Term to search for in file contents
   * @param options - Additional listing options
   * @returns Search results
   */
  async searchByContent(
    searchTerm: string,
    options: ListFilesOptions = {},
  ): Promise<DriveFileList> {
    if (!searchTerm) {
      throw new GoogleDriveError("Search term is required", "InvalidArgument");
    }

    const escapedTerm = searchTerm.replace(/'/g, "\\'");
    const query = `fullText contains '${escapedTerm}'`;

    return this.listFiles({
      ...options,
      query: options.query ? `(${options.query}) and (${query})` : query,
    });
  }

  /**
   * Get files by MIME type
   *
   * @param mimeType - MIME type to filter by
   * @param options - Additional listing options
   * @returns Matching files
   */
  async getFilesByMimeType(
    mimeType: string,
    options: ListFilesOptions = {},
  ): Promise<DriveFileList> {
    if (!mimeType) {
      throw new GoogleDriveError("MIME type is required", "InvalidArgument");
    }

    const query = `mimeType = '${mimeType}'`;

    return this.listFiles({
      ...options,
      query: options.query ? `(${options.query}) and (${query})` : query,
    });
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Get the raw Drive API instance for advanced operations
   */
  getRawClient(): drive_v3.Drive {
    return this.drive;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Map Google Drive API response to our DriveFile interface
 */
function mapDriveFile(data: drive_v3.Schema$File): DriveFile {
  return {
    id: data.id ?? "",
    name: data.name ?? "",
    mimeType: data.mimeType ?? "",
    size: data.size ? parseInt(data.size, 10) : undefined,
    createdTime: data.createdTime ?? "",
    modifiedTime: data.modifiedTime ?? "",
    parents: data.parents ?? undefined,
    webViewLink: data.webViewLink ?? undefined,
    webContentLink: data.webContentLink ?? undefined,
    description: data.description ?? undefined,
    starred: data.starred ?? undefined,
    trashed: data.trashed ?? undefined,
    lastModifyingUser: data.lastModifyingUser
      ? {
          displayName: data.lastModifyingUser.displayName ?? undefined,
          emailAddress: data.lastModifyingUser.emailAddress ?? undefined,
          photoLink: data.lastModifyingUser.photoLink ?? undefined,
          me: data.lastModifyingUser.me ?? undefined,
          permissionId: data.lastModifyingUser.permissionId ?? undefined,
        }
      : undefined,
    owners: data.owners?.map((o) => ({
      displayName: o.displayName ?? undefined,
      emailAddress: o.emailAddress ?? undefined,
      photoLink: o.photoLink ?? undefined,
      me: o.me ?? undefined,
      permissionId: o.permissionId ?? undefined,
    })),
    md5Checksum: data.md5Checksum ?? undefined,
    fileExtension: data.fileExtension ?? undefined,
    originalFilename: data.originalFilename ?? undefined,
    iconLink: data.iconLink ?? undefined,
    thumbnailLink: data.thumbnailLink ?? undefined,
    viewersCanCopyContent: data.viewersCanCopyContent ?? undefined,
    writersCanShare: data.writersCanShare ?? undefined,
    permissions: data.permissions?.map((p) => ({
      id: p.id ?? undefined,
      type: p.type as "user" | "group" | "domain" | "anyone",
      role: p.role as "owner" | "organizer" | "fileOrganizer" | "writer" | "commenter" | "reader",
      emailAddress: p.emailAddress ?? undefined,
      domain: p.domain ?? undefined,
      allowFileDiscovery: p.allowFileDiscovery ?? undefined,
      displayName: p.displayName ?? undefined,
      expirationTime: p.expirationTime ?? undefined,
    })),
    driveId: data.driveId ?? undefined,
  };
}

/**
 * Check if a MIME type is a Google Docs type that requires export
 */
function isGoogleDocsFile(mimeType: string): boolean {
  return mimeType.startsWith("application/vnd.google-apps.");
}

/**
 * Convert a Buffer to a readable stream for upload
 */
function bufferToReadable(buffer: Buffer): NodeJS.ReadableStream {
  const { Readable } = require("stream");
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

// =============================================================================
// STANDALONE HELPER FUNCTIONS (EXPORTED)
// =============================================================================

/**
 * Check if a file is a folder
 */
export function isFolder(file: DriveFile): boolean {
  return file.mimeType === GoogleDocsMimeTypes.FOLDER;
}

/**
 * Check if a file is a Google Docs file
 */
export function isGoogleDocsType(file: DriveFile): boolean {
  return isGoogleDocsFile(file.mimeType);
}

/**
 * Get the file extension from a filename
 */
export function getFileExtension(file: DriveFile): string | undefined {
  if (file.fileExtension) {
    return file.fileExtension.toLowerCase();
  }
  if (!file.name) return undefined;
  const lastDot = file.name.lastIndexOf(".");
  if (lastDot === -1 || lastDot === file.name.length - 1) return undefined;
  return file.name.slice(lastDot + 1).toLowerCase();
}

/**
 * Build a Drive query string for common filters
 */
export function buildQuery(options: {
  mimeType?: string;
  mimeTypes?: string[];
  nameContains?: string;
  fullTextContains?: string;
  parentId?: string;
  starred?: boolean;
  trashed?: boolean;
  ownedByMe?: boolean;
  sharedWithMe?: boolean;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
}): string {
  const parts: string[] = [];

  if (options.mimeType) {
    parts.push(`mimeType = '${options.mimeType}'`);
  }

  if (options.mimeTypes && options.mimeTypes.length > 0) {
    const mimeTypeConditions = options.mimeTypes.map((mt) => `mimeType = '${mt}'`).join(" or ");
    parts.push(`(${mimeTypeConditions})`);
  }

  if (options.nameContains) {
    parts.push(`name contains '${options.nameContains.replace(/'/g, "\\'")}'`);
  }

  if (options.fullTextContains) {
    parts.push(`fullText contains '${options.fullTextContains.replace(/'/g, "\\'")}'`);
  }

  if (options.parentId) {
    parts.push(`'${options.parentId}' in parents`);
  }

  if (options.starred !== undefined) {
    parts.push(`starred = ${options.starred}`);
  }

  if (options.trashed !== undefined) {
    parts.push(`trashed = ${options.trashed}`);
  }

  if (options.ownedByMe !== undefined) {
    parts.push(`'me' in owners`);
  }

  if (options.sharedWithMe !== undefined) {
    parts.push(`sharedWithMe = ${options.sharedWithMe}`);
  }

  if (options.modifiedAfter) {
    parts.push(`modifiedTime > '${options.modifiedAfter.toISOString()}'`);
  }

  if (options.modifiedBefore) {
    parts.push(`modifiedTime < '${options.modifiedBefore.toISOString()}'`);
  }

  return parts.join(" and ");
}
