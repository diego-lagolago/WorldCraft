import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SPIKE_PIN_TYPE_META,
  SPIKE_PIN_TYPES,
  pinTypeIconUrl,
} from "./pin-types.ts";

describe("spike pin types", () => {
  it("has exactly 12 distinct types with distinct icons", () => {
    assert.equal(SPIKE_PIN_TYPES.length, 12);
    assert.equal(new Set(SPIKE_PIN_TYPES).size, 12);
    assert.equal(SPIKE_PIN_TYPE_META.length, 12);
    const urls = SPIKE_PIN_TYPE_META.map((meta) => pinTypeIconUrl(meta.id));
    assert.equal(new Set(urls).size, 12);
  });
});
