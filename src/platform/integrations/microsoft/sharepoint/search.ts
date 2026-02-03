/**
 * SharePoint & OneDrive Search Operations
 *
 * Functions for searching files across SharePoint sites and OneDrive.
 * @see https://learn.microsoft.com/en-us/graph/api/driveitem-search
 */

import type {
  DriveItem,
  DriveItemListResponse,
  GraphClient,
  SearchOptions,
  SearchResponse,
  SearchResult,
  SharePointError,
} from "./types.js";

// =============================================================================
// SEARCH OPERATIONS
// =============================================================================

/**
 * Search for files across all accessible SharePoint sites and OneDrive
 *
 * Uses the Microsoft Search API for comprehensive cross-site search.
 *
 * @param client - Microsoft Graph client
 * @param query - Search query string
 * @param options - Search options (file types, scope, limit)
 * @returns Array of search results
 *
 * @example
 * ```typescript
 * // Simple search
 * const results = await searchFiles(graphClient, "quarterly report");
 *
 * // Search with filters
 * const docs = await searchFiles(graphClient, "budget", {
 *   fileTypes: ["xlsx", "docx"],
 *   limit: 10,
 * });
 * ```
 */
export async function searchFiles(
  client: GraphClient,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  if (!query) {
    throw createSharePointError("Search query is required", "InvalidArgument");
  }

  const { fileTypes, limit = 25, driveId, siteId } = options;

  // If driveId is specified, use drive-specific search
  if (driveId) {
    return searchInDrive(client, driveId, query, options);
  }

  // If siteId is specified, use site-specific search
  if (siteId) {
    return searchInSite(client, siteId, query, options);
  }

  // Build the search query with file type filters
  let searchQuery = query;
  if (fileTypes && fileTypes.length > 0) {
    const typeFilters = fileTypes.map((ext) => `filetype:${ext}`).join(" OR ");
    searchQuery = `${query} (${typeFilters})`;
  }

  // Use Microsoft Search API for cross-site search
  const searchRequest = {
    requests: [
      {
        entityTypes: ["driveItem"],
        query: {
          queryString: searchQuery,
        },
        from: 0,
        size: Math.min(limit, 500), // Max 500 results
        fields: [
          "id",
          "name",
          "size",
          "webUrl",
          "createdDateTime",
          "lastModifiedDateTime",
          "parentReference",
          "file",
          "folder",
        ],
      },
    ],
  };

  try {
    const response = await client.api("/search/query").post<SearchResponse>(searchRequest);

    return parseSearchResponse(response);
  } catch (error) {
    // Fallback to drive search if Search API not available
    return searchMyDrive(client, query, options);
  }
}

/**
 * Search for files within a specific SharePoint site
 *
 * @param client - Microsoft Graph client
 * @param siteId - The unique identifier of the site
 * @param query - Search query string
 * @param options - Search options
 * @returns Array of search results
 *
 * @example
 * ```typescript
 * const results = await searchInSite(graphClient, siteId, "project plan");
 * ```
 */
export async function searchInSite(
  client: GraphClient,
  siteId: string,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  if (!siteId) {
    throw createSharePointError("Site ID is required", "InvalidArgument");
  }
  if (!query) {
    throw createSharePointError("Search query is required", "InvalidArgument");
  }

  const { fileTypes, limit = 25 } = options;

  // Build KQL query with file type filters
  let searchQuery = query;
  if (fileTypes && fileTypes.length > 0) {
    const typeFilters = fileTypes.map((ext) => `FileExtension:${ext}`).join(" OR ");
    searchQuery = `${query} (${typeFilters})`;
  }

  // Get the site's default drive first
  const drives = await client
    .api(`/sites/${encodeURIComponent(siteId)}/drives`)
    .select(["id"])
    .get<{ value: Array<{ id: string }> }>();

  const results: SearchResult[] = [];

  // Search each drive in the site
  for (const drive of drives.value ?? []) {
    const driveResults = await searchInDrive(client, drive.id, query, {
      ...options,
      limit: Math.min(limit - results.length, 100),
    });
    results.push(...driveResults);

    if (results.length >= limit) {
      break;
    }
  }

  return results.slice(0, limit);
}

/**
 * Search for files within a specific drive
 *
 * @param client - Microsoft Graph client
 * @param driveId - The unique identifier of the drive
 * @param query - Search query string
 * @param options - Search options
 * @returns Array of search results
 *
 * @example
 * ```typescript
 * const results = await searchInDrive(graphClient, driveId, "report");
 * ```
 */
export async function searchInDrive(
  client: GraphClient,
  driveId: string,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  if (!driveId) {
    throw createSharePointError("Drive ID is required", "InvalidArgument");
  }
  if (!query) {
    throw createSharePointError("Search query is required", "InvalidArgument");
  }

  const { folderScope, limit = 25 } = options;

  // Build the search path
  let searchPath: string;
  if (folderScope) {
    const normalizedScope = folderScope.startsWith("/") ? folderScope : `/${folderScope}`;
    searchPath = `/drives/${encodeURIComponent(driveId)}/root:${normalizedScope}:/search(q='${encodeURIComponent(query)}')`;
  } else {
    searchPath = `/drives/${encodeURIComponent(driveId)}/root/search(q='${encodeURIComponent(query)}')`;
  }

  const response = await client
    .api(searchPath)
    .top(Math.min(limit, 200))
    .select([
      "id",
      "name",
      "size",
      "webUrl",
      "createdDateTime",
      "lastModifiedDateTime",
      "parentReference",
      "file",
      "folder",
    ])
    .get<DriveItemListResponse>();

  const items = response.value ?? [];

  // Filter by file type if specified
  const { fileTypes } = options;
  const filteredItems =
    fileTypes && fileTypes.length > 0
      ? items.filter((item) => {
          if (!item.name) return false;
          const ext = getFileExtension(item.name);
          return ext && fileTypes.includes(ext.toLowerCase());
        })
      : items;

  // Convert to SearchResult format
  return filteredItems.map((item, index) => ({
    driveItem: item,
    rank: index + 1,
    resource: item,
  }));
}

/**
 * Search in the current user's OneDrive
 */
async function searchMyDrive(
  client: GraphClient,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const { limit = 25 } = options;

  const response = await client
    .api(`/me/drive/root/search(q='${encodeURIComponent(query)}')`)
    .top(Math.min(limit, 200))
    .select([
      "id",
      "name",
      "size",
      "webUrl",
      "createdDateTime",
      "lastModifiedDateTime",
      "parentReference",
      "file",
      "folder",
    ])
    .get<DriveItemListResponse>();

  const items = response.value ?? [];

  // Filter by file type if specified
  const { fileTypes } = options;
  const filteredItems =
    fileTypes && fileTypes.length > 0
      ? items.filter((item) => {
          if (!item.name) return false;
          const ext = getFileExtension(item.name);
          return ext && fileTypes.includes(ext.toLowerCase());
        })
      : items;

  return filteredItems.map((item, index) => ({
    driveItem: item,
    rank: index + 1,
    resource: item,
  }));
}

// =============================================================================
// RECENT FILES
// =============================================================================

/**
 * Get recently accessed files across SharePoint and OneDrive
 *
 * @param client - Microsoft Graph client
 * @param limit - Maximum number of results
 * @returns Array of recently accessed drive items
 *
 * @example
 * ```typescript
 * const recent = await getRecentFiles(graphClient, 10);
 * console.log(`Last accessed: ${recent[0]?.name}`);
 * ```
 */
export async function getRecentFiles(client: GraphClient, limit = 25): Promise<DriveItem[]> {
  const response = await client
    .api("/me/drive/recent")
    .top(Math.min(limit, 200))
    .select([
      "id",
      "name",
      "size",
      "webUrl",
      "createdDateTime",
      "lastModifiedDateTime",
      "parentReference",
      "file",
      "folder",
    ])
    .get<DriveItemListResponse>();

  return response.value ?? [];
}

/**
 * Get files shared with the current user
 *
 * @param client - Microsoft Graph client
 * @param limit - Maximum number of results
 * @returns Array of shared drive items
 *
 * @example
 * ```typescript
 * const shared = await getSharedWithMe(graphClient);
 * ```
 */
export async function getSharedWithMe(client: GraphClient, limit = 25): Promise<DriveItem[]> {
  const response = await client
    .api("/me/drive/sharedWithMe")
    .top(Math.min(limit, 200))
    .select([
      "id",
      "name",
      "size",
      "webUrl",
      "createdDateTime",
      "lastModifiedDateTime",
      "parentReference",
      "file",
      "folder",
    ])
    .get<DriveItemListResponse>();

  return response.value ?? [];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse the response from Microsoft Search API
 */
function parseSearchResponse(response: SearchResponse): SearchResult[] {
  const results: SearchResult[] = [];

  for (const searchResult of response.value ?? []) {
    for (const container of searchResult.hitsContainers ?? []) {
      for (const hit of container.hits ?? []) {
        if (hit.resource) {
          results.push({
            driveItem: hit.resource,
            rank: hit.rank,
            resource: hit.resource,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string | undefined {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) return undefined;
  return filename.slice(lastDot + 1);
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
 * Build a search query with KQL syntax for SharePoint
 *
 * @param terms - Base search terms
 * @param options - Additional query options
 * @returns KQL query string
 */
export function buildSearchQuery(
  terms: string,
  options: {
    fileTypes?: string[];
    author?: string;
    modifiedAfter?: Date;
    modifiedBefore?: Date;
    sizeGreaterThan?: number;
    sizeLessThan?: number;
  } = {},
): string {
  const parts: string[] = [terms];

  if (options.fileTypes && options.fileTypes.length > 0) {
    const typeFilters = options.fileTypes.map((ext) => `FileExtension:${ext}`).join(" OR ");
    parts.push(`(${typeFilters})`);
  }

  if (options.author) {
    parts.push(`Author:"${options.author}"`);
  }

  if (options.modifiedAfter) {
    parts.push(`LastModifiedTime>=${options.modifiedAfter.toISOString().split("T")[0]}`);
  }

  if (options.modifiedBefore) {
    parts.push(`LastModifiedTime<=${options.modifiedBefore.toISOString().split("T")[0]}`);
  }

  if (options.sizeGreaterThan !== undefined) {
    parts.push(`Size>${options.sizeGreaterThan}`);
  }

  if (options.sizeLessThan !== undefined) {
    parts.push(`Size<${options.sizeLessThan}`);
  }

  return parts.join(" ");
}

/**
 * Extract file types from search results for faceted navigation
 */
export function extractFileTypes(results: SearchResult[]): Map<string, number> {
  const typeCounts = new Map<string, number>();

  for (const result of results) {
    const item = result.driveItem;
    if (item.name) {
      const ext = getFileExtension(item.name);
      if (ext) {
        typeCounts.set(ext.toLowerCase(), (typeCounts.get(ext.toLowerCase()) ?? 0) + 1);
      }
    }
  }

  return typeCounts;
}
