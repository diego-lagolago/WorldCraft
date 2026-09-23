import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  articles,
  characterImages,
  characters,
  maps,
  memberships,
  universes,
  worlds,
} from "@/db/schema";
import { fail, type AuthzResult } from "@/lib/authz";
import { mapDbError } from "@/lib/domain/db-errors";
import { worldEvents } from "@/lib/realtime/events";
import { authorizeImageWrite, type ImageKind } from "./authorize";
import { collectUnreferencedFiles } from "./gc";
import { MAP_IMAGE_MAX_BYTES, OTHER_IMAGE_MAX_BYTES } from "./inspect";
import { persistImage, removeStoredFile } from "./store";

export async function attachImage(input: {
  kind: ImageKind;
  actorId: string;
  bytes: Buffer;
  worldId?: string | null;
  targetId?: string | null;
}): Promise<AuthzResult<{ fileId: string }>> {
  const maxBytes = input.kind === "map" ? MAP_IMAGE_MAX_BYTES : OTHER_IMAGE_MAX_BYTES;

  if (input.kind === "world_title" || input.kind === "map" || input.kind === "article_title") {
    if (!input.worldId || !input.targetId) {
      return fail(400, "Welt und Ziel fehlen.");
    }
    const [membership] = await db
      .select()
      .from(memberships)
      .where(
        and(eq(memberships.worldId, input.worldId), eq(memberships.userId, input.actorId)),
      )
      .limit(1);
    const allowed = authorizeImageWrite({
      kind: input.kind,
      actorId: input.actorId,
      membership: membership
        ? {
            id: membership.id,
            worldId: membership.worldId,
            userId: membership.userId,
            role: membership.role,
            archivedAt: membership.archivedAt,
          }
        : null,
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
      await db
        .update(characters)
        .set({ portraitId: saved.id, updatedAt: new Date(), updatedBy: input.actorId })
        .where(eq(characters.id, character.id));
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

  if (input.kind === "character_portrait") await collectUnreferencedFiles([character.portraitId]);
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
    const [previous] = await db
      .select({ id: worlds.titleImageId })
      .from(worlds)
      .where(eq(worlds.id, worldId))
      .limit(1);
    if (!previous) return fail(404, "Welt nicht gefunden.");
    await db
      .update(worlds)
      .set({ titleImageId: fileId, updatedAt: now, updatedBy: actorId })
      .where(eq(worlds.id, worldId));
    await collectUnreferencedFiles([previous.id]);
    return { ok: true, data: true };
  }
  if (kind === "article_title") {
    const [previous] = await db
      .select({ id: articles.titleImageId })
      .from(articles)
      .where(and(eq(articles.id, targetId), eq(articles.worldId, worldId)))
      .limit(1);
    if (!previous) return fail(404, "Artikel nicht gefunden.");
    await db
      .update(articles)
      .set({ titleImageId: fileId, updatedAt: now, updatedBy: actorId })
      .where(eq(articles.id, targetId));
    await collectUnreferencedFiles([previous.id]);
    return { ok: true, data: true };
  }
  const [map] = await db
    .select({ id: maps.id, imageId: maps.imageId, universeId: maps.universeId })
    .from(maps)
    .innerJoin(universes, eq(universes.id, maps.universeId))
    .where(and(eq(maps.id, targetId), eq(universes.worldId, worldId)))
    .limit(1);
  if (!map) return fail(404, "Karte nicht gefunden.");
  await db
    .update(maps)
    .set({ imageId: fileId, updatedAt: now, updatedBy: actorId })
    .where(eq(maps.id, map.id));
  await collectUnreferencedFiles([map.imageId]);
  worldEvents.publish({ type: "map.updated", worldId, universeId: map.universeId });
  return { ok: true, data: true };
}
