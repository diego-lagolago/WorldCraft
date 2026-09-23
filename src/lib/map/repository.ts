import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  characterMarkers,
  characters,
  files,
  maps,
  pins,
  universes,
  users,
  worldParticipations,
} from "@/db/schema";
import {
  VISIBILITY_STATUSES,
  authorizeMarkerAction,
  authorizePinWrite,
  canSeePublishedLayer,
  canSeeVisibility,
  fail,
  isStaff,
  ok,
  requireStaff,
  type AuthzResult,
  type ColumnPatch,
  type MembershipRole,
  type MembershipRow,
  type VisibilityStatus,
} from "@/lib/authz";
import { recalcOutgoingMentions, listLinked } from "@/lib/domain/relations";
import { resolveMentions } from "@/lib/domain/mention-resolve";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import { mapDbError } from "@/lib/domain/db-errors";
import { listUniverses } from "@/lib/domain/universes";
import { richFieldFromInput } from "@/lib/domain/rich-field";
import { collectUnreferencedFiles } from "@/lib/files/gc";
import { MAP_IMAGE_MAX_BYTES } from "@/lib/files/inspect";
import { persistImage, removeStoredFile } from "@/lib/files/store";
import { worldEvents } from "@/lib/realtime/events";
import { positionSql, roundPosition } from "./coords";
import { PIN_TYPES, type PinType } from "./pin-types";
import type {
  MapDto,
  MapOptionDto,
  MapState,
  MarkerDto,
  PinDetails,
  PinDto,
  PlaceableCharacterDto,
} from "./types";

export { MAP_IMAGE_MAX_BYTES };

export const MAP_NAME_MAX = 120;
export const PIN_TITLE_MAX = 120;
export const mapNameSchema = z.string().trim().min(1).max(MAP_NAME_MAX);
export const pinTitleSchema = z.string().trim().min(1).max(PIN_TITLE_MAX);
export const visibilitySchema = z.enum(VISIBILITY_STATUSES);
export const pinTypeSchema = z.enum(PIN_TYPES);
export const positionSchema = z.number().min(0).max(1);

const MARKER_ONE_MAP = "Ein Charakter kann nur auf einer Karte sein.";

function toNumber(value: string | number): number {
  return roundPosition(Number(value));
}

function fileUrl(fileId: string): string {
  return `/api/files/${fileId}`;
}

function mapLabel(universeName: string, mapName: string, mapVisibility: VisibilityStatus): string {
  const base = `${universeName}: ${mapName}`;
  return mapVisibility === "gm_only" ? `${base} · SL` : base;
}

function serializeMap(
  row: typeof maps.$inferSelect,
  image: { widthPx: number | null; heightPx: number | null } | null,
): MapDto {
  const hasDims = Boolean(row.imageId && image?.widthPx && image?.heightPx);
  return {
    id: row.id,
    universeId: row.universeId,
    name: row.name,
    imageId: hasDims ? row.imageId : null,
    imageUrl: hasDims && row.imageId ? fileUrl(row.imageId) : null,
    imageWidth: hasDims ? image!.widthPx : null,
    imageHeight: hasDims ? image!.heightPx : null,
    visibility: row.visibility,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializePin(row: typeof pins.$inferSelect): PinDto {
  return {
    id: row.id,
    mapId: row.mapId,
    pinType: row.pinType,
    title: row.title,
    descriptionJson: (row.descriptionJson as PinDto["descriptionJson"]) ?? null,
    descriptionPlain: row.descriptionPlain,
    posX: toNumber(row.posX),
    posY: toNumber(row.posY),
    visibility: row.visibility,
    locked: row.locked,
  };
}

function serializeMarker(row: {
  id: string;
  mapId: string;
  characterId: string;
  name: string;
  portraitId: string | null;
  ownerId: string;
  posX: string | number;
  posY: string | number;
}): MarkerDto {
  return {
    id: row.id,
    mapId: row.mapId,
    characterId: row.characterId,
    name: row.name,
    portraitId: row.portraitId,
    ownerId: row.ownerId,
    posX: toNumber(row.posX),
    posY: toNumber(row.posY),
  };
}

async function loadMapRow(mapId: string, worldId: string) {
  const [row] = await db
    .select({
      map: maps,
      universeVisibility: universes.visibility,
      universeId: universes.id,
      worldId: universes.worldId,
      widthPx: files.widthPx,
      heightPx: files.heightPx,
    })
    .from(maps)
    .innerJoin(universes, eq(universes.id, maps.universeId))
    .leftJoin(files, eq(files.id, maps.imageId))
    .where(and(eq(maps.id, mapId), eq(universes.worldId, worldId)))
    .limit(1);
  return row ?? null;
}

function mapVisible(role: MembershipRole, universeVisibility: VisibilityStatus, mapVisibility: VisibilityStatus) {
  return canSeePublishedLayer(role, [universeVisibility, mapVisibility]);
}

export async function loadMapState(input: {
  worldId: string;
  actorId: string;
  role: MembershipRole;
  universeId: string | null;
  mapId: string | null;
  pinId: string | null;
}): Promise<AuthzResult<MapState>> {
  const universesVisible = await listUniverses(input.worldId, input.role);
  const universeIds = universesVisible.map((row) => row.id);
  let highlightPinId: string | null = null;
  let preferredMapId = input.mapId;
  let preferredUniverseId =
    input.universeId && universesVisible.some((row) => row.id === input.universeId)
      ? input.universeId
      : null;

  if (input.pinId) {
    const [pinRow] = await db
      .select({
        pinId: pins.id,
        mapId: maps.id,
        universeId: universes.id,
        universeVisibility: universes.visibility,
        mapVisibility: maps.visibility,
        pinVisibility: pins.visibility,
      })
      .from(pins)
      .innerJoin(maps, eq(maps.id, pins.mapId))
      .innerJoin(universes, eq(universes.id, maps.universeId))
      .where(and(eq(pins.id, input.pinId), eq(universes.worldId, input.worldId)))
      .limit(1);
    if (
      pinRow &&
      canSeePublishedLayer(input.role, [pinRow.universeVisibility, pinRow.mapVisibility, pinRow.pinVisibility])
    ) {
      preferredUniverseId = pinRow.universeId;
      preferredMapId = pinRow.mapId;
      highlightPinId = pinRow.pinId;
    }
  }

  const emptyState = (partial?: Partial<MapState>): AuthzResult<MapState> =>
    ok({
      actorId: input.actorId,
      role: input.role,
      staff: isStaff(input.role),
      universes: universesVisible,
      maps: [],
      universe: null,
      map: null,
      mapHidden: false,
      pins: [],
      markers: [],
      characters: [],
      highlightPinId: null,
      ...partial,
    });

  if (universeIds.length === 0) return emptyState();

  const mapRows = await db
    .select({
      map: maps,
      universeId: universes.id,
      universeName: universes.name,
      universeVisibility: universes.visibility,
      widthPx: files.widthPx,
      heightPx: files.heightPx,
    })
    .from(maps)
    .innerJoin(universes, eq(universes.id, maps.universeId))
    .leftJoin(files, eq(files.id, maps.imageId))
    .where(inArray(maps.universeId, universeIds))
    .orderBy(asc(universes.sortOrder), asc(maps.name));

  const options: MapOptionDto[] = [];
  for (const row of mapRows) {
    if (!mapVisible(input.role, row.universeVisibility, row.map.visibility)) continue;
    options.push({
      id: row.map.id,
      universeId: row.universeId,
      universeName: row.universeName,
      name: row.map.name,
      visibility: row.map.visibility,
      hasImage: Boolean(row.map.imageId && row.widthPx && row.heightPx),
      label: mapLabel(row.universeName, row.map.name, row.map.visibility),
    });
  }

  const hiddenRequested =
    preferredMapId &&
    mapRows.some((row) => {
      if (row.map.id !== preferredMapId) return false;
      return !mapVisible(input.role, row.universeVisibility, row.map.visibility);
    });

  let selected =
    (preferredMapId ? options.find((row) => row.id === preferredMapId) : undefined) ??
    (preferredUniverseId ? options.find((row) => row.universeId === preferredUniverseId) : undefined) ??
    options[0] ??
    null;

  const universe =
    (selected ? universesVisible.find((row) => row.id === selected!.universeId) : null) ??
    (preferredUniverseId ? universesVisible.find((row) => row.id === preferredUniverseId) : null) ??
    universesVisible[0] ??
    null;

  if (hiddenRequested) {
    return emptyState({
      maps: options,
      universe,
      mapHidden: true,
      highlightPinId: null,
    });
  }

  if (!selected || !universe) {
    const focusUniverse =
      universe ??
      (preferredUniverseId ? universesVisible.find((row) => row.id === preferredUniverseId) : null) ??
      universesVisible[0] ??
      null;
    const mapsInFocus = focusUniverse
      ? mapRows.filter((row) => row.universeId === focusUniverse.id)
      : [];
    const allHiddenInFocus =
      mapsInFocus.length > 0 &&
      mapsInFocus.every((row) => !mapVisible(input.role, row.universeVisibility, row.map.visibility));
    return emptyState({
      maps: options,
      universe: focusUniverse,
      mapHidden: allHiddenInFocus,
    });
  }

  const loaded = mapRows.find((row) => row.map.id === selected!.id)!;
  const dto = serializeMap(loaded.map, loaded);

  const [pinRows, markerRows, characterRows, placedRows] = await Promise.all([
    dto.imageId
      ? db.select().from(pins).where(eq(pins.mapId, dto.id))
      : Promise.resolve([] as (typeof pins.$inferSelect)[]),
    dto.imageId
      ? db
          .select({
            id: characterMarkers.id,
            mapId: characterMarkers.mapId,
            characterId: characterMarkers.characterId,
            posX: characterMarkers.posX,
            posY: characterMarkers.posY,
            name: characters.name,
            portraitId: characters.portraitId,
            ownerId: characters.ownerId,
          })
          .from(characterMarkers)
          .innerJoin(characters, eq(characters.id, characterMarkers.characterId))
          .innerJoin(
            worldParticipations,
            and(
              eq(worldParticipations.characterId, characters.id),
              eq(worldParticipations.worldId, input.worldId),
              isNull(worldParticipations.archivedAt),
            ),
          )
          .where(eq(characterMarkers.mapId, dto.id))
      : Promise.resolve([]),
    db
      .select({
        id: characters.id,
        name: characters.name,
        portraitId: characters.portraitId,
        ownerId: characters.ownerId,
        ownerName: users.name,
      })
      .from(worldParticipations)
      .innerJoin(characters, eq(characters.id, worldParticipations.characterId))
      .innerJoin(users, eq(users.id, characters.ownerId))
      .where(and(eq(worldParticipations.worldId, input.worldId), isNull(worldParticipations.archivedAt))),
    db
      .select({
        characterId: characterMarkers.characterId,
        mapId: characterMarkers.mapId,
      })
      .from(characterMarkers)
      .innerJoin(maps, eq(maps.id, characterMarkers.mapId))
      .innerJoin(universes, eq(universes.id, maps.universeId))
      .where(eq(universes.worldId, input.worldId)),
  ]);

  const placedByCharacter = new Map(placedRows.map((row) => [row.characterId, row.mapId]));
  const charactersOnMap: PlaceableCharacterDto[] = characterRows
    .filter((row) => isStaff(input.role) || row.ownerId === input.actorId)
    .map((row) => {
      const placedMapId = placedByCharacter.get(row.id) ?? null;
      return {
        ...row,
        placed: placedMapId === dto.id,
        placedElsewhere: placedMapId !== null && placedMapId !== dto.id,
      };
    });

  return ok({
    actorId: input.actorId,
    role: input.role,
    staff: isStaff(input.role),
    universes: universesVisible,
    maps: options,
    universe,
    map: dto,
    mapHidden: false,
    pins: pinRows.map(serializePin).filter((pin) => canSeeVisibility(input.role, pin.visibility)),
    markers: markerRows.map(serializeMarker),
    characters: charactersOnMap,
    highlightPinId,
  });
}

/** Create an empty map (no image). Image upload happens later on the map view. */
export async function createMap(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  universeId: string;
  name: string;
}): Promise<AuthzResult<{ map: MapDto }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const [universe] = await db
    .select()
    .from(universes)
    .where(and(eq(universes.id, input.universeId), eq(universes.worldId, input.worldId)))
    .limit(1);
  if (!universe) return fail(404, "Dieses Universum gibt es nicht.");

  try {
    const [row] = await db
      .insert(maps)
      .values({
        universeId: input.universeId,
        name: input.name,
        imageId: null,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })
      .returning();
    const dto = serializeMap(row, null);
    worldEvents.publish({ type: "map.updated", worldId: input.worldId, universeId: input.universeId });
    return ok({ map: dto });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

/** @deprecated Prefer createMap + file attach; kept for API tests that upload on create. */
export async function createMapWithImage(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  universeId: string;
  name: string;
  bytes: Buffer;
}): Promise<AuthzResult<{ map: MapDto }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const [universe] = await db
    .select()
    .from(universes)
    .where(and(eq(universes.id, input.universeId), eq(universes.worldId, input.worldId)))
    .limit(1);
  if (!universe) return fail(404, "Dieses Universum gibt es nicht.");

  const saved = await persistImage({ bytes: input.bytes, createdBy: input.actorId, maxBytes: MAP_IMAGE_MAX_BYTES });
  if ("error" in saved) return fail(400, saved.error);
  if (!saved.image.width || !saved.image.height) {
    await removeStoredFile(saved.id);
    return fail(400, "Bildgröße unbekannt.");
  }

  try {
    const [row] = await db
      .insert(maps)
      .values({
        universeId: input.universeId,
        name: input.name,
        imageId: saved.id,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })
      .returning();
    const dto = serializeMap(row, { widthPx: saved.image.width, heightPx: saved.image.height });
    worldEvents.publish({ type: "map.updated", worldId: input.worldId, universeId: input.universeId });
    return ok({ map: dto });
  } catch (error) {
    await removeStoredFile(saved.id);
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function deleteMap(input: {
  membership: MembershipRow | null;
  worldId: string;
  mapId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const loaded = await loadMapRow(input.mapId, input.worldId);
  if (!loaded) return fail(404, "Diese Karte gibt es nicht.");
  await db.delete(maps).where(eq(maps.id, input.mapId));
  await collectUnreferencedFiles([loaded.map.imageId]);
  worldEvents.publish({ type: "map.updated", worldId: input.worldId, universeId: loaded.universeId });
  return ok({ id: input.mapId });
}

export async function updateMap(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  mapId: string;
  name?: string;
  visibility?: VisibilityStatus;
}): Promise<AuthzResult<{ map: MapDto }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const loaded = await loadMapRow(input.mapId, input.worldId);
  if (!loaded) return fail(404, "Diese Karte gibt es nicht.");
  const patch: ColumnPatch<typeof maps.$inferInsert> = {
    updatedBy: input.actorId,
    updatedAt: new Date(),
  };
  if (input.name !== undefined) patch.name = input.name;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  const [row] = await db.update(maps).set(patch).where(eq(maps.id, input.mapId)).returning();
  if (!row) return fail(404, "Diese Karte gibt es nicht.");
  const dto = serializeMap(row, loaded);
  worldEvents.publish({ type: "map.updated", worldId: input.worldId, universeId: loaded.universeId });
  return ok({ map: dto });
}

export async function getPinDetails(input: {
  worldId: string;
  role: MembershipRole;
  pinId: string;
}): Promise<AuthzResult<PinDetails>> {
  const [row] = await db
    .select({ pin: pins, universeVisibility: universes.visibility, mapVisibility: maps.visibility, worldId: universes.worldId })
    .from(pins)
    .innerJoin(maps, eq(maps.id, pins.mapId))
    .innerJoin(universes, eq(universes.id, maps.universeId))
    .where(and(eq(pins.id, input.pinId), eq(universes.worldId, input.worldId)))
    .limit(1);
  if (!row) return fail(404, "Diesen Pin gibt es nicht.");
  if (!canSeePublishedLayer(input.role, [row.universeVisibility, row.mapVisibility, row.pin.visibility])) {
    return fail(404, "Diesen Pin gibt es nicht.");
  }
  const linked = await listLinked({ worldId: input.worldId, role: input.role, kind: "pin", id: input.pinId });
  const dto = serializePin(row.pin);
  const mentions = await resolveMentions(
    input.worldId,
    input.role,
    extractMentions(asRichDoc(dto.descriptionJson)),
  );
  return ok({ ...dto, linked, mentions });
}

export async function createPin(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  mapId: string;
  pinType: PinType;
  title: string;
  description?: unknown;
  posX: number;
  posY: number;
  visibility?: VisibilityStatus;
}): Promise<AuthzResult<{ pin: PinDto }>> {
  const allowed = authorizePinWrite(input.membership, null, "create");
  if (!allowed.ok) return allowed;
  const loaded = await loadMapRow(input.mapId, input.worldId);
  if (!loaded) return fail(404, "Diese Karte gibt es nicht.");
  if (!loaded.map.imageId) return fail(400, "Diese Karte hat noch kein Bild.");
  const description = richFieldFromInput(input.description ?? null, { mentions: true });
  if (!description.ok) return description;
  try {
    const [row] = await db
      .insert(pins)
      .values({
        mapId: input.mapId,
        pinType: input.pinType,
        title: input.title,
        descriptionJson: description.data.json,
        descriptionPlain: description.data.plain,
        posX: positionSql(input.posX),
        posY: positionSql(input.posY),
        visibility: input.visibility ?? "gm_only",
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })
      .returning();
    await recalcOutgoingMentions({
      worldId: input.worldId,
      actorId: input.actorId,
      sourceKind: "pin",
      sourceId: row.id,
      mentions: description.data.mentions,
    });
    const pin = serializePin(row);
    worldEvents.publish({ type: "map.pin", worldId: input.worldId, pin });
    return ok({ pin });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function updatePin(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  pinId: string;
  title?: string;
  pinType?: PinType;
  description?: unknown;
  posX?: number;
  posY?: number;
  visibility?: VisibilityStatus;
  locked?: boolean;
}): Promise<AuthzResult<{ pin: PinDto }>> {
  const [row] = await db
    .select({ pin: pins, worldId: universes.worldId })
    .from(pins)
    .innerJoin(maps, eq(maps.id, pins.mapId))
    .innerJoin(universes, eq(universes.id, maps.universeId))
    .where(and(eq(pins.id, input.pinId), eq(universes.worldId, input.worldId)))
    .limit(1);
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.pinType !== undefined) patch.pinType = input.pinType;
  if (input.description !== undefined) patch.description = true;
  if (input.posX !== undefined) patch.posX = input.posX;
  if (input.posY !== undefined) patch.posY = input.posY;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.locked !== undefined) patch.locked = input.locked;
  const allowed = authorizePinWrite(input.membership, row?.pin ?? null, patch);
  if (!allowed.ok) return allowed;
  if (!row) return fail(404, "Diesen Pin gibt es nicht.");

  let descriptionMentions: Awaited<ReturnType<typeof richFieldFromInput>> | null = null;
  if (input.description !== undefined) {
    descriptionMentions = richFieldFromInput(input.description, { mentions: true });
    if (!descriptionMentions.ok) return descriptionMentions;
  }

  const dbPatch: ColumnPatch<typeof pins.$inferInsert> = {
    updatedBy: input.actorId,
    updatedAt: new Date(),
  };
  if (input.title !== undefined) dbPatch.title = input.title;
  if (input.pinType !== undefined) dbPatch.pinType = input.pinType;
  if (descriptionMentions?.ok) {
    dbPatch.descriptionJson = descriptionMentions.data.json;
    dbPatch.descriptionPlain = descriptionMentions.data.plain;
  }
  if (input.posX !== undefined) dbPatch.posX = positionSql(input.posX);
  if (input.posY !== undefined) dbPatch.posY = positionSql(input.posY);
  if (input.visibility !== undefined) dbPatch.visibility = input.visibility;
  if (input.locked !== undefined) dbPatch.locked = input.locked;

  try {
    const [updated] = await db.update(pins).set(dbPatch).where(eq(pins.id, input.pinId)).returning();
    if (descriptionMentions?.ok) {
      await recalcOutgoingMentions({
        worldId: input.worldId,
        actorId: input.actorId,
        sourceKind: "pin",
        sourceId: input.pinId,
        mentions: descriptionMentions.data.mentions,
      });
    }
    const pin = serializePin(updated);
    worldEvents.publish({ type: "map.pin", worldId: input.worldId, pin });
    return ok({ pin });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function deletePin(input: {
  membership: MembershipRow | null;
  worldId: string;
  pinId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const [row] = await db
    .select({ pin: pins })
    .from(pins)
    .innerJoin(maps, eq(maps.id, pins.mapId))
    .innerJoin(universes, eq(universes.id, maps.universeId))
    .where(and(eq(pins.id, input.pinId), eq(universes.worldId, input.worldId)))
    .limit(1);
  const allowed = authorizePinWrite(input.membership, row?.pin ?? null, "delete");
  if (!allowed.ok) return allowed;
  if (!row) return fail(404, "Diesen Pin gibt es nicht.");
  await db.delete(pins).where(eq(pins.id, input.pinId));
  worldEvents.publish({
    type: "map.pin.deleted",
    worldId: input.worldId,
    pinId: input.pinId,
    mapId: row.pin.mapId,
  });
  return ok({ id: input.pinId });
}

async function loadMarkerContext(worldId: string, markerId: string) {
  const [row] = await db
    .select({
      marker: characterMarkers,
      ownerId: characters.ownerId,
      universeVisibility: universes.visibility,
      mapVisibility: maps.visibility,
    })
    .from(characterMarkers)
    .innerJoin(characters, eq(characters.id, characterMarkers.characterId))
    .innerJoin(maps, eq(maps.id, characterMarkers.mapId))
    .innerJoin(universes, eq(universes.id, maps.universeId))
    .where(and(eq(characterMarkers.id, markerId), eq(universes.worldId, worldId)))
    .limit(1);
  return row ?? null;
}

export async function placeMarker(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  mapId: string;
  characterId: string;
  posX: number;
  posY: number;
}): Promise<AuthzResult<{ marker: MarkerDto }>> {
  const loaded = await loadMapRow(input.mapId, input.worldId);
  if (!loaded) return fail(404, "Diese Karte gibt es nicht.");
  if (!loaded.map.imageId) return fail(400, "Diese Karte hat noch kein Bild.");
  const visible = mapVisible(input.membership?.role ?? "player", loaded.universeVisibility, loaded.map.visibility);
  const [character] = await db
    .select({
      id: characters.id,
      ownerId: characters.ownerId,
      name: characters.name,
      portraitId: characters.portraitId,
      archivedAt: worldParticipations.archivedAt,
    })
    .from(characters)
    .innerJoin(
      worldParticipations,
      and(eq(worldParticipations.characterId, characters.id), eq(worldParticipations.worldId, input.worldId)),
    )
    .where(eq(characters.id, input.characterId))
    .limit(1);
  const allowed = authorizeMarkerAction(
    input.membership,
    character && !character.archivedAt ? { ownerId: character.ownerId } : null,
    visible,
  );
  if (!allowed.ok) return allowed;
  if (!character || character.archivedAt) return fail(400, "Der Charakter ist nicht in diese Welt mitgebracht.");

  try {
    const marker = await db.transaction(async (tx) => {
      const previous = await tx
        .select({ id: characterMarkers.id, mapId: characterMarkers.mapId })
        .from(characterMarkers)
        .where(eq(characterMarkers.characterId, input.characterId));
      for (const old of previous) {
        await tx.delete(characterMarkers).where(eq(characterMarkers.id, old.id));
        worldEvents.publish({
          type: "map.marker.deleted",
          worldId: input.worldId,
          markerId: old.id,
          mapId: old.mapId,
        });
      }
      const [row] = await tx
        .insert(characterMarkers)
        .values({
          characterId: input.characterId,
          mapId: input.mapId,
          posX: positionSql(input.posX),
          posY: positionSql(input.posY),
          createdBy: input.actorId,
          updatedBy: input.actorId,
        })
        .returning();
      return serializeMarker({
        ...row,
        name: character.name,
        portraitId: character.portraitId,
        ownerId: character.ownerId,
      });
    });
    worldEvents.publish({ type: "map.marker", worldId: input.worldId, marker });
    return ok({ marker });
  } catch (error) {
    const mapped = mapDbError(error, { unique: MARKER_ONE_MAP });
    if (mapped) return mapped;
    throw error;
  }
}

export async function moveMarker(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  markerId: string;
  posX: number;
  posY: number;
}): Promise<AuthzResult<{ marker: MarkerDto }>> {
  const loaded = await loadMarkerContext(input.worldId, input.markerId);
  const visible = loaded
    ? mapVisible(input.membership?.role ?? "player", loaded.universeVisibility, loaded.mapVisibility)
    : false;
  const allowed = authorizeMarkerAction(input.membership, loaded ? { ownerId: loaded.ownerId } : null, visible);
  if (!allowed.ok) return allowed;
  if (!loaded) return fail(404, "Diesen Marker gibt es nicht.");
  const [row] = await db
    .update(characterMarkers)
    .set({
      posX: positionSql(input.posX),
      posY: positionSql(input.posY),
      updatedAt: new Date(),
      updatedBy: input.actorId,
    })
    .where(eq(characterMarkers.id, input.markerId))
    .returning();
  const [character] = await db
    .select({ name: characters.name, portraitId: characters.portraitId, ownerId: characters.ownerId })
    .from(characters)
    .where(eq(characters.id, row.characterId))
    .limit(1);
  const marker = serializeMarker({ ...row, ...character! });
  worldEvents.publish({ type: "map.marker", worldId: input.worldId, marker });
  return ok({ marker });
}

export async function deleteMarker(input: {
  membership: MembershipRow | null;
  worldId: string;
  markerId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const loaded = await loadMarkerContext(input.worldId, input.markerId);
  const visible = loaded
    ? mapVisible(input.membership?.role ?? "player", loaded.universeVisibility, loaded.mapVisibility)
    : false;
  const allowed = authorizeMarkerAction(input.membership, loaded ? { ownerId: loaded.ownerId } : null, visible);
  if (!allowed.ok) return allowed;
  if (!loaded) return fail(404, "Diesen Marker gibt es nicht.");
  await db.delete(characterMarkers).where(eq(characterMarkers.id, input.markerId));
  worldEvents.publish({
    type: "map.marker.deleted",
    worldId: input.worldId,
    markerId: input.markerId,
    mapId: loaded.marker.mapId,
  });
  return ok({ id: input.markerId });
}
