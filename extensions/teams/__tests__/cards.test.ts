import { describe, expect, it } from "vitest";
import {
  createBaseCard,
  createTextCard,
  createActionCard,
  createListCard,
  createFactCard,
  createPollCard,
  createHeroCard,
  createErrorCard,
  createSuccessCard,
  cardToAttachment,
  cardToJson,
  parseCardJson,
  isValidAdaptiveCard,
  addElementsToCard,
  addActionsToCard,
  ADAPTIVE_CARD_VERSION,
  ADAPTIVE_CARD_CONTENT_TYPE,
} from "../cards.js";
import type { AdaptiveCard, AdaptiveCardTextBlock } from "../types.js";

describe("cards", () => {
  describe("createBaseCard", () => {
    it("creates a basic card structure", () => {
      const card = createBaseCard();
      expect(card.type).toBe("AdaptiveCard");
      expect(card.version).toBe(ADAPTIVE_CARD_VERSION);
      expect(card.$schema).toBe("http://adaptivecards.io/schemas/adaptive-card.json");
      expect(card.body).toEqual([]);
    });

    it("accepts custom version", () => {
      const card = createBaseCard({ version: "1.4" });
      expect(card.version).toBe("1.4");
    });

    it("includes fallback text when provided", () => {
      const card = createBaseCard({ fallbackText: "Fallback" });
      expect(card.fallbackText).toBe("Fallback");
    });
  });

  describe("createTextCard", () => {
    it("creates a card with text block", () => {
      const card = createTextCard("Hello world");
      expect(card.body).toHaveLength(1);
      expect((card.body?.[0] as AdaptiveCardTextBlock).type).toBe("TextBlock");
      expect((card.body?.[0] as AdaptiveCardTextBlock).text).toBe("Hello world");
    });

    it("wraps text by default", () => {
      const card = createTextCard("Hello");
      expect((card.body?.[0] as AdaptiveCardTextBlock).wrap).toBe(true);
    });

    it("applies styling options", () => {
      const card = createTextCard("Styled", {
        size: "large",
        weight: "bolder",
        color: "accent",
      });
      const textBlock = card.body?.[0] as AdaptiveCardTextBlock;
      expect(textBlock.size).toBe("large");
      expect(textBlock.weight).toBe("bolder");
      expect(textBlock.color).toBe("accent");
    });

    it("sets fallback text", () => {
      const card = createTextCard("Hello world");
      expect(card.fallbackText).toBe("Hello world");
    });
  });

  describe("createActionCard", () => {
    it("creates a card with text and action buttons", () => {
      const card = createActionCard("Choose an option", [
        { title: "Yes", type: "submit", data: { choice: "yes" } },
        { title: "No", type: "submit", data: { choice: "no" } },
      ]);

      expect(card.body).toHaveLength(1);
      expect(card.actions).toHaveLength(2);
      expect(card.actions?.[0]?.type).toBe("Action.Submit");
      expect(card.actions?.[0]?.title).toBe("Yes");
    });

    it("creates openUrl actions", () => {
      const card = createActionCard("Click to visit", [
        { title: "Visit", type: "openUrl", url: "https://example.com" },
      ]);

      expect(card.actions?.[0]?.type).toBe("Action.OpenUrl");
      expect((card.actions?.[0] as { url: string }).url).toBe("https://example.com");
    });

    it("creates execute actions", () => {
      const card = createActionCard("Execute", [
        { title: "Run", type: "execute", verb: "doSomething", data: { key: "value" } },
      ]);

      expect(card.actions?.[0]?.type).toBe("Action.Execute");
      expect((card.actions?.[0] as { verb: string }).verb).toBe("doSomething");
    });

    it("applies button styles", () => {
      const card = createActionCard("Danger", [
        { title: "Delete", type: "submit", style: "destructive" },
      ]);

      expect(card.actions?.[0]?.style).toBe("destructive");
    });
  });

  describe("createListCard", () => {
    it("creates a card with list items", () => {
      const card = createListCard("My List", [
        { title: "Item 1", subtitle: "Description 1" },
        { title: "Item 2", subtitle: "Description 2" },
      ]);

      expect(card.body).toHaveLength(3); // title + 2 items
      expect((card.body?.[0] as AdaptiveCardTextBlock).text).toBe("My List");
    });

    it("includes icons when provided", () => {
      const card = createListCard("List", [
        { title: "Item", iconUrl: "https://example.com/icon.png" },
      ]);

      // Item should be a ColumnSet with icon column
      const item = card.body?.[1] as { type: string; columns: Array<{ items: unknown[] }> };
      expect(item.type).toBe("ColumnSet");
      expect(item.columns.length).toBeGreaterThanOrEqual(2);
    });

    it("handles items without subtitles", () => {
      const card = createListCard("List", [{ title: "Just Title" }]);

      expect(card.body).toHaveLength(2);
    });

    it("sets fallback text", () => {
      const card = createListCard("My List", [{ title: "A" }, { title: "B" }]);
      expect(card.fallbackText).toBe("My List: A, B");
    });
  });

  describe("createFactCard", () => {
    it("creates a card with fact set", () => {
      const card = createFactCard("Details", [
        { title: "Name", value: "John" },
        { title: "Age", value: "30" },
      ]);

      expect(card.body).toHaveLength(2); // title + fact set
      const factSet = card.body?.[1] as { type: string; facts: Array<{ title: string; value: string }> };
      expect(factSet.type).toBe("FactSet");
      expect(factSet.facts).toHaveLength(2);
    });

    it("sets fallback text with all facts", () => {
      const card = createFactCard("Info", [
        { title: "Key1", value: "Val1" },
        { title: "Key2", value: "Val2" },
      ]);
      expect(card.fallbackText).toContain("Key1: Val1");
    });
  });

  describe("createPollCard", () => {
    it("creates a poll card with choices", () => {
      const card = createPollCard("What's your choice?", [
        { title: "Option A" },
        { title: "Option B" },
      ]);

      expect(card.body).toHaveLength(2); // question + choice set
      expect(card.actions).toHaveLength(1);
      expect(card.actions?.[0]?.title).toBe("Vote");
    });

    it("supports multi-select", () => {
      const card = createPollCard(
        "Select all that apply",
        [{ title: "A" }, { title: "B" }],
        { isMultiSelect: true },
      );

      const choiceSet = card.body?.[1] as { isMultiSelect: boolean };
      expect(choiceSet.isMultiSelect).toBe(true);
    });

    it("uses custom poll ID", () => {
      const card = createPollCard("Question", [{ title: "A" }], { pollId: "custom-poll" });

      const action = card.actions?.[0] as { data: { pollId: string } };
      expect(action.data.pollId).toBe("custom-poll");
    });

    it("uses custom submit button text", () => {
      const card = createPollCard("Question", [{ title: "A" }], { submitText: "Submit Vote" });

      expect(card.actions?.[0]?.title).toBe("Submit Vote");
    });
  });

  describe("createHeroCard", () => {
    it("creates a hero card with title", () => {
      const card = createHeroCard({ title: "Hero Title" });

      expect(card.body).toHaveLength(1);
      expect((card.body?.[0] as AdaptiveCardTextBlock).text).toBe("Hero Title");
    });

    it("includes all optional elements", () => {
      const card = createHeroCard({
        title: "Title",
        subtitle: "Subtitle",
        text: "Body text",
        imageUrl: "https://example.com/image.jpg",
        buttons: [{ title: "Click", type: "openUrl", url: "https://example.com" }],
      });

      expect(card.body?.length).toBeGreaterThanOrEqual(3);
      expect(card.actions).toHaveLength(1);
    });
  });

  describe("createErrorCard", () => {
    it("creates an error-styled card", () => {
      const card = createErrorCard("Error Title", "Something went wrong");

      expect(card.body).toHaveLength(1);
      const container = card.body?.[0] as { style: string };
      expect(container.style).toBe("attention");
    });

    it("includes retry action when provided", () => {
      const card = createErrorCard("Error", "Failed", {
        title: "Retry",
        type: "submit",
        data: { action: "retry" },
      });

      expect(card.actions).toHaveLength(1);
      expect(card.actions?.[0]?.title).toBe("Retry");
    });
  });

  describe("createSuccessCard", () => {
    it("creates a success-styled card", () => {
      const card = createSuccessCard("Success!", "Operation completed");

      const container = card.body?.[0] as { style: string };
      expect(container.style).toBe("good");
    });
  });

  describe("cardToAttachment", () => {
    it("wraps card in Teams attachment format", () => {
      const card = createTextCard("Test");
      const attachment = cardToAttachment(card);

      expect(attachment.contentType).toBe(ADAPTIVE_CARD_CONTENT_TYPE);
      expect(attachment.content).toBe(card);
    });
  });

  describe("cardToJson", () => {
    it("serializes card to JSON string", () => {
      const card = createTextCard("Test");
      const json = cardToJson(card);

      expect(typeof json).toBe("string");
      const parsed = JSON.parse(json);
      expect(parsed.type).toBe("AdaptiveCard");
    });
  });

  describe("parseCardJson", () => {
    it("parses valid card JSON", () => {
      const original = createTextCard("Test");
      const json = cardToJson(original);
      const parsed = parseCardJson(json);

      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe("AdaptiveCard");
    });

    it("returns null for invalid JSON", () => {
      expect(parseCardJson("not json")).toBeNull();
    });

    it("returns null for non-card JSON", () => {
      expect(parseCardJson('{"type": "NotACard"}')).toBeNull();
    });
  });

  describe("isValidAdaptiveCard", () => {
    it("validates correct cards", () => {
      const card = createTextCard("Test");
      expect(isValidAdaptiveCard(card)).toBe(true);
    });

    it("rejects non-objects", () => {
      expect(isValidAdaptiveCard(null)).toBe(false);
      expect(isValidAdaptiveCard("string")).toBe(false);
      expect(isValidAdaptiveCard(123)).toBe(false);
    });

    it("rejects objects without correct type", () => {
      expect(isValidAdaptiveCard({ type: "Other" })).toBe(false);
      expect(isValidAdaptiveCard({ version: "1.5" })).toBe(false);
    });
  });

  describe("addElementsToCard", () => {
    it("adds elements to card body", () => {
      const card = createBaseCard();
      const textBlock: AdaptiveCardTextBlock = { type: "TextBlock", text: "Added" };
      const updated = addElementsToCard(card, [textBlock]);

      expect(updated.body).toHaveLength(1);
      expect((updated.body?.[0] as AdaptiveCardTextBlock).text).toBe("Added");
    });

    it("preserves existing elements", () => {
      const card = createTextCard("Original");
      const textBlock: AdaptiveCardTextBlock = { type: "TextBlock", text: "Added" };
      const updated = addElementsToCard(card, [textBlock]);

      expect(updated.body).toHaveLength(2);
    });
  });

  describe("addActionsToCard", () => {
    it("adds actions to card", () => {
      const card = createTextCard("Test");
      const updated = addActionsToCard(card, [
        { type: "Action.Submit", title: "Submit" },
      ]);

      expect(updated.actions).toHaveLength(1);
    });

    it("preserves existing actions", () => {
      const card = createActionCard("Test", [{ title: "First", type: "submit" }]);
      const updated = addActionsToCard(card, [
        { type: "Action.Submit", title: "Second" },
      ]);

      expect(updated.actions).toHaveLength(2);
    });
  });
});
