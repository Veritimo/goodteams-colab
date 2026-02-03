/**
 * SharePoint Site Operations
 *
 * Functions for interacting with SharePoint sites and document libraries via MS Graph API.
 * @see https://learn.microsoft.com/en-us/graph/api/resources/site
 */

import type {
  Drive,
  DriveListResponse,
  GraphClient,
  Site,
  SiteListResponse,
  SharePointError,
} from "./types.js";

// =============================================================================
// SITE OPERATIONS
// =============================================================================

/**
 * List all SharePoint sites accessible to the current user
 *
 * Requires Sites.Read.All or Sites.ReadWrite.All permission
 *
 * @param client - Microsoft Graph client
 * @returns Array of accessible sites
 *
 * @example
 * ```typescript
 * const sites = await listSites(graphClient);
 * console.log(`Found ${sites.length} sites`);
 * ```
 */
export async function listSites(client: GraphClient): Promise<Site[]> {
  const response = await client
    .api("/sites")
    .query({ search: "*" }) // Search all sites
    .select([
      "id",
      "displayName",
      "name",
      "webUrl",
      "description",
      "createdDateTime",
      "lastModifiedDateTime",
    ])
    .get<SiteListResponse>();

  return response.value ?? [];
}

/**
 * Get a specific SharePoint site by its ID
 *
 * @param client - Microsoft Graph client
 * @param siteId - The unique identifier of the site
 * @returns Site details
 *
 * @example
 * ```typescript
 * const site = await getSite(graphClient, "contoso.sharepoint.com,abc123,def456");
 * console.log(`Site: ${site.displayName}`);
 * ```
 */
export async function getSite(client: GraphClient, siteId: string): Promise<Site> {
  if (!siteId) {
    throw createSharePointError("Site ID is required", "InvalidArgument");
  }

  const site = await client
    .api(`/sites/${encodeURIComponent(siteId)}`)
    .select([
      "id",
      "displayName",
      "name",
      "webUrl",
      "description",
      "createdDateTime",
      "lastModifiedDateTime",
      "siteCollection",
    ])
    .get<Site>();

  return site;
}

/**
 * Get a SharePoint site by its hostname and path
 *
 * @param client - Microsoft Graph client
 * @param hostname - The SharePoint hostname (e.g., "contoso.sharepoint.com")
 * @param sitePath - The site path (e.g., "/sites/marketing")
 * @returns Site details
 *
 * @example
 * ```typescript
 * const site = await getSiteByPath(graphClient, "contoso.sharepoint.com", "/sites/marketing");
 * console.log(`Site ID: ${site.id}`);
 * ```
 */
export async function getSiteByPath(
  client: GraphClient,
  hostname: string,
  sitePath: string,
): Promise<Site> {
  if (!hostname) {
    throw createSharePointError("Hostname is required", "InvalidArgument");
  }
  if (!sitePath) {
    throw createSharePointError("Site path is required", "InvalidArgument");
  }

  // Ensure sitePath starts with /
  const normalizedPath = sitePath.startsWith("/") ? sitePath : `/${sitePath}`;

  // Build the path: /sites/{hostname}:/{relative-path}
  const apiPath = `/sites/${encodeURIComponent(hostname)}:${normalizedPath}`;

  const site = await client
    .api(apiPath)
    .select([
      "id",
      "displayName",
      "name",
      "webUrl",
      "description",
      "createdDateTime",
      "lastModifiedDateTime",
      "siteCollection",
    ])
    .get<Site>();

  return site;
}

/**
 * Get the root SharePoint site for a tenant
 *
 * @param client - Microsoft Graph client
 * @returns Root site details
 *
 * @example
 * ```typescript
 * const rootSite = await getRootSite(graphClient);
 * console.log(`Root site: ${rootSite.webUrl}`);
 * ```
 */
export async function getRootSite(client: GraphClient): Promise<Site> {
  const site = await client
    .api("/sites/root")
    .select([
      "id",
      "displayName",
      "name",
      "webUrl",
      "description",
      "createdDateTime",
      "lastModifiedDateTime",
      "siteCollection",
    ])
    .get<Site>();

  return site;
}

/**
 * Search for SharePoint sites by keyword
 *
 * @param client - Microsoft Graph client
 * @param query - Search query string
 * @returns Array of matching sites
 *
 * @example
 * ```typescript
 * const sites = await searchSites(graphClient, "marketing");
 * console.log(`Found ${sites.length} marketing-related sites`);
 * ```
 */
export async function searchSites(client: GraphClient, query: string): Promise<Site[]> {
  if (!query) {
    return listSites(client);
  }

  const response = await client
    .api("/sites")
    .query({ search: query })
    .select([
      "id",
      "displayName",
      "name",
      "webUrl",
      "description",
      "createdDateTime",
      "lastModifiedDateTime",
    ])
    .get<SiteListResponse>();

  return response.value ?? [];
}

// =============================================================================
// DRIVE (DOCUMENT LIBRARY) OPERATIONS
// =============================================================================

/**
 * List all document libraries (drives) for a SharePoint site
 *
 * @param client - Microsoft Graph client
 * @param siteId - The unique identifier of the site
 * @returns Array of drives (document libraries)
 *
 * @example
 * ```typescript
 * const drives = await listDrives(graphClient, siteId);
 * for (const drive of drives) {
 *   console.log(`${drive.name}: ${drive.driveType}`);
 * }
 * ```
 */
export async function listDrives(client: GraphClient, siteId: string): Promise<Drive[]> {
  if (!siteId) {
    throw createSharePointError("Site ID is required", "InvalidArgument");
  }

  const response = await client
    .api(`/sites/${encodeURIComponent(siteId)}/drives`)
    .select([
      "id",
      "name",
      "driveType",
      "description",
      "webUrl",
      "createdDateTime",
      "lastModifiedDateTime",
      "quota",
      "owner",
    ])
    .get<DriveListResponse>();

  return response.value ?? [];
}

/**
 * Get a specific drive by its ID
 *
 * @param client - Microsoft Graph client
 * @param driveId - The unique identifier of the drive
 * @returns Drive details
 *
 * @example
 * ```typescript
 * const drive = await getDrive(graphClient, driveId);
 * console.log(`Drive: ${drive.name}, Used: ${drive.quota?.used} bytes`);
 * ```
 */
export async function getDrive(client: GraphClient, driveId: string): Promise<Drive> {
  if (!driveId) {
    throw createSharePointError("Drive ID is required", "InvalidArgument");
  }

  const drive = await client
    .api(`/drives/${encodeURIComponent(driveId)}`)
    .select([
      "id",
      "name",
      "driveType",
      "description",
      "webUrl",
      "createdDateTime",
      "lastModifiedDateTime",
      "quota",
      "owner",
    ])
    .get<Drive>();

  return drive;
}

/**
 * Get the default document library for a site
 *
 * @param client - Microsoft Graph client
 * @param siteId - The unique identifier of the site
 * @returns Default drive
 *
 * @example
 * ```typescript
 * const defaultDrive = await getDefaultDrive(graphClient, siteId);
 * console.log(`Default drive: ${defaultDrive.name}`);
 * ```
 */
export async function getDefaultDrive(client: GraphClient, siteId: string): Promise<Drive> {
  if (!siteId) {
    throw createSharePointError("Site ID is required", "InvalidArgument");
  }

  const drive = await client
    .api(`/sites/${encodeURIComponent(siteId)}/drive`)
    .select([
      "id",
      "name",
      "driveType",
      "description",
      "webUrl",
      "createdDateTime",
      "lastModifiedDateTime",
      "quota",
      "owner",
    ])
    .get<Drive>();

  return drive;
}

/**
 * Get the current user's OneDrive
 *
 * @param client - Microsoft Graph client
 * @returns User's OneDrive
 *
 * @example
 * ```typescript
 * const myDrive = await getMyDrive(graphClient);
 * console.log(`My OneDrive: ${myDrive.quota?.used}/${myDrive.quota?.total} bytes used`);
 * ```
 */
export async function getMyDrive(client: GraphClient): Promise<Drive> {
  const drive = await client
    .api("/me/drive")
    .select([
      "id",
      "name",
      "driveType",
      "description",
      "webUrl",
      "createdDateTime",
      "lastModifiedDateTime",
      "quota",
      "owner",
    ])
    .get<Drive>();

  return drive;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a SharePoint error with consistent formatting
 */
function createSharePointError(
  message: string,
  code: string,
  statusCode?: number,
): SharePointError {
  // Using a class-like error structure
  const error = new Error(message) as SharePointError;
  error.name = "SharePointError";
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

/**
 * Check if a site ID is in the compound format (hostname,site-id,web-id)
 */
export function isCompoundSiteId(siteId: string): boolean {
  return siteId.includes(",");
}

/**
 * Parse a compound site ID into its components
 */
export function parseCompoundSiteId(siteId: string): {
  hostname: string;
  siteGuid: string;
  webGuid: string;
} | null {
  const parts = siteId.split(",");
  if (parts.length !== 3) {
    return null;
  }
  return {
    hostname: parts[0] ?? "",
    siteGuid: parts[1] ?? "",
    webGuid: parts[2] ?? "",
  };
}

/**
 * Build a compound site ID from components
 */
export function buildCompoundSiteId(hostname: string, siteGuid: string, webGuid: string): string {
  return `${hostname},${siteGuid},${webGuid}`;
}
