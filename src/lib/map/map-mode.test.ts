import { describe, expect, it } from "vitest";
import { resolveMapTap, tapOnItemPosition, type MapMode, type MapTapTarget } from "./map-mode";

describe("map mode", () => {
  it("offsets taps on existing items without crossing the right edge", () => {
    expect(tapOnItemPosition(0.5, 0.3)).toEqual({ x: 0.505, y: 0.3 });
    expect(tapOnItemPosition(0.998, 0.3)).toEqual({ x: 0.993, y: 0.3 });
  });

  it("resolves every K12 mode and tap target", () => {
    const modes: MapMode[] = [
      { kind: "pin" },
      { kind: "monster" },
      { kind: "character" },
      { kind: "copy", source: { id: "marker", mapId: "map", monsterId: "monster", name: "Wolf", imageUrl: null, rarity: "common", isBoss: false, visibility: "published", ownerId: "owner", posX: 0.5, posY: 0.5 } },
    ];
    const targets: MapTapTarget[] = ["map", "pin", "marker", "monster-marker"];

    for (const target of targets) {
      expect(resolveMapTap(modes[0], target)).toBe("create-pin");
      expect(resolveMapTap(modes[1], target)).toBe("pick-monster");
      expect(resolveMapTap(modes[2], target)).toBe("pick-character");
      expect(resolveMapTap(modes[3], target)).toBe("copy");
    }
  });
});
