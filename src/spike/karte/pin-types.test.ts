import { describe, expect, it } from "vitest";
import {
  SPIKE_PIN_TYPE_META,
  SPIKE_PIN_TYPES,
  pinTypeIconUrl,
  pinTypePictogram,
} from "./pin-types";

describe("spike pin types", () => {
  it("has exactly 12 distinct types with distinct icons", () => {
    expect(SPIKE_PIN_TYPES.length).toBe(12);
    expect(new Set(SPIKE_PIN_TYPES).size).toBe(12);
    expect(SPIKE_PIN_TYPE_META.length).toBe(12);
    const urls = SPIKE_PIN_TYPE_META.map((meta) => pinTypeIconUrl(meta.id));
    expect(new Set(urls).size).toBe(12);
  });

  it("uses pictograms without letter or text glyphs", () => {
    for (const meta of SPIKE_PIN_TYPE_META) {
      const pictogram = pinTypePictogram(meta.id);
      expect(pictogram).toMatch(/<path|<circle/);
      expect(pictogram).not.toMatch(/<text/);
      const svg = decodeURIComponent(pinTypeIconUrl(meta.id).split(",")[1] ?? "");
      expect(svg).not.toMatch(/<text/);
    }
    expect(pinTypePictogram("house")).not.toBe(pinTypePictogram("city"));
  });

  it("renders teleporter as a simple two-arm galaxy", () => {
    const galaxy = pinTypePictogram("teleporter");
    expect(galaxy).toMatch(/linearGradient/);
    expect(galaxy).toMatch(/#2563eb/);
    expect(galaxy).toMatch(/#7c3aed/);
    expect([...galaxy.matchAll(/stroke-width="1.6"/g)].length).toBe(1);
    expect(galaxy).not.toMatch(/orbit|door/i);
  });

  it("renders a tilted leaf with stem and a money-bag shop", () => {
    const leaf = pinTypePictogram("plants");
    expect(leaf).not.toMatch(/#ecfccb|#fff|#fff7ed/i);
    expect(leaf).toMatch(/M10\.4 17/);
    const bag = pinTypePictogram("shop");
    expect(bag).toMatch(/<circle/);
    expect(bag).toMatch(/<rect/);
    expect(bag).not.toMatch(/<text/);
  });
});
