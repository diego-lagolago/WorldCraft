import { describe, expect, it } from "vitest";
import { isMonsterRarity } from "./labels";

describe("isMonsterRarity", () => {
  it("accepts known rarity keys only", () => {
    expect(isMonsterRarity("legendary")).toBe(true);
    expect(isMonsterRarity("mythic")).toBe(false);
    expect(isMonsterRarity(null)).toBe(false);
  });
});
