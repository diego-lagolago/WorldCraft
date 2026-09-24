import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  characterMarkers,
  characters,
  files,
  maps,
  monsterMarkers,
  monsters,
  pins,
  universes,
  users,
  worldParticipations,
} from "@/db/schema";
import {
  authorizeMarkerAction,
  authorizeOwnedContentWrite,
  authorizePinWrite,
  canSeePublishedLayer,
  canSeeContent,
  fail,
  isStaff,
  ok,
  requireStaff,
  type AuthzResult,
  type ColumnPatch,
  type ContentVisibility,
  type MembershipRole,
  type MembershipRow,
  type VisibilityLayer,
  type VisibilityStatus,
} from "@/lib/authz";
import { recalcOutgoingMentions, listLinked } from "@/lib/domain/relations";
import { resolveMentions } from "@/lib/domain/mention-resolve";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import { mapDbError } from "@/lib/domain/db-errors";
import { listUniverses } from "@/lib/domain/universes";
import { richFieldFromInput } from "@/lib/domain/rich-field";
import { setMapImage } from "@/lib/files/attach";
import { collectUnreferencedFiles } from "@/lib/files/gc";
import { worldEvents } from "@/lib/realtime/events";
import { positionSql, roundPosition } from "./coords";
import { PIN_TYPES, type PinType } from "./pin-types";
import type {
  MapDto,
  MapOptionDto,
  MapState,
  MarkerDto,
  MonsterMarkerDto,
  PinDetails,
  PinDto,
  PlaceableCharacterDto,
} from "./types";
import type { MonsterRarity } from "@/lib/monsters/labels";

export const MAP_NAME_MAX = 120;
export const PIN_TITLE_MAX = 120;
export const mapNameSchema = z.string().trim().min(1).max(MAP_NAME_MAX);
export const pinTitleSchema = z.string().trim().min(1).max(PIN_TITLE_MAX);
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
    ownerId: row.ownerId,
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

function serializeMonsterMarker(row: {
  id: string;
  mapId: string;
  monsterId: string;
  name: string;
  portraitId: string | null;
  rarity: MonsterRarity;
  isBoss: boolean;
  visibility: ContentVisibility;
  ownerId: string;
  posX: string | number;
  posY: string | number;
}): MonsterMarkerDto {
  return {
    id: row.id,
    mapId: row.mapId,
    monsterId: row.monsterId,
    name: row.name,
    imageUrl: row.portraitId ? fileUrl(row.portraitId) : null,
    rarity: row.rarity,
    isBoss: row.isBoss,
    visibility: row.visibility,
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

function mapVisible(
  role: MembershipRole,
  universeVisibility: VisibilityStatus,
  mapVisibility: VisibilityStatus,
  viewerId: string,
) {
  return canSeePublishedLayer({ role, userId: viewerId }, [
    { visibility: universeVisibility },
    { visibility: mapVisibility },
  ]);
}

function mapEventLayers(
  universeVisibility: VisibilityStatus,
  mapVisibility: VisibilityStatus,
): VisibilityLayer[] {
  return [{ visibility: universeVisibility }, { visibility: mapVisibility }];
}

function pinEventLayers(
  universeVisibility: VisibilityStatus,
  mapVisibility: VisibilityStatus,
  pinVisibility: ContentVisibility,
  ownerId: string,
): VisibilityLayer[] {
  return [
    { visibility: universeVisibility },
    { visibility: mapVisibility },
    { visibility: pinVisibility, ownerId },
  ];
}

function monsterMarkerEventLayers(
  universeVisibility: VisibilityStatus,
  mapVisibility: VisibilityStatus,
  monsterVisibility: ContentVisibility,
  monsterOwnerId: string,
  markerVisibility: ContentVisibility,
  markerOwnerId: string,
): VisibilityLayer[] {
  return [
    { visibility: universeVisibility },
    { visibility: mapVisibility },
    { visibility: monsterVisibility, ownerId: monsterOwnerId },
    { visibility: markerVisibility, ownerId: markerOwnerId },
  ];
}

export async function loadMapState(input: {
  worldId: string;
  actorId: string;
  role: MembershipRole;
  universeId: string | null;
  mapId: string | null;
  pinId: string | null;
}): Promise<AuthzResult<MapState>> {
  const universesVisible = await listUniverses(input.worldId, input.role, input.actorId);
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
        pinOwnerId: pins.ownerId,
      })
      .from(pins)
      .innerJoin(maps, eq(maps.id, pins.mapId))
      .innerJoin(universes, eq(universes.id, maps.universeId))
      .where(and(eq(pins.id, input.pinId), eq(universes.worldId, input.worldId)))
      .limit(1);
    if (
      pinRow &&
      canSeePublishedLayer(
        { role: input.role, userId: input.actorId },
        [
          { visibility: pinRow.universeVisibility },
          { visibility: pinRow.mapVisibility },
          { visibility: pinRow.pinVisibility, ownerId: pinRow.pinOwnerId },
        ],
      )
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
      monsterMarkers: [],
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
    if (!mapVisible(input.role, row.universeVisibility, row.map.visibility, input.actorId)) continue;
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
      return !mapVisible(input.role, row.universeVisibility, row.map.visibility, input.actorId);
    });

  const selected =
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
      mapsInFocus.every((row) => !mapVisible(input.role, row.universeVisibility, row.map.visibility, input.actorId));
    return emptyState({
      maps: options,
      universe: focusUniverse,
      mapHidden: allHiddenInFocus,
    });
  }

  const loaded = mapRows.find((row) => row.map.id === selected!.id)!;
  const dto = serializeMap(loaded.map, loaded);

  const [pinRows, markerRows, monsterMarkerRows, characterRows, placedRows] = await Promise.all([
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
    dto.imageId
      ? db
          .select({
            id: monsterMarkers.id,
            mapId: monsterMarkers.mapId,
            monsterId: monsterMarkers.monsterId,
            posX: monsterMarkers.posX,
            posY: monsterMarkers.posY,
            visibility: monsterMarkers.visibility,
            ownerId: monsterMarkers.ownerId,
            name: monsters.name,
            portraitId: monsters.portraitId,
            rarity: monsters.rarity,
            isBoss: monsters.isBoss,
            monsterVisibility: monsters.visibility,
            monsterOwnerId: monsters.ownerId,
          })
          .from(monsterMarkers)
          .innerJoin(monsters, eq(monsters.id, monsterMarkers.monsterId))
          .where(and(eq(monsterMarkers.mapId, dto.id), eq(monsters.worldId, input.worldId)))
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
    pins: pinRows
      .map(serializePin)
      .filter((pin) =>
        canSeeContent(
          { role: input.role, userId: input.actorId },
          { visibility: pin.visibility, ownerId: pin.ownerId },
        ),
      ),
    markers: markerRows.map(serializeMarker),
    monsterMarkers: monsterMarkerRows
      .filter((row) =>
        canSeePublishedLayer(
          { role: input.role, userId: input.actorId },
          [
            { visibility: row.visibility, ownerId: row.ownerId },
            { visibility: row.monsterVisibility, ownerId: row.monsterOwnerId },
          ],
        ),
      )
      .map(serializeMonsterMarker),
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
    worldEvents.publish({
      type: "map.updated",
      worldId: input.worldId,
      universeId: input.universeId,
      layers: mapEventLayers(universe.visibility, row.visibility),
    });
    return ok({ map: dto });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

/**
 * Create a map with an image in one step for clients without a browser,
 * e.g. MCP (Plan 002). Composed from createMap + shared map image attach.
 */
export async function createMapWithImage(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  universeId: string;
  name: string;
  bytes: Buffer;
}): Promise<AuthzResult<{ map: MapDto }>> {
  const created = await createMap({
    membership: input.membership,
    actorId: input.actorId,
    worldId: input.worldId,
    universeId: input.universeId,
    name: input.name,
  });
  if (!created.ok) return created;

  const attached = await setMapImage({
    worldId: input.worldId,
    mapId: created.data.map.id,
    actorId: input.actorId,
    bytes: input.bytes,
  });
  if (!attached.ok) return attached;

  return ok({
    map: {
      ...created.data.map,
      imageId: attached.data.fileId,
      imageUrl: fileUrl(attached.data.fileId),
      imageWidth: attached.data.widthPx,
      imageHeight: attached.data.heightPx,
    },
  });
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
  worldEvents.publish({
    type: "map.updated",
    worldId: input.worldId,
    universeId: loaded.universeId,
    layers: mapEventLayers(loaded.universeVisibility, loaded.map.visibility),
  });
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
  worldEvents.publish({
    type: "map.updated",
    worldId: input.worldId,
    universeId: loaded.universeId,
    layers: mapEventLayers(loaded.universeVisibility, row.visibility),
  });
  return ok({ map: dto });
}

export async function getPinDetails(input: {
  worldId: string;
  role: MembershipRole;
  actorId: string;
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
  if (
    !canSeePublishedLayer(
      { role: input.role, userId: input.actorId },
      [
        { visibility: row.universeVisibility },
        { visibility: row.mapVisibility },
        { visibility: row.pin.visibility, ownerId: row.pin.ownerId },
      ],
    )
  ) {
    return fail(404, "Diesen Pin gibt es nicht.");
  }
  const linked = await listLinked({
    worldId: input.worldId,
    role: input.role,
    viewerId: input.actorId,
    kind: "pin",
    id: input.pinId,
  });
  const dto = serializePin(row.pin);
  const mentions = await resolveMentions(
    input.worldId,
    input.role,
    input.actorId,
    extractMentions(asRichDoc(dto.descriptionJson)),
  );
  return ok({ ...dto, linked, mentions });
}

export async function getMarkerDetails(input: {
  worldId: string;
  role: MembershipRole;
  actorId: string;
  markerId: string;
}): Promise<AuthzResult<MarkerDto>> {
  const loaded = await loadMarkerContext(input.worldId, input.markerId);
  if (!loaded) return fail(404, "Diesen Marker gibt es nicht.");
  if (
    !mapVisible(input.role, loaded.universeVisibility, loaded.mapVisibility, input.actorId)
  ) {
    return fail(404, "Diesen Marker gibt es nicht.");
  }
  const [character] = await db
    .select({ name: characters.name, portraitId: characters.portraitId, ownerId: characters.ownerId })
    .from(characters)
    .where(eq(characters.id, loaded.marker.characterId))
    .limit(1);
  if (!character) return fail(404, "Diesen Marker gibt es nicht.");
  return ok(
    serializeMarker({
      ...loaded.marker,
      name: character.name,
      portraitId: character.portraitId,
      ownerId: character.ownerId,
    }),
  );
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
  visibility?: ContentVisibility;
}): Promise<AuthzResult<{ pin: PinDto }>> {
  const allowed = authorizePinWrite(input.membership, null, "create");
  if (!allowed.ok) return allowed;
  const loaded = await loadMapRow(input.mapId, input.worldId);
  if (!loaded) return fail(404, "Diese Karte gibt es nicht.");
  if (!loaded.map.imageId) return fail(400, "Diese Karte hat noch kein Bild.");
  const description = richFieldFromInput(input.description ?? null, { mentions: true });
  if (!description.ok) return description;
  try {
    const pin = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(pins)
        .values({
          mapId: input.mapId,
          pinType: input.pinType,
          title: input.title,
          descriptionJson: description.data.json,
          descriptionPlain: description.data.plain,
          posX: positionSql(input.posX),
          posY: positionSql(input.posY),
          visibility: input.visibility ?? "owner_only",
          ownerId: input.actorId,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        })
        .returning();
      await recalcOutgoingMentions(
        {
          worldId: input.worldId,
          actorId: input.actorId,
          sourceKind: "pin",
          sourceId: row.id,
          mentions: description.data.mentions,
        },
        tx,
      );
      return serializePin(row);
    });
    worldEvents.publish({
      type: "map.pin",
      worldId: input.worldId,
      pinId: pin.id,
      mapId: pin.mapId,
      layers: pinEventLayers(
        loaded.universeVisibility,
        loaded.map.visibility,
        pin.visibility,
        pin.ownerId,
      ),
    });
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
  visibility?: ContentVisibility;
  locked?: boolean;
}): Promise<AuthzResult<{ pin: PinDto }>> {
  const [row] = await db
    .select({
      pin: pins,
      worldId: universes.worldId,
      universeVisibility: universes.visibility,
      mapVisibility: maps.visibility,
    })
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
    const pin = await db.transaction(async (tx) => {
      const [updated] = await tx.update(pins).set(dbPatch).where(eq(pins.id, input.pinId)).returning();
      if (descriptionMentions?.ok) {
        await recalcOutgoingMentions(
          {
            worldId: input.worldId,
            actorId: input.actorId,
            sourceKind: "pin",
            sourceId: input.pinId,
            mentions: descriptionMentions.data.mentions,
          },
          tx,
        );
      }
      return serializePin(updated);
    });
    worldEvents.publish({
      type: "map.pin",
      worldId: input.worldId,
      pinId: pin.id,
      mapId: pin.mapId,
      layers: pinEventLayers(
        row.universeVisibility,
        row.mapVisibility,
        pin.visibility,
        pin.ownerId,
      ),
    });
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
    .select({
      pin: pins,
      universeVisibility: universes.visibility,
      mapVisibility: maps.visibility,
    })
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
    layers: pinEventLayers(
      row.universeVisibility,
      row.mapVisibility,
      row.pin.visibility,
      row.pin.ownerId,
    ),
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
  const visible = mapVisible(
    input.membership?.role ?? "player",
    loaded.universeVisibility,
    loaded.map.visibility,
    input.actorId,
  );
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
    const { marker, removed } = await db.transaction(async (tx) => {
      const removedRows = await tx.execute<{
        id: string;
        map_id: string;
        map_visibility: VisibilityStatus;
        universe_visibility: VisibilityStatus;
      }>(sql`
        DELETE FROM character_markers AS cm
        USING maps AS m, universes AS u
        WHERE cm.character_id = ${input.characterId}
          AND m.id = cm.map_id
          AND u.id = m.universe_id
        RETURNING cm.id, cm.map_id, m.visibility AS map_visibility, u.visibility AS universe_visibility
      `);
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
      return {
        marker: serializeMarker({
          ...row,
          name: character.name,
          portraitId: character.portraitId,
          ownerId: character.ownerId,
        }),
        removed: [...removedRows],
      };
    });
    for (const old of removed) {
      worldEvents.publish({
        type: "map.marker.deleted",
        worldId: input.worldId,
        markerId: old.id,
        mapId: old.map_id,
        layers: mapEventLayers(old.universe_visibility, old.map_visibility),
      });
    }
    worldEvents.publish({
      type: "map.marker",
      worldId: input.worldId,
      markerId: marker.id,
      mapId: marker.mapId,
      layers: mapEventLayers(loaded.universeVisibility, loaded.map.visibility),
    });
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
    ? mapVisible(
        input.membership?.role ?? "player",
        loaded.universeVisibility,
        loaded.mapVisibility,
        input.actorId,
      )
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
  worldEvents.publish({
    type: "map.marker",
    worldId: input.worldId,
    markerId: marker.id,
    mapId: marker.mapId,
    layers: mapEventLayers(loaded.universeVisibility, loaded.mapVisibility),
  });
  return ok({ marker });
}

export async function deleteMarker(input: {
  membership: MembershipRow | null;
  worldId: string;
  markerId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const loaded = await loadMarkerContext(input.worldId, input.markerId);
  const viewerId = input.membership?.userId ?? "";
  const visible = loaded
    ? mapVisible(
        input.membership?.role ?? "player",
        loaded.universeVisibility,
        loaded.mapVisibility,
        viewerId,
      )
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
    layers: mapEventLayers(loaded.universeVisibility, loaded.mapVisibility),
  });
  return ok({ id: input.markerId });
}

/** K5: reload maps that show this monster when name/image/visibility changes or it is deleted. */
export { publishMapsForMonster } from "./monster-marker-events";

async function loadMonsterMarkerContext(worldId: string, markerId: string) {
  const [row] = await db
    .select({
      marker: monsterMarkers,
      monster: {
        id: monsters.id,
        name: monsters.name,
        portraitId: monsters.portraitId,
        rarity: monsters.rarity,
        isBoss: monsters.isBoss,
        visibility: monsters.visibility,
        ownerId: monsters.ownerId,
        worldId: monsters.worldId,
      },
      universeVisibility: universes.visibility,
      mapVisibility: maps.visibility,
      universeId: universes.id,
    })
    .from(monsterMarkers)
    .innerJoin(monsters, eq(monsters.id, monsterMarkers.monsterId))
    .innerJoin(maps, eq(maps.id, monsterMarkers.mapId))
    .innerJoin(universes, eq(universes.id, maps.universeId))
    .where(and(eq(monsterMarkers.id, markerId), eq(universes.worldId, worldId), eq(monsters.worldId, worldId)))
    .limit(1);
  return row ?? null;
}

export async function getMonsterMarkerDetails(input: {
  worldId: string;
  role: MembershipRole;
  actorId: string;
  markerId: string;
}): Promise<AuthzResult<MonsterMarkerDto>> {
  const loaded = await loadMonsterMarkerContext(input.worldId, input.markerId);
  if (!loaded) return fail(404, "Diesen Monster-Marker gibt es nicht.");
  if (
    !canSeePublishedLayer(
      { role: input.role, userId: input.actorId },
      monsterMarkerEventLayers(
        loaded.universeVisibility,
        loaded.mapVisibility,
        loaded.monster.visibility,
        loaded.monster.ownerId,
        loaded.marker.visibility,
        loaded.marker.ownerId,
      ),
    )
  ) {
    return fail(404, "Diesen Monster-Marker gibt es nicht.");
  }
  return ok(
    serializeMonsterMarker({
      ...loaded.marker,
      name: loaded.monster.name,
      portraitId: loaded.monster.portraitId,
      rarity: loaded.monster.rarity,
      isBoss: loaded.monster.isBoss,
    }),
  );
}

export async function placeMonsterMarker(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  mapId: string;
  monsterId: string;
  posX: number;
  posY: number;
}): Promise<AuthzResult<{ marker: MonsterMarkerDto }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const loaded = await loadMapRow(input.mapId, input.worldId);
  if (!loaded) return fail(404, "Diese Karte gibt es nicht.");
  if (!loaded.map.imageId) return fail(400, "Diese Karte hat noch kein Bild.");
  if (
    !mapVisible(
      staff.data.role,
      loaded.universeVisibility,
      loaded.map.visibility,
      input.actorId,
    )
  ) {
    return fail(404, "Diese Karte gibt es nicht.");
  }

  const [monster] = await db
    .select({
      id: monsters.id,
      name: monsters.name,
      portraitId: monsters.portraitId,
      rarity: monsters.rarity,
      isBoss: monsters.isBoss,
      visibility: monsters.visibility,
      ownerId: monsters.ownerId,
    })
    .from(monsters)
    .where(and(eq(monsters.id, input.monsterId), eq(monsters.worldId, input.worldId)))
    .limit(1);
  if (!monster) return fail(404, "Dieses Monster gibt es nicht.");
  if (
    !canSeeContent(
      { role: staff.data.role, userId: staff.data.userId },
      { visibility: monster.visibility, ownerId: monster.ownerId },
    )
  ) {
    return fail(404, "Dieses Monster gibt es nicht.");
  }

  try {
    const [row] = await db
      .insert(monsterMarkers)
      .values({
        monsterId: input.monsterId,
        mapId: input.mapId,
        posX: positionSql(input.posX),
        posY: positionSql(input.posY),
        visibility: "owner_only",
        ownerId: input.actorId,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })
      .returning();
    const marker = serializeMonsterMarker({
      ...row,
      name: monster.name,
      portraitId: monster.portraitId,
      rarity: monster.rarity,
      isBoss: monster.isBoss,
    });
    worldEvents.publish({
      type: "map.monsterMarker",
      worldId: input.worldId,
      markerId: marker.id,
      mapId: marker.mapId,
      layers: monsterMarkerEventLayers(
        loaded.universeVisibility,
        loaded.map.visibility,
        monster.visibility,
        monster.ownerId,
        marker.visibility,
        marker.ownerId,
      ),
    });
    return ok({ marker });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

/** K11: copy keeps monster_id, map_id, visibility; new owner = actor. */
export async function copyMonsterMarker(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  sourceMarkerId: string;
  posX: number;
  posY: number;
}): Promise<AuthzResult<{ marker: MonsterMarkerDto }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const loaded = await loadMonsterMarkerContext(input.worldId, input.sourceMarkerId);
  if (!loaded) return fail(404, "Diesen Monster-Marker gibt es nicht.");
  if (
    !canSeePublishedLayer(
      { role: staff.data.role, userId: staff.data.userId },
      monsterMarkerEventLayers(
        loaded.universeVisibility,
        loaded.mapVisibility,
        loaded.monster.visibility,
        loaded.monster.ownerId,
        loaded.marker.visibility,
        loaded.marker.ownerId,
      ),
    )
  ) {
    return fail(404, "Diesen Monster-Marker gibt es nicht.");
  }

  try {
    const [row] = await db
      .insert(monsterMarkers)
      .values({
        monsterId: loaded.marker.monsterId,
        mapId: loaded.marker.mapId,
        posX: positionSql(input.posX),
        posY: positionSql(input.posY),
        visibility: loaded.marker.visibility,
        ownerId: input.actorId,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })
      .returning();
    const marker = serializeMonsterMarker({
      ...row,
      name: loaded.monster.name,
      portraitId: loaded.monster.portraitId,
      rarity: loaded.monster.rarity,
      isBoss: loaded.monster.isBoss,
    });
    worldEvents.publish({
      type: "map.monsterMarker",
      worldId: input.worldId,
      markerId: marker.id,
      mapId: marker.mapId,
      layers: monsterMarkerEventLayers(
        loaded.universeVisibility,
        loaded.mapVisibility,
        loaded.monster.visibility,
        loaded.monster.ownerId,
        marker.visibility,
        marker.ownerId,
      ),
    });
    return ok({ marker });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function updateMonsterMarker(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  markerId: string;
  posX?: number;
  posY?: number;
  visibility?: ContentVisibility;
}): Promise<AuthzResult<{ marker: MonsterMarkerDto }>> {
  const loaded = await loadMonsterMarkerContext(input.worldId, input.markerId);
  const allowed = authorizeOwnedContentWrite({
    membership: input.membership,
    content: loaded
      ? { ownerId: loaded.marker.ownerId, visibility: loaded.marker.visibility }
      : null,
    nextVisibility: input.visibility,
    notFoundError: "Diesen Monster-Marker gibt es nicht.",
  });
  if (!allowed.ok) return allowed;
  if (!loaded) return fail(404, "Diesen Monster-Marker gibt es nicht.");

  const dbPatch: ColumnPatch<typeof monsterMarkers.$inferInsert> = {
    updatedBy: input.actorId,
    updatedAt: new Date(),
  };
  if (input.posX !== undefined) dbPatch.posX = positionSql(input.posX);
  if (input.posY !== undefined) dbPatch.posY = positionSql(input.posY);
  if (input.visibility !== undefined) dbPatch.visibility = input.visibility;

  const [row] = await db
    .update(monsterMarkers)
    .set(dbPatch)
    .where(eq(monsterMarkers.id, input.markerId))
    .returning();
  const marker = serializeMonsterMarker({
    ...row,
    name: loaded.monster.name,
    portraitId: loaded.monster.portraitId,
    rarity: loaded.monster.rarity,
    isBoss: loaded.monster.isBoss,
  });
  worldEvents.publish({
    type: "map.monsterMarker",
    worldId: input.worldId,
    markerId: marker.id,
    mapId: marker.mapId,
    layers: monsterMarkerEventLayers(
      loaded.universeVisibility,
      loaded.mapVisibility,
      loaded.monster.visibility,
      loaded.monster.ownerId,
      marker.visibility,
      marker.ownerId,
    ),
  });
  return ok({ marker });
}

export async function deleteMonsterMarker(input: {
  membership: MembershipRow | null;
  worldId: string;
  markerId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const loaded = await loadMonsterMarkerContext(input.worldId, input.markerId);
  const allowed = authorizeOwnedContentWrite({
    membership: input.membership,
    content: loaded
      ? { ownerId: loaded.marker.ownerId, visibility: loaded.marker.visibility }
      : null,
    notFoundError: "Diesen Monster-Marker gibt es nicht.",
  });
  if (!allowed.ok) return allowed;
  if (!loaded) return fail(404, "Diesen Monster-Marker gibt es nicht.");
  await db.delete(monsterMarkers).where(eq(monsterMarkers.id, input.markerId));
  worldEvents.publish({
    type: "map.monsterMarker.deleted",
    worldId: input.worldId,
    markerId: input.markerId,
    mapId: loaded.marker.mapId,
    layers: monsterMarkerEventLayers(
      loaded.universeVisibility,
      loaded.mapVisibility,
      loaded.monster.visibility,
      loaded.monster.ownerId,
      loaded.marker.visibility,
      loaded.marker.ownerId,
    ),
  });
  return ok({ id: input.markerId });
}
