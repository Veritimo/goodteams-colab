/**
 * Microsoft Outlook Contacts Operations
 *
 * Contact management via Microsoft Graph API.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/contact
 */

import type { Client } from "@microsoft/microsoft-graph-client";
import type {
  Contact,
  ListContactsOptions,
  NewContact,
  ContactUpdate,
  PagedResponse,
} from "./types.js";

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

/** Default fields to select for contacts */
const DEFAULT_CONTACT_SELECT = [
  "id",
  "displayName",
  "givenName",
  "surname",
  "emailAddresses",
  "businessPhones",
  "mobilePhone",
  "companyName",
  "jobTitle",
  "department",
];

/** Extended fields for full contact details */
const FULL_CONTACT_SELECT = [
  ...DEFAULT_CONTACT_SELECT,
  "middleName",
  "nickName",
  "homePhones",
  "businessAddress",
  "homeAddress",
  "birthday",
  "personalNotes",
];

/** Default number of items to return */
const DEFAULT_TOP = 10;

// =============================================================================
// CONTACT OPERATIONS
// =============================================================================

/**
 * List contacts
 *
 * @param client - Authenticated Graph client
 * @param options - Query options (pagination, filters)
 * @returns Array of contacts
 *
 * @example
 * ```typescript
 * // List all contacts
 * const contacts = await listContacts(client, { top: 50 });
 *
 * // Filter by company
 * const coworkers = await listContacts(client, {
 *   filter: "companyName eq 'Acme Corp'",
 * });
 * ```
 */
export async function listContacts(
  client: Client,
  options: ListContactsOptions = {},
): Promise<Contact[]> {
  const {
    folderId,
    top = DEFAULT_TOP,
    skip,
    select = DEFAULT_CONTACT_SELECT,
    orderBy = "displayName",
    filter,
  } = options;

  const endpoint = folderId ? `/me/contactFolders/${folderId}/contacts` : "/me/contacts";

  let request = client.api(endpoint).select(select).top(top).orderby(orderBy);

  if (skip !== undefined) {
    request = request.skip(skip);
  }

  if (filter) {
    request = request.filter(filter);
  }

  const response: PagedResponse<Contact> = await request.get();
  return response.value;
}

/**
 * Get a single contact with full details
 *
 * @param client - Authenticated Graph client
 * @param contactId - Contact ID
 * @returns Full contact details
 *
 * @example
 * ```typescript
 * const contact = await getContact(client, "AAMkAGI2...");
 * console.log(contact.displayName, contact.emailAddresses);
 * ```
 */
export async function getContact(client: Client, contactId: string): Promise<Contact> {
  return client.api(`/me/contacts/${contactId}`).select(FULL_CONTACT_SELECT).get();
}

/**
 * Search contacts by name or email
 *
 * @param client - Authenticated Graph client
 * @param query - Search query (name or email)
 * @param options - Additional query options
 * @returns Matching contacts
 *
 * @example
 * ```typescript
 * // Search by name
 * const contacts = await searchContacts(client, "John");
 *
 * // Search by email domain
 * const contacts = await searchContacts(client, "@acme.com");
 * ```
 */
export async function searchContacts(
  client: Client,
  query: string,
  options: { top?: number } = {},
): Promise<Contact[]> {
  const { top = DEFAULT_TOP } = options;

  // Use $filter with startsWith for partial matching
  // Note: Graph API search on contacts is limited compared to messages
  // Using filter with startsWith for displayName or checking email
  const response: PagedResponse<Contact> = await client
    .api("/me/contacts")
    .select(DEFAULT_CONTACT_SELECT)
    .filter(
      `startswith(displayName,'${escapeFilterValue(query)}') or ` +
        `startswith(givenName,'${escapeFilterValue(query)}') or ` +
        `startswith(surname,'${escapeFilterValue(query)}')`,
    )
    .top(top)
    .get();

  return response.value;
}

/**
 * Search contacts by email address
 *
 * @param client - Authenticated Graph client
 * @param email - Email address to search for
 * @returns Matching contacts
 */
export async function findContactByEmail(client: Client, email: string): Promise<Contact[]> {
  // Graph API doesn't support direct filter on emailAddresses collection
  // So we need to search with broader criteria and filter client-side
  const response: PagedResponse<Contact> = await client
    .api("/me/contacts")
    .select([...DEFAULT_CONTACT_SELECT, "emailAddresses"])
    .top(100)
    .get();

  const normalizedEmail = email.toLowerCase();
  return response.value.filter((contact) =>
    contact.emailAddresses?.some((e) => e.address?.toLowerCase() === normalizedEmail),
  );
}

/**
 * Create a new contact
 *
 * @param client - Authenticated Graph client
 * @param contact - Contact details
 * @returns Created contact
 *
 * @example
 * ```typescript
 * const contact = await createContact(client, {
 *   givenName: "John",
 *   surname: "Doe",
 *   emailAddresses: [
 *     { address: "john.doe@example.com", name: "John Doe" }
 *   ],
 *   businessPhones: ["+1-555-1234"],
 *   companyName: "Acme Corp",
 *   jobTitle: "Developer",
 * });
 * ```
 */
export async function createContact(client: Client, contact: NewContact): Promise<Contact> {
  // Build display name if not provided
  const body = {
    ...contact,
    displayName: contact.displayName || buildDisplayName(contact),
  };

  return client.api("/me/contacts").post(body);
}

/**
 * Update an existing contact
 *
 * @param client - Authenticated Graph client
 * @param contactId - Contact ID
 * @param updates - Fields to update
 * @returns Updated contact
 *
 * @example
 * ```typescript
 * const updated = await updateContact(client, contactId, {
 *   jobTitle: "Senior Developer",
 *   department: "Engineering",
 * });
 * ```
 */
export async function updateContact(
  client: Client,
  contactId: string,
  updates: ContactUpdate,
): Promise<Contact> {
  return client.api(`/me/contacts/${contactId}`).patch(updates);
}

/**
 * Delete a contact
 *
 * @param client - Authenticated Graph client
 * @param contactId - Contact ID
 *
 * @example
 * ```typescript
 * await deleteContact(client, contactId);
 * ```
 */
export async function deleteContact(client: Client, contactId: string): Promise<void> {
  await client.api(`/me/contacts/${contactId}`).delete();
}

// =============================================================================
// CONTACT FOLDER OPERATIONS
// =============================================================================

/**
 * Contact folder information
 */
export interface ContactFolder {
  id: string;
  displayName?: string;
  parentFolderId?: string;
}

/**
 * List contact folders
 *
 * @param client - Authenticated Graph client
 * @returns Array of contact folders
 */
export async function listContactFolders(client: Client): Promise<ContactFolder[]> {
  const response: PagedResponse<ContactFolder> = await client
    .api("/me/contactFolders")
    .select(["id", "displayName", "parentFolderId"])
    .get();

  return response.value;
}

/**
 * Create a contact folder
 *
 * @param client - Authenticated Graph client
 * @param displayName - Folder name
 * @returns Created folder
 */
export async function createContactFolder(
  client: Client,
  displayName: string,
): Promise<ContactFolder> {
  return client.api("/me/contactFolders").post({
    displayName,
  });
}

/**
 * Delete a contact folder
 *
 * @param client - Authenticated Graph client
 * @param folderId - Folder ID
 */
export async function deleteContactFolder(client: Client, folderId: string): Promise<void> {
  await client.api(`/me/contactFolders/${folderId}`).delete();
}

// =============================================================================
// CONTACT PHOTO OPERATIONS
// =============================================================================

/**
 * Get contact photo as base64
 *
 * @param client - Authenticated Graph client
 * @param contactId - Contact ID
 * @returns Base64 encoded photo or null if not available
 */
export async function getContactPhoto(client: Client, contactId: string): Promise<string | null> {
  try {
    const response = await client
      .api(`/me/contacts/${contactId}/photo/$value`)
      .responseType("arraybuffer" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .get();

    const buffer = Buffer.from(response);
    return buffer.toString("base64");
  } catch (error: unknown) {
    // Photo not found is common, return null instead of throwing
    if (isGraphError(error) && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Update contact photo
 *
 * @param client - Authenticated Graph client
 * @param contactId - Contact ID
 * @param photoData - Photo as base64 or Buffer
 * @param contentType - MIME type (default: image/jpeg)
 */
export async function updateContactPhoto(
  client: Client,
  contactId: string,
  photoData: string | Buffer,
  contentType = "image/jpeg",
): Promise<void> {
  const buffer = typeof photoData === "string" ? Buffer.from(photoData, "base64") : photoData;

  await client
    .api(`/me/contacts/${contactId}/photo/$value`)
    .header("Content-Type", contentType)
    .put(buffer);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build display name from contact parts
 */
function buildDisplayName(contact: NewContact): string {
  const parts: string[] = [];

  if (contact.givenName) parts.push(contact.givenName);
  if (contact.middleName) parts.push(contact.middleName);
  if (contact.surname) parts.push(contact.surname);

  return parts.join(" ") || "Unknown";
}

/**
 * Escape special characters for OData filter values
 */
function escapeFilterValue(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Type guard for Graph errors
 */
function isGraphError(error: unknown): error is { statusCode: number } {
  return typeof error === "object" && error !== null && "statusCode" in error;
}
