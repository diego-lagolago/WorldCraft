// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { clipboardContainsOnlyImage, sanitizePastedHtml } from "./sanitize-paste";

describe("sanitizePastedHtml", () => {
  it("drops images and embedded media", () => {
    const html = sanitizePastedHtml(
      '<p>Vor<img src="x.png">nach</p><figure><img src="y.png"><figcaption>Bild</figcaption></figure><iframe title="Einbettung"></iframe>',
    );
    expect(html).toBe("<p>Vornach</p>");
  });

  it("replaces tables by their cell text", () => {
    const html = sanitizePastedHtml(
      "<p>A</p><table><tr><td>Zelle 1</td><td>Zelle 2</td></tr></table><p>B</p>",
    );
    expect(html).toBe("<p>A</p>Zelle 1Zelle 2<p>B</p>");
  });
});

function clipboard(types: string[], data: Record<string, string>, itemTypes: string[] = []) {
  return {
    types,
    items: itemTypes.map((type) => ({ type })),
    getData: (type: string) => data[type] ?? "",
  } as unknown as DataTransfer;
}

describe("clipboardContainsOnlyImage", () => {
  it("is true for an image without text", () => {
    expect(clipboardContainsOnlyImage(clipboard(["Files"], {}, ["image/png"]))).toBe(true);
  });

  it("is false when text is present or nothing is there", () => {
    expect(
      clipboardContainsOnlyImage(clipboard(["Files", "text/html"], { "text/html": "<p>x</p>" }, ["image/png"])),
    ).toBe(false);
    expect(clipboardContainsOnlyImage(clipboard(["text/plain"], { "text/plain": "x" }))).toBe(false);
    expect(clipboardContainsOnlyImage(null)).toBe(false);
  });
});
