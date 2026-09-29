import { describe, expect, it, vi } from "vitest";

const getArticle = vi.fn();

vi.mock("@/lib/domain/articles", () => ({ getArticle }));
vi.mock("@/lib/domain/characters", () => ({ getWorldCharacter: vi.fn() }));
vi.mock("@/lib/editor/tiptap-mcp-markdown", () => ({ tiptapJsonToMcpMarkdown: vi.fn() }));
vi.mock("@/lib/characters/sheet", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/characters/sheet")>(),
  attributeModifier: vi.fn(),
  skillBonus: vi.fn(),
}));

const { renderTemplateFields, renderWriteKeys } = await import("./renderers");

describe("renderTemplateFields", () => {
  const world = { id: "world-1", role: "player" as const };
  const fields = { race: { kind: "article", id: "hidden-race" } };

  it("CR-007 / 012 T-006(2): shows an invisible reference as „–“ without title or ID", async () => {
    getArticle.mockResolvedValueOnce(null);

    const rendered = await renderTemplateFields("person", fields, world, "player-1");

    expect(rendered).toContain("Rasse: –");
    expect(rendered).not.toContain("hidden-race");
  });

  it("012 T-006(1): lists every item field in registry order, unset ones as „–“", async () => {
    const rendered = await renderTemplateFields("item", {}, world, "player-1");

    expect(rendered).toBe("Vorlagentyp: Gegenstand\nArt: –\nSeltenheit: –\nBesitzer: –\nQuest-Gegenstand: Nein");
  });

  it("CR-007: renders a visible reference with its title and MCP link", async () => {
    getArticle.mockResolvedValueOnce({ id: "visible-race", title: "Nebelvolk" });

    const rendered = await renderTemplateFields("person", fields, world, "game-master-1");

    expect(rendered).toContain("Rasse: @[Nebelvolk](artikel:visible-race)");
  });
});

describe("renderWriteKeys", () => {
  it("012 T-006(6): maps display labels to felder keys for items and monsters", () => {
    const item = renderWriteKeys([{ art: "artikel", heading: "Artikel", vorlagentyp: "item" }]);
    expect(item).toContain("## Schreibschlüssel");
    expect(item).toContain("- Seltenheit → `vorlagenfelder.Seltenheit`");
    expect(item).toContain("- Text → `text`");

    const monster = renderWriteKeys([{ art: "monster", heading: "Monster" }]);
    expect(monster).toContain("- Gefahrenstufe → `gefahr`");
    expect(monster).toContain("- Makel → `charakterblatt.schwaechen`");
  });
});
