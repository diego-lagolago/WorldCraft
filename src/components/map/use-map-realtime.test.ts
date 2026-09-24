import { describe, expect, it } from "vitest";
import type { MapState } from "@/lib/map/types";
import { applyMapEvent } from "./use-map-realtime";

describe("applyMapEvent", () => {
  it("removes a monster marker after its realtime delete event", () => {
    const state = {
      monsterMarkers: [
        { id: "remove", mapId: "map", monsterId: "monster", name: "Wolf", imageUrl: null, rarity: "common", isBoss: false, visibility: "published", ownerId: "gm", posX: 0.2, posY: 0.3 },
        { id: "keep", mapId: "map", monsterId: "monster", name: "Bär", imageUrl: null, rarity: "common", isBoss: false, visibility: "published", ownerId: "gm", posX: 0.4, posY: 0.5 },
      ],
    } as MapState;

    const next = applyMapEvent(state, {
      type: "map.monsterMarker.deleted",
      worldId: "world",
      markerId: "remove",
      mapId: "map",
      layers: [],
    });

    expect(next.monsterMarkers.map((marker) => marker.id)).toEqual(["keep"]);
  });
});
