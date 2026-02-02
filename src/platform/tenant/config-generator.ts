/**
 * Tenant Configuration Generator
 *
 * Generates openclaw.json configuration for a tenant's isolated gateway instance.
 * Each tenant gets their own configuration with isolated paths and credentials.
 */

import type { Organization, TenantConfig, TenantGateway } from "@prisma/client";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Generated configuration structure for openclaw.json
 */
export interface GeneratedConfig {
  gateway: {
    port: number;
    bind: string;
    auth: {
      mode: string;
      token: string;
    };
  };
  model: string;
  agent: {
    name: string;
    systemPrompt?: string;
  };
  stateDir: string;
  sessions: {
    dir: string;
  };
  memory: {
    enabled: boolean;
    provider: string;
    path: string;
  };
  limits: {
    maxTokensPerDay: number;
    maxConcurrentSessions: number;
    maxMemoryMb: number;
  };
}

/**
 * Generate a secure token for gateway authentication
 *
 * @param organizationId - Organization UUID
 * @returns Promise resolving to a unique gateway token
 */
export function generateTenantToken(organizationId: string): Promise<string> {
  // Generate secure token for gateway auth
  return Promise.resolve(`gt_${organizationId}_${crypto.randomUUID()}`);
}

/**
 * Generate a complete tenant configuration
 *
 * @param organization - Organization entity
 * @param config - Tenant configuration settings
 * @param gateway - Tenant gateway settings
 * @returns Promise resolving to the generated configuration object
 */
export async function generateTenantConfig(
  organization: Organization,
  config: TenantConfig,
  gateway: TenantGateway,
): Promise<GeneratedConfig> {
  const basePath = `/tenants/${organization.id}`;

  return {
    gateway: {
      port: gateway.port,
      bind: "127.0.0.1",
      auth: {
        mode: "token",
        token: await generateTenantToken(organization.id),
      },
    },
    model: config.model,
    agent: {
      name: config.agentName,
      systemPrompt: config.systemPrompt || undefined,
    },
    stateDir: `${basePath}/state`,
    sessions: {
      dir: `${basePath}/sessions`,
    },
    memory: {
      enabled: true,
      provider: "sqlite-vec",
      path: `${basePath}/memory/vectors.db`,
    },
    limits: {
      maxTokensPerDay: config.maxTokensPerDay,
      maxConcurrentSessions: config.maxConcurrentSessions,
      maxMemoryMb: config.maxMemoryMb,
    },
  };
}

/**
 * Write the generated configuration to a file
 *
 * @param organizationId - Organization UUID
 * @param config - Generated configuration object
 * @returns Promise resolving to the path where the config was written
 */
export async function writeConfigToFile(
  organizationId: string,
  config: GeneratedConfig,
): Promise<string> {
  const configPath = `/tenants/${organizationId}/openclaw.json`;
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/**
 * Generate configuration and write it to file in one operation
 *
 * @param organization - Organization entity
 * @param config - Tenant configuration settings
 * @param gateway - Tenant gateway settings
 * @returns Promise resolving to the config path
 */
export async function generateAndWriteConfig(
  organization: Organization,
  config: TenantConfig,
  gateway: TenantGateway,
): Promise<{ config: GeneratedConfig; path: string }> {
  const generatedConfig = await generateTenantConfig(organization, config, gateway);
  const configPath = await writeConfigToFile(organization.id, generatedConfig);
  return { config: generatedConfig, path: configPath };
}

/**
 * Get the expected configuration path for an organization
 *
 * @param organizationId - Organization UUID
 * @returns The expected config file path
 */
export function getConfigPath(organizationId: string): string {
  return `/tenants/${organizationId}/openclaw.json`;
}

/**
 * Get the base tenant directory path
 *
 * @param organizationId - Organization UUID
 * @returns The base tenant directory path
 */
export function getTenantBasePath(organizationId: string): string {
  return `/tenants/${organizationId}`;
}
