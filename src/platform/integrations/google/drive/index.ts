/**
 * Google Drive Integration
 *
 * Provides file operations for Google Drive and Shared Drives via the Drive API v3.
 *
 * @example
 * ```typescript
 * import {
 *   GoogleDriveClient,
 *   SharedDrivesClient,
 *   GoogleDocsMimeTypes,
 *   ExportMimeTypes,
 * } from "@platform/integrations/google/drive";
 *
 * // Create client with OAuth2 credentials
 * const client = new GoogleDriveClient({ auth: oauth2Client });
 *
 * // List files in Drive
 * const { files } = await client.listFiles();
 *
 * // Upload a file
 * const uploaded = await client.uploadFile({
 *   name: "report.txt",
 *   content: Buffer.from("Hello, World!"),
 *   mimeType: "text/plain",
 * });
 *
 * // Search for files
 * const results = await client.searchByName("quarterly report");
 *
 * // Work with shared drives
 * const sharedClient = new SharedDrivesClient({ auth: oauth2Client });
 * const { drives } = await sharedClient.listSharedDrives();
 * ```
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Auth types
  GoogleAuthClient,
  GoogleServiceAccount,
  GoogleAuth,
  // File types
  DriveFile,
  DriveFileList,
  DriveUser,
  DrivePermission,
  // Shared drive types
  SharedDrive,
  SharedDriveList,
  SharedDriveCapabilities,
  SharedDriveRestrictions,
  // Operation options
  ListFilesOptions,
  UploadFileOptions,
  CreateFolderOptions,
  SharedDriveFilesOptions,
  // Error types
  GoogleDriveApiError,
} from "./types.js";

// Exported values (error class, constants)
export { GoogleDriveError, GoogleDocsMimeTypes, ExportMimeTypes } from "./types.js";

// =============================================================================
// CLIENTS
// =============================================================================

// Main Drive client
export {
  GoogleDriveClient,
  type DriveClientOptions,
  // Helper functions
  isFolder,
  isGoogleDocsType,
  getFileExtension,
  buildQuery,
} from "./client.js";

// Shared Drives client
export { SharedDrivesClient, type SharedDrivesClientOptions } from "./shared-drives.js";
