import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUnlockOnlyPatch } from "./pin-lock.ts";

describe("locked pin patches", () => {
  it("allows an explicit unlock and nothing else", () => {
    assert.equal(isUnlockOnlyPatch({ locked: false }), true);
    assert.equal(isUnlockOnlyPatch({ locked: false, title: undefined }), true);
    assert.equal(isUnlockOnlyPatch({ locked: true }), false);
    assert.equal(isUnlockOnlyPatch({ locked: false, title: "X" }), false);
    assert.equal(isUnlockOnlyPatch({ posX: 0.1, posY: 0.2 }), false);
  });
});
