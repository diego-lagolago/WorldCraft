import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleList } from "./ArticleList";

function render(templateType: string, rarity: string | null) {
  return renderToStaticMarkup(
    createElement(ArticleList, {
      worldId: "00000000-0000-4000-8000-000000000001",
      canCreate: false,
      articles: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          title: "Testartikel",
          templateType,
          rarity,
          visibility: "published",
          ownerId: "user-1",
          firstEditedAt: new Date(),
          titleImageId: null,
        },
      ],
    }),
  );
}

describe("ArticleList item rarity", () => {
  it("renders the rarity pill for items with a valid rarity", () => {
    const html = render("item", "legendary");
    expect(html).toContain("badge rarity-legendary");
    expect(html).toContain("Legendär");
  });

  it("does not render a pill for items without rarity", () => {
    expect(render("item", null)).not.toContain("rarity-");
  });

  it("does not render an item rarity pill for other templates", () => {
    expect(render("place", "legendary")).not.toContain("rarity-");
  });

  it("does not render a pill for invalid rarity values", () => {
    expect(render("item", "mythic")).not.toContain("rarity-");
  });
});
