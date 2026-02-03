/**
 * Contacts Operations Tests
 */

import type { Client } from "@microsoft/microsoft-graph-client";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listContacts,
  getContact,
  searchContacts,
  findContactByEmail,
  createContact,
  updateContact,
  deleteContact,
  listContactFolders,
  createContactFolder,
  deleteContactFolder,
  getContactPhoto,
  updateContactPhoto,
} from "../contacts.js";

// =============================================================================
// MOCK SETUP
// =============================================================================

function createMockClient(): Client {
  const mockRequest = {
    select: vi.fn().mockReturnThis(),
    top: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    orderby: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    responseType: vi.fn().mockReturnThis(),
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };

  return {
    api: vi.fn().mockReturnValue(mockRequest),
  } as unknown as Client;
}

// =============================================================================
// LIST CONTACTS TESTS
// =============================================================================

describe("listContacts", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should list contacts with default options", async () => {
    const mockContacts = [
      { id: "c1", displayName: "John Doe", emailAddresses: [{ address: "john@example.com" }] },
      { id: "c2", displayName: "Jane Smith", emailAddresses: [{ address: "jane@example.com" }] },
    ];

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: mockContacts });

    const result = await listContacts(client);

    expect(client.api).toHaveBeenCalledWith("/me/contacts");
    expect(mockRequest.select).toHaveBeenCalled();
    expect(mockRequest.top).toHaveBeenCalledWith(10);
    expect(mockRequest.orderby).toHaveBeenCalledWith("displayName");
    expect(result).toEqual(mockContacts);
  });

  it("should list contacts from a specific folder", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await listContacts(client, { folderId: "folder-123" });

    expect(client.api).toHaveBeenCalledWith("/me/contactFolders/folder-123/contacts");
  });

  it("should apply pagination options", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await listContacts(client, { top: 50, skip: 100 });

    expect(mockRequest.top).toHaveBeenCalledWith(50);
    expect(mockRequest.skip).toHaveBeenCalledWith(100);
  });

  it("should apply filter expression", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await listContacts(client, { filter: "companyName eq 'Acme'" });

    expect(mockRequest.filter).toHaveBeenCalledWith("companyName eq 'Acme'");
  });
});

// =============================================================================
// GET CONTACT TESTS
// =============================================================================

describe("getContact", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should get a single contact with full details", async () => {
    const mockContact = {
      id: "c1",
      displayName: "John Doe",
      givenName: "John",
      surname: "Doe",
      emailAddresses: [{ address: "john@example.com" }],
      businessPhones: ["+1-555-1234"],
      companyName: "Acme Corp",
      personalNotes: "Met at conference",
    };

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue(mockContact);

    const result = await getContact(client, "c1");

    expect(client.api).toHaveBeenCalledWith("/me/contacts/c1");
    expect(result).toEqual(mockContact);
  });
});

// =============================================================================
// SEARCH CONTACTS TESTS
// =============================================================================

describe("searchContacts", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should search contacts by name", async () => {
    const mockContacts = [
      { id: "c1", displayName: "John Doe" },
      { id: "c2", displayName: "Johnny Smith" },
    ];

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: mockContacts });

    const result = await searchContacts(client, "John");

    expect(client.api).toHaveBeenCalledWith("/me/contacts");
    expect(mockRequest.filter).toHaveBeenCalledWith(
      expect.stringContaining("startswith(displayName,'John')"),
    );
    expect(result).toEqual(mockContacts);
  });

  it("should escape special characters in search query", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await searchContacts(client, "O'Brien");

    expect(mockRequest.filter).toHaveBeenCalledWith(expect.stringContaining("O''Brien"));
  });

  it("should respect top parameter", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: [] });

    await searchContacts(client, "John", { top: 25 });

    expect(mockRequest.top).toHaveBeenCalledWith(25);
  });
});

describe("findContactByEmail", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should find contact by email address", async () => {
    const mockContacts = [
      { id: "c1", displayName: "John", emailAddresses: [{ address: "john@example.com" }] },
      { id: "c2", displayName: "Jane", emailAddresses: [{ address: "jane@example.com" }] },
    ];

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: mockContacts });

    const result = await findContactByEmail(client, "john@example.com");

    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe("John");
  });

  it("should be case-insensitive", async () => {
    const mockContacts = [
      { id: "c1", displayName: "John", emailAddresses: [{ address: "John@Example.com" }] },
    ];

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: mockContacts });

    const result = await findContactByEmail(client, "john@example.com");

    expect(result).toHaveLength(1);
  });
});

// =============================================================================
// CREATE CONTACT TESTS
// =============================================================================

describe("createContact", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should create a simple contact", async () => {
    const newContact = {
      givenName: "John",
      surname: "Doe",
      emailAddresses: [{ address: "john@example.com" }],
    };

    const createdContact = { id: "c-new", displayName: "John Doe", ...newContact };
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(createdContact);

    const result = await createContact(client, newContact);

    expect(client.api).toHaveBeenCalledWith("/me/contacts");
    expect(mockRequest.post).toHaveBeenCalledWith(
      expect.objectContaining({
        givenName: "John",
        surname: "Doe",
        displayName: "John Doe",
      }),
    );
    expect(result).toEqual(createdContact);
  });

  it("should use provided displayName", async () => {
    const newContact = {
      givenName: "John",
      displayName: "Johnny D",
    };

    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue({ id: "c-new", ...newContact });

    await createContact(client, newContact);

    expect(mockRequest.post).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Johnny D" }),
    );
  });

  it("should create contact with full details", async () => {
    const newContact = {
      givenName: "John",
      surname: "Doe",
      middleName: "Q",
      emailAddresses: [{ address: "john@example.com", name: "John Doe" }],
      businessPhones: ["+1-555-1234"],
      mobilePhone: "+1-555-5678",
      companyName: "Acme Corp",
      department: "Engineering",
      jobTitle: "Developer",
    };

    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue({ id: "c-new" });

    await createContact(client, newContact);

    expect(mockRequest.post).toHaveBeenCalledWith(expect.objectContaining(newContact));
  });
});

// =============================================================================
// UPDATE CONTACT TESTS
// =============================================================================

describe("updateContact", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should update contact fields", async () => {
    const updates = {
      jobTitle: "Senior Developer",
      department: "Platform",
    };

    const updatedContact = { id: "c1", ...updates };
    const mockRequest = (client.api as any)();
    mockRequest.patch.mockResolvedValue(updatedContact);

    const result = await updateContact(client, "c1", updates);

    expect(client.api).toHaveBeenCalledWith("/me/contacts/c1");
    expect(mockRequest.patch).toHaveBeenCalledWith(updates);
    expect(result.jobTitle).toBe("Senior Developer");
  });
});

// =============================================================================
// DELETE CONTACT TESTS
// =============================================================================

describe("deleteContact", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should delete a contact", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.delete.mockResolvedValue(undefined);

    await deleteContact(client, "c1");

    expect(client.api).toHaveBeenCalledWith("/me/contacts/c1");
    expect(mockRequest.delete).toHaveBeenCalled();
  });
});

// =============================================================================
// CONTACT FOLDER TESTS
// =============================================================================

describe("listContactFolders", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should list contact folders", async () => {
    const mockFolders = [
      { id: "f1", displayName: "Personal" },
      { id: "f2", displayName: "Work" },
    ];

    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue({ value: mockFolders });

    const result = await listContactFolders(client);

    expect(client.api).toHaveBeenCalledWith("/me/contactFolders");
    expect(result).toEqual(mockFolders);
  });
});

describe("createContactFolder", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should create a contact folder", async () => {
    const mockFolder = { id: "f-new", displayName: "VIPs" };
    const mockRequest = (client.api as any)();
    mockRequest.post.mockResolvedValue(mockFolder);

    const result = await createContactFolder(client, "VIPs");

    expect(client.api).toHaveBeenCalledWith("/me/contactFolders");
    expect(mockRequest.post).toHaveBeenCalledWith({ displayName: "VIPs" });
    expect(result).toEqual(mockFolder);
  });
});

describe("deleteContactFolder", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should delete a contact folder", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.delete.mockResolvedValue(undefined);

    await deleteContactFolder(client, "f1");

    expect(client.api).toHaveBeenCalledWith("/me/contactFolders/f1");
    expect(mockRequest.delete).toHaveBeenCalled();
  });
});

// =============================================================================
// CONTACT PHOTO TESTS
// =============================================================================

describe("getContactPhoto", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should get contact photo as base64", async () => {
    const photoBuffer = Buffer.from("fake-image-data");
    const mockRequest = (client.api as any)();
    mockRequest.get.mockResolvedValue(photoBuffer);

    const result = await getContactPhoto(client, "c1");

    expect(client.api).toHaveBeenCalledWith("/me/contacts/c1/photo/$value");
    expect(result).toBe(photoBuffer.toString("base64"));
  });

  it("should return null if photo not found", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockRejectedValue({ statusCode: 404 });

    const result = await getContactPhoto(client, "c1");

    expect(result).toBeNull();
  });

  it("should throw on other errors", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.get.mockRejectedValue(new Error("Network error"));

    await expect(getContactPhoto(client, "c1")).rejects.toThrow("Network error");
  });
});

describe("updateContactPhoto", () => {
  let client: Client;

  beforeEach(() => {
    client = createMockClient();
  });

  it("should update contact photo with base64 string", async () => {
    const base64Photo = Buffer.from("new-image-data").toString("base64");
    const mockRequest = (client.api as any)();
    mockRequest.put.mockResolvedValue(undefined);

    await updateContactPhoto(client, "c1", base64Photo);

    expect(client.api).toHaveBeenCalledWith("/me/contacts/c1/photo/$value");
    expect(mockRequest.header).toHaveBeenCalledWith("Content-Type", "image/jpeg");
    expect(mockRequest.put).toHaveBeenCalled();
  });

  it("should update contact photo with Buffer", async () => {
    const photoBuffer = Buffer.from("new-image-data");
    const mockRequest = (client.api as any)();
    mockRequest.put.mockResolvedValue(undefined);

    await updateContactPhoto(client, "c1", photoBuffer);

    expect(mockRequest.put).toHaveBeenCalledWith(photoBuffer);
  });

  it("should use custom content type", async () => {
    const mockRequest = (client.api as any)();
    mockRequest.put.mockResolvedValue(undefined);

    await updateContactPhoto(client, "c1", Buffer.from("png-data"), "image/png");

    expect(mockRequest.header).toHaveBeenCalledWith("Content-Type", "image/png");
  });
});
