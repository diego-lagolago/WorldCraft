import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characterImages,
  characters,
  maps,
  memberships,
  monsters,
  universes,
} from "@/db/schema";
import { fail, type AuthzResult, type MembershipRow } from "@/lib/authz";
import { mapDbError } from "@/lib/domain/db-errors";
import { MONSTER_NOT_FOUND } from "@/lib/domain/monsters";
import { worldEvents } from "@/lib/realtime/events";
import { authorizeImageWrite, type ImageKind } from "./authorize";
import { collectUnreferencedFiles } from "./gc";
import { swapSingleImage } from "./single-image";
import { maxBytesFor } from "./inspect";
import { persistImage, removeStoredFile } from "./store";

/**
 * Persist bytes and set them as the map image. Caller must already have
 * authorized the write (staff). Shared by attachImage and createMapWithImage.
 */
export async function setMapImage(input: {
  worldId: string;
  mapId: string;
  actorId: string;
  bytes: Buffer;
}): Promise<AuthzResult<{ fileId: string; widthPx: number; heightPx: number }>> {
  const saved = await persistImage({
    bytes: input.bytes,
    createdBy: input.actorId,
    maxBytes: maxBytesFor("map"),
  });
  if ("error" in saved) return fail(400, saved.error);
  if (!saved.image.width || !saved.image.height) {
    await removeStoredFile(saved.id);
    return fail(400, "Bildgröße unbekannt.");
  }

  try {
    const linked = await linkStaffImage("map", input.worldId, input.mapId, saved.id, input.actorId);
    if (!linked.ok) {
      await removeStoredFile(saved.id);
      return linked;
    }
  } catch (error) {
    await removeStoredFile(saved.id);
    throw error;
  }
  return { ok: true, data: { fileId: saved.id, widthPx: saved.image.width, heightPx: saved.image.height } };
}

async function membershipFor(worldId: string, userId: string): Promise<MembershipRow | null> {
  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.worldId, worldId), eq(memberships.userId, userId)))
    .limit(1);
  if (!membership) return null;
  return {
    id: membership.id,
    worldId: membership.worldId,
    userId: membership.userId,
    role: membership.role,
    archivedAt: membership.archivedAt,
  };
}

export async function attachImage(input: {
  kind: ImageKind;
  actorId: string;
  bytes: Buffer;
  worldId?: string | null;
  targetId?: string | null;
}): Promise<AuthzResult<{ fileId: string }>> {
  const maxBytes = maxBytesFor(input.kind);

  if (input.kind === "map") {
    if (!input.worldId || !input.targetId) {
      return fail(400, "Welt und Ziel fehlen.");
    }
    const membership = await membershipFor(input.worldId, input.actorId);
    const allowed = authorizeImageWrite({
      kind: input.kind,
      actorId: input.actorId,
      membership,
      ownerId: null,
      existingCharacterImages: 0,
    });
    if (!allowed.ok) return allowed;
    const set = await setMapImage({
      worldId: input.worldId,
      mapId: input.targetId,
      actorId: input.actorId,
      bytes: input.bytes,
    });
    if (!set.ok) return set;
    return { ok: true, data: { fileId: set.data.fileId } };
  }

  if (input.kind === "world_title" || input.kind === "article_title") {
    if (!input.worldId || !input.targetId) {
      return fail(400, "Welt und Ziel fehlen.");
    }
    const membership = await membershipFor(input.worldId, input.actorId);
    const allowed = authorizeImageWrite({
      kind: input.kind,
      actorId: input.actorId,
      membership,
      ownerId: null,
      existingCharacterImages: 0,
    });
    if (!allowed.ok) return allowed;

    const saved = await persistImage({
      bytes: input.bytes,
      createdBy: input.actorId,
      maxBytes,
    });
    if ("error" in saved) return fail(400, saved.error);

    try {
      const linked = await linkStaffImage(
        input.kind,
        input.worldId,
        input.targetId,
        saved.id,
        input.actorId,
      );
      if (!linked.ok) {
        await removeStoredFile(saved.id);
        return linked;
      }
    } catch (error) {
      await removeStoredFile(saved.id);
      throw error;
    }
    return { ok: true, data: { fileId: saved.id } };
  }

  if (input.kind === "monster_portrait") {
    if (!input.worldId || !input.targetId) {
      return fail(400, "Welt und Ziel fehlen.");
    }
    const membership = await membershipFor(input.worldId, input.actorId);
    const [monster] = await db
      .select({
        id: monsters.id,
        portraitId: monsters.portraitId,
        ownerId: monsters.ownerId,
        visibility: monsters.visibility,
      })
      .from(monsters)
      .where(and(eq(monsters.id, input.targetId), eq(monsters.worldId, input.worldId)))
      .limit(1);
    const allowed = authorizeImageWrite({
      kind: input.kind,
      actorId: input.actorId,
      membership,
      ownerId: null,
      existingCharacterImages: 0,
      content: monster
        ? { ownerId: monster.ownerId, visibility: monster.visibility }
        : null,
    });
    if (!allowed.ok) return allowed;
    if (!monster) return fail(404, MONSTER_NOT_FOUND);

    const saved = await persistImage({
      bytes: input.bytes,
      createdBy: input.actorId,
      maxBytes,
    });
    if ("error" in saved) return fail(400, saved.error);

    try {
      const previous = await swapSingleImage({
        kind: "monster_portrait",
        worldId: input.worldId,
        targetId: monster.id,
        fileId: saved.id,
        actorId: input.actorId,
      });
      if (previous === undefined) {
        await removeStoredFile(saved.id);
        return fail(404, MONSTER_NOT_FOUND);
      }
      await collectUnreferencedFiles([previous]);
    } catch (error) {
      await removeStoredFile(saved.id);
      const mapped = mapDbError(error, { unique: "Bitte das Bild erneut hochladen." });
      if (mapped) return mapped;
      throw error;
    }
    return { ok: true, data: { fileId: saved.id } };
  }

  if (!input.targetId) return fail(400, "Charakter fehlt.");
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, input.targetId))
    .limit(1);
  if (!character) return fail(404, "Charakter nicht gefunden.");

  const [imageCount] = await db
    .select({ value: count() })
    .from(characterImages)
    .where(eq(characterImages.characterId, character.id));

  const allowed = authorizeImageWrite({
    kind: input.kind,
    actorId: input.actorId,
    membership: null,
    ownerId: character.ownerId,
    existingCharacterImages: imageCount?.value ?? 0,
  });
  if (!allowed.ok) return allowed;

  const saved = await persistImage({
    bytes: input.bytes,
    createdBy: input.actorId,
    maxBytes,
  });
  if ("error" in saved) return fail(400, saved.error);

  try {
    if (input.kind === "character_portrait") {
      const previous = await swapSingleImage({
        kind: "character_portrait",
        targetId: character.id,
        fileId: saved.id,
        actorId: input.actorId,
      });
      if (previous === undefined) {
        await removeStoredFile(saved.id);
        return fail(404, "Charakter nicht gefunden.");
      }
      await collectUnreferencedFiles([previous]);
    } else {
      await db.insert(characterImages).values({
        characterId: character.id,
        fileId: saved.id,
        sortOrder: sql`(SELECT coalesce(max(${characterImages.sortOrder}), -1) + 1 FROM ${characterImages} WHERE ${characterImages.characterId} = ${character.id})`,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      });
    }
  } catch (error) {
    await removeStoredFile(saved.id);
    const mapped = mapDbError(error, { unique: "Bitte das Bild erneut hochladen." });
    if (mapped) return mapped;
    throw error;
  }

  return { ok: true, data: { fileId: saved.id } };
}

async function linkStaffImage(
  kind: ImageKind,
  worldId: string,
  targetId: string,
  fileId: string,
  actorId: string,
): Promise<AuthzResult<true>> {
  const now = new Date();
  if (kind === "world_title") {
    const previous = await swapSingleImage({ kind, targetId: worldId, fileId, actorId });
    if (previous === undefined) return fail(404, "Welt nicht gefunden.");
    await collectUnreferencedFiles([previous]);
    return { ok: true, data: true };
  }
  if (kind === "article_title") {
    const previous = await swapSingleImage({ kind, worldId, targetId, fileId, actorId });
    if (previous === undefined) return fail(404, "Artikel nicht gefunden.");
    await collectUnreferencedFiles([previous]);
    return { ok: true, data: true };
  }
  const [map] = await db
    .select({
      id: maps.id,
      imageId: maps.imageId,
      universeId: maps.universeId,
      mapVisibility: maps.visibility,
      universeVisibility: universes.visibility,
    })
    .from(maps)
    .innerJoin(universes, eq(universes.id, maps.universeId))
    .where(and(eq(maps.id, targetId), eq(universes.worldId, worldId)))
    .limit(1);
  if (!map) return fail(404, "Karte nicht gefunden.");
  await db
    .update(maps)
    .set({ imageId: fileId, updatedAt: now, updatedBy: actorId })
    .where(eq(maps.id, map.id));
  if (map.imageId) await collectUnreferencedFiles([map.imageId]);
  worldEvents.publish({
    type: "map.updated",
    worldId,
    universeId: map.universeId,
    layers: [{ visibility: map.universeVisibility }, { visibility: map.mapVisibility }],
  });
  return { ok: true, data: true };
}
