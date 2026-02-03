/**
 * Adaptive Card Builder
 *
 * Utility functions for creating Adaptive Cards for Microsoft Teams.
 * @see https://adaptivecards.io/
 */

import type {
  AdaptiveCard,
  AdaptiveCardAction,
  AdaptiveCardActionOpenUrl,
  AdaptiveCardActionSubmit,
  AdaptiveCardElement,
  AdaptiveCardFact,
  AdaptiveCardFactSet,
  AdaptiveCardTextBlock,
  AdaptiveCardContainer,
  AdaptiveCardColumnSet,
  AdaptiveCardColumn,
  AdaptiveCardImage,
  AdaptiveCardInputChoiceSet,
  AdaptiveCardChoice,
  TeamsActivityAttachment,
} from "./types.js";

/** Default Adaptive Card version */
export const ADAPTIVE_CARD_VERSION = "1.5";

/** Content type for Adaptive Cards */
export const ADAPTIVE_CARD_CONTENT_TYPE = "application/vnd.microsoft.card.adaptive";

/**
 * Create a basic Adaptive Card structure
 */
export function createBaseCard(options?: {
  version?: string;
  fallbackText?: string;
}): AdaptiveCard {
  return {
    type: "AdaptiveCard",
    version: options?.version ?? ADAPTIVE_CARD_VERSION,
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    body: [],
    ...(options?.fallbackText ? { fallbackText: options.fallbackText } : {}),
  };
}

/**
 * Create a simple text card
 *
 * @param text - Text content to display
 * @param options - Optional styling options
 * @returns Adaptive Card with text block
 */
export function createTextCard(
  text: string,
  options?: {
    size?: AdaptiveCardTextBlock["size"];
    weight?: AdaptiveCardTextBlock["weight"];
    color?: AdaptiveCardTextBlock["color"];
    wrap?: boolean;
  },
): AdaptiveCard {
  const card = createBaseCard({ fallbackText: text });

  const textBlock: AdaptiveCardTextBlock = {
    type: "TextBlock",
    text,
    wrap: options?.wrap ?? true,
    ...(options?.size ? { size: options.size } : {}),
    ...(options?.weight ? { weight: options.weight } : {}),
    ...(options?.color ? { color: options.color } : {}),
  };

  card.body = [textBlock];
  return card;
}

/**
 * Action button configuration
 */
export interface ActionButtonConfig {
  /** Button title */
  title: string;
  /** Action type */
  type: "openUrl" | "submit" | "execute";
  /** URL for openUrl actions */
  url?: string;
  /** Data for submit/execute actions */
  data?: unknown;
  /** Verb for execute actions */
  verb?: string;
  /** Button style */
  style?: "default" | "positive" | "destructive";
}

/**
 * Create an action card with buttons
 *
 * @param text - Card text content
 * @param actions - Array of action button configurations
 * @returns Adaptive Card with text and action buttons
 */
export function createActionCard(
  text: string,
  actions: ActionButtonConfig[],
): AdaptiveCard {
  const card = createBaseCard({ fallbackText: text });

  const textBlock: AdaptiveCardTextBlock = {
    type: "TextBlock",
    text,
    wrap: true,
  };

  card.body = [textBlock];
  card.actions = actions.map((action): AdaptiveCardAction => {
    switch (action.type) {
      case "openUrl":
        return {
          type: "Action.OpenUrl",
          title: action.title,
          url: action.url ?? "",
          ...(action.style ? { style: action.style } : {}),
        } satisfies AdaptiveCardActionOpenUrl;

      case "submit":
        return {
          type: "Action.Submit",
          title: action.title,
          data: action.data,
          ...(action.style ? { style: action.style } : {}),
        } satisfies AdaptiveCardActionSubmit;

      case "execute":
        return {
          type: "Action.Execute",
          title: action.title,
          verb: action.verb,
          data: action.data,
          ...(action.style ? { style: action.style } : {}),
        };

      default:
        return {
          type: "Action.Submit",
          title: action.title,
          data: action.data,
          ...(action.style ? { style: action.style } : {}),
        } satisfies AdaptiveCardActionSubmit;
    }
  });

  return card;
}

/**
 * List item configuration
 */
export interface ListItemConfig {
  /** Primary text */
  title: string;
  /** Secondary text (optional) */
  subtitle?: string;
  /** Icon URL (optional) */
  iconUrl?: string;
  /** Action when item is clicked (optional) */
  selectAction?: ActionButtonConfig;
}

/**
 * Create a list card
 *
 * @param title - Card title
 * @param items - Array of list items
 * @returns Adaptive Card with a list layout
 */
export function createListCard(
  title: string,
  items: ListItemConfig[],
): AdaptiveCard {
  const card = createBaseCard({ fallbackText: `${title}: ${items.map((i) => i.title).join(", ")}` });

  const titleBlock: AdaptiveCardTextBlock = {
    type: "TextBlock",
    text: title,
    size: "large",
    weight: "bolder",
    wrap: true,
  };

  const listItems: AdaptiveCardElement[] = items.map((item) => {
    const columns: AdaptiveCardColumn[] = [];

    // Icon column (if icon provided)
    if (item.iconUrl) {
      columns.push({
        type: "Column",
        width: "auto",
        items: [
          {
            type: "Image",
            url: item.iconUrl,
            size: "small",
            style: "default",
          } as AdaptiveCardImage,
        ],
      });
    }

    // Content column
    const contentItems: AdaptiveCardElement[] = [
      {
        type: "TextBlock",
        text: item.title,
        weight: "bolder",
        wrap: true,
      } as AdaptiveCardTextBlock,
    ];

    if (item.subtitle) {
      contentItems.push({
        type: "TextBlock",
        text: item.subtitle,
        isSubtle: true,
        wrap: true,
        spacing: "none",
      } as AdaptiveCardTextBlock);
    }

    columns.push({
      type: "Column",
      width: "stretch",
      items: contentItems,
    });

    const columnSet: AdaptiveCardColumnSet = {
      type: "ColumnSet",
      columns,
      ...(item.selectAction
        ? {
            selectAction: convertActionConfig(item.selectAction),
          }
        : {}),
    };

    return columnSet;
  });

  card.body = [titleBlock, ...listItems];
  return card;
}

/**
 * Fact (key-value pair) configuration
 */
export interface FactConfig {
  /** Fact title/label */
  title: string;
  /** Fact value */
  value: string;
}

/**
 * Create a fact card (key-value pairs)
 *
 * @param title - Card title
 * @param facts - Array of key-value pairs
 * @returns Adaptive Card with fact set
 */
export function createFactCard(
  title: string,
  facts: FactConfig[],
): AdaptiveCard {
  const card = createBaseCard({
    fallbackText: `${title}: ${facts.map((f) => `${f.title}: ${f.value}`).join(", ")}`,
  });

  const titleBlock: AdaptiveCardTextBlock = {
    type: "TextBlock",
    text: title,
    size: "large",
    weight: "bolder",
    wrap: true,
  };

  const factSet: AdaptiveCardFactSet = {
    type: "FactSet",
    facts: facts.map(
      (fact): AdaptiveCardFact => ({
        title: fact.title,
        value: fact.value,
      }),
    ),
  };

  card.body = [titleBlock, factSet];
  return card;
}

/**
 * Poll option configuration
 */
export interface PollOptionConfig {
  /** Option display text */
  title: string;
  /** Option value (defaults to title if not provided) */
  value?: string;
}

/**
 * Create a poll card
 *
 * @param question - Poll question
 * @param options - Poll options
 * @param config - Additional poll configuration
 * @returns Adaptive Card with poll input
 */
export function createPollCard(
  question: string,
  options: PollOptionConfig[],
  config?: {
    /** Allow multiple selections */
    isMultiSelect?: boolean;
    /** Poll ID for tracking responses */
    pollId?: string;
    /** Submit button text */
    submitText?: string;
  },
): AdaptiveCard {
  const pollId = config?.pollId ?? `poll_${Date.now()}`;
  const card = createBaseCard({ fallbackText: question });

  const questionBlock: AdaptiveCardTextBlock = {
    type: "TextBlock",
    text: question,
    size: "medium",
    weight: "bolder",
    wrap: true,
  };

  const choices: AdaptiveCardChoice[] = options.map((opt) => ({
    title: opt.title,
    value: opt.value ?? opt.title,
  }));

  const choiceSet: AdaptiveCardInputChoiceSet = {
    type: "Input.ChoiceSet",
    id: "pollChoice",
    choices,
    isMultiSelect: config?.isMultiSelect ?? false,
    style: "expanded",
  };

  card.body = [questionBlock, choiceSet];
  card.actions = [
    {
      type: "Action.Submit",
      title: config?.submitText ?? "Vote",
      data: { pollId, action: "vote" },
    },
  ];

  return card;
}

/**
 * Create a hero card (image + title + subtitle + buttons)
 *
 * @param options - Hero card options
 * @returns Adaptive Card with hero layout
 */
export function createHeroCard(options: {
  title: string;
  subtitle?: string;
  text?: string;
  imageUrl?: string;
  buttons?: ActionButtonConfig[];
}): AdaptiveCard {
  const card = createBaseCard({ fallbackText: options.title });
  const body: AdaptiveCardElement[] = [];

  // Image
  if (options.imageUrl) {
    body.push({
      type: "Image",
      url: options.imageUrl,
      size: "stretch",
    } as AdaptiveCardImage);
  }

  // Title
  body.push({
    type: "TextBlock",
    text: options.title,
    size: "large",
    weight: "bolder",
    wrap: true,
  } as AdaptiveCardTextBlock);

  // Subtitle
  if (options.subtitle) {
    body.push({
      type: "TextBlock",
      text: options.subtitle,
      isSubtle: true,
      wrap: true,
      spacing: "none",
    } as AdaptiveCardTextBlock);
  }

  // Text
  if (options.text) {
    body.push({
      type: "TextBlock",
      text: options.text,
      wrap: true,
    } as AdaptiveCardTextBlock);
  }

  card.body = body;

  // Buttons
  if (options.buttons && options.buttons.length > 0) {
    card.actions = options.buttons.map(convertActionConfig);
  }

  return card;
}

/**
 * Create an error card for displaying error messages
 *
 * @param title - Error title
 * @param message - Error message
 * @param retryAction - Optional retry action
 * @returns Adaptive Card styled for errors
 */
export function createErrorCard(
  title: string,
  message: string,
  retryAction?: ActionButtonConfig,
): AdaptiveCard {
  const card = createBaseCard({ fallbackText: `Error: ${title} - ${message}` });

  const container: AdaptiveCardContainer = {
    type: "Container",
    style: "attention",
    items: [
      {
        type: "TextBlock",
        text: `⚠️ ${title}`,
        weight: "bolder",
        color: "attention",
        wrap: true,
      } as AdaptiveCardTextBlock,
      {
        type: "TextBlock",
        text: message,
        wrap: true,
      } as AdaptiveCardTextBlock,
    ],
  };

  card.body = [container];

  if (retryAction) {
    card.actions = [convertActionConfig(retryAction)];
  }

  return card;
}

/**
 * Create a success card for displaying success messages
 *
 * @param title - Success title
 * @param message - Success message
 * @returns Adaptive Card styled for success
 */
export function createSuccessCard(title: string, message: string): AdaptiveCard {
  const card = createBaseCard({ fallbackText: `Success: ${title} - ${message}` });

  const container: AdaptiveCardContainer = {
    type: "Container",
    style: "good",
    items: [
      {
        type: "TextBlock",
        text: `✅ ${title}`,
        weight: "bolder",
        color: "good",
        wrap: true,
      } as AdaptiveCardTextBlock,
      {
        type: "TextBlock",
        text: message,
        wrap: true,
      } as AdaptiveCardTextBlock,
    ],
  };

  card.body = [container];
  return card;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert ActionButtonConfig to AdaptiveCardAction
 */
function convertActionConfig(config: ActionButtonConfig): AdaptiveCardAction {
  switch (config.type) {
    case "openUrl":
      return {
        type: "Action.OpenUrl",
        title: config.title,
        url: config.url ?? "",
        ...(config.style ? { style: config.style } : {}),
      };
    case "submit":
      return {
        type: "Action.Submit",
        title: config.title,
        data: config.data,
        ...(config.style ? { style: config.style } : {}),
      };
    case "execute":
      return {
        type: "Action.Execute",
        title: config.title,
        verb: config.verb,
        data: config.data,
        ...(config.style ? { style: config.style } : {}),
      };
    default:
      return {
        type: "Action.Submit",
        title: config.title,
        data: config.data,
        ...(config.style ? { style: config.style } : {}),
      };
  }
}

/**
 * Convert an Adaptive Card to a Teams attachment
 *
 * @param card - Adaptive Card object
 * @returns Teams activity attachment
 */
export function cardToAttachment(card: AdaptiveCard): TeamsActivityAttachment {
  return {
    contentType: ADAPTIVE_CARD_CONTENT_TYPE,
    content: card,
  };
}

/**
 * Convert an Adaptive Card to JSON string
 *
 * @param card - Adaptive Card object
 * @returns JSON string representation
 */
export function cardToJson(card: AdaptiveCard): string {
  return JSON.stringify(card, null, 2);
}

/**
 * Parse JSON string to Adaptive Card
 *
 * @param json - JSON string
 * @returns Adaptive Card object or null if invalid
 */
export function parseCardJson(json: string): AdaptiveCard | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (isValidAdaptiveCard(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate that an object is a valid Adaptive Card
 *
 * @param obj - Object to validate
 * @returns True if valid Adaptive Card
 */
export function isValidAdaptiveCard(obj: unknown): obj is AdaptiveCard {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const card = obj as Record<string, unknown>;
  return card.type === "AdaptiveCard" && typeof card.version === "string";
}

/**
 * Add elements to a card's body
 *
 * @param card - Base card
 * @param elements - Elements to add
 * @returns Card with added elements
 */
export function addElementsToCard(
  card: AdaptiveCard,
  elements: AdaptiveCardElement[],
): AdaptiveCard {
  return {
    ...card,
    body: [...(card.body ?? []), ...elements],
  };
}

/**
 * Add actions to a card
 *
 * @param card - Base card
 * @param actions - Actions to add
 * @returns Card with added actions
 */
export function addActionsToCard(
  card: AdaptiveCard,
  actions: AdaptiveCardAction[],
): AdaptiveCard {
  return {
    ...card,
    actions: [...(card.actions ?? []), ...actions],
  };
}
