import { describe, expect, it } from "vitest";
import { characterMarkerHtml, markerPinHtml } from "./character-marker";
import { PIN_ICON } from "./pin-icon";

describe("PIN_ICON", () => {
  it("anchors at the tip of the 48×58 pin graphic (K8)", () => {
    expect(PIN_ICON.size).toEqual([48, 58]);
    expect(PIN_ICON.anchor).toEqual([24, 56]);
  });
});

describe("markerPinHtml", () => {
  it("renders initials without an image and escapes HTML", () => {
    const html = markerPinHtml({
      name: 'A<"b',
      imageUrl: null,
      variant: "character",
    });
    expect(html).toContain("class=\"map-marker-pin character\"");
    expect(html).toContain(">A&lt;</span>");
    expect(html).not.toContain("<\"b");
    expect(html).not.toContain("<img");
  });

  it("sets the variant class for monster", () => {
    const html = markerPinHtml({
      name: "Schattenwolf",
      imageUrl: "/api/files/x",
      variant: "monster",
    });
    expect(html).toContain("map-marker-pin monster");
    expect(html).toContain('src="/api/files/x"');
    expect(html).toContain(">Schattenwolf</span>");
  });

  it("characterMarkerHtml delegates to the character variant", () => {
    const a = characterMarkerHtml("Elara", null);
    const b = markerPinHtml({ name: "Elara", imageUrl: null, variant: "character" });
    expect(a).toBe(b);
  });
});
