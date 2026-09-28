import { describe, expect, it, vi } from "vitest";

const getArticle = vi.fn();

vi.mock("@/lib/domain/articles", () => ({ getArticle }));
vi.mock("@/lib/domain/characters", () => ({ getWorldCharacter: vi.fn() }));
vi.mock("@/lib/editor/tiptap-mcp-markdown", () => ({ tiptapJsonToMcpMarkdown: vi.fn() }));
vi.mock("@/lib/characters/sheet", () => ({
  attributeModifier: vi.fn(),
  skillBonus: vi.fn(),
  SKILL_LEVEL_LABEL: {},
}));

const { renderTemplateFields } = await import("./renderers");

describe("renderTemplateFields", () => {
  const world = { id: "world-1", role: "player" as const };
  const fields = { race: { kind: "article", id: "hidden-race" } };

  it("CR-007: omits a reference that is invisible to the viewer", async () => {
    getArticle.mockResolvedValueOnce(null);

    const rendered = await renderTemplateFields("person", fields, world, "player-1");

    expect(rendered).not.toContain("Rasse:");
    expect(rendered).not.toContain("hidden-race");
  });

  it("CR-007: renders a visible reference with its title and MCP link", async () => {
    getArticle.mockResolvedValueOnce({ id: "visible-race", title: "Nebelvolk" });

    const rendered = await renderTemplateFields("person", fields, world, "game-master-1");

    expect(rendered).toContain("Rasse: @[Nebelvolk](artikel:visible-race)");
  });
});
