/** Spike T-009 — eine gemeinsame Spike-Karte für alle angemeldeten Tester. */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  spikeCharacterMarkers,
  spikeMaps,
  spikePins,
} from "@/db/schema";
import { positionSql, roundPosition } from "./coords";
import type { SpikeKarteState, SpikeMapDto, SpikeMarkerDto, SpikePinDto } from "./types";
import type { SpikePinType } from "./pin-types";

export const SPIKE_TEST_CHARACTER_NAME = "Mira Steinfaust";

function toNumber(value: string | number): number {
  return roundPosition(Number(value));
}

export function mapImageUrl(updatedAt: Date): string {
  return `/api/spike/karte/image?v=${updatedAt.getTime()}`;
}

export function serializeMap(row: typeof spikeMaps.$inferSelect): SpikeMapDto {
  return {
    id: row.id,
    name: row.name,
    imageWidth: row.imageWidth,
    imageHeight: row.imageHeight,
    imageUrl: mapImageUrl(row.updatedAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializePin(row: typeof spikePins.$inferSelect): SpikePinDto {
  return {
    id: row.id,
    mapId: row.mapId,
    pinType: row.pinType,
    title: row.title,
    description: row.description,
    locked: row.locked,
    posX: toNumber(row.posX),
    posY: toNumber(row.posY),
  };
}

export function serializeMarker(
  row: typeof spikeCharacterMarkers.$inferSelect,
): SpikeMarkerDto {
  return {
    id: row.id,
    mapId: row.mapId,
    name: row.name,
    posX: toNumber(row.posX),
    posY: toNumber(row.posY),
  };
}

export async function loadSpikeState(): Promise<SpikeKarteState> {
  const [map] = await db.select().from(spikeMaps).limit(1);
  if (!map) {
    return { map: null, pins: [], marker: null };
  }
  const [pins, markers] = await Promise.all([
    db.select().from(spikePins).where(eq(spikePins.mapId, map.id)),
    db
      .select()
      .from(spikeCharacterMarkers)
      .where(eq(spikeCharacterMarkers.mapId, map.id))
      .limit(1),
  ]);
  return {
    map: serializeMap(map),
    pins: pins.map(serializePin),
    marker: markers[0] ? serializeMarker(markers[0]) : null,
  };
}

export async function getSpikeMap() {
  const [map] = await db.select().from(spikeMaps).limit(1);
  return map ?? null;
}

export async function upsertSpikeMap(input: {
  id?: string;
  name: string;
  imageFilename: string;
  imageWidth: number;
  imageHeight: number;
  existingId?: string;
}): Promise<typeof spikeMaps.$inferSelect> {
  const now = new Date();
  if (input.existingId) {
    const [updated] = await db
      .update(spikeMaps)
      .set({
        name: input.name,
        imageFilename: input.imageFilename,
        imageWidth: input.imageWidth,
        imageHeight: input.imageHeight,
        updatedAt: now,
      })
      .where(eq(spikeMaps.id, input.existingId))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(spikeMaps)
    .values({
      id: input.id,
      name: input.name,
      imageFilename: input.imageFilename,
      imageWidth: input.imageWidth,
      imageHeight: input.imageHeight,
    })
    .returning();

  await db.insert(spikeCharacterMarkers).values({
    mapId: created.id,
    name: SPIKE_TEST_CHARACTER_NAME,
    posX: positionSql(0.5),
    posY: positionSql(0.5),
  });

  return created;
}

export async function insertSpikePin(input: {
  mapId: string;
  pinType: SpikePinType;
  title: string;
  description: string | null;
  posX: number;
  posY: number;
}) {
  const [row] = await db
    .insert(spikePins)
    .values({
      mapId: input.mapId,
      pinType: input.pinType,
      title: input.title,
      description: input.description,
      locked: false,
      posX: positionSql(input.posX),
      posY: positionSql(input.posY),
    })
    .returning();
  return row;
}

export async function getSpikePin(id: string) {
  const [row] = await db.select().from(spikePins).where(eq(spikePins.id, id)).limit(1);
  return row ?? null;
}

export async function updateSpikePin(
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    pinType?: SpikePinType;
    locked?: boolean;
    posX?: number;
    posY?: number;
  },
) {
  const [row] = await db
    .update(spikePins)
    .set({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.pinType !== undefined ? { pinType: patch.pinType } : {}),
      ...(patch.locked !== undefined ? { locked: patch.locked } : {}),
      ...(patch.posX !== undefined ? { posX: positionSql(patch.posX) } : {}),
      ...(patch.posY !== undefined ? { posY: positionSql(patch.posY) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(spikePins.id, id))
    .returning();
  return row ?? null;
}

export async function updateSpikeMarkerPosition(id: string, posX: number, posY: number) {
  const [row] = await db
    .update(spikeCharacterMarkers)
    .set({
      posX: positionSql(posX),
      posY: positionSql(posY),
      updatedAt: new Date(),
    })
    .where(eq(spikeCharacterMarkers.id, id))
    .returning();
  return row ?? null;
}
