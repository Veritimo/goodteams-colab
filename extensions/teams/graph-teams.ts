/**
 * Teams-specific Graph Operations
 *
 * Functions for interacting with Microsoft Teams via the Graph API.
 * @see https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview
 */

import type {
  GraphClient,
  Team,
  TeamsChannel,
  TeamsChat,
  TeamsMessage,
  TeamListResponse,
  ChannelListResponse,
  MessageListResponse,
  ChatListResponse,
  ListMessagesOptions,
  TeamsError,
} from "./types.js";

// =============================================================================
// TEAM OPERATIONS
// =============================================================================

/**
 * List all teams the current user is a member of
 *
 * @param client - Microsoft Graph client
 * @returns Array of teams
 */
export async function listTeams(client: GraphClient): Promise<Team[]> {
  const teams: Team[] = [];
  let nextLink: string | undefined = "/me/joinedTeams";

  while (nextLink) {
    const response = await client.api(nextLink).get<TeamListResponse>();
    teams.push(...response.value);
    nextLink = response["@odata.nextLink"];

    // Extract path from full URL if present
    if (nextLink && nextLink.startsWith("https://")) {
      const url = new URL(nextLink);
      nextLink = url.pathname + url.search;
    }
  }

  return teams;
}

/**
 * Get a specific team by ID
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @returns Team object
 */
export async function getTeam(client: GraphClient, teamId: string): Promise<Team> {
  const response = await client.api(`/teams/${teamId}`).get<Team>();
  return response;
}

/**
 * Search teams by display name
 *
 * @param client - Microsoft Graph client
 * @param query - Search query for display name
 * @returns Array of matching teams
 */
export async function searchTeams(client: GraphClient, query: string): Promise<Team[]> {
  const allTeams = await listTeams(client);
  const lowerQuery = query.toLowerCase();

  return allTeams.filter(
    (team) =>
      team.displayName.toLowerCase().includes(lowerQuery) ||
      team.description?.toLowerCase().includes(lowerQuery),
  );
}

// =============================================================================
// CHANNEL OPERATIONS
// =============================================================================

/**
 * List all channels in a team
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @returns Array of channels
 */
export async function listChannels(
  client: GraphClient,
  teamId: string,
): Promise<TeamsChannel[]> {
  const channels: TeamsChannel[] = [];
  let nextLink: string | undefined = `/teams/${teamId}/channels`;

  while (nextLink) {
    const response = await client.api(nextLink).get<ChannelListResponse>();
    channels.push(...response.value);
    nextLink = response["@odata.nextLink"];

    if (nextLink && nextLink.startsWith("https://")) {
      const url = new URL(nextLink);
      nextLink = url.pathname + url.search;
    }
  }

  return channels;
}

/**
 * Get a specific channel by ID
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @param channelId - Channel ID
 * @returns Channel object
 */
export async function getChannel(
  client: GraphClient,
  teamId: string,
  channelId: string,
): Promise<TeamsChannel> {
  const response = await client
    .api(`/teams/${teamId}/channels/${channelId}`)
    .get<TeamsChannel>();
  return response;
}

/**
 * Get the primary (General) channel of a team
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @returns Primary channel
 */
export async function getPrimaryChannel(
  client: GraphClient,
  teamId: string,
): Promise<TeamsChannel> {
  const response = await client
    .api(`/teams/${teamId}/primaryChannel`)
    .get<TeamsChannel>();
  return response;
}

/**
 * Search channels in a team by display name
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @param query - Search query
 * @returns Array of matching channels
 */
export async function searchChannels(
  client: GraphClient,
  teamId: string,
  query: string,
): Promise<TeamsChannel[]> {
  const allChannels = await listChannels(client, teamId);
  const lowerQuery = query.toLowerCase();

  return allChannels.filter(
    (channel) =>
      channel.displayName.toLowerCase().includes(lowerQuery) ||
      channel.description?.toLowerCase().includes(lowerQuery),
  );
}

// =============================================================================
// CHANNEL MESSAGE OPERATIONS
// =============================================================================

/**
 * List messages in a channel
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @param channelId - Channel ID
 * @param options - Optional query parameters
 * @returns Array of messages
 */
export async function listChannelMessages(
  client: GraphClient,
  teamId: string,
  channelId: string,
  options?: ListMessagesOptions,
): Promise<TeamsMessage[]> {
  const messages: TeamsMessage[] = [];
  let request = client.api(`/teams/${teamId}/channels/${channelId}/messages`);

  if (options?.top) {
    request = request.top(options.top);
  }
  if (options?.filter) {
    request = request.filter(options.filter);
  }
  if (options?.orderBy) {
    request = request.orderby(options.orderBy);
  }

  const response = await request.get<MessageListResponse>();
  messages.push(...response.value);

  // Handle pagination if no limit specified
  if (!options?.top) {
    let nextLink = response["@odata.nextLink"];
    while (nextLink) {
      if (nextLink.startsWith("https://")) {
        const url = new URL(nextLink);
        nextLink = url.pathname + url.search;
      }
      const nextResponse = await client.api(nextLink).get<MessageListResponse>();
      messages.push(...nextResponse.value);
      nextLink = nextResponse["@odata.nextLink"];
    }
  }

  return messages;
}

/**
 * Get a specific message in a channel
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @param channelId - Channel ID
 * @param messageId - Message ID
 * @returns Message object
 */
export async function getChannelMessage(
  client: GraphClient,
  teamId: string,
  channelId: string,
  messageId: string,
): Promise<TeamsMessage> {
  const response = await client
    .api(`/teams/${teamId}/channels/${channelId}/messages/${messageId}`)
    .get<TeamsMessage>();
  return response;
}

/**
 * List replies to a message in a channel
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @param channelId - Channel ID
 * @param messageId - Parent message ID
 * @param options - Optional query parameters
 * @returns Array of reply messages
 */
export async function listChannelMessageReplies(
  client: GraphClient,
  teamId: string,
  channelId: string,
  messageId: string,
  options?: ListMessagesOptions,
): Promise<TeamsMessage[]> {
  const replies: TeamsMessage[] = [];
  let request = client.api(
    `/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`,
  );

  if (options?.top) {
    request = request.top(options.top);
  }
  if (options?.orderBy) {
    request = request.orderby(options.orderBy);
  }

  const response = await request.get<MessageListResponse>();
  replies.push(...response.value);

  return replies;
}

// =============================================================================
// CHAT OPERATIONS
// =============================================================================

/**
 * List all chats for the current user
 *
 * @param client - Microsoft Graph client
 * @returns Array of chats
 */
export async function listChats(client: GraphClient): Promise<TeamsChat[]> {
  const chats: TeamsChat[] = [];
  let nextLink: string | undefined = "/me/chats";

  while (nextLink) {
    const response = await client.api(nextLink).get<ChatListResponse>();
    chats.push(...response.value);
    nextLink = response["@odata.nextLink"];

    if (nextLink && nextLink.startsWith("https://")) {
      const url = new URL(nextLink);
      nextLink = url.pathname + url.search;
    }
  }

  return chats;
}

/**
 * Get a specific chat by ID
 *
 * @param client - Microsoft Graph client
 * @param chatId - Chat ID
 * @returns Chat object
 */
export async function getChat(client: GraphClient, chatId: string): Promise<TeamsChat> {
  const response = await client.api(`/chats/${chatId}`).get<TeamsChat>();
  return response;
}

/**
 * List messages in a chat
 *
 * @param client - Microsoft Graph client
 * @param chatId - Chat ID
 * @param options - Optional query parameters
 * @returns Array of messages
 */
export async function listChatMessages(
  client: GraphClient,
  chatId: string,
  options?: ListMessagesOptions,
): Promise<TeamsMessage[]> {
  const messages: TeamsMessage[] = [];
  let request = client.api(`/chats/${chatId}/messages`);

  if (options?.top) {
    request = request.top(options.top);
  }
  if (options?.filter) {
    request = request.filter(options.filter);
  }
  if (options?.orderBy) {
    request = request.orderby(options.orderBy);
  }

  const response = await request.get<MessageListResponse>();
  messages.push(...response.value);

  // Handle pagination if no limit specified
  if (!options?.top) {
    let nextLink = response["@odata.nextLink"];
    while (nextLink) {
      if (nextLink.startsWith("https://")) {
        const url = new URL(nextLink);
        nextLink = url.pathname + url.search;
      }
      const nextResponse = await client.api(nextLink).get<MessageListResponse>();
      messages.push(...nextResponse.value);
      nextLink = nextResponse["@odata.nextLink"];
    }
  }

  return messages;
}

/**
 * Get a specific message in a chat
 *
 * @param client - Microsoft Graph client
 * @param chatId - Chat ID
 * @param messageId - Message ID
 * @returns Message object
 */
export async function getChatMessage(
  client: GraphClient,
  chatId: string,
  messageId: string,
): Promise<TeamsMessage> {
  const response = await client
    .api(`/chats/${chatId}/messages/${messageId}`)
    .get<TeamsMessage>();
  return response;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Find a team by name (case-insensitive exact match)
 *
 * @param client - Microsoft Graph client
 * @param name - Team name to find
 * @returns Team or undefined if not found
 */
export async function findTeamByName(
  client: GraphClient,
  name: string,
): Promise<Team | undefined> {
  const teams = await listTeams(client);
  const lowerName = name.toLowerCase();
  return teams.find((t) => t.displayName.toLowerCase() === lowerName);
}

/**
 * Find a channel by name in a team (case-insensitive exact match)
 *
 * @param client - Microsoft Graph client
 * @param teamId - Team ID
 * @param name - Channel name to find
 * @returns Channel or undefined if not found
 */
export async function findChannelByName(
  client: GraphClient,
  teamId: string,
  name: string,
): Promise<TeamsChannel | undefined> {
  const channels = await listChannels(client, teamId);
  const lowerName = name.toLowerCase();
  return channels.find((c) => c.displayName.toLowerCase() === lowerName);
}

/**
 * Resolve a team and channel from a path like "Team Name/Channel Name"
 *
 * @param client - Microsoft Graph client
 * @param path - Path in format "Team/Channel" or "Team" (uses primary channel)
 * @returns Object with team and channel
 */
export async function resolveTeamAndChannel(
  client: GraphClient,
  path: string,
): Promise<{ team: Team; channel: TeamsChannel }> {
  const parts = path.split("/").map((p) => p.trim());
  const teamName = parts[0];
  const channelName = parts[1];

  if (!teamName) {
    throw createTeamsError("INVALID_PATH", "Team name is required");
  }

  const team = await findTeamByName(client, teamName);
  if (!team) {
    throw createTeamsError("TEAM_NOT_FOUND", `Team "${teamName}" not found`);
  }

  let channel: TeamsChannel;
  if (channelName) {
    const found = await findChannelByName(client, team.id, channelName);
    if (!found) {
      throw createTeamsError(
        "CHANNEL_NOT_FOUND",
        `Channel "${channelName}" not found in team "${teamName}"`,
      );
    }
    channel = found;
  } else {
    // Use primary channel if no channel specified
    channel = await getPrimaryChannel(client, team.id);
  }

  return { team, channel };
}

/**
 * Build a web URL for a channel message
 *
 * @param teamId - Team ID
 * @param channelId - Channel ID
 * @param messageId - Optional message ID
 * @returns Web URL for the Teams client
 */
export function buildChannelMessageUrl(
  teamId: string,
  channelId: string,
  messageId?: string,
): string {
  const base = `https://teams.microsoft.com/l/channel/${encodeURIComponent(channelId)}`;
  const params = new URLSearchParams({ groupId: teamId });

  if (messageId) {
    params.set("messageId", messageId);
  }

  return `${base}?${params.toString()}`;
}

/**
 * Build a web URL for a chat
 *
 * @param chatId - Chat ID
 * @returns Web URL for the Teams client
 */
export function buildChatUrl(chatId: string): string {
  return `https://teams.microsoft.com/l/chat/${encodeURIComponent(chatId)}`;
}

/**
 * Extract text content from a message, stripping HTML if needed
 *
 * @param message - Teams message
 * @returns Plain text content
 */
export function extractMessageText(message: TeamsMessage): string {
  const body = message.body;
  if (!body?.content) {
    return "";
  }

  if (body.contentType === "text") {
    return body.content;
  }

  // Strip HTML tags for html content type
  return body.content
    .replace(/<at[^>]*>.*?<\/at>/gi, "") // Remove mention tags
    .replace(/<[^>]+>/g, "") // Remove other HTML tags
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Check if a message mentions a specific user
 *
 * @param message - Teams message
 * @param userId - User ID to check for
 * @returns True if user is mentioned
 */
export function isUserMentioned(message: TeamsMessage, userId: string): boolean {
  if (!message.mentions || message.mentions.length === 0) {
    return false;
  }

  return message.mentions.some((mention) => mention.mentioned?.id === userId);
}

/**
 * Create a TeamsError
 */
function createTeamsError(code: string, message: string, statusCode?: number): Error {
  const error = new Error(message) as Error & { code: string; statusCode?: number };
  error.name = "TeamsError";
  error.code = code;
  if (statusCode !== undefined) {
    error.statusCode = statusCode;
  }
  return error;
}

/**
 * Check if an error is a Graph API error with a specific code
 *
 * @param error - Error to check
 * @param code - Error code to match
 * @returns True if error matches
 */
export function isGraphError(error: unknown, code?: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const err = error as Record<string, unknown>;

  // Check for Graph API error format
  if (err.error && typeof err.error === "object") {
    const graphError = err.error as Record<string, unknown>;
    if (code) {
      return graphError.code === code;
    }
    return typeof graphError.code === "string";
  }

  // Check for error with code property
  if (code) {
    return err.code === code;
  }

  return false;
}
