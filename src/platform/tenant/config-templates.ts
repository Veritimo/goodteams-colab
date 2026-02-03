/**
 * Tenant Configuration Templates
 *
 * Plan-based default configurations, feature flags, and resource limits.
 * Used by the gateway provisioner to configure new tenant gateways.
 */

/** Plan types available */
export type Plan = "free" | "pro" | "enterprise";

/**
 * Feature flags available per plan
 */
export interface PlanFeatures {
  /** Enable voice/audio input and output */
  voice: boolean;
  /** Enable file upload processing */
  fileUpload: boolean;
  /** Enable image analysis capabilities */
  imageAnalysis: boolean;
  /** Enable code execution sandbox */
  codeExecution: boolean;
  /** Enable browser automation */
  browserAutomation: boolean;
  /** Enable web search capabilities */
  webSearch: boolean;
  /** Enable custom system prompts */
  customSystemPrompt: boolean;
  /** Enable API access */
  apiAccess: boolean;
  /** Enable webhook integrations */
  webhooks: boolean;
  /** Enable advanced memory features */
  advancedMemory: boolean;
  /** Enable priority support queue */
  prioritySupport: boolean;
  /** Enable custom model selection */
  customModels: boolean;
}

/**
 * Resource limits per plan
 */
export interface PlanLimits {
  /** Maximum tokens per day */
  maxTokensPerDay: number;
  /** Maximum concurrent sessions */
  maxConcurrentSessions: number;
  /** Maximum memory in MB for gateway process */
  maxMemoryMb: number;
  /** Maximum file upload size in MB */
  maxFileUploadMb: number;
  /** Maximum message history retained */
  maxMessageHistory: number;
  /** Session timeout in minutes */
  sessionTimeoutMinutes: number;
  /** Rate limit: requests per minute */
  rateLimitPerMinute: number;
}

/**
 * Default model per plan
 */
export const PLAN_MODELS: Record<Plan, string> = {
  free: "anthropic/claude-sonnet-4-20250514",
  pro: "anthropic/claude-sonnet-4-20250514",
  enterprise: "anthropic/claude-opus-4-5",
};

/**
 * Feature flags per plan
 */
export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    voice: false,
    fileUpload: true,
    imageAnalysis: true,
    codeExecution: false,
    browserAutomation: false,
    webSearch: true,
    customSystemPrompt: false,
    apiAccess: false,
    webhooks: false,
    advancedMemory: false,
    prioritySupport: false,
    customModels: false,
  },
  pro: {
    voice: true,
    fileUpload: true,
    imageAnalysis: true,
    codeExecution: true,
    browserAutomation: true,
    webSearch: true,
    customSystemPrompt: true,
    apiAccess: true,
    webhooks: true,
    advancedMemory: true,
    prioritySupport: false,
    customModels: false,
  },
  enterprise: {
    voice: true,
    fileUpload: true,
    imageAnalysis: true,
    codeExecution: true,
    browserAutomation: true,
    webSearch: true,
    customSystemPrompt: true,
    apiAccess: true,
    webhooks: true,
    advancedMemory: true,
    prioritySupport: true,
    customModels: true,
  },
};

/**
 * Resource limits per plan
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxTokensPerDay: 50_000,
    maxConcurrentSessions: 2,
    maxMemoryMb: 256,
    maxFileUploadMb: 10,
    maxMessageHistory: 100,
    sessionTimeoutMinutes: 30,
    rateLimitPerMinute: 20,
  },
  pro: {
    maxTokensPerDay: 500_000,
    maxConcurrentSessions: 10,
    maxMemoryMb: 512,
    maxFileUploadMb: 50,
    maxMessageHistory: 1000,
    sessionTimeoutMinutes: 120,
    rateLimitPerMinute: 60,
  },
  enterprise: {
    maxTokensPerDay: 5_000_000,
    maxConcurrentSessions: 50,
    maxMemoryMb: 1024,
    maxFileUploadMb: 200,
    maxMessageHistory: 10000,
    sessionTimeoutMinutes: 480,
    rateLimitPerMinute: 200,
  },
};

/**
 * Default agent settings
 */
export const DEFAULT_AGENT_SETTINGS = {
  name: "Assistant",
  systemPrompt: null,
} as const;

/**
 * Default tenant configuration based on plan
 */
export interface DefaultTenantConfig {
  model: string;
  agentName: string;
  systemPrompt: string | null;
  features: PlanFeatures;
  limits: PlanLimits;
}

/**
 * Get the default configuration for a given plan
 *
 * @param plan - The subscription plan type
 * @returns Default configuration for the plan
 */
export function getDefaultConfig(plan: Plan): DefaultTenantConfig {
  return {
    model: PLAN_MODELS[plan],
    agentName: DEFAULT_AGENT_SETTINGS.name,
    systemPrompt: DEFAULT_AGENT_SETTINGS.systemPrompt,
    features: { ...PLAN_FEATURES[plan] },
    limits: { ...PLAN_LIMITS[plan] },
  };
}

/**
 * Get features for a specific plan
 *
 * @param plan - The subscription plan type
 * @returns Feature flags for the plan
 */
export function getPlanFeatures(plan: Plan): PlanFeatures {
  return { ...PLAN_FEATURES[plan] };
}

/**
 * Get resource limits for a specific plan
 *
 * @param plan - The subscription plan type
 * @returns Resource limits for the plan
 */
export function getPlanLimits(plan: Plan): PlanLimits {
  return { ...PLAN_LIMITS[plan] };
}

/**
 * Check if a feature is enabled for a plan
 *
 * @param plan - The subscription plan type
 * @param feature - The feature key to check
 * @returns True if the feature is enabled
 */
export function isFeatureEnabled(plan: Plan, feature: keyof PlanFeatures): boolean {
  return PLAN_FEATURES[plan][feature];
}

/**
 * Merge custom features with plan defaults
 *
 * @param plan - The subscription plan type
 * @param customFeatures - Custom feature overrides
 * @returns Merged feature flags
 */
export function mergeFeatures(plan: Plan, customFeatures: Partial<PlanFeatures>): PlanFeatures {
  return {
    ...PLAN_FEATURES[plan],
    ...customFeatures,
  };
}

/**
 * Merge custom limits with plan defaults
 *
 * @param plan - The subscription plan type
 * @param customLimits - Custom limit overrides
 * @returns Merged resource limits
 */
export function mergeLimits(plan: Plan, customLimits: Partial<PlanLimits>): PlanLimits {
  return {
    ...PLAN_LIMITS[plan],
    ...customLimits,
  };
}

/**
 * Validate that a plan is valid
 *
 * @param plan - The plan string to validate
 * @returns True if valid plan
 */
export function isValidPlan(plan: string): plan is Plan {
  return plan === "free" || plan === "pro" || plan === "enterprise";
}
