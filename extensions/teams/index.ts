/**
 * Microsoft Teams Channel Plugin
 *
 * OpenClaw channel plugin for Microsoft Teams using Graph API.
 * This plugin provides:
 * - Sending messages to channels and chats
 * - Adaptive Card support
 * - Webhook handling for incoming messages
 *
 * Note: For Bot Framework-based Teams integration, see the msteams plugin.
 * This plugin uses Graph API for direct Teams integration.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// Re-export types and utilities for consumers
export * from "./types.js";
export * from "./cards.js";
export * from "./graph-teams.js";
export * from "./webhook.js";
export * from "./sender.js";

// Plugin runtime reference
let pluginRuntime: OpenClawPluginApi["runtime"] | undefined;

/**
 * Set the plugin runtime (called during registration)
 */
export function setTeamsRuntime(runtime: OpenClawPluginApi["runtime"]): void {
  pluginRuntime = runtime;
}

/**
 * Get the plugin runtime
 */
export function getTeamsRuntime(): OpenClawPluginApi["runtime"] {
  if (!pluginRuntime) {
    throw new Error("Teams plugin runtime not initialized");
  }
  return pluginRuntime;
}

/**
 * Teams channel plugin configuration
 */
export interface TeamsPluginConfig {
  /** Whether the plugin is enabled */
  enabled?: boolean;
  /** Microsoft Graph API credentials (from Entra SSO) */
  graph?: {
    /** Organization ID (tenant ID) */
    organizationId?: string;
  };
  /** Webhook configuration */
  webhook?: {
    /** Webhook endpoint path */
    path?: string;
    /** Port to listen on */
    port?: number;
  };
  /** Message defaults */
  defaults?: {
    /** Default message importance */
    importance?: "normal" | "high" | "urgent";
  };
}

/**
 * Resolved Teams account state
 */
interface ResolvedTeamsAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
}

/**
 * Channel plugin definition
 */
const teamsPlugin = {
  id: "teams",
  meta: {
    id: "teams",
    label: "Microsoft Teams (Graph API)",
    selectionLabel: "Microsoft Teams (Graph API)",
    docsPath: "/channels/teams",
    docsLabel: "teams",
    blurb: "Graph API integration for Microsoft Teams channels and chats.",
    order: 61, // After msteams (Bot Framework)
  },
  capabilities: {
    chatTypes: ["direct", "channel", "thread"] as const,
    polls: false, // Polls via cards only
    reactions: false,
    edit: false,
    unsend: false,
    reply: true,
    effects: false,
    groupManagement: false,
    threads: true,
    media: true,
    nativeCommands: false,
  },
  config: {
    listAccountIds: () => ["default"],
    resolveAccount: (cfg): ResolvedTeamsAccount => {
      const teamsConfig = cfg.channels?.teams as TeamsPluginConfig | undefined;
      return {
        accountId: "default",
        enabled: teamsConfig?.enabled !== false,
        configured: Boolean(teamsConfig?.graph?.organizationId),
      };
    },
    defaultAccountId: () => "default",
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        teams: {
          ...(cfg.channels?.teams as TeamsPluginConfig | undefined),
          enabled,
        },
      },
    }),
    deleteAccount: ({ cfg }) => {
      const next = { ...cfg };
      const nextChannels = { ...cfg.channels };
      delete nextChannels.teams;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (_account, cfg) => {
      const teamsConfig = cfg.channels?.teams as TeamsPluginConfig | undefined;
      return Boolean(teamsConfig?.graph?.organizationId);
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
    }),
    resolveAllowFrom: ({ cfg }) => {
      const teamsConfig = cfg.channels?.teams as Record<string, unknown> | undefined;
      const allowFrom = teamsConfig?.allowFrom;
      return Array.isArray(allowFrom) ? allowFrom : [];
    },
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },
  messaging: {
    normalizeTarget: (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        return undefined;
      }
      // Normalize channel: and chat: prefixes
      if (trimmed.startsWith("channel:") || trimmed.startsWith("chat:")) {
        return trimmed;
      }
      // Conversation ID format
      if (trimmed.includes("@thread")) {
        return `conversation:${trimmed}`;
      }
      return trimmed;
    },
    targetResolver: {
      looksLikeId: (raw: string) => {
        const trimmed = raw.trim();
        return (
          trimmed.startsWith("channel:") ||
          trimmed.startsWith("chat:") ||
          trimmed.startsWith("conversation:") ||
          trimmed.includes("@thread")
        );
      },
      hint: "<channel:teamId/channelId|chat:chatId>",
    },
  },
  agentPrompt: {
    messageToolHints: () => [
      "- Teams Graph API targeting: use `channel:teamId/channelId` for channels, `chat:chatId` for chats.",
      "- Adaptive Cards: use `card={type,version,body}` parameter to send rich cards.",
      "- Replies: add `:messageId` to channel target for threaded replies.",
    ],
  },
  threading: {
    buildToolContext: ({ context, hasRepliedRef }) => ({
      currentChannelId: context.To?.trim() || undefined,
      currentThreadTs: context.ReplyToId,
      hasRepliedRef,
    }),
  },
  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
  },
  status: {
    defaultRuntime: {
      accountId: "default",
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    probeAccount: async ({ cfg }) => {
      const teamsConfig = cfg.channels?.teams as TeamsPluginConfig | undefined;
      const hasOrgId = Boolean(teamsConfig?.graph?.organizationId);
      return {
        ok: hasOrgId,
        error: hasOrgId ? undefined : "Missing organizationId in graph config",
      };
    },
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      probe,
    }),
  },
};

/**
 * OpenClaw plugin definition
 */
const plugin = {
  id: "teams",
  name: "Microsoft Teams (Graph API)",
  description: "Microsoft Teams channel plugin using Graph API",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setTeamsRuntime(api.runtime);
    api.registerChannel({ plugin: teamsPlugin });
  },
};

export default plugin;
