import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { StoredTemplateFields } from "@/lib/templates/fields";
import { ArticleFields } from "./ArticleFields";

function render(fields: StoredTemplateFields) {
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

describe("ArticleFields item quest flag", () => {
  it("shows Ja when set and Nein when absent", () => {
    expect(render({ quest: true })).toContain("<dt>Quest</dt><dd>Ja</dd>");
    expect(render({})).toContain("<dt>Quest</dt><dd>Nein</dd>");
  });
});
