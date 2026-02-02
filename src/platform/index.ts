/**
 * GoodTeams Platform Module
 *
 * This module will contain platform-specific functionality for GoodTeams
 * including database connections, Microsoft Teams integration, and other
 * enterprise features.
 */

export const PLATFORM_VERSION = "0.1.0";

/**
 * Platform health check
 * Returns true if the platform is ready to handle requests
 */
export function isHealthy(): boolean {
  return true;
}

/**
 * Platform configuration interface
 */
export interface PlatformConfig {
  databaseUrl?: string;
  appUrl?: string;
  entraClientId?: string;
  entraClientSecret?: string;
}

/**
 * Get platform configuration from environment
 */
export function getPlatformConfig(): PlatformConfig {
  return {
    databaseUrl: process.env.DATABASE_URL,
    appUrl: process.env.APP_URL,
    entraClientId: process.env.ENTRA_CLIENT_ID,
    entraClientSecret: process.env.ENTRA_CLIENT_SECRET,
  };
}
