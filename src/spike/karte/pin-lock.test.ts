import { describe, expect, it } from "vitest";
import { isUnlockOnlyPatch } from "./pin-lock";

describe("locked pin patches", () => {
  it("allows an explicit unlock and nothing else", () => {
    expect(isUnlockOnlyPatch({ locked: false })).toBe(true);
    expect(isUnlockOnlyPatch({ locked: false, title: undefined })).toBe(true);
    expect(isUnlockOnlyPatch({ locked: true })).toBe(false);
    expect(isUnlockOnlyPatch({ locked: false, title: "X" })).toBe(false);
    expect(isUnlockOnlyPatch({ posX: 0.1, posY: 0.2 })).toBe(false);
  });
});
