/**
 * SharePoint & OneDrive Integration
 *
 * Provides file operations for SharePoint sites and OneDrive via Microsoft Graph API.
 *
 * @example
 * ```typescript
 * import {
 *   listSites,
 *   listFiles,
 *   uploadFile,
 *   searchFiles,
 * } from "@platform/integrations/microsoft/sharepoint";
 *
 * // List all sites
 * const sites = await listSites(graphClient);
 *
 * // Browse files in a drive
 * const files = await listFiles(graphClient, driveId);
 *
 * // Upload a file
 * const uploaded = await uploadFile(graphClient, driveId, "/Documents", "report.txt", content);
 *
 * // Search across sites
 * const results = await searchFiles(graphClient, "quarterly report");
 * ```
 */

// Types
export type {
  // Graph client
  GraphClient,
  GraphRequest,
  // Site types
  Site,
  SiteListResponse,
  // Drive types
  Drive,
  DriveQuota,
  DriveListResponse,
  // Drive item types
  DriveItem,
  DriveItemListResponse,
  FileInfo,
  FolderInfo,
  ItemReference,
  IdentitySet,
  // Search types
  SearchResult,
  SearchOptions,
  SearchResponse,
  // Upload types
  UploadOptions,
  UploadSession,
  // Error types
  GraphError,
} from "./types.js";

export { SharePointError } from "./types.js";

// Site operations
export {
  listSites,
  getSite,
  getSiteByPath,
  getRootSite,
  searchSites,
  listDrives,
  getDrive,
  getDefaultDrive,
  getMyDrive,
  // Helper functions
  isCompoundSiteId,
  parseCompoundSiteId,
  buildCompoundSiteId,
} from "./sites.js";

// File operations
export {
  // List operations
  listFiles,
  listFilesByPath,
  // Get operations
  getFile,
  getFileByPath,
  // Download operations
  downloadFile,
  downloadFileByPath,
  // Upload operations
  uploadFile,
  updateFile,
  // Delete operations
  deleteFile,
  deleteFileByPath,
  // Folder operations
  createFolder,
  // Copy/Move operations
  copyFile,
  moveFile,
  // Helper functions
  isFile,
  isFolder,
  getFileExtension,
  getMimeType,
} from "./files.js";

// Search operations
export {
  searchFiles,
  searchInSite,
  searchInDrive,
  getRecentFiles,
  getSharedWithMe,
  // Helper functions
  buildSearchQuery,
  extractFileTypes,
} from "./search.js";
