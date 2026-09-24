import { describe, expect, it } from "vitest";
import type { WorldRealtimeEvent } from "./events";

describe("map realtime signals (R5)", () => {
  it("map.pin, map.marker and map.monsterMarker carry only ids plus layers, not content fields", () => {
    const pin = {
      type: "map.pin",
      worldId: "w",
      pinId: "p",
      mapId: "m",
      layers: [{ visibility: "published" }, { visibility: "published" }, { visibility: "gm_only" }],
    } satisfies WorldRealtimeEvent;
    const marker = {
      type: "map.marker",
      worldId: "w",
      markerId: "mk",
      mapId: "m",
      layers: [{ visibility: "published" }, { visibility: "gm_only" }],
    } satisfies WorldRealtimeEvent;
    const monsterMarker = {
      type: "map.monsterMarker",
      worldId: "w",
      markerId: "mm",
      mapId: "m",
      layers: [
        { visibility: "published" },
        { visibility: "published" },
        { visibility: "gm_only", ownerId: "o" },
        { visibility: "owner_only", ownerId: "o" },
      ],
    } satisfies WorldRealtimeEvent;

    expect(Object.keys(pin).sort()).toEqual(["layers", "mapId", "pinId", "type", "worldId"]);
    expect(Object.keys(marker).sort()).toEqual(["layers", "mapId", "markerId", "type", "worldId"]);
    expect(Object.keys(monsterMarker).sort()).toEqual(["layers", "mapId", "markerId", "type", "worldId"]);
    for (const key of ["title", "description", "name", "posX", "posY", "pin", "marker"] as const) {
      expect(pin).not.toHaveProperty(key);
      expect(marker).not.toHaveProperty(key);
      expect(monsterMarker).not.toHaveProperty(key);
    }
  });
});
