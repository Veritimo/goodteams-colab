/**
 * SharePoint & OneDrive File Operations
 *
 * Functions for file CRUD operations via MS Graph API.
 * @see https://learn.microsoft.com/en-us/graph/api/resources/driveitem
 */

import type {
  DriveItem,
  DriveItemListResponse,
  GraphClient,
  SharePointError,
  UploadOptions,
  UploadSession,
} from "./types.js";

// Size threshold for using upload sessions (4MB)
const SIMPLE_UPLOAD_MAX_SIZE = 4 * 1024 * 1024;

// =============================================================================
// LIST OPERATIONS
// =============================================================================

/**
 * List files and folders in a drive, optionally within a specific folder
 *
 * @param client - Microsoft Graph client
 * @param driveId - The unique identifier of the drive
 * @param folderId - Optional folder ID to list contents of (default: root)
 * @returns Array of drive items
 *
 * @example
 * ```typescript
 * // List root contents
 * const items = await listFiles(graphClient, driveId);
 *
 * // List folder contents
 * const folderItems = await listFiles(graphClient, driveId, folderId);
 * ```
 */
export async function listFiles(
  client: GraphClient,
  driveId: string,
  folderId?: string,
): Promise<DriveItem[]> {
  if (!driveId) {
    throw createSharePointError("Drive ID is required", "InvalidArgument");
  }

  const basePath = folderId
    ? `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderId)}/children`
    : `/drives/${encodeURIComponent(driveId)}/root/children`;

  const response = await client
    .api(basePath)
    .select([
      "id",
      "name",
      "size",
      "webUrl",
      "createdDateTime",
      "lastModifiedDateTime",
      "createdBy",
      "lastModifiedBy",
      "parentReference",
      "file",
      "folder",
      "@microsoft.graph.downloadUrl",
    ])
    .get<DriveItemListResponse>();

  return response.value ?? [];
}

/**
 * List files and folders at a specific path
 *
 * @param client - Microsoft Graph client
 * @param driveId - The unique identifier of the drive
 * @param path - The folder path (e.g., "/Documents/Reports")
 * @returns Array of drive items
 *
 * @example
 * ```typescript
 * const items = await listFilesByPath(graphClient, driveId, "/Documents/2024");
 * ```
 */
export async function listFilesByPath(
  client: GraphClient,
  driveId: string,
  path: string,
): Promise<DriveItem[]> {
  if (!driveId) {
    throw createSharePointError("Drive ID is required", "InvalidArgument");
  }
  if (!path) {
    throw createSharePointError("Path is required", "InvalidArgument");
  }

  // Normalize path: ensure it starts with / and doesn't end with /
  const normalizedPath = normalizePath(path);

  const apiPath = `/drives/${encodeURIComponent(driveId)}/root:${normalizedPath}:/children`;

  const response = await client
    .api(apiPath)
    .select([
      "id",
      "name",
      "size",
      "webUrl",
      "createdDateTime",
      "lastModifiedDateTime",
      "createdBy",
      "lastModifiedBy",
      "parentReference",
      "file",
      "folder",
      "@microsoft.graph.downloadUrl",
    ])
    .get<DriveItemListResponse>();

  return response.value ?? [];
}

// =============================================================================
// GET OPERATIONS
// =============================================================================

/**
 * Get file or folder metadata by item ID
 *
 * @param client - Microsoft Graph client
 * @param driveId - The unique identifier of the drive
 * @param itemId - The unique identifier of the item
 * @returns Drive item metadata
 *
 * @example
 * ```typescript
 * const file = await getFile(graphClient, driveId, itemId);
 * console.log(`${file.name}: ${file.size} bytes`);
 * ```
 */
export async function getFile(
  client: GraphClient,
  driveId: string,
  itemId: string,
): Promise<DriveItem> {
  if (!driveId) {
    throw createSharePointError("Drive ID is required", "InvalidArgument");
  }
  if (!itemId) {
    throw createSharePointError("Item ID is required", "InvalidArgument");
  }

  const item = await client
    .api(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`)
    .select([
      "id",
      "name",
      "size",
      "webUrl",
      "createdDateTime",
      "lastModifiedDateTime",
      "createdBy",
      "lastModifiedBy",
      "parentReference",
      "file",
      "folder",
      "description",
      "@microsoft.graph.downloadUrl",
      "eTag",
      "cTag",
    ])
    .get<DriveItem>();

  return item;
}

/**
 * Get file or folder metadata by path
 *
 * @param client - Microsoft Graph client
 * @param driveId - The unique identifier of the drive
 * @param path - The item path (e.g., "/Documents/report.docx")
 * @returns Drive item metadata
 *
 * @example
 * ```typescript
 * const file = await getFileByPath(graphClient, driveId, "/Documents/report.docx");
 * ```
 */
export async function getFileByPath(
  client: GraphClient,
  driveId: string,
  path: string,
): Promise<DriveItem> {
  if (!driveId) {
    throw createSharePointError("Drive ID is required", "InvalidArgument");
  }
  if (!path) {
    throw createSharePointError("Path is required", "InvalidArgument");
  }

  const normalizedPath = normalizePath(path);

  const item = await client
    .api(`/drives/${encodeURIComponent(driveId)}/root:${normalizedPath}`)
    .select([
      "id",
      "name",
      "size",
      "webUrl",
      "createdDateTime",
      "lastModifiedDateTime",
      "createdBy",
      "lastModifiedBy",
      "parentReference",
      "file",
      "folder",
      "description",
      "@microsoft.graph.downloadUrl",
      "eTag",
      "cTag",
    ])
    .get<DriveItem>();

  return item;
}

// =============================================================================
// DOWNLOAD OPERATIONS
// =============================================================================

/**
 * Download file content as a Buffer
 *
 * @param client - Microsoft Graph client
 * @param driveId - The unique identifier of the drive
 * @param itemId - The unique identifier of the item
 * @returns File content as Buffer
 *
 * @example
 * ```typescript
 * const content = await downloadFile(graphClient, driveId, itemId);
 * await fs.writeFile("local-file.docx", content);
 * ```
 */
export async function downloadFile(
  client: GraphClient,
  driveId: string,
  itemId: string,
): Promise<Buffer> {
  if (!driveId) {
    throw createSharePointError("Drive ID is required", "InvalidArgument");
  }
  if (!itemId) {
    throw createSharePointError("Item ID is required", "InvalidArgument");
  }

  // Get the download URL from the item metadata
  const item = await getFile(client, driveId, itemId);

  // Check if it's a folder
  if (item.folder) {
    throw createSharePointError("Cannot download a folder", "InvalidOperation");
  }

  const downloadUrl = item["@microsoft.graph.downloadUrl"];

  if (!downloadUrl) {
    // Fall back to content endpoint
    const response = await client
      .api(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`)
      .get<ArrayBuffer>();

    return Buffer.from(response);
  }

  // Fetch from the direct download URL
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw createSharePointError(
      `Failed to download file: ${response.statusText}`,
      "DownloadFailed",
      response.status,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Download file content by path
 *
 * @param client - Microsoft Graph client
 * @param driveId - The unique identifier of the drive
 * @param path - The item path
 * @returns File content as Buffer
 */
export async function downloadFileByPath(
  client: GraphClient,
  driveId: string,
  path: string,
): Promise<Buffer> {
  const item = await getFileByPath(client, driveId, path);
  return downloadFile(client, driveId, item.id);
}

// =============================================================================
// UPLOAD OPERATIONS
// =============================================================================

/**
 * Upload a new file to a drive
 *
 * For files larger than 4MB, use resumable upload session.
 *
 * @param client - Microsoft Graph client
 * @param driveId - The unique identifier of the drive
 * @param parentPath - Parent folder path (e.g., "/Documents" or "/" for root)
 * @param filename - Name for the new file
 * @param content - File content as Buffer or string
 * @param options - Upload options
 * @returns Created drive item
 *
 * @example
 * ```typescript
 * const content = Buffer.from("Hello, World!");
 * const item = await uploadFile(graphClient, driveId, "/Documents", "hello.txt", content);
 * console.log(`Uploaded: ${item.webUrl}`);
 * ```
 */
export async function uploadFile(
  client: GraphClient,
  driveId: string,
  parentPath: string,
  filename: string,
  content: Buffer | string,
  options: UploadOptions = {},
): Promise<DriveItem> {
  if (!driveId) {
    throw createSharePointError("Drive ID is required", "InvalidArgument");
  }
  if (!filename) {
    throw createSharePointError("Filename is required", "InvalidArgument");
  }

  const buffer = typeof content === "string" ? Buffer.from(content, "utf-8") : content;

  // Normalize paths
  const normalizedParent = normalizePath(parentPath || "/");
  const safeName = encodeURIComponent(filename);

  // Build the upload path
  const uploadPath =
    normalizedParent === "/"
      ? `/drives/${encodeURIComponent(driveId)}/root:/${safeName}:/content`
      : `/drives/${encodeURIComponent(driveId)}/root:${normalizedParent}/${safeName}:/content`;

  // For small files, use simple upload
  if (buffer.length <= SIMPLE_UPLOAD_MAX_SIZE) {
    // Set conflict behavior
    const conflictBehavior = options.conflictBehavior ?? "replace";

    const request = client
      .api(uploadPath)
      .query({ "@microsoft.graph.conflictBehavior": conflictBehavior });

    if (options.contentType) {
      request.header("Content-Type", options.contentType);
    } else {
      request.header("Content-Type", "application/octet-stream");
    }

    const item = await request.put<DriveItem>(buffer);
    return item;
  }

  // For large files, use upload session
  return uploadLargeFile(client, driveId, parentPath, filename, buffer, options);
}

/**
 * Upload a large file using resumable upload session
 */
async function uploadLargeFile(
  client: GraphClient,
  driveId: string,
  parentPath: string,
  filename: string,
  content: Buffer,
  options: UploadOptions = {},
): Promise<DriveItem> {
  // Create upload session
  const normalizedParent = normalizePath(parentPath || "/");
  const safeName = encodeURIComponent(filename);

  const sessionPath =
    normalizedParent === "/"
      ? `/drives/${encodeURIComponent(driveId)}/root:/${safeName}:/createUploadSession`
      : `/drives/${encodeURIComponent(driveId)}/root:${normalizedParent}/${safeName}:/createUploadSession`;

  const sessionBody = {
    item: {
      "@microsoft.graph.conflictBehavior": options.conflictBehavior ?? "replace",
      name: filename,
    },
  };

  const session = await client.api(sessionPath).post<UploadSession>(sessionBody);

  // Upload in chunks (10MB chunks)
  const chunkSize = 10 * 1024 * 1024;
  const totalSize = content.length;
  let offset = 0;

  while (offset < totalSize) {
    const end = Math.min(offset + chunkSize, totalSize);
    const chunk = content.subarray(offset, end);

    const response = await fetch(session.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": chunk.length.toString(),
        "Content-Range": `bytes ${offset}-${end - 1}/${totalSize}`,
      },
      body: new Uint8Array(chunk),
    });

    if (!response.ok) {
      throw createSharePointError(
        `Upload chunk failed: ${response.statusText}`,
        "UploadFailed",
        response.status,
      );
    }

    // Check if upload is complete (last chunk returns the item)
    if (end >= totalSize) {
      const result = await response.json();
      return result as DriveItem;
    }

    offset = end;
  }

  // This shouldn't happen, but satisfy TypeScript
  throw createSharePointError("Upload completed without returning item", "UploadFailed");
}

/**
 * Update an existing file's content
 *
 * @param client - Microsoft Graph client
 * @param driveId - The unique identifier of the drive
 * @param itemId - The unique identifier of the item to update
 * @param content - New file content as Buffer or string
 * @returns Updated drive item
 *
 * @example
 * ```typescript
 * const newContent = Buffer.from("Updated content");
 * const updated = await updateFile(graphClient, driveId, itemId, newContent);
 * ```
 */
export async function updateFile(
  client: GraphClient,
  driveId: string,
  itemId: string,
  content: Buffer | string,
): Promise<DriveItem> {
  if (!driveId) {
    throw createSharePointError("Drive ID is required", "InvalidArgument");
  }
  if (!itemId) {
    throw createSharePointError("Item ID is required", "InvalidArgument");
  }

  const buffer = typeof content === "string" ? Buffer.from(content, "utf-8") : content;

  const item = await client
    .api(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`)
    .header("Content-Type", "application/octet-stream")
    .put<DriveItem>(buffer);

  return item;
}

// =============================================================================
// DELETE OPERATIONS
// =============================================================================

/**
 * Delete a file or folder
 *
 * @param client - Microsoft Graph client
 * @param driveId - The unique identifier of the drive
 * @param itemId - The unique identifier of the item to delete
 *
 * @example
 * ```typescript
 * await deleteFile(graphClient, driveId, itemId);
 * console.log("File deleted");
 * ```
 */
export async function deleteFile(
  client: GraphClient,
  driveId: string,
  itemId: string,
): Promise<void> {
  if (!driveId) {
    throw createSharePointError("Drive ID is required", "InvalidArgument");
  }
  if (!itemId) {
    throw createSharePointError("Item ID is required", "InvalidArgument");
  }

  await client
    .api(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`)
    .delete();
}

/**
 * Delete a file or folder by path
 *
 * @param client - Microsoft Graph client
 * @param driveId - The unique identifier of the drive
 * @param path - The item path to delete
 */
export async function deleteFileByPath(
  client: GraphClient,
  driveId: string,
  path: string,
): Promise<void> {
  const item = await getFileByPath(client, driveId, path);
  await deleteFile(client, driveId, item.id);
}

// =============================================================================
// FOLDER OPERATIONS
// =============================================================================

/**
 * Create a new folder
 *
 * @param client - Microsoft Graph client
 * @param driveId - The unique identifier of the drive
 * @param parentPath - Parent folder path (e.g., "/Documents" or "/" for root)
 * @param name - Name for the new folder
 * @returns Created folder item
 *
 * @example
 * ```typescript
 * const folder = await createFolder(graphClient, driveId, "/Documents", "2024 Reports");
 * console.log(`Created: ${folder.webUrl}`);
 * ```
 */
export async function createFolder(
  client: GraphClient,
  driveId: string,
  parentPath: string,
  name: string,
): Promise<DriveItem> {
  if (!driveId) {
    throw createSharePointError("Drive ID is required", "InvalidArgument");
  }
  if (!name) {
    throw createSharePointError("Folder name is required", "InvalidArgument");
  }

  const normalizedParent = normalizePath(parentPath || "/");

  const apiPath =
    normalizedParent === "/"
      ? `/drives/${encodeURIComponent(driveId)}/root/children`
      : `/drives/${encodeURIComponent(driveId)}/root:${normalizedParent}:/children`;

  const folderData = {
    name,
    folder: {},
    "@microsoft.graph.conflictBehavior": "fail",
  };

  const item = await client.api(apiPath).post<DriveItem>(folderData);

  return item;
}

// =============================================================================
// COPY/MOVE OPERATIONS
// =============================================================================

/**
 * Copy a file or folder to a new location
 *
 * @param client - Microsoft Graph client
 * @param driveId - Source drive ID
 * @param itemId - Item to copy
 * @param destinationPath - Destination folder path
 * @param newName - Optional new name for the copy
 * @returns Monitor URL to track the copy operation
 *
 * @example
 * ```typescript
 * const monitorUrl = await copyFile(graphClient, driveId, itemId, "/Archive", "backup.docx");
 * ```
 */
export async function copyFile(
  client: GraphClient,
  driveId: string,
  itemId: string,
  destinationPath: string,
  newName?: string,
): Promise<string> {
  if (!driveId) {
    throw createSharePointError("Drive ID is required", "InvalidArgument");
  }
  if (!itemId) {
    throw createSharePointError("Item ID is required", "InvalidArgument");
  }

  // Get the item to get its name if no new name provided
  const item = await getFile(client, driveId, itemId);

  // Get the destination folder
  const normalizedDest = normalizePath(destinationPath || "/");
  let parentReference: { driveId: string; path?: string };

  if (normalizedDest === "/") {
    parentReference = { driveId, path: "/drive/root:" };
  } else {
    parentReference = { driveId, path: `/drive/root:${normalizedDest}` };
  }

  const copyBody = {
    parentReference,
    name: newName ?? item.name,
  };

  // Copy returns 202 Accepted with Location header for monitoring
  // The Graph SDK may not directly expose this, so we handle the async nature
  const response = await client
    .api(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/copy`)
    .post<{ monitorUrl?: string }>(copyBody);

  return response.monitorUrl ?? "";
}

/**
 * Move a file or folder to a new location
 *
 * @param client - Microsoft Graph client
 * @param driveId - Drive ID
 * @param itemId - Item to move
 * @param destinationPath - Destination folder path
 * @param newName - Optional new name
 * @returns Updated drive item
 *
 * @example
 * ```typescript
 * const moved = await moveFile(graphClient, driveId, itemId, "/Archive");
 * ```
 */
export async function moveFile(
  client: GraphClient,
  driveId: string,
  itemId: string,
  destinationPath: string,
  newName?: string,
): Promise<DriveItem> {
  if (!driveId) {
    throw createSharePointError("Drive ID is required", "InvalidArgument");
  }
  if (!itemId) {
    throw createSharePointError("Item ID is required", "InvalidArgument");
  }

  const normalizedDest = normalizePath(destinationPath || "/");
  let parentReference: { driveId: string; path?: string };

  if (normalizedDest === "/") {
    parentReference = { driveId, path: "/drive/root:" };
  } else {
    parentReference = { driveId, path: `/drive/root:${normalizedDest}` };
  }

  const updateBody: { parentReference: typeof parentReference; name?: string } = {
    parentReference,
  };

  if (newName) {
    updateBody.name = newName;
  }

  const item = await client
    .api(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`)
    .patch<DriveItem>(updateBody);

  return item;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize a path for use in Graph API calls
 */
function normalizePath(path: string): string {
  // Ensure path starts with /
  let normalized = path.startsWith("/") ? path : `/${path}`;

  // Remove trailing slash (unless it's just "/")
  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Create a SharePoint error with consistent formatting
 */
function createSharePointError(
  message: string,
  code: string,
  statusCode?: number,
): SharePointError {
  const error = new Error(message) as SharePointError;
  error.name = "SharePointError";
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

/**
 * Check if a drive item is a file
 */
export function isFile(item: DriveItem): boolean {
  return item.file !== undefined && item.folder === undefined;
}

/**
 * Check if a drive item is a folder
 */
export function isFolder(item: DriveItem): boolean {
  return item.folder !== undefined;
}

/**
 * Get the file extension from a drive item
 */
export function getFileExtension(item: DriveItem): string | undefined {
  if (!item.name) return undefined;
  const lastDot = item.name.lastIndexOf(".");
  if (lastDot === -1 || lastDot === item.name.length - 1) return undefined;
  return item.name.slice(lastDot + 1).toLowerCase();
}

/**
 * Get the MIME type from a drive item
 */
export function getMimeType(item: DriveItem): string | undefined {
  return item.file?.mimeType;
}
