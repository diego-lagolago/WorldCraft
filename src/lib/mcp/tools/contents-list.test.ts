import { describe, expect, it, vi } from "vitest";

const { TestMcpToolError } = vi.hoisted(() => ({
  TestMcpToolError: class TestMcpToolError extends Error {},
}));

vi.mock("@/lib/domain/articles", () => ({ listArticles: vi.fn() }));
vi.mock("@/lib/domain/monsters", () => ({ listMonsters: vi.fn() }));
vi.mock("../context", () => ({
  McpToolError: TestMcpToolError,
  resolveMcpWorld: vi.fn(),
}));

import { QUEST_ITEM_FILTER_GUIDANCE, renderArticleListItem, validateContentsListInput } from "./contents-list";

describe("inhalte_auflisten", () => {
  it("guides MCP clients to use the complete quest-item filter immediately", () => {
    expect(QUEST_ITEM_FILTER_GUIDANCE).toContain('art: "artikel"');
    expect(QUEST_ITEM_FILTER_GUIDANCE).toContain('vorlagentyp: "gegenstand"');
    expect(QUEST_ITEM_FILTER_GUIDANCE).toContain("quest_gegenstand: true");
  });

  it("CR-008: rejects quest_gegenstand without the Gegenstand template", () => {
    expect(() => validateContentsListInput({
      art: "artikel",
      vorlagentyp: "person",
      quest_gegenstand: true,
    })).toThrow(new TestMcpToolError("quest_gegenstand ist nur bei vorlagentyp: gegenstand erlaubt."));
  });

  it("CR-008: uses the German rarity label for a quest item", () => {
    expect(renderArticleListItem({
      id: "item-1",
      title: "Schlüssel von Rabenstein",
      templateType: "item",
      visibility: "published",
      ownerId: "owner-1",
      firstEditedAt: null,
      updatedAt: new Date(),
      titleImageId: null,
      isQuestItem: true,
      rarity: "rare",
    })).toContain("Selten");
  });
});
