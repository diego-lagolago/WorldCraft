import { describe, expect, it } from "vitest";
import { contentHref } from "./content-href";

describe("contentHref", () => {
  it("opens pins on the map with a deep-link", () => {
    expect(contentHref("w1", "pin", "p1")).toBe("/w/w1/map?pin=p1");
    expect(contentHref("w1", "article", "a1")).toBe("/w/w1/articles/a1");
    expect(contentHref("w1", "character", "c1")).toBe("/w/w1/characters/c1");
  });
});
