import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  articles,
  chatChannels,
  maps,
  memberships,
  universes,
  worlds,
} from "@/db/schema";
import { ok, requireGm, type AuthzResult, type MembershipRole, type MembershipRow } from "@/lib/authz";
import { collectUnreferencedFiles } from "@/lib/files/gc";
import { swapSingleImage } from "@/lib/files/single-image";
import { mapDbError } from "./db-errors";
import { richFieldFromInput } from "./rich-field";

export const WORLD_NAME_MAX = 120;
export const FIRST_UNIVERSE_NAME = "Hauptuniversum";
export const FIRST_CHANNEL_NAME = "Allgemein";

export const worldNameSchema = z.string().trim().min(1).max(WORLD_NAME_MAX);

export type MyWorld = { id: string; name: string; role: MembershipRole };

/** Worlds with an active membership of the user, alphabetical. */
export async function listMyWorlds(userId: string): Promise<MyWorld[]> {
  return db
    .select({ id: worlds.id, name: worlds.name, role: memberships.role })
    .from(memberships)
    .innerJoin(worlds, eq(worlds.id, memberships.worldId))
    .where(and(eq(memberships.userId, userId), isNull(memberships.archivedAt)))
    .orderBy(asc(worlds.name));
}

export type WorldDetails = {
  id: string;
  name: string;
  descriptionJson: unknown;
  titleImageId: string | null;
  mcpEnabled: boolean;
};

export async function getWorldDetails(worldId: string): Promise<WorldDetails | null> {
  const [row] = await db
    .select({
      id: worlds.id,
      name: worlds.name,
      descriptionJson: worlds.descriptionJson,
      titleImageId: worlds.titleImageId,
      mcpEnabled: worlds.mcpEnabled,
    })
    .from(worlds)
    .where(eq(worlds.id, worldId))
    .limit(1);
  return row ?? null;
}

/**
 * APP-WORLD-CREATE in one transaction: world, game master membership,
 * „Hauptuniversum“ (published, sort 0) and chat channel „Allgemein“ (sort 0).
 */
export async function createWorld(input: {
  actorId: string;
  name: string;
  description?: unknown;
}): Promise<AuthzResult<{ id: string; name: string; universeId: string }>> {
  const description = richFieldFromInput(input.description ?? null, { mentions: false });
  if (!description.ok) return description;
  const actor = input.actorId;

  try {
    const created = await db.transaction(async (tx) => {
      const [world] = await tx
        .insert(worlds)
        .values({
          name: input.name,
          descriptionJson: description.data.json,
          descriptionPlain: description.data.plain,
          createdBy: actor,
          updatedBy: actor,
        })
        .returning({ id: worlds.id, name: worlds.name });
      await tx.insert(memberships).values({
        worldId: world.id,
        userId: actor,
        role: "game_master",
        createdBy: actor,
        updatedBy: actor,
      });
      const [universe] = await tx
        .insert(universes)
        .values({
          worldId: world.id,
          name: FIRST_UNIVERSE_NAME,
          sortOrder: 0,
          visibility: "published",
          createdBy: actor,
          updatedBy: actor,
        })
        .returning({ id: universes.id });
      await tx.insert(chatChannels).values({
        worldId: world.id,
        name: FIRST_CHANNEL_NAME,
        sortOrder: 0,
        createdBy: actor,
        updatedBy: actor,
      });
      return { ...world, universeId: universe.id };
    });
    return ok(created);
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function updateWorld(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  name?: string;
  description?: unknown;
  removeTitleImage?: boolean;
  mcpEnabled?: boolean;
}): Promise<AuthzResult<{ id: string }>> {
  const gm = requireGm(input.membership);
  if (!gm.ok) return gm;

  const patch: Partial<typeof worlds.$inferInsert> = { updatedAt: new Date(), updatedBy: input.actorId };
  if (input.name !== undefined) patch.name = input.name;
  if (input.mcpEnabled !== undefined) patch.mcpEnabled = input.mcpEnabled;
  if (input.description !== undefined) {
    const description = richFieldFromInput(input.description, { mentions: false });
    if (!description.ok) return description;
    patch.descriptionJson = description.data.json;
    patch.descriptionPlain = description.data.plain;
  }

  await db.update(worlds).set(patch).where(eq(worlds.id, input.worldId));
  if (input.removeTitleImage) {
    const previousImage = await swapSingleImage({
      kind: "world_title",
      targetId: input.worldId,
      fileId: null,
      actorId: input.actorId,
    });
    await collectUnreferencedFiles([previousImage]);
  }
  return ok({ id: input.worldId });
}

/** Game master only. Content cascades; images without other references leave the volume (APP-FILE-GC). */
export async function deleteWorld(input: {
  membership: MembershipRow | null;
  worldId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const gm = requireGm(input.membership);
  if (!gm.ok) return gm;

  const candidates = await db.execute<{ file_id: string | null }>(sql`
    SELECT ${worlds.titleImageId} AS file_id FROM ${worlds} WHERE ${worlds.id} = ${input.worldId}
    UNION SELECT ${articles.titleImageId} FROM ${articles} WHERE ${articles.worldId} = ${input.worldId}
    UNION SELECT ${maps.imageId} FROM ${maps}
      JOIN ${universes} ON ${universes.id} = ${maps.universeId}
      WHERE ${universes.worldId} = ${input.worldId}
  `);

  await db.delete(worlds).where(eq(worlds.id, input.worldId));
  await collectUnreferencedFiles(candidates.map((row) => row.file_id));
  return ok({ id: input.worldId });
}
