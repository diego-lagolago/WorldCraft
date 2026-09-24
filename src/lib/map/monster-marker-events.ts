import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { maps, monsterMarkers, universes } from "@/db/schema";
import type { VisibilityStatus } from "@/lib/authz";
import { worldEvents } from "@/lib/realtime/events";

function mapEventLayers(
  universeVisibility: VisibilityStatus,
  mapVisibility: VisibilityStatus,
) {
  return [{ visibility: universeVisibility }, { visibility: mapVisibility }];
}

/** K5: reload maps that show this monster when name/image/visibility changes or it is deleted. */
export async function publishMapsForMonster(worldId: string, monsterId: string): Promise<void> {
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
