import { describe, expect, it } from "vitest";
import { hubFilterHref } from "./hub-filter-href";

const W = "11111111-1111-4111-8111-111111111111";

describe("hubFilterHref", () => {
  it("sets only its own param", () => {
    expect(hubFilterHref(W, {}, "template", "place")).toBe(`/w/${W}?template=place`);
    expect(hubFilterHref(W, {}, "kind", "dragon")).toBe(`/w/${W}?kind=dragon`);
  });

  it("preserves the other filter when setting one", () => {
    expect(hubFilterHref(W, { kind: "dragon" }, "template", "place")).toBe(
      `/w/${W}?template=place&kind=dragon`,
    );
    expect(hubFilterHref(W, { template: "place" }, "kind", "beast")).toBe(
      `/w/${W}?template=place&kind=beast`,
    );
  });

  it("removes only its own param on Alle", () => {
    expect(hubFilterHref(W, { template: "place", kind: "dragon" }, "template", "all")).toBe(
      `/w/${W}?kind=dragon`,
    );
    expect(hubFilterHref(W, { template: "place", kind: "dragon" }, "kind", "all")).toBe(
      `/w/${W}?template=place`,
    );
  });

  it("returns bare hub path when nothing remains", () => {
    expect(hubFilterHref(W, { template: "place" }, "template", "all")).toBe(`/w/${W}`);
  });
});
