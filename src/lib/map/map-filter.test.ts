import { describe, expect, it } from "vitest";
import {
  categoryForItem,
  isMapFilterVisible,
  toggleMapFilterHidden,
} from "./map-filter";

describe("map filter", () => {
  it("maps items to categories", () => {
    expect(categoryForItem({ kind: "character" })).toBe("characters");
    expect(categoryForItem({ kind: "monster" })).toBe("monsters");
    expect(categoryForItem({ kind: "pin", pinType: "shop" })).toBe("pin:shop");
  });

  it("hides categories that are in the hidden list", () => {
    const hidden = ["monsters", "pin:shop"] as const;
    expect(isMapFilterVisible({ kind: "monster" }, hidden)).toBe(false);
    expect(isMapFilterVisible({ kind: "character" }, hidden)).toBe(true);
    expect(isMapFilterVisible({ kind: "pin", pinType: "shop" }, hidden)).toBe(false);
    expect(isMapFilterVisible({ kind: "pin", pinType: "city" }, hidden)).toBe(true);
  });

  it("keeps highlighted pins visible when their type is hidden", () => {
    expect(
      isMapFilterVisible(
        { kind: "pin", pinType: "shop", highlighted: true },
        ["pin:shop"],
      ),
    ).toBe(true);
  });

  it("toggles categories in the hidden list", () => {
    expect(toggleMapFilterHidden([], "monsters")).toEqual(["monsters"]);
    expect(toggleMapFilterHidden(["monsters"], "monsters")).toEqual([]);
  });
});
