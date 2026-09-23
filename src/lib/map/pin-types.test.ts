import { describe, expect, it } from "vitest";
import { pinType } from "@/db/schema";
import { PIN_TYPES, isPinType, pinTypeMeta } from "./pin-types";

describe("pin types", () => {
  it("matches the drizzle pin_type enum exactly", () => {
    expect([...PIN_TYPES]).toEqual([...pinType.enumValues]);
  });

  it("has a German label for every type", () => {
    for (const id of PIN_TYPES) {
      expect(isPinType(id)).toBe(true);
      expect(pinTypeMeta(id).label.length).toBeGreaterThan(0);
    }
    expect(isPinType("unknown")).toBe(false);
  });
});
