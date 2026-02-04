// API client for Platform Admin - /api/platform/* endpoints with platform-wide access

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
      credentials: "include",
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

// Organizations (Platform-wide)
export interface Organization {
  id: string;
  name: string;
  status: "active" | "suspended" | "inactive";
  externalTenantId: string | null;
  authorizedModels: string[];
  defaultModelId: string | null;
  memberCount: number;
  subscriptionTier: "free" | "pro" | "enterprise";
  createdAt: string;
  updatedAt: string;
}

export async function getAllOrganizations(): Promise<ApiResponse<Organization[]>> {
  return fetchApi<Organization[]>("/admin/organizations");
}

export async function getOrganization(id: string): Promise<ApiResponse<Organization>> {
  return fetchApi<Organization>(`/admin/organizations/${id}`);
}

export async function updateOrganization(
  id: string,
  data: Partial<Pick<Organization, "name" | "status" | "subscriptionTier">>,
): Promise<ApiResponse<Organization>> {
  return fetchApi<Organization>(`/admin/organizations/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function createOrganization(data: {
  name: string;
  externalTenantId?: string;
}): Promise<ApiResponse<Organization>> {
  return fetchApi<Organization>("/admin/organizations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Platform Users (all users across all orgs)
export interface PlatformUser {
  id: string;
  email: string;
  username: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "USER" | "VIEWER";
  organizationId: string;
  organizationName: string;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getAllUsers(): Promise<ApiResponse<PlatformUser[]>> {
  return fetchApi<PlatformUser[]>("/admin/users");
}

// Subscriptions
export interface Subscription {
  id: string;
  organizationId: string;
  organizationName: string;
  tier: "free" | "pro" | "enterprise";
  status: "active" | "canceled" | "past_due";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  monthlyApiCalls: number;
  apiCallLimit: number;
}

export async function getSubscriptions(): Promise<ApiResponse<Subscription[]>> {
  return fetchApi<Subscription[]>("/admin/subscriptions");
}

// Platform Settings
export interface PlatformSettings {
  maintenanceMode: boolean;
  allowSignups: boolean;
  defaultSubscriptionTier: "free" | "pro" | "enterprise";
  featureFlags: Record<string, boolean>;
  announcementBanner: string | null;
}

export async function getPlatformSettings(): Promise<ApiResponse<PlatformSettings>> {
  return fetchApi<PlatformSettings>("/admin/settings");
}

export async function updatePlatformSettings(
  data: Partial<PlatformSettings>,
): Promise<ApiResponse<PlatformSettings>> {
  return fetchApi<PlatformSettings>("/admin/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// System Health
export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  services: Array<{
    name: string;
    status: "up" | "down" | "degraded";
    latencyMs: number;
    lastCheck: string;
  }>;
  metrics: {
    totalApiCalls24h: number;
    errorRate24h: number;
    avgLatencyMs: number;
    activeUsers24h: number;
  };
}

export async function getSystemHealth(): Promise<ApiResponse<SystemHealth>> {
  return fetchApi<SystemHealth>("/admin/health");
}

// Platform Dashboard Stats
export interface PlatformDashboardStats {
  totalOrganizations: number;
  totalUsers: number;
  activeOrganizations: number;
  totalApiCalls30d: number;
  revenueThisMonth: number;
  newOrgsThisMonth: number;
}

export async function getPlatformDashboardStats(): Promise<ApiResponse<PlatformDashboardStats>> {
  return fetchApi<PlatformDashboardStats>("/admin/stats");
}
