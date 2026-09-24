import { describe, expect, it } from "vitest";
import { MAP_MODE_CANCEL_HINT, MAP_TOOLS, mapModeHint, resolveMapTap, tapOnItemPosition, type MapMode } from "./map-mode";

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
    expect(modes.map((mode) => resolveMapTap(mode))).toEqual([
      "create-pin",
      "pick-monster",
      "pick-character",
      "copy",
    ]);
    expect(resolveMapTap({ kind: "none" })).toBe("none");
  });

  it("gives every mode a hint with the same cancel text", () => {
    expect(mapModeHint({ kind: "none" })).toBeNull();
    for (const tool of MAP_TOOLS) {
      expect(mapModeHint({ kind: tool.kind })).toContain(MAP_MODE_CANCEL_HINT);
    }
    expect(MAP_TOOLS.find((tool) => tool.kind === "character")).toMatchObject({ hotkey: null, staffOnly: false });
  });
});
