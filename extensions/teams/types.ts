/**
 * Microsoft Teams Type Definitions
 *
 * Type definitions for Teams API and Bot Framework activities.
 * @see https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview
 * @see https://learn.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference
 */

// =============================================================================
// GRAPH CLIENT TYPE
// =============================================================================

/**
 * Microsoft Graph Client interface
 */
export interface GraphClient {
  api(path: string): GraphRequest;
}

export interface GraphRequest {
  get<T = unknown>(): Promise<T>;
  post<T = unknown>(body: unknown): Promise<T>;
  put<T = unknown>(body: unknown): Promise<T>;
  patch<T = unknown>(body: unknown): Promise<T>;
  delete(): Promise<void>;
  header(name: string, value: string): GraphRequest;
  select(fields: string | string[]): GraphRequest;
  expand(fields: string | string[]): GraphRequest;
  filter(filterStr: string): GraphRequest;
  top(count: number): GraphRequest;
  orderby(field: string): GraphRequest;
}

// =============================================================================
// TEAMS TYPES
// =============================================================================

/**
 * Microsoft Teams Team resource
 * @see https://learn.microsoft.com/en-us/graph/api/resources/team
 */
export interface Team {
  /** Unique identifier of the team */
  id: string;
  /** Display name of the team */
  displayName: string;
  /** Description of the team */
  description?: string;
  /** Internal name of the team */
  internalId?: string;
  /** Web URL to the team */
  webUrl?: string;
  /** Whether the team is archived */
  isArchived?: boolean;
  /** Date and time the team was created */
  createdDateTime?: string;
  /** Visibility of the team */
  visibility?: "private" | "public";
  /** Team specialization */
  specialization?: "none" | "educationStandard" | "educationClass" | "educationProfessionalLearningCommunity" | "educationStaff";
}

/**
 * Microsoft Teams Channel resource
 * @see https://learn.microsoft.com/en-us/graph/api/resources/channel
 */
export interface TeamsChannel {
  /** Unique identifier of the channel */
  id: string;
  /** Display name of the channel */
  displayName: string;
  /** Description of the channel */
  description?: string;
  /** Email address for the channel */
  email?: string;
  /** Web URL to the channel */
  webUrl?: string;
  /** Type of channel membership */
  membershipType?: "standard" | "private" | "shared";
  /** Date and time the channel was created */
  createdDateTime?: string;
  /** Whether this is a favorite channel by default */
  isFavoriteByDefault?: boolean;
}

/**
 * Microsoft Teams Chat resource
 * @see https://learn.microsoft.com/en-us/graph/api/resources/chat
 */
export interface TeamsChat {
  /** Unique identifier of the chat */
  id: string;
  /** Topic of the chat */
  topic?: string;
  /** Type of chat */
  chatType: "oneOnOne" | "group" | "meeting";
  /** Web URL to the chat */
  webUrl?: string;
  /** Date and time the chat was created */
  createdDateTime?: string;
  /** Date and time the chat was last updated */
  lastUpdatedDateTime?: string;
  /** Members of the chat */
  members?: TeamsMember[];
}

/**
 * Teams member
 */
export interface TeamsMember {
  /** Unique identifier */
  id?: string;
  /** Display name */
  displayName?: string;
  /** User ID */
  userId?: string;
  /** Email address */
  email?: string;
  /** Roles (owner, member, guest) */
  roles?: string[];
}

/**
 * Teams channel message
 * @see https://learn.microsoft.com/en-us/graph/api/resources/chatmessage
 */
export interface TeamsMessage {
  /** Unique identifier of the message */
  id: string;
  /** Reply chain ID for threaded messages */
  replyToId?: string;
  /** ETag for the message */
  etag?: string;
  /** Type of message */
  messageType: "message" | "chatEvent" | "typing" | "unknownFutureValue";
  /** Date and time the message was created */
  createdDateTime: string;
  /** Date and time the message was last modified */
  lastModifiedDateTime?: string;
  /** Date and time the message was last edited */
  lastEditedDateTime?: string;
  /** Date and time the message was deleted */
  deletedDateTime?: string;
  /** Subject of the message */
  subject?: string;
  /** Message body */
  body: TeamsMessageBody;
  /** Summary of the message */
  summary?: string;
  /** Sender of the message */
  from?: TeamsMessageSender;
  /** Web URL to the message */
  webUrl?: string;
  /** Chat ID (for chat messages) */
  chatId?: string;
  /** Channel identity (for channel messages) */
  channelIdentity?: {
    teamId?: string;
    channelId?: string;
  };
  /** Attachments */
  attachments?: TeamsAttachment[];
  /** Mentions in the message */
  mentions?: TeamsMention[];
  /** Reactions to the message */
  reactions?: TeamsReaction[];
  /** Importance of the message */
  importance?: "normal" | "high" | "urgent";
  /** Policy violation information */
  policyViolation?: unknown;
  /** Locale of the message */
  locale?: string;
}

/**
 * Message body
 */
export interface TeamsMessageBody {
  /** Content type (text or html) */
  contentType: "text" | "html";
  /** Message content */
  content: string;
}

/**
 * Message sender information
 */
export interface TeamsMessageSender {
  /** Application identity */
  application?: TeamsIdentity;
  /** Device identity */
  device?: TeamsIdentity;
  /** User identity */
  user?: TeamsIdentity;
}

/**
 * Identity information
 */
export interface TeamsIdentity {
  /** Unique identifier */
  id?: string;
  /** Display name */
  displayName?: string;
  /** User identity type */
  userIdentityType?: "aadUser" | "onPremiseAadUser" | "anonymousGuest" | "federatedUser" | "personalMicrosoftAccountUser" | "skypeUser" | "phoneUser";
}

/**
 * Message attachment
 */
export interface TeamsAttachment {
  /** Unique identifier */
  id?: string;
  /** Content type */
  contentType: string;
  /** Content URL */
  contentUrl?: string;
  /** Content (for inline content) */
  content?: string;
  /** Name of the attachment */
  name?: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
}

/**
 * Message mention
 */
export interface TeamsMention {
  /** ID of the mention (e.g., "0") */
  id?: number;
  /** Type of mention */
  mentionText?: string;
  /** Mentioned entity */
  mentioned?: TeamsIdentity;
}

/**
 * Message reaction
 */
export interface TeamsReaction {
  /** Reaction type (like, angry, sad, laugh, heart, surprised) */
  reactionType: string;
  /** Date and time of the reaction */
  createdDateTime?: string;
  /** User who reacted */
  user?: TeamsIdentity;
}

// =============================================================================
// BOT FRAMEWORK ACTIVITY TYPES
// =============================================================================

/**
 * Bot Framework Activity
 * @see https://learn.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference
 */
export interface TeamsActivity {
  /** Activity type */
  type: TeamsActivityType;
  /** Unique identifier of the activity */
  id?: string;
  /** Timestamp of the activity */
  timestamp?: string;
  /** Local timestamp */
  localTimestamp?: string;
  /** Local timezone */
  localTimezone?: string;
  /** Service URL for replies */
  serviceUrl?: string;
  /** Channel ID (msteams) */
  channelId?: string;
  /** Sender of the activity */
  from?: TeamsChannelAccount;
  /** Conversation reference */
  conversation?: TeamsConversationAccount;
  /** Recipient of the activity */
  recipient?: TeamsChannelAccount;
  /** Text format (plain, markdown, xml) */
  textFormat?: string;
  /** Attachment layout (list, carousel) */
  attachmentLayout?: "list" | "carousel";
  /** Members added (for conversationUpdate) */
  membersAdded?: TeamsChannelAccount[];
  /** Members removed (for conversationUpdate) */
  membersRemoved?: TeamsChannelAccount[];
  /** Reactions added */
  reactionsAdded?: TeamsReactionInfo[];
  /** Reactions removed */
  reactionsRemoved?: TeamsReactionInfo[];
  /** Topic name (for conversationUpdate) */
  topicName?: string;
  /** History disclosed flag */
  historyDisclosed?: boolean;
  /** Locale */
  locale?: string;
  /** Message text */
  text?: string;
  /** Speak text (for voice) */
  speak?: string;
  /** Input hint */
  inputHint?: "acceptingInput" | "ignoringInput" | "expectingInput";
  /** Summary */
  summary?: string;
  /** Suggested actions */
  suggestedActions?: TeamsSuggestedActions;
  /** Attachments */
  attachments?: TeamsActivityAttachment[];
  /** Entities (includes mentions) */
  entities?: TeamsEntity[];
  /** Channel-specific data */
  channelData?: TeamsChannelData;
  /** Activity action */
  action?: string;
  /** Reply to ID */
  replyToId?: string;
  /** Label for the activity */
  label?: string;
  /** Value field (for card actions, etc.) */
  value?: unknown;
  /** Name of the invoke activity */
  name?: string;
  /** Relates to reference */
  relatesTo?: TeamsConversationReference;
  /** Semantic action */
  semanticAction?: unknown;
}

/**
 * Activity types
 */
export type TeamsActivityType =
  | "message"
  | "contactRelationUpdate"
  | "conversationUpdate"
  | "typing"
  | "endOfConversation"
  | "event"
  | "invoke"
  | "installationUpdate"
  | "messageReaction"
  | "suggestion"
  | "trace"
  | "handoff";

/**
 * Channel account (user/bot identity in a channel)
 */
export interface TeamsChannelAccount {
  /** Unique identifier */
  id: string;
  /** Display name */
  name?: string;
  /** Azure AD object ID */
  aadObjectId?: string;
  /** Role in the conversation */
  role?: "user" | "bot";
  /** Email address */
  email?: string;
  /** User principal name */
  userPrincipalName?: string;
}

/**
 * Conversation account
 */
export interface TeamsConversationAccount {
  /** Whether this is a group conversation */
  isGroup?: boolean;
  /** Conversation type (personal, groupChat, channel) */
  conversationType?: "personal" | "groupChat" | "channel";
  /** Unique identifier */
  id: string;
  /** Conversation name */
  name?: string;
  /** Azure AD object ID */
  aadObjectId?: string;
  /** Role */
  role?: string;
  /** Tenant ID */
  tenantId?: string;
}

/**
 * Conversation reference (for proactive messaging)
 */
export interface TeamsConversationReference {
  /** Activity ID */
  activityId?: string;
  /** User */
  user?: TeamsChannelAccount;
  /** Bot */
  bot?: TeamsChannelAccount;
  /** Conversation */
  conversation?: TeamsConversationAccount;
  /** Channel ID */
  channelId?: string;
  /** Locale */
  locale?: string;
  /** Service URL */
  serviceUrl?: string;
}

/**
 * Reaction info
 */
export interface TeamsReactionInfo {
  /** Reaction type */
  type: string;
}

/**
 * Suggested actions
 */
export interface TeamsSuggestedActions {
  /** Users to show actions to */
  to?: string[];
  /** Actions */
  actions?: TeamsCardAction[];
}

/**
 * Card action
 */
export interface TeamsCardAction {
  /** Action type */
  type: string;
  /** Title */
  title?: string;
  /** Image URL */
  image?: string;
  /** Text */
  text?: string;
  /** Display text */
  displayText?: string;
  /** Value */
  value?: unknown;
  /** Channel data */
  channelData?: unknown;
}

/**
 * Activity attachment
 */
export interface TeamsActivityAttachment {
  /** Content type */
  contentType: string;
  /** Content URL */
  contentUrl?: string;
  /** Content (JSON for cards) */
  content?: unknown;
  /** Name */
  name?: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
}

/**
 * Entity in an activity
 */
export interface TeamsEntity {
  /** Entity type */
  type: string;
  /** Mentioned user (for mention entities) */
  mentioned?: TeamsChannelAccount;
  /** Mention text */
  text?: string;
}

/**
 * Teams-specific channel data
 */
export interface TeamsChannelData {
  /** Team information */
  team?: {
    id?: string;
    name?: string;
    aadGroupId?: string;
  };
  /** Channel information */
  channel?: {
    id?: string;
    name?: string;
  };
  /** Tenant information */
  tenant?: {
    id?: string;
  };
  /** Notification settings */
  notification?: {
    alert?: boolean;
    alertInMeeting?: boolean;
  };
  /** Event type (for events) */
  eventType?: string;
}

// =============================================================================
// ADAPTIVE CARD TYPES
// =============================================================================

/**
 * Adaptive Card schema
 * @see https://adaptivecards.io/explorer/
 */
export interface AdaptiveCard {
  /** Must be "AdaptiveCard" */
  type: "AdaptiveCard";
  /** Card schema version */
  version: string;
  /** Card body elements */
  body?: AdaptiveCardElement[];
  /** Card actions */
  actions?: AdaptiveCardAction[];
  /** Select action (clickable card) */
  selectAction?: AdaptiveCardAction;
  /** Fallback text */
  fallbackText?: string;
  /** Background image */
  backgroundImage?: string | AdaptiveCardBackgroundImage;
  /** Minimum height */
  minHeight?: string;
  /** Speak text */
  speak?: string;
  /** Language */
  lang?: string;
  /** Vertical content alignment */
  verticalContentAlignment?: "top" | "center" | "bottom";
  /** Schema URL */
  $schema?: string;
}

/**
 * Background image
 */
export interface AdaptiveCardBackgroundImage {
  url: string;
  fillMode?: "cover" | "repeatHorizontally" | "repeatVertically" | "repeat";
  horizontalAlignment?: "left" | "center" | "right";
  verticalAlignment?: "top" | "center" | "bottom";
}

/**
 * Base element type
 */
export interface AdaptiveCardElementBase {
  /** Element type */
  type: string;
  /** Element ID */
  id?: string;
  /** Spacing */
  spacing?: "none" | "small" | "default" | "medium" | "large" | "extraLarge" | "padding";
  /** Separator */
  separator?: boolean;
  /** Height */
  height?: "auto" | "stretch";
  /** Whether element is visible */
  isVisible?: boolean;
}

/**
 * Text block element
 */
export interface AdaptiveCardTextBlock extends AdaptiveCardElementBase {
  type: "TextBlock";
  text: string;
  color?: "default" | "dark" | "light" | "accent" | "good" | "warning" | "attention";
  fontType?: "default" | "monospace";
  horizontalAlignment?: "left" | "center" | "right";
  isSubtle?: boolean;
  maxLines?: number;
  size?: "default" | "small" | "medium" | "large" | "extraLarge";
  weight?: "default" | "lighter" | "bolder";
  wrap?: boolean;
}

/**
 * Image element
 */
export interface AdaptiveCardImage extends AdaptiveCardElementBase {
  type: "Image";
  url: string;
  altText?: string;
  backgroundColor?: string;
  horizontalAlignment?: "left" | "center" | "right";
  selectAction?: AdaptiveCardAction;
  size?: "auto" | "stretch" | "small" | "medium" | "large";
  style?: "default" | "person";
  width?: string;
}

/**
 * Container element
 */
export interface AdaptiveCardContainer extends AdaptiveCardElementBase {
  type: "Container";
  items: AdaptiveCardElement[];
  selectAction?: AdaptiveCardAction;
  style?: "default" | "emphasis" | "good" | "attention" | "warning" | "accent";
  verticalContentAlignment?: "top" | "center" | "bottom";
  bleed?: boolean;
  minHeight?: string;
}

/**
 * Column set element
 */
export interface AdaptiveCardColumnSet extends AdaptiveCardElementBase {
  type: "ColumnSet";
  columns: AdaptiveCardColumn[];
  selectAction?: AdaptiveCardAction;
  style?: "default" | "emphasis" | "good" | "attention" | "warning" | "accent";
  bleed?: boolean;
  minHeight?: string;
  horizontalAlignment?: "left" | "center" | "right";
}

/**
 * Column element
 */
export interface AdaptiveCardColumn extends AdaptiveCardElementBase {
  type: "Column";
  items: AdaptiveCardElement[];
  backgroundImage?: string | AdaptiveCardBackgroundImage;
  bleed?: boolean;
  fallback?: "drop" | AdaptiveCardElement;
  minHeight?: string;
  separator?: boolean;
  spacing?: "none" | "small" | "default" | "medium" | "large" | "extraLarge" | "padding";
  selectAction?: AdaptiveCardAction;
  style?: "default" | "emphasis" | "good" | "attention" | "warning" | "accent";
  verticalContentAlignment?: "top" | "center" | "bottom";
  width?: "auto" | "stretch" | string;
}

/**
 * Fact set element
 */
export interface AdaptiveCardFactSet extends AdaptiveCardElementBase {
  type: "FactSet";
  facts: AdaptiveCardFact[];
}

/**
 * Fact (key-value pair)
 */
export interface AdaptiveCardFact {
  title: string;
  value: string;
}

/**
 * Input text element
 */
export interface AdaptiveCardInputText extends AdaptiveCardElementBase {
  type: "Input.Text";
  id: string;
  isMultiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  style?: "text" | "tel" | "url" | "email";
  value?: string;
  label?: string;
  isRequired?: boolean;
  errorMessage?: string;
}

/**
 * Input choice set element
 */
export interface AdaptiveCardInputChoiceSet extends AdaptiveCardElementBase {
  type: "Input.ChoiceSet";
  id: string;
  choices: AdaptiveCardChoice[];
  isMultiSelect?: boolean;
  style?: "compact" | "expanded";
  value?: string;
  label?: string;
  isRequired?: boolean;
  errorMessage?: string;
  placeholder?: string;
}

/**
 * Choice option
 */
export interface AdaptiveCardChoice {
  title: string;
  value: string;
}

/**
 * Union type for all card elements
 */
export type AdaptiveCardElement =
  | AdaptiveCardTextBlock
  | AdaptiveCardImage
  | AdaptiveCardContainer
  | AdaptiveCardColumnSet
  | AdaptiveCardFactSet
  | AdaptiveCardInputText
  | AdaptiveCardInputChoiceSet;

/**
 * Action base type
 */
export interface AdaptiveCardActionBase {
  type: string;
  title?: string;
  iconUrl?: string;
  id?: string;
  style?: "default" | "positive" | "destructive";
  fallback?: "drop" | AdaptiveCardAction;
  tooltip?: string;
  isEnabled?: boolean;
  mode?: "primary" | "secondary";
}

/**
 * Open URL action
 */
export interface AdaptiveCardActionOpenUrl extends AdaptiveCardActionBase {
  type: "Action.OpenUrl";
  url: string;
}

/**
 * Submit action
 */
export interface AdaptiveCardActionSubmit extends AdaptiveCardActionBase {
  type: "Action.Submit";
  data?: unknown;
}

/**
 * Show card action
 */
export interface AdaptiveCardActionShowCard extends AdaptiveCardActionBase {
  type: "Action.ShowCard";
  card: AdaptiveCard;
}

/**
 * Toggle visibility action
 */
export interface AdaptiveCardActionToggleVisibility extends AdaptiveCardActionBase {
  type: "Action.ToggleVisibility";
  targetElements: Array<string | { elementId: string; isVisible?: boolean }>;
}

/**
 * Execute action (Teams-specific)
 */
export interface AdaptiveCardActionExecute extends AdaptiveCardActionBase {
  type: "Action.Execute";
  verb?: string;
  data?: unknown;
  associatedInputs?: "auto" | "none";
}

/**
 * Union type for all card actions
 */
export type AdaptiveCardAction =
  | AdaptiveCardActionOpenUrl
  | AdaptiveCardActionSubmit
  | AdaptiveCardActionShowCard
  | AdaptiveCardActionToggleVisibility
  | AdaptiveCardActionExecute;

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * Response wrapper for team list
 */
export interface TeamListResponse {
  value: Team[];
  "@odata.nextLink"?: string;
  "@odata.count"?: number;
}

/**
 * Response wrapper for channel list
 */
export interface ChannelListResponse {
  value: TeamsChannel[];
  "@odata.nextLink"?: string;
}

/**
 * Response wrapper for message list
 */
export interface MessageListResponse {
  value: TeamsMessage[];
  "@odata.nextLink"?: string;
}

/**
 * Response wrapper for chat list
 */
export interface ChatListResponse {
  value: TeamsChat[];
  "@odata.nextLink"?: string;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Microsoft Graph error response
 */
export interface GraphError {
  error: {
    code: string;
    message: string;
    innerError?: {
      code?: string;
      "request-id"?: string;
      "client-request-id"?: string;
      date?: string;
    };
  };
}

/**
 * Teams-specific error
 */
export class TeamsError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "TeamsError";
  }
}

// =============================================================================
// OPTIONS TYPES
// =============================================================================

/**
 * Options for listing messages
 */
export interface ListMessagesOptions {
  /** Maximum number of messages to return */
  top?: number;
  /** Filter query */
  filter?: string;
  /** Order by field */
  orderBy?: string;
}

/**
 * Options for sending messages
 */
export interface SendMessageOptions {
  /** Message importance */
  importance?: "normal" | "high" | "urgent";
  /** Subject line */
  subject?: string;
  /** Reply to a specific message ID */
  replyToId?: string;
  /** Attachments */
  attachments?: TeamsAttachment[];
  /** Mentions */
  mentions?: Array<{
    id: number;
    mentionText: string;
    mentioned: {
      user: {
        id: string;
        displayName: string;
        userIdentityType: string;
      };
    };
  }>;
}

// =============================================================================
// OPENCLAW INTEGRATION TYPES
// =============================================================================

/**
 * Normalized incoming message for OpenClaw processing
 */
export interface NormalizedTeamsMessage {
  /** Unique message ID */
  id: string;
  /** Channel identifier (teams) */
  channel: "teams";
  /** Sender information */
  sender: {
    id: string;
    name?: string;
    email?: string;
  };
  /** Message text (stripped of mentions) */
  text: string;
  /** Original raw text */
  rawText?: string;
  /** Chat type */
  chatType: "direct" | "channel" | "groupChat";
  /** Conversation ID */
  conversationId: string;
  /** Team ID (for channel messages) */
  teamId?: string;
  /** Channel ID (for channel messages) */
  channelId?: string;
  /** Thread ID (for replies) */
  threadId?: string;
  /** Whether the bot was mentioned */
  botMentioned: boolean;
  /** Timestamp */
  timestamp: string;
  /** Service URL for replies */
  serviceUrl?: string;
  /** Original activity for reference */
  activity?: TeamsActivity;
}
