import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SPIKE_PIN_TYPE_META,
  SPIKE_PIN_TYPES,
  pinTypeIconUrl,
  pinTypePictogram,
} from "./pin-types.ts";

describe("spike pin types", () => {
  it("has exactly 12 distinct types with distinct icons", () => {
    assert.equal(SPIKE_PIN_TYPES.length, 12);
    assert.equal(new Set(SPIKE_PIN_TYPES).size, 12);
    assert.equal(SPIKE_PIN_TYPE_META.length, 12);
    const urls = SPIKE_PIN_TYPE_META.map((meta) => pinTypeIconUrl(meta.id));
    assert.equal(new Set(urls).size, 12);
  });

  it("uses pictograms without letter or text glyphs", () => {
    for (const meta of SPIKE_PIN_TYPE_META) {
      const pictogram = pinTypePictogram(meta.id);
      assert.match(pictogram, /<path|<circle/);
      assert.doesNotMatch(pictogram, /<text/);
      const svg = decodeURIComponent(pinTypeIconUrl(meta.id).split(",")[1] ?? "");
      assert.doesNotMatch(svg, /<text/);
    }
    assert.notEqual(pinTypePictogram("house"), pinTypePictogram("city"));
  });

  it("renders teleporter as a simple two-arm galaxy", () => {
    const galaxy = pinTypePictogram("teleporter");
    assert.match(galaxy, /linearGradient/);
    assert.match(galaxy, /#2563eb/);
    assert.match(galaxy, /#7c3aed/);
    assert.equal([...galaxy.matchAll(/stroke-width="1.6"/g)].length, 1);
    assert.doesNotMatch(galaxy, /orbit|door/i);
  });

  it("renders a tilted leaf with stem and a money-bag shop", () => {
    const leaf = pinTypePictogram("plants");
    assert.doesNotMatch(leaf, /#ecfccb|#fff|#fff7ed/i);
    assert.match(leaf, /M10\.4 17/);
    const bag = pinTypePictogram("shop");
    assert.match(bag, /<circle/);
    assert.match(bag, /<rect/);
    assert.doesNotMatch(bag, /<text/);
  });
});
