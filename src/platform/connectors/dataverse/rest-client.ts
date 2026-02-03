/**
 * Dataverse REST Client
 *
 * REST API client for Dataverse operations not supported via TDS endpoint.
 * Handles CRUD operations, metadata retrieval, and OData queries.
 */

import { ClientSecretCredential } from "@azure/identity";
import {
  DataverseConfig,
  DataverseCredentials,
  EntityMetadata,
  AttributeMetadata,
  OptionSetValue,
  RestApiError,
  DATAVERSE_DEFAULTS,
} from "./types.js";

/**
 * REST Client options
 */
export interface RestClientOptions {
  /** Dataverse configuration */
  config: DataverseConfig;
  /** Azure AD credentials */
  credentials: DataverseCredentials;
}

/**
 * OData query options
 */
export interface ODataQueryOptions {
  /** Select specific columns */
  select?: string[];
  /** Filter expression */
  filter?: string;
  /** Order by expression */
  orderBy?: string;
  /** Maximum results */
  top?: number;
  /** Skip count for pagination */
  skip?: number;
  /** Expand related entities */
  expand?: string[];
}

/**
 * REST Client for Dataverse Web API
 */
export class RestClient {
  private config: DataverseConfig;
  private credentials: DataverseCredentials;
  private credential: ClientSecretCredential;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(options: RestClientOptions) {
    this.config = options.config;
    this.credentials = options.credentials;
    this.credential = new ClientSecretCredential(
      options.credentials.tenantId,
      options.credentials.clientId,
      options.credentials.clientSecret,
    );
  }

  /**
   * Get or refresh Azure AD access token
   */
  private async getAccessToken(): Promise<string> {
    // Check if token is still valid (with 5 minute buffer)
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    const scope = `https://${this.config.environmentUrl}/.default`;
    const tokenResponse = await this.credential.getToken(scope);

    if (!tokenResponse?.token) {
      throw new RestApiError("Failed to acquire Azure AD token");
    }

    this.accessToken = tokenResponse.token;
    // Set expiry with 5 minute buffer
    this.tokenExpiry = new Date(tokenResponse.expiresOnTimestamp - 5 * 60 * 1000);

    return this.accessToken;
  }

  /**
   * Get base API URL
   */
  private getBaseUrl(): string {
    return `https://${this.config.environmentUrl}/api/data/v9.2`;
  }

  /**
   * Make an authenticated request to the Dataverse API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = path.startsWith("http") ? path : `${this.getBaseUrl()}${path}`;

    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    };

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.config.timeoutMs ?? DATAVERSE_DEFAULTS.TIMEOUT_MS),
    });

    if (!response.ok) {
      let errorDetails: unknown;
      try {
        errorDetails = await response.json();
      } catch {
        errorDetails = await response.text();
      }
      throw new RestApiError(
        `Dataverse API error: ${response.statusText}`,
        response.status,
        errorDetails,
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get entity metadata (schema)
   */
  async getEntityMetadata(entityName: string): Promise<EntityMetadata> {
    const response = await this.request<{
      LogicalName: string;
      DisplayName: { UserLocalizedLabel: { Label: string } };
      PrimaryIdAttribute: string;
      PrimaryNameAttribute: string;
      ObjectTypeCode: number;
      ChangeTrackingEnabled: boolean;
    }>(
      "GET",
      `/EntityDefinitions(LogicalName='${entityName}')?$select=LogicalName,DisplayName,PrimaryIdAttribute,PrimaryNameAttribute,ObjectTypeCode,ChangeTrackingEnabled`,
    );

    // Fetch attributes separately
    const attributes = await this.getAttributeMetadata(entityName);

    return {
      logicalName: response.LogicalName,
      displayName: response.DisplayName?.UserLocalizedLabel?.Label ?? response.LogicalName,
      primaryIdAttribute: response.PrimaryIdAttribute,
      primaryNameAttribute: response.PrimaryNameAttribute,
      objectTypeCode: response.ObjectTypeCode,
      changeTrackingEnabled: response.ChangeTrackingEnabled,
      attributes,
    };
  }

  /**
   * Get attribute metadata for an entity
   */
  async getAttributeMetadata(entityName: string): Promise<AttributeMetadata[]> {
    interface ApiAttribute {
      LogicalName: string;
      DisplayName: { UserLocalizedLabel: { Label: string } | null } | null;
      AttributeType: string;
      SchemaName: string;
      IsValidForCreate: boolean;
      IsValidForUpdate: boolean;
      RequiredLevel: { Value: string };
      MaxLength?: number;
      Targets?: string[];
    }

    const response = await this.request<{ value: ApiAttribute[] }>(
      "GET",
      `/EntityDefinitions(LogicalName='${entityName}')/Attributes?$select=LogicalName,DisplayName,AttributeType,SchemaName,IsValidForCreate,IsValidForUpdate,RequiredLevel,MaxLength,Targets`,
    );

    return response.value.map((attr) => ({
      logicalName: attr.LogicalName,
      displayName: attr.DisplayName?.UserLocalizedLabel?.Label ?? attr.LogicalName,
      attributeType: attr.AttributeType,
      schemaName: attr.SchemaName,
      isValidForCreate: attr.IsValidForCreate,
      isValidForUpdate: attr.IsValidForUpdate,
      isRequired: attr.RequiredLevel?.Value === "ApplicationRequired",
      maxLength: attr.MaxLength,
      targets: attr.Targets,
    }));
  }

  /**
   * Get option set values for a picklist attribute
   */
  async getOptionSetValues(entityName: string, attributeName: string): Promise<OptionSetValue[]> {
    interface ApiOption {
      Value: number;
      Label: { UserLocalizedLabel: { Label: string } };
    }

    const response = await this.request<{
      OptionSet: { Options: ApiOption[] };
    }>(
      "GET",
      `/EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${attributeName}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options)`,
    );

    return (
      response.OptionSet?.Options?.map((opt) => ({
        value: opt.Value,
        label: opt.Label?.UserLocalizedLabel?.Label ?? String(opt.Value),
      })) ?? []
    );
  }

  /**
   * Execute an OData query
   */
  async query(entitySetName: string, options?: ODataQueryOptions): Promise<unknown[]> {
    let path = `/${entitySetName}`;
    const params: string[] = [];

    if (options?.select?.length) {
      params.push(`$select=${options.select.join(",")}`);
    }
    if (options?.filter) {
      params.push(`$filter=${encodeURIComponent(options.filter)}`);
    }
    if (options?.orderBy) {
      params.push(`$orderby=${options.orderBy}`);
    }
    if (options?.top !== undefined) {
      params.push(`$top=${options.top}`);
    }
    if (options?.skip !== undefined) {
      params.push(`$skip=${options.skip}`);
    }
    if (options?.expand?.length) {
      params.push(`$expand=${options.expand.join(",")}`);
    }

    if (params.length > 0) {
      path += `?${params.join("&")}`;
    }

    const response = await this.request<{ value: unknown[] }>("GET", path);
    return response.value;
  }

  /**
   * Get a single record by ID
   */
  async getRecord(entitySetName: string, id: string, select?: string[]): Promise<unknown> {
    let path = `/${entitySetName}(${id})`;
    if (select?.length) {
      path += `?$select=${select.join(",")}`;
    }
    return this.request("GET", path);
  }

  /**
   * Create a new record
   */
  async createRecord(entitySetName: string, data: Record<string, unknown>): Promise<string> {
    const response = await fetch(`${this.getBaseUrl()}/${entitySetName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Accept: "application/json",
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorDetails = await response.json().catch(() => response.text());
      throw new RestApiError(
        `Failed to create record: ${response.statusText}`,
        response.status,
        errorDetails,
      );
    }

    // Extract ID from OData-EntityId header or response body
    const entityIdHeader = response.headers.get("OData-EntityId");
    if (entityIdHeader) {
      const match = entityIdHeader.match(/\(([^)]+)\)/);
      if (match) {
        return match[1];
      }
    }

    // Fallback to response body
    const result = (await response.json()) as Record<string, unknown>;
    const idKey = Object.keys(result).find((k) => k.endsWith("id"));
    return idKey ? String(result[idKey]) : "";
  }

  /**
   * Update an existing record
   */
  async updateRecord(
    entitySetName: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.request("PATCH", `/${entitySetName}(${id})`, data);
  }

  /**
   * Delete a record
   */
  async deleteRecord(entitySetName: string, id: string): Promise<void> {
    await this.request("DELETE", `/${entitySetName}(${id})`);
  }

  /**
   * Execute a batch request
   */
  async executeBatch(requests: BatchRequest[]): Promise<BatchResponse[]> {
    const batchId = `batch_${Date.now()}`;
    const changesetId = `changeset_${Date.now()}`;

    let batchBody = "";
    let contentId = 1;

    // Build multipart batch body
    for (const req of requests) {
      if (req.method !== "GET") {
        // Changeset for write operations
        batchBody += `--${batchId}\r\n`;
        batchBody += `Content-Type: multipart/mixed; boundary=${changesetId}\r\n\r\n`;
        batchBody += `--${changesetId}\r\n`;
        batchBody += `Content-Type: application/http\r\n`;
        batchBody += `Content-Transfer-Encoding: binary\r\n`;
        batchBody += `Content-ID: ${contentId++}\r\n\r\n`;
        batchBody += `${req.method} ${this.getBaseUrl()}${req.path} HTTP/1.1\r\n`;
        batchBody += `Content-Type: application/json\r\n\r\n`;
        if (req.body) {
          batchBody += JSON.stringify(req.body);
        }
        batchBody += `\r\n--${changesetId}--\r\n`;
      } else {
        batchBody += `--${batchId}\r\n`;
        batchBody += `Content-Type: application/http\r\n`;
        batchBody += `Content-Transfer-Encoding: binary\r\n\r\n`;
        batchBody += `GET ${this.getBaseUrl()}${req.path} HTTP/1.1\r\n`;
        batchBody += `Accept: application/json\r\n\r\n`;
      }
    }
    batchBody += `--${batchId}--\r\n`;

    const response = await fetch(`${this.getBaseUrl()}/$batch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Accept: "application/json",
        "Content-Type": `multipart/mixed; boundary=${batchId}`,
      },
      body: batchBody,
    });

    if (!response.ok) {
      throw new RestApiError(`Batch request failed: ${response.statusText}`, response.status);
    }

    // Parse batch response (simplified - real implementation would parse multipart)
    const responseText = await response.text();
    return this.parseBatchResponse(responseText);
  }

  /**
   * Parse batch response (simplified)
   */
  private parseBatchResponse(responseText: string): BatchResponse[] {
    // This is a simplified parser - real implementation would handle multipart properly
    const responses: BatchResponse[] = [];
    const parts = responseText.split(/--batch[_a-z0-9]+/i);

    for (const part of parts) {
      if (part.includes("HTTP/1.1")) {
        const statusMatch = part.match(/HTTP\/1\.1 (\d+)/);
        const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
        const bodyMatch = part.match(/\{[\s\S]*\}/);
        const body = bodyMatch ? JSON.parse(bodyMatch[0]) : undefined;
        responses.push({ status, body });
      }
    }

    return responses;
  }

  /**
   * Test connection health
   */
  async testConnection(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();
    try {
      await this.request("GET", "/WhoAmI");
      return {
        healthy: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Batch request structure
 */
export interface BatchRequest {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
}

/**
 * Batch response structure
 */
export interface BatchResponse {
  status: number;
  body?: unknown;
}

/**
 * Create a REST client from config and credentials
 */
export function createRestClient(
  config: DataverseConfig,
  credentials: DataverseCredentials,
): RestClient {
  return new RestClient({ config, credentials });
}
