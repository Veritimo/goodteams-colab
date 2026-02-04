// API client for /api/platform/* endpoints

const API_BASE = "/api/platform";

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: errorText || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Organizations
export interface Organization {
  id: string;
  name: string;
  status: string;
  externalTenantId: string | null;
  authorizedModels: string[];
  defaultModelId: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function getOrganizations(): Promise<ApiResponse<Organization[]>> {
  // Note: This returns the current org, for multi-org we'd need a different endpoint
  const result = await fetchApi<Organization>("/org");
  if (result.data) {
    return { data: [result.data] };
  }
  return { data: [], error: result.error };
}

export async function getOrganization(id: string): Promise<ApiResponse<Organization>> {
  return fetchApi<Organization>(`/org`);
}

export async function updateOrganization(
  data: Partial<Pick<Organization, "name" | "defaultModelId" | "authorizedModels">>,
): Promise<ApiResponse<Organization>> {
  return fetchApi<Organization>("/org", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function disconnectEntra(): Promise<
  ApiResponse<{ success: boolean; message: string }>
> {
  return fetchApi<{ success: boolean; message: string }>("/org/entra/disconnect", {
    method: "POST",
  });
}

// Users
export interface User {
  id: string;
  email: string;
  username: string | null;
  role: string;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UsersListResponse {
  users: User[];
  total: number;
}

export async function getUsers(): Promise<ApiResponse<User[]>> {
  const result = await fetchApi<UsersListResponse>("/users");
  if (result.data) {
    return { data: result.data.users };
  }
  return { data: [], error: result.error };
}

export async function getUser(id: string): Promise<ApiResponse<User>> {
  return fetchApi<User>(`/users/${id}`);
}

export async function updateUserRole(userId: string, role: string): Promise<ApiResponse<User>> {
  return fetchApi<User>(`/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

export async function removeUser(userId: string): Promise<ApiResponse<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/users/${userId}`, {
    method: "DELETE",
  });
}

// Invitations
export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  invitedBy: {
    id: string;
    email: string;
    name: string | null;
  };
  createdAt: string;
  expiresAt: string;
}

export interface InvitationsListResponse {
  invitations: Invitation[];
  total: number;
}

export async function getInvitations(): Promise<ApiResponse<Invitation[]>> {
  const result = await fetchApi<InvitationsListResponse>("/invitations");
  if (result.data) {
    return { data: result.data.invitations };
  }
  return { data: [], error: result.error };
}

export async function createInvitation(
  email: string,
  role: string,
): Promise<ApiResponse<Invitation>> {
  return fetchApi<Invitation>("/invitations", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export async function revokeInvitation(id: string): Promise<ApiResponse<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/invitations/${id}`, {
    method: "DELETE",
  });
}

// Connectors
export type ConnectionType = "SQL_SERVER" | "POSTGRESQL" | "MYSQL" | "DATAVERSE" | "SALESFORCE";
export type ConnectionStatus = "PENDING" | "CONNECTED" | "ERROR" | "DISABLED";

export interface Connector {
  id: string;
  organizationId: string;
  type: ConnectionType;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  status: ConnectionStatus;
  lastHealthCheck: string | null;
  healthMessage: string | null;
  isReadOnly: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface ConnectorsListResponse {
  connectors: Connector[];
  total: number;
}

export async function getConnectors(): Promise<ApiResponse<Connector[]>> {
  const result = await fetchApi<ConnectorsListResponse>("/connectors");
  if (result.data) {
    return { data: result.data.connectors };
  }
  return { data: [], error: result.error };
}

export async function getConnector(id: string): Promise<ApiResponse<Connector>> {
  return fetchApi<Connector>(`/connectors/${id}`);
}

export interface CreateConnectorRequest {
  type: ConnectionType;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  credentials?: Record<string, unknown>;
  isReadOnly?: boolean;
}

export async function createConnector(
  data: CreateConnectorRequest,
): Promise<ApiResponse<Connector>> {
  return fetchApi<Connector>("/connectors", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateConnector(
  id: string,
  data: Partial<CreateConnectorRequest>,
): Promise<ApiResponse<Connector>> {
  return fetchApi<Connector>(`/connectors/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteConnector(id: string): Promise<ApiResponse<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/connectors/${id}`, {
    method: "DELETE",
  });
}

export interface TestConnectionResult {
  success: boolean;
  latencyMs: number;
  message: string;
  testedAt: string;
}

export async function testConnector(id: string): Promise<ApiResponse<TestConnectionResult>> {
  return fetchApi<TestConnectionResult>(`/connectors/${id}/test`, {
    method: "POST",
  });
}

// Workflows
export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive" | "draft";
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export async function getWorkflows(): Promise<ApiResponse<Workflow[]>> {
  return fetchApi<Workflow[]>("/workflows");
}

// Knowledge Base (Collections)
export interface KnowledgeCollection {
  id: string;
  name: string;
  description: string | null;
  sourceType: "sharepoint" | "confluence" | "upload" | "url";
  sourceUrl: string | null;
  documentCount: number;
  status: "syncing" | "ready" | "error";
  lastSyncAt: string | null;
  syncSchedule: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getKnowledgeCollections(): Promise<ApiResponse<KnowledgeCollection[]>> {
  // Note: This endpoint may not exist yet - returns mock data for stub UI
  return fetchApi<KnowledgeCollection[]>("/knowledge-base/collections");
}

// Skills
export interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export async function getSkills(): Promise<ApiResponse<Skill[]>> {
  return fetchApi<Skill[]>("/skills");
}

// Models
export interface Model {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export async function getModels(): Promise<ApiResponse<Model[]>> {
  return fetchApi<Model[]>("/models");
}

// Audit Logs
export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export async function getAuditLogs(): Promise<ApiResponse<AuditLog[]>> {
  return fetchApi<AuditLog[]>("/audit-logs");
}

// Dashboard stats
export interface DashboardStats {
  totalOrganizations: number;
  totalUsers: number;
  activeConnectors: number;
  activeWorkflows: number;
  totalWorkflows: number;
}

export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  // Fetch multiple endpoints and aggregate
  const [orgs, users, connectors, workflows] = await Promise.all([
    getOrganizations(),
    getUsers(),
    getConnectors(),
    getWorkflows(),
  ]);

  return {
    data: {
      totalOrganizations: orgs.data?.length ?? 0,
      totalUsers: users.data?.length ?? 0,
      activeConnectors: connectors.data?.filter((c) => c.status === "active").length ?? 0,
      activeWorkflows: workflows.data?.filter((w) => w.status === "active").length ?? 0,
      totalWorkflows: workflows.data?.length ?? 0,
    },
  };
}
