import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleFields } from "./ArticleFields";

function render(fields: Record<string, string>) {
  return renderToStaticMarkup(createElement(ArticleFields, { templateType: "item", fields, mentions: {} }));
}

describe("ArticleFields item rarity", () => {
  it("renders the rarity pill and German label for valid item rarities", () => {
    expect(render({ rarity: "legendary" })).toContain('badge rarity-legendary');
    expect(render({ rarity: "legendary" })).toContain("Legendär");
    expect(render({ rarity: "common" })).toContain('badge rarity-common');
    expect(render({ rarity: "common" })).toContain("Gewöhnlich");
  });

  it("shows a dash without rarity and no pill for invalid values", () => {
    const missing = render({});
    expect(missing).toContain("–");
    expect(missing).not.toContain("rarity-");
    expect(render({ rarity: "mythic" })).not.toContain("rarity-");
  });
});
