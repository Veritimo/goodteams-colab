/**
 * Microsoft Entra Directory Search
 *
 * Search the organization's Entra directory to find users for invitations.
 * Uses Microsoft Graph API with delegated permissions.
 *
 * Required scope: User.Read.All or User.ReadBasic.All
 *
 * @see docs/RBAC-STAFF-ONBOARDING.md §4.2
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * User info from Entra directory
 */
export interface EntraUser {
  /** Microsoft object ID (unique identifier) */
  id: string;
  /** Display name */
  displayName: string;
  /** Primary email address */
  mail: string | null;
  /** User principal name (usually email-format) */
  userPrincipalName: string;
  /** Given name (first name) */
  givenName?: string;
  /** Surname (last name) */
  surname?: string;
  /** Job title */
  jobTitle?: string;
  /** Department */
  department?: string;
  /** Office location */
  officeLocation?: string;
}

/**
 * Search results with pagination info
 */
export interface DirectorySearchResult {
  /** Found users */
  users: EntraUser[];
  /** Total count (if available) */
  totalCount?: number;
  /** Next page link (for pagination) */
  nextLink?: string;
}

/**
 * Graph API response for users
 */
interface GraphUsersResponse {
  value: GraphUser[];
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
}

interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
}

// =============================================================================
// DIRECTORY SEARCH
// =============================================================================

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

/**
 * Selected fields to retrieve from Graph API
 * Reduces response size and improves performance
 */
const USER_SELECT_FIELDS = [
  "id",
  "displayName",
  "mail",
  "userPrincipalName",
  "givenName",
  "surname",
  "jobTitle",
  "department",
  "officeLocation",
].join(",");

/**
 * Search users in the Entra directory
 *
 * Searches by display name, email, or UPN prefix.
 * Requires a valid access token with User.Read.All or User.ReadBasic.All scope.
 *
 * @example
 * ```typescript
 * const result = await searchUsers(accessToken, "john");
 * console.log(result.users); // Users matching "john"
 * ```
 */
export async function searchUsers(
  accessToken: string,
  query: string,
  options: {
    /** Maximum results to return (default: 10, max: 50) */
    limit?: number;
    /** Include guest users (default: false) */
    includeGuests?: boolean;
  } = {},
): Promise<DirectorySearchResult> {
  const limit = Math.min(options.limit || 10, 50);
  const sanitizedQuery = sanitizeSearchQuery(query);

  if (!sanitizedQuery) {
    return { users: [] };
  }

  // Build OData filter
  // Search by displayName, mail, or userPrincipalName prefix
  const filters = [
    `startswith(displayName,'${sanitizedQuery}')`,
    `startswith(mail,'${sanitizedQuery}')`,
    `startswith(userPrincipalName,'${sanitizedQuery}')`,
  ];

  let filter = `(${filters.join(" or ")})`;

  // Optionally exclude guest users
  if (!options.includeGuests) {
    filter += " and userType eq 'Member'";
  }

  const params = new URLSearchParams({
    $filter: filter,
    $select: USER_SELECT_FIELDS,
    $top: limit.toString(),
    $count: "true",
  });

  const response = await fetch(`${GRAPH_API_BASE}/users?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ConsistencyLevel: "eventual", // Required for $count
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new DirectorySearchError(
      `Directory search failed: ${response.status}`,
      response.status,
      error,
    );
  }

  const data: GraphUsersResponse = await response.json();

  return {
    users: data.value.map(mapGraphUser),
    totalCount: data["@odata.count"],
    nextLink: data["@odata.nextLink"],
  };
}

/**
 * Get a specific user by their Microsoft object ID
 */
export async function getUserById(accessToken: string, userId: string): Promise<EntraUser | null> {
  const response = await fetch(`${GRAPH_API_BASE}/users/${userId}?$select=${USER_SELECT_FIELDS}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new DirectorySearchError(
      `Failed to get user: ${response.status}`,
      response.status,
      error,
    );
  }

  const data: GraphUser = await response.json();
  return mapGraphUser(data);
}

/**
 * Get a user by their email address
 */
export async function getUserByEmail(
  accessToken: string,
  email: string,
): Promise<EntraUser | null> {
  const sanitizedEmail = sanitizeSearchQuery(email);
  if (!sanitizedEmail) {
    return null;
  }

  const params = new URLSearchParams({
    $filter: `mail eq '${sanitizedEmail}' or userPrincipalName eq '${sanitizedEmail}'`,
    $select: USER_SELECT_FIELDS,
    $top: "1",
  });

  const response = await fetch(`${GRAPH_API_BASE}/users?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new DirectorySearchError(
      `Failed to find user by email: ${response.status}`,
      response.status,
      error,
    );
  }

  const data: GraphUsersResponse = await response.json();
  if (data.value.length === 0) {
    return null;
  }

  return mapGraphUser(data.value[0]);
}

/**
 * Get current authenticated user's profile
 */
export async function getCurrentUser(accessToken: string): Promise<EntraUser> {
  const response = await fetch(`${GRAPH_API_BASE}/me?$select=${USER_SELECT_FIELDS}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new DirectorySearchError(
      `Failed to get current user: ${response.status}`,
      response.status,
      error,
    );
  }

  const data: GraphUser = await response.json();
  return mapGraphUser(data);
}

/**
 * List all users in the directory (with pagination)
 *
 * Use for bulk operations or full directory sync.
 */
export async function listUsers(
  accessToken: string,
  options: {
    limit?: number;
    nextLink?: string;
    includeGuests?: boolean;
  } = {},
): Promise<DirectorySearchResult> {
  const limit = Math.min(options.limit || 100, 999);

  let url: string;
  if (options.nextLink) {
    url = options.nextLink;
  } else {
    const params = new URLSearchParams({
      $select: USER_SELECT_FIELDS,
      $top: limit.toString(),
      $count: "true",
    });

    if (!options.includeGuests) {
      params.set("$filter", "userType eq 'Member'");
    }

    url = `${GRAPH_API_BASE}/users?${params.toString()}`;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ConsistencyLevel: "eventual",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new DirectorySearchError(
      `Failed to list users: ${response.status}`,
      response.status,
      error,
    );
  }

  const data: GraphUsersResponse = await response.json();

  return {
    users: data.value.map(mapGraphUser),
    totalCount: data["@odata.count"],
    nextLink: data["@odata.nextLink"],
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map Graph API user to our EntraUser type
 */
function mapGraphUser(user: GraphUser): EntraUser {
  return {
    id: user.id,
    displayName: user.displayName,
    mail: user.mail,
    userPrincipalName: user.userPrincipalName,
    givenName: user.givenName,
    surname: user.surname,
    jobTitle: user.jobTitle,
    department: user.department,
    officeLocation: user.officeLocation,
  };
}

/**
 * Sanitize search query to prevent OData injection
 */
function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/['"\\]/g, "") // Remove quotes and backslashes
    .slice(0, 100); // Limit length
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Error class for directory search failures
 */
export class DirectorySearchError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DirectorySearchError";
  }

  /**
   * Check if error is due to insufficient permissions
   */
  isPermissionError(): boolean {
    return this.statusCode === 403;
  }

  /**
   * Check if error is due to invalid/expired token
   */
  isAuthError(): boolean {
    return this.statusCode === 401;
  }

  /**
   * Check if error is due to rate limiting
   */
  isRateLimited(): boolean {
    return this.statusCode === 429;
  }
}
