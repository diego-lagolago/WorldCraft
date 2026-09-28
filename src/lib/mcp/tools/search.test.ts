import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/worldcraft_test";
});

import { renderSearchHit } from "./search";

describe("renderSearchHit", () => {
  it("CR-004: renders the German template label instead of the database key", () => {
    const value = renderSearchHit({
      kind: "article",
      id: "article-1",
      title: "Sonnenklinge",
      href: "/unused",
      templateType: "item",
      snippet: "",
    });

    expect(value).toContain("Gegenstand");
    expect(value).not.toContain("item");
  });
});
