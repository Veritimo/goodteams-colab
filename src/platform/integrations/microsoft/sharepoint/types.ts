/**
 * SharePoint & OneDrive Type Definitions
 *
 * Type definitions for Microsoft Graph Drive API resources.
 * @see https://learn.microsoft.com/en-us/graph/api/resources/drive
 */

// =============================================================================
// GRAPH CLIENT TYPE (stub if @microsoft/microsoft-graph-client not available)
// =============================================================================

/**
 * Microsoft Graph Client interface
 * If @microsoft/microsoft-graph-client is available, use that instead
 */
export interface GraphClient {
  api(path: string): GraphRequest;
}

export interface GraphRequest {
  get<T = unknown>(): Promise<T>;
  post<T = unknown>(body: unknown): Promise<T>;
  put<T = unknown>(body: unknown): Promise<T>;
  patch<T = unknown>(body: unknown): Promise<T>;
  delete(): Promise<void>;
  header(name: string, value: string): GraphRequest;
  select(fields: string | string[]): GraphRequest;
  expand(fields: string | string[]): GraphRequest;
  filter(filterStr: string): GraphRequest;
  top(count: number): GraphRequest;
  orderby(field: string): GraphRequest;
  search(query: string): GraphRequest;
  query(params: Record<string, string | number | boolean>): GraphRequest;
  count(value?: boolean): GraphRequest;
}

// =============================================================================
// SITE TYPES
// =============================================================================

/**
 * SharePoint Site resource
 * @see https://learn.microsoft.com/en-us/graph/api/resources/site
 */
export interface Site {
  /** Unique identifier of the site */
  id: string;
  /** Display name of the site */
  displayName: string;
  /** Site description */
  description?: string;
  /** Full URL to the site */
  webUrl: string;
  /** The hostname of the site (e.g., contoso.sharepoint.com) */
  siteCollection?: {
    hostname: string;
    root?: Record<string, unknown>;
  };
  /** Name of the site */
  name: string;
  /** Date and time the site was created */
  createdDateTime?: string;
  /** Date and time the site was last modified */
  lastModifiedDateTime?: string;
  /** Root information */
  root?: Record<string, unknown>;
}

/**
 * Response wrapper for site list
 */
export interface SiteListResponse {
  value: Site[];
  "@odata.nextLink"?: string;
}

// =============================================================================
// DRIVE TYPES
// =============================================================================

/**
 * Drive (document library) resource
 * @see https://learn.microsoft.com/en-us/graph/api/resources/drive
 */
export interface Drive {
  /** Unique identifier of the drive */
  id: string;
  /** The type of drive (documentLibrary, personal, etc.) */
  driveType: "personal" | "business" | "documentLibrary";
  /** Name of the drive */
  name: string;
  /** Description of the drive */
  description?: string;
  /** Web URL to the drive */
  webUrl?: string;
  /** Date and time the drive was created */
  createdDateTime?: string;
  /** Date and time the drive was last modified */
  lastModifiedDateTime?: string;
  /** Information about the owner */
  owner?: {
    user?: IdentitySet;
    group?: IdentitySet;
  };
  /** Quota information */
  quota?: DriveQuota;
}

/**
 * Drive quota information
 */
export interface DriveQuota {
  /** Total allowed storage in bytes */
  total?: number;
  /** Used storage in bytes */
  used?: number;
  /** Remaining storage in bytes */
  remaining?: number;
  /** State of the quota (normal, nearing, critical, exceeded) */
  state?: "normal" | "nearing" | "critical" | "exceeded";
}

/**
 * Response wrapper for drive list
 */
export interface DriveListResponse {
  value: Drive[];
  "@odata.nextLink"?: string;
}

// =============================================================================
// DRIVE ITEM TYPES
// =============================================================================

/**
 * DriveItem resource (file or folder)
 * @see https://learn.microsoft.com/en-us/graph/api/resources/driveitem
 */
export interface DriveItem {
  /** Unique identifier of the item */
  id: string;
  /** Name of the item (filename with extension) */
  name: string;
  /** Description of the item */
  description?: string;
  /** Size of the item in bytes */
  size?: number;
  /** Web URL to the item */
  webUrl?: string;
  /** Date and time the item was created */
  createdDateTime?: string;
  /** Date and time the item was last modified */
  lastModifiedDateTime?: string;
  /** User who created the item */
  createdBy?: {
    user?: IdentitySet;
    application?: IdentitySet;
  };
  /** User who last modified the item */
  lastModifiedBy?: {
    user?: IdentitySet;
    application?: IdentitySet;
  };
  /** Reference to the parent folder */
  parentReference?: ItemReference;
  /** File-specific metadata (present if item is a file) */
  file?: FileInfo;
  /** Folder-specific metadata (present if item is a folder) */
  folder?: FolderInfo;
  /** Download URL (expires after a short time) */
  "@microsoft.graph.downloadUrl"?: string;
  /** Content type of the file */
  contentType?: {
    id?: string;
    name?: string;
  };
  /** eTag for concurrency control */
  eTag?: string;
  /** cTag for content changes */
  cTag?: string;
}

/**
 * File-specific facet
 */
export interface FileInfo {
  /** MIME type of the file */
  mimeType?: string;
  /** Hashes for file validation */
  hashes?: {
    sha1Hash?: string;
    sha256Hash?: string;
    quickXorHash?: string;
  };
}

/**
 * Folder-specific facet
 */
export interface FolderInfo {
  /** Number of child items in the folder */
  childCount?: number;
  /** View settings for the folder */
  view?: {
    sortBy?: string;
    sortOrder?: "ascending" | "descending";
    viewType?: string;
  };
}

/**
 * Reference to a parent item
 */
export interface ItemReference {
  /** Unique identifier of the drive */
  driveId?: string;
  /** Type of drive */
  driveType?: string;
  /** Unique identifier of the item */
  id?: string;
  /** Name of the item */
  name?: string;
  /** Path from the root */
  path?: string;
  /** Share ID if accessed via share */
  shareId?: string;
  /** Site ID (for SharePoint) */
  siteId?: string;
}

/**
 * Identity information
 */
export interface IdentitySet {
  /** Display name */
  displayName?: string;
  /** Email address */
  email?: string;
  /** Unique identifier */
  id?: string;
}

/**
 * Response wrapper for drive item list
 */
export interface DriveItemListResponse {
  value: DriveItem[];
  "@odata.nextLink"?: string;
}

// =============================================================================
// SEARCH TYPES
// =============================================================================

/**
 * Search result item
 */
export interface SearchResult {
  /** The matched drive item */
  driveItem: DriveItem;
  /** Relevance score (higher = more relevant) */
  rank?: number;
  /** Resource reference */
  resource?: DriveItem;
  /** Hit highlights */
  hitsContainers?: Array<{
    hits?: Array<{
      rank?: number;
      summary?: string;
      resource?: DriveItem;
    }>;
    total?: number;
    moreResultsAvailable?: boolean;
  }>;
}

/**
 * Search options for file search
 */
export interface SearchOptions {
  /** Filter by file types (e.g., ['docx', 'xlsx', 'pdf']) */
  fileTypes?: string[];
  /** Limit search to a specific folder path */
  folderScope?: string;
  /** Maximum number of results */
  limit?: number;
  /** Search within specific drive only */
  driveId?: string;
  /** Search within specific site only */
  siteId?: string;
}

/**
 * Search response from Microsoft Graph
 */
export interface SearchResponse {
  value: Array<{
    searchTerms?: string[];
    hitsContainers?: Array<{
      hits?: Array<{
        rank?: number;
        summary?: string;
        resource?: DriveItem;
      }>;
      total?: number;
      moreResultsAvailable?: boolean;
    }>;
  }>;
}

// =============================================================================
// UPLOAD TYPES
// =============================================================================

/**
 * Options for file upload
 */
export interface UploadOptions {
  /** Conflict behavior: fail, replace, or rename */
  conflictBehavior?: "fail" | "replace" | "rename";
  /** Content type of the file */
  contentType?: string;
}

/**
 * Upload session for large files
 */
export interface UploadSession {
  /** Upload URL for PUT requests */
  uploadUrl: string;
  /** Expiration date of the session */
  expirationDateTime: string;
  /** Next expected byte ranges to upload */
  nextExpectedRanges?: string[];
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Microsoft Graph error response
 */
export interface GraphError {
  error: {
    code: string;
    message: string;
    innerError?: {
      code?: string;
      "request-id"?: string;
      "client-request-id"?: string;
      date?: string;
    };
  };
}

/**
 * SharePoint-specific error
 */
export class SharePointError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "SharePointError";
  }
}
