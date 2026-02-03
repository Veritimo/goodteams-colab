/**
 * Google Drive Type Definitions
 *
 * Type definitions for Google Drive API resources.
 * @see https://developers.google.com/drive/api/reference/rest/v3
 */

import type { Auth } from "googleapis";

// =============================================================================
// AUTH TYPES
// =============================================================================

/**
 * Google OAuth2 client for user-delegated access
 */
export type GoogleAuthClient = Auth.OAuth2Client;

/**
 * Google Service Account for domain-wide delegation
 */
export type GoogleServiceAccount = Auth.JWT | Auth.GoogleAuth;

/**
 * Combined auth type that can be either OAuth2 or Service Account
 */
export type GoogleAuth = GoogleAuthClient | GoogleServiceAccount;

// =============================================================================
// DRIVE FILE TYPES
// =============================================================================

/**
 * Google Drive file resource
 * @see https://developers.google.com/drive/api/reference/rest/v3/files
 */
export interface DriveFile {
  /** The unique identifier of the file */
  id: string;
  /** The name of the file */
  name: string;
  /** The MIME type of the file */
  mimeType: string;
  /** The size of the file in bytes (not applicable to folders) */
  size?: number;
  /** The time the file was created */
  createdTime: string;
  /** The time the file was last modified */
  modifiedTime: string;
  /** The IDs of the parent folders */
  parents?: string[];
  /** A link for opening the file in a browser */
  webViewLink?: string;
  /** A short-lived link for downloading the file (only for non-Google Docs) */
  webContentLink?: string;
  /** Description of the file */
  description?: string;
  /** Whether the file has been starred */
  starred?: boolean;
  /** Whether the file has been trashed */
  trashed?: boolean;
  /** The last user to modify the file */
  lastModifyingUser?: DriveUser;
  /** The owner(s) of the file */
  owners?: DriveUser[];
  /** MD5 checksum (only for files, not Google Docs) */
  md5Checksum?: string;
  /** File extension */
  fileExtension?: string;
  /** Original filename (for uploaded files) */
  originalFilename?: string;
  /** Icon link */
  iconLink?: string;
  /** Thumbnail link */
  thumbnailLink?: string;
  /** Whether viewers can copy content */
  viewersCanCopyContent?: boolean;
  /** Whether writers can share */
  writersCanShare?: boolean;
  /** Permissions for the file */
  permissions?: DrivePermission[];
  /** Shared drive ID if file is in a shared drive */
  driveId?: string;
}

/**
 * Paginated list of Drive files
 */
export interface DriveFileList {
  /** List of files */
  files: DriveFile[];
  /** Token for the next page of results */
  nextPageToken?: string;
  /** Whether there are incomplete search results */
  incompleteSearch?: boolean;
}

/**
 * Google Drive user information
 */
export interface DriveUser {
  /** Display name of the user */
  displayName?: string;
  /** Email address of the user */
  emailAddress?: string;
  /** Profile photo URL */
  photoLink?: string;
  /** Whether this is the authenticated user */
  me?: boolean;
  /** Permission ID for the user */
  permissionId?: string;
}

/**
 * Permission for a file or shared drive
 */
export interface DrivePermission {
  /** Permission ID */
  id?: string;
  /** Type of the grantee (user, group, domain, anyone) */
  type: "user" | "group" | "domain" | "anyone";
  /** The role granted by this permission */
  role: "owner" | "organizer" | "fileOrganizer" | "writer" | "commenter" | "reader";
  /** Email address of the user or group (if applicable) */
  emailAddress?: string;
  /** Domain to which this permission refers (if applicable) */
  domain?: string;
  /** Whether the permission allows the file to be discovered via search */
  allowFileDiscovery?: boolean;
  /** Display name of the user, group, or domain */
  displayName?: string;
  /** Expiration time of the permission */
  expirationTime?: string;
}

// =============================================================================
// SHARED DRIVE TYPES
// =============================================================================

/**
 * Google Shared Drive (formerly Team Drive)
 * @see https://developers.google.com/drive/api/reference/rest/v3/drives
 */
export interface SharedDrive {
  /** The unique identifier of the shared drive */
  id: string;
  /** The name of the shared drive */
  name: string;
  /** URL for the background image of the shared drive */
  backgroundImageLink?: string;
  /** Hex color code for the shared drive */
  colorRgb?: string;
  /** The time at which the shared drive was created */
  createdTime?: string;
  /** Whether the shared drive is hidden from default view */
  hidden?: boolean;
  /** Capabilities the current user has on this shared drive */
  capabilities?: SharedDriveCapabilities;
  /** Restrictions on what actions users can perform on the shared drive */
  restrictions?: SharedDriveRestrictions;
}

/**
 * Capabilities for a shared drive
 */
export interface SharedDriveCapabilities {
  canAddChildren?: boolean;
  canChangeCopyRequiresWriterPermissionRestriction?: boolean;
  canChangeDomainUsersOnlyRestriction?: boolean;
  canChangeDriveBackground?: boolean;
  canChangeDriveMembersOnlyRestriction?: boolean;
  canComment?: boolean;
  canCopy?: boolean;
  canDeleteChildren?: boolean;
  canDeleteDrive?: boolean;
  canDownload?: boolean;
  canEdit?: boolean;
  canListChildren?: boolean;
  canManageMembers?: boolean;
  canReadRevisions?: boolean;
  canRename?: boolean;
  canRenameDrive?: boolean;
  canShare?: boolean;
  canTrashChildren?: boolean;
}

/**
 * Restrictions for a shared drive
 */
export interface SharedDriveRestrictions {
  /** Whether administrative privileges on this shared drive are required to modify restrictions */
  adminManagedRestrictions?: boolean;
  /** Whether copy, print, or download of files inside this shared drive is disabled */
  copyRequiresWriterPermission?: boolean;
  /** Whether access to this shared drive and items inside is restricted to users of the domain */
  domainUsersOnly?: boolean;
  /** Whether access to items inside this shared drive is restricted to its members */
  driveMembersOnly?: boolean;
}

/**
 * Paginated list of shared drives
 */
export interface SharedDriveList {
  /** List of shared drives */
  drives: SharedDrive[];
  /** Token for the next page of results */
  nextPageToken?: string;
}

// =============================================================================
// OPERATION OPTIONS
// =============================================================================

/**
 * Options for listing files
 */
export interface ListFilesOptions {
  /** ID of the folder to list (default: root) */
  folderId?: string;
  /** Search query in Drive query format */
  query?: string;
  /** Maximum number of files to return per page (default: 100, max: 1000) */
  pageSize?: number;
  /** Page token from previous list response */
  pageToken?: string;
  /** Fields to include in the response */
  fields?: string[];
  /** Order by field (e.g., "modifiedTime desc") */
  orderBy?: string;
  /** Include items in trash */
  includeItemsFromAllDrives?: boolean;
  /** Support shared drives */
  supportsAllDrives?: boolean;
}

/**
 * Options for uploading files
 */
export interface UploadFileOptions {
  /** Name for the file */
  name: string;
  /** File content as Buffer */
  content: Buffer;
  /** MIME type of the file */
  mimeType: string;
  /** Parent folder ID (default: root) */
  folderId?: string;
  /** Description of the file */
  description?: string;
  /** Whether to keep revision history */
  keepRevisionForever?: boolean;
  /** Whether to add the file to a shared drive */
  supportsAllDrives?: boolean;
}

/**
 * Options for creating a folder
 */
export interface CreateFolderOptions {
  /** Name for the folder */
  name: string;
  /** Parent folder ID (default: root) */
  parentId?: string;
  /** Description of the folder */
  description?: string;
}

/**
 * Options for shared drive file listing
 */
export interface SharedDriveFilesOptions {
  /** ID of the folder within the shared drive */
  folderId?: string;
  /** Search query */
  query?: string;
  /** Page size */
  pageSize?: number;
  /** Page token */
  pageToken?: string;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Google Drive API error
 */
export interface GoogleDriveApiError {
  code: number;
  message: string;
  errors?: Array<{
    domain: string;
    reason: string;
    message: string;
    locationType?: string;
    location?: string;
  }>;
}

/**
 * Google Drive error class
 */
export class GoogleDriveError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "GoogleDriveError";
  }
}

// =============================================================================
// GOOGLE DOCS MIME TYPES
// =============================================================================

/**
 * MIME types for Google Workspace documents
 */
export const GoogleDocsMimeTypes = {
  /** Google Docs document */
  DOCUMENT: "application/vnd.google-apps.document",
  /** Google Sheets spreadsheet */
  SPREADSHEET: "application/vnd.google-apps.spreadsheet",
  /** Google Slides presentation */
  PRESENTATION: "application/vnd.google-apps.presentation",
  /** Google Forms form */
  FORM: "application/vnd.google-apps.form",
  /** Google Drawings drawing */
  DRAWING: "application/vnd.google-apps.drawing",
  /** Google Drive folder */
  FOLDER: "application/vnd.google-apps.folder",
  /** Google Sites site */
  SITE: "application/vnd.google-apps.site",
  /** Google Apps Script project */
  SCRIPT: "application/vnd.google-apps.script",
  /** Shortcut to another file */
  SHORTCUT: "application/vnd.google-apps.shortcut",
} as const;

/**
 * Export MIME types for converting Google Docs
 */
export const ExportMimeTypes = {
  /** PDF format */
  PDF: "application/pdf",
  /** Microsoft Word */
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  /** Microsoft Excel */
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  /** Microsoft PowerPoint */
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  /** Plain text */
  TEXT: "text/plain",
  /** HTML */
  HTML: "text/html",
  /** CSV (for spreadsheets) */
  CSV: "text/csv",
  /** Rich text format */
  RTF: "application/rtf",
  /** Open Document Text */
  ODT: "application/vnd.oasis.opendocument.text",
  /** Open Document Spreadsheet */
  ODS: "application/vnd.oasis.opendocument.spreadsheet",
  /** Open Document Presentation */
  ODP: "application/vnd.oasis.opendocument.presentation",
} as const;
