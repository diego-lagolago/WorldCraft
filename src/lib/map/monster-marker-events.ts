import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { maps, monsterMarkers, universes } from "@/db/schema";
import { worldEvents } from "@/lib/realtime/events";
import { mapEventLayers } from "./event-layers";

export async function mapsForMonster(worldId: string, monsterId: string) {
  const rows = await db
    .select({
      mapId: maps.id,
      universeId: universes.id,
      mapVisibility: maps.visibility,
      universeVisibility: universes.visibility,
    })
    .from(monsterMarkers)
    .innerJoin(maps, eq(maps.id, monsterMarkers.mapId))
    .innerJoin(universes, eq(universes.id, maps.universeId))
    .where(and(eq(monsterMarkers.monsterId, monsterId), eq(universes.worldId, worldId)));

  return rows;
}

export function publishMapUpdates(
  worldId: string,
  rows: Awaited<ReturnType<typeof mapsForMonster>>,
): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.mapId)) continue;
    seen.add(row.mapId);
    worldEvents.publish({
      type: "map.updated",
      worldId,
      universeId: row.universeId,
      layers: mapEventLayers(row.universeVisibility, row.mapVisibility),
    });
  }
}

/** K5: reload maps that show this monster when name/image/visibility changes or it is deleted. */
export async function publishMapsForMonster(worldId: string, monsterId: string): Promise<void> {
  publishMapUpdates(worldId, await mapsForMonster(worldId, monsterId));
}
