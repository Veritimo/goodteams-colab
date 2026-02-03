/**
 * Google Shared Drives Client
 *
 * Provides operations for Google Shared Drives (formerly Team Drives).
 * @see https://developers.google.com/drive/api/reference/rest/v3/drives
 */

import { google, type drive_v3 } from "googleapis";
import type {
  GoogleAuth,
  SharedDrive,
  SharedDriveList,
  DriveFile,
  DriveFileList,
  SharedDriveFilesOptions,
} from "./types.js";
import { GoogleDriveError } from "./types.js";

// =============================================================================
// CLIENT OPTIONS
// =============================================================================

/**
 * Options for creating a Shared Drives client
 */
export interface SharedDrivesClientOptions {
  /** Google OAuth2 client or Service Account */
  auth: GoogleAuth;
}

// =============================================================================
// SHARED DRIVES CLIENT
// =============================================================================

/**
 * Client for interacting with Google Shared Drives API
 *
 * @example
 * ```typescript
 * import { SharedDrivesClient } from "@platform/integrations/google/drive";
 *
 * const client = new SharedDrivesClient({ auth: oauth2Client });
 *
 * // List shared drives
 * const drives = await client.listSharedDrives();
 *
 * // Get files in a shared drive
 * const files = await client.listSharedDriveFiles("drive-id");
 * ```
 */
export class SharedDrivesClient {
  private drive: drive_v3.Drive;

  constructor(options: SharedDrivesClientOptions) {
    if (!options.auth) {
      throw new GoogleDriveError("Auth client is required", "InvalidArgument");
    }

    this.drive = google.drive({
      version: "v3",
      auth: options.auth,
    });
  }

  // ===========================================================================
  // SHARED DRIVE OPERATIONS
  // ===========================================================================

  /**
   * List all shared drives the user has access to
   *
   * @param pageSize - Maximum number of shared drives to return (default: 100)
   * @param pageToken - Page token for pagination
   * @returns Paginated list of shared drives
   *
   * @example
   * ```typescript
   * const { drives, nextPageToken } = await client.listSharedDrives();
   *
   * // Iterate through all pages
   * let token;
   * do {
   *   const result = await client.listSharedDrives(100, token);
   *   for (const drive of result.drives) {
   *     console.log(drive.name);
   *   }
   *   token = result.nextPageToken;
   * } while (token);
   * ```
   */
  async listSharedDrives(pageSize = 100, pageToken?: string): Promise<SharedDriveList> {
    const response = await this.drive.drives.list({
      pageSize: Math.min(pageSize, 100),
      pageToken,
      fields:
        "nextPageToken, drives(id, name, backgroundImageLink, colorRgb, createdTime, hidden, capabilities, restrictions)",
    });

    const drives = (response.data.drives ?? []).map(mapSharedDrive);

    return {
      drives,
      nextPageToken: response.data.nextPageToken ?? undefined,
    };
  }

  /**
   * List all shared drives, handling pagination automatically
   *
   * @param maxResults - Maximum number of shared drives to return (default: all)
   * @returns Array of all shared drives
   */
  async listAllSharedDrives(maxResults?: number): Promise<SharedDrive[]> {
    const allDrives: SharedDrive[] = [];
    let pageToken: string | undefined;

    do {
      const result = await this.listSharedDrives(
        Math.min(100, maxResults ? maxResults - allDrives.length : 100),
        pageToken,
      );

      allDrives.push(...result.drives);
      pageToken = result.nextPageToken;

      if (maxResults && allDrives.length >= maxResults) {
        break;
      }
    } while (pageToken);

    return maxResults ? allDrives.slice(0, maxResults) : allDrives;
  }

  /**
   * Get a specific shared drive by ID
   *
   * @param driveId - The unique identifier of the shared drive
   * @returns Shared drive metadata
   *
   * @example
   * ```typescript
   * const drive = await client.getSharedDrive("drive-id");
   * console.log(`${drive.name} - ${drive.capabilities?.canManageMembers ? "Admin" : "Member"}`);
   * ```
   */
  async getSharedDrive(driveId: string): Promise<SharedDrive> {
    if (!driveId) {
      throw new GoogleDriveError("Drive ID is required", "InvalidArgument");
    }

    const response = await this.drive.drives.get({
      driveId,
      fields:
        "id, name, backgroundImageLink, colorRgb, createdTime, hidden, capabilities, restrictions",
    });

    return mapSharedDrive(response.data);
  }

  /**
   * Search for shared drives by name
   *
   * @param searchTerm - Term to search for in shared drive names
   * @param pageSize - Maximum number of results
   * @returns Matching shared drives
   */
  async searchSharedDrives(searchTerm: string, pageSize = 100): Promise<SharedDriveList> {
    if (!searchTerm) {
      throw new GoogleDriveError("Search term is required", "InvalidArgument");
    }

    const escapedTerm = searchTerm.replace(/'/g, "\\'");

    const response = await this.drive.drives.list({
      pageSize: Math.min(pageSize, 100),
      q: `name contains '${escapedTerm}'`,
      fields:
        "nextPageToken, drives(id, name, backgroundImageLink, colorRgb, createdTime, hidden, capabilities, restrictions)",
    });

    const drives = (response.data.drives ?? []).map(mapSharedDrive);

    return {
      drives,
      nextPageToken: response.data.nextPageToken ?? undefined,
    };
  }

  // ===========================================================================
  // FILE OPERATIONS IN SHARED DRIVES
  // ===========================================================================

  /**
   * List files in a shared drive
   *
   * @param driveId - The unique identifier of the shared drive
   * @param options - Listing options
   * @returns Paginated list of files
   *
   * @example
   * ```typescript
   * // List all files in shared drive root
   * const { files } = await client.listSharedDriveFiles("drive-id");
   *
   * // List files in a specific folder
   * const { files } = await client.listSharedDriveFiles("drive-id", {
   *   folderId: "folder-id",
   * });
   * ```
   */
  async listSharedDriveFiles(
    driveId: string,
    options: SharedDriveFilesOptions = {},
  ): Promise<DriveFileList> {
    if (!driveId) {
      throw new GoogleDriveError("Drive ID is required", "InvalidArgument");
    }

    const { folderId, query, pageSize = 100, pageToken } = options;

    // Build query for shared drive
    let q = `trashed = false`;

    // If folderId is provided, search within that folder
    // If not, search at the root of the shared drive
    if (folderId) {
      q += ` and '${folderId}' in parents`;
    } else {
      // For root-level files, parent is the drive ID
      q += ` and '${driveId}' in parents`;
    }

    if (query) {
      q += ` and (${query})`;
    }

    const response = await this.drive.files.list({
      q,
      driveId,
      corpora: "drive",
      pageSize: Math.min(pageSize, 1000),
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      orderBy: "modifiedTime desc",
      fields:
        "nextPageToken, incompleteSearch, files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, description, starred, trashed, md5Checksum, fileExtension, iconLink, thumbnailLink, driveId)",
    });

    const files = (response.data.files ?? []).map(mapDriveFile);

    return {
      files,
      nextPageToken: response.data.nextPageToken ?? undefined,
      incompleteSearch: response.data.incompleteSearch ?? undefined,
    };
  }

  /**
   * List all files in a shared drive, handling pagination automatically
   *
   * @param driveId - The unique identifier of the shared drive
   * @param folderId - Optional folder ID
   * @param maxResults - Maximum number of files to return (default: all)
   * @returns Array of all files
   */
  async listAllSharedDriveFiles(
    driveId: string,
    folderId?: string,
    maxResults?: number,
  ): Promise<DriveFile[]> {
    const allFiles: DriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const result = await this.listSharedDriveFiles(driveId, {
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

  /**
   * Search for files within a shared drive
   *
   * @param driveId - The unique identifier of the shared drive
   * @param searchTerm - Term to search for in file names
   * @param options - Additional listing options
   * @returns Search results
   *
   * @example
   * ```typescript
   * const { files } = await client.searchSharedDriveFiles("drive-id", "quarterly report");
   * ```
   */
  async searchSharedDriveFiles(
    driveId: string,
    searchTerm: string,
    options: SharedDriveFilesOptions = {},
  ): Promise<DriveFileList> {
    if (!driveId) {
      throw new GoogleDriveError("Drive ID is required", "InvalidArgument");
    }
    if (!searchTerm) {
      throw new GoogleDriveError("Search term is required", "InvalidArgument");
    }

    const escapedTerm = searchTerm.replace(/'/g, "\\'");
    const query = options.query
      ? `(${options.query}) and name contains '${escapedTerm}'`
      : `name contains '${escapedTerm}'`;

    // Remove folderId constraint for search across entire shared drive
    const { folderId: _folderId, ...searchOptions } = options;

    return this.listSharedDriveFilesWithQuery(driveId, query, searchOptions);
  }

  /**
   * Search files by full-text content within a shared drive
   *
   * @param driveId - The unique identifier of the shared drive
   * @param searchTerm - Term to search for in file contents
   * @param options - Additional listing options
   * @returns Search results
   */
  async searchSharedDriveByContent(
    driveId: string,
    searchTerm: string,
    options: SharedDriveFilesOptions = {},
  ): Promise<DriveFileList> {
    if (!driveId) {
      throw new GoogleDriveError("Drive ID is required", "InvalidArgument");
    }
    if (!searchTerm) {
      throw new GoogleDriveError("Search term is required", "InvalidArgument");
    }

    const escapedTerm = searchTerm.replace(/'/g, "\\'");
    const query = options.query
      ? `(${options.query}) and fullText contains '${escapedTerm}'`
      : `fullText contains '${escapedTerm}'`;

    const { folderId: _folderId, ...searchOptions } = options;

    return this.listSharedDriveFilesWithQuery(driveId, query, searchOptions);
  }

  /**
   * Get files by MIME type within a shared drive
   *
   * @param driveId - The unique identifier of the shared drive
   * @param mimeType - MIME type to filter by
   * @param options - Additional listing options
   * @returns Matching files
   */
  async getSharedDriveFilesByMimeType(
    driveId: string,
    mimeType: string,
    options: SharedDriveFilesOptions = {},
  ): Promise<DriveFileList> {
    if (!driveId) {
      throw new GoogleDriveError("Drive ID is required", "InvalidArgument");
    }
    if (!mimeType) {
      throw new GoogleDriveError("MIME type is required", "InvalidArgument");
    }

    const query = options.query
      ? `(${options.query}) and mimeType = '${mimeType}'`
      : `mimeType = '${mimeType}'`;

    const { folderId: _folderId, ...searchOptions } = options;

    return this.listSharedDriveFilesWithQuery(driveId, query, searchOptions);
  }

  /**
   * Internal method to list files with a custom query
   */
  private async listSharedDriveFilesWithQuery(
    driveId: string,
    query: string,
    options: Omit<SharedDriveFilesOptions, "folderId"> = {},
  ): Promise<DriveFileList> {
    const { pageSize = 100, pageToken } = options;

    // Build query for shared drive
    const q = `trashed = false and (${query})`;

    const response = await this.drive.files.list({
      q,
      driveId,
      corpora: "drive",
      pageSize: Math.min(pageSize, 1000),
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      orderBy: "modifiedTime desc",
      fields:
        "nextPageToken, incompleteSearch, files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, description, starred, trashed, md5Checksum, fileExtension, iconLink, thumbnailLink, driveId)",
    });

    const files = (response.data.files ?? []).map(mapDriveFile);

    return {
      files,
      nextPageToken: response.data.nextPageToken ?? undefined,
      incompleteSearch: response.data.incompleteSearch ?? undefined,
    };
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Check if the user has a specific capability on a shared drive
   *
   * @param driveId - The unique identifier of the shared drive
   * @param capability - Capability to check
   * @returns Whether the user has the capability
   */
  async hasCapability(
    driveId: string,
    capability: keyof NonNullable<SharedDrive["capabilities"]>,
  ): Promise<boolean> {
    const drive = await this.getSharedDrive(driveId);
    return drive.capabilities?.[capability] ?? false;
  }

  /**
   * Check if a shared drive is hidden
   *
   * @param driveId - The unique identifier of the shared drive
   * @returns Whether the shared drive is hidden
   */
  async isHidden(driveId: string): Promise<boolean> {
    const drive = await this.getSharedDrive(driveId);
    return drive.hidden ?? false;
  }

  /**
   * Hide a shared drive from the default view
   *
   * @param driveId - The unique identifier of the shared drive
   */
  async hideSharedDrive(driveId: string): Promise<void> {
    if (!driveId) {
      throw new GoogleDriveError("Drive ID is required", "InvalidArgument");
    }

    await this.drive.drives.hide({
      driveId,
    });
  }

  /**
   * Unhide a shared drive
   *
   * @param driveId - The unique identifier of the shared drive
   * @returns The updated shared drive
   */
  async unhideSharedDrive(driveId: string): Promise<SharedDrive> {
    if (!driveId) {
      throw new GoogleDriveError("Drive ID is required", "InvalidArgument");
    }

    const response = await this.drive.drives.unhide({
      driveId,
    });

    return mapSharedDrive(response.data);
  }

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
 * Map Google Drive API response to our SharedDrive interface
 */
function mapSharedDrive(data: drive_v3.Schema$Drive): SharedDrive {
  return {
    id: data.id ?? "",
    name: data.name ?? "",
    backgroundImageLink: data.backgroundImageLink ?? undefined,
    colorRgb: data.colorRgb ?? undefined,
    createdTime: data.createdTime ?? undefined,
    hidden: data.hidden ?? undefined,
    capabilities: data.capabilities
      ? {
          canAddChildren: data.capabilities.canAddChildren ?? undefined,
          canChangeCopyRequiresWriterPermissionRestriction:
            data.capabilities.canChangeCopyRequiresWriterPermissionRestriction ?? undefined,
          canChangeDomainUsersOnlyRestriction:
            data.capabilities.canChangeDomainUsersOnlyRestriction ?? undefined,
          canChangeDriveBackground: data.capabilities.canChangeDriveBackground ?? undefined,
          canChangeDriveMembersOnlyRestriction:
            data.capabilities.canChangeDriveMembersOnlyRestriction ?? undefined,
          canComment: data.capabilities.canComment ?? undefined,
          canCopy: data.capabilities.canCopy ?? undefined,
          canDeleteChildren: data.capabilities.canDeleteChildren ?? undefined,
          canDeleteDrive: data.capabilities.canDeleteDrive ?? undefined,
          canDownload: data.capabilities.canDownload ?? undefined,
          canEdit: data.capabilities.canEdit ?? undefined,
          canListChildren: data.capabilities.canListChildren ?? undefined,
          canManageMembers: data.capabilities.canManageMembers ?? undefined,
          canReadRevisions: data.capabilities.canReadRevisions ?? undefined,
          canRename: data.capabilities.canRename ?? undefined,
          canRenameDrive: data.capabilities.canRenameDrive ?? undefined,
          canShare: data.capabilities.canShare ?? undefined,
          canTrashChildren: data.capabilities.canTrashChildren ?? undefined,
        }
      : undefined,
    restrictions: data.restrictions
      ? {
          adminManagedRestrictions: data.restrictions.adminManagedRestrictions ?? undefined,
          copyRequiresWriterPermission: data.restrictions.copyRequiresWriterPermission ?? undefined,
          domainUsersOnly: data.restrictions.domainUsersOnly ?? undefined,
          driveMembersOnly: data.restrictions.driveMembersOnly ?? undefined,
        }
      : undefined,
  };
}

/**
 * Map Google Drive API file response to our DriveFile interface
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
    md5Checksum: data.md5Checksum ?? undefined,
    fileExtension: data.fileExtension ?? undefined,
    iconLink: data.iconLink ?? undefined,
    thumbnailLink: data.thumbnailLink ?? undefined,
    driveId: data.driveId ?? undefined,
  };
}
