import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { maps, universes, worlds } from "@/db/schema";
import {
  VISIBILITY_STATUSES,
  canSeeVisibility,
  fail,
  ok,
  requireStaff,
  type AuthzResult,
  type MembershipRole,
  type MembershipRow,
  type VisibilityStatus,
} from "@/lib/authz";
import type { MentionRef } from "@/lib/editor/mentions";
import { collectUnreferencedFiles } from "@/lib/files/gc";
import { mapDbError } from "./db-errors";
import { richFieldFromInput } from "./rich-field";

export const UNIVERSE_NAME_MAX = 120;
export const universeNameSchema = z.string().trim().min(1).max(UNIVERSE_NAME_MAX);
export const visibilitySchema = z.enum(VISIBILITY_STATUSES);

const DUPLICATE_NAME = "In dieser Welt gibt es schon ein Universum mit diesem Namen.";

export type UniverseSummary = {
  id: string;
  name: string;
  visibility: VisibilityStatus;
  sortOrder: number;
};

export type UniverseDetails = UniverseSummary & { worldId: string; descriptionJson: unknown };

/** Visible universes of a world in display order (APP-VIS-INHERIT: no parent level). */
export async function listUniverses(worldId: string, role: MembershipRole): Promise<UniverseSummary[]> {
  const rows = await db
    .select({
      id: universes.id,
      name: universes.name,
      visibility: universes.visibility,
      sortOrder: universes.sortOrder,
    })
    .from(universes)
    .where(eq(universes.worldId, worldId))
    .orderBy(asc(universes.sortOrder), asc(universes.name));
  return rows.filter((row) => canSeeVisibility(role, row.visibility));
}

/** A universe the actor may see, else null (callers answer 404). */
export async function getUniverse(
  worldId: string,
  universeId: string,
  role: MembershipRole,
): Promise<UniverseDetails | null> {
  const [row] = await db
    .select({
      id: universes.id,
      worldId: universes.worldId,
      name: universes.name,
      visibility: universes.visibility,
      sortOrder: universes.sortOrder,
      descriptionJson: universes.descriptionJson,
    })
    .from(universes)
    .where(and(eq(universes.id, universeId), eq(universes.worldId, worldId)))
    .limit(1);
  if (!row || !canSeeVisibility(role, row.visibility)) return null;
  return row;
}

/** New universes default to `gm_only` and go to the end (CR-023: max + 1 under a world lock). */
export async function createUniverse(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  name: string;
  description?: unknown;
  visibility?: VisibilityStatus;
}): Promise<AuthzResult<UniverseSummary>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const description = richFieldFromInput(input.description ?? null, { mentions: true });
  if (!description.ok) return description;

  try {
    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT 1 FROM ${worlds} WHERE ${worlds.id} = ${input.worldId} FOR UPDATE`);
      const [{ next }] = await tx
        .select({ next: sql<number>`coalesce(max(${universes.sortOrder}), -1) + 1` })
        .from(universes)
        .where(eq(universes.worldId, input.worldId));
      const [row] = await tx
        .insert(universes)
        .values({
          worldId: input.worldId,
          name: input.name,
          descriptionJson: description.data.json,
          descriptionPlain: description.data.plain,
          sortOrder: Number(next),
          visibility: input.visibility ?? "gm_only",
          createdBy: input.actorId,
          updatedBy: input.actorId,
        })
        .returning({
          id: universes.id,
          name: universes.name,
          visibility: universes.visibility,
          sortOrder: universes.sortOrder,
        });
      return row;
    });
    return ok(created);
  } catch (error) {
    const mapped = mapDbError(error, { unique: DUPLICATE_NAME });
    if (mapped) return mapped;
    throw error;
  }
}

export async function updateUniverse(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  universeId: string;
  name?: string;
  description?: unknown;
  visibility?: VisibilityStatus;
}): Promise<AuthzResult<{ id: string; mentions: MentionRef[] | null }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;

  const patch: Partial<typeof universes.$inferInsert> = { updatedAt: new Date(), updatedBy: input.actorId };
  if (input.name !== undefined) patch.name = input.name;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  let mentions: MentionRef[] | null = null;
  if (input.description !== undefined) {
    const description = richFieldFromInput(input.description, { mentions: true });
    if (!description.ok) return description;
    patch.descriptionJson = description.data.json;
    patch.descriptionPlain = description.data.plain;
    mentions = description.data.mentions;
  }

  try {
    const updated = await db
      .update(universes)
      .set(patch)
      .where(and(eq(universes.id, input.universeId), eq(universes.worldId, input.worldId)))
      .returning({ id: universes.id });
    if (updated.length === 0) return fail(404, "Dieses Universum gibt es nicht.");
    return ok({ id: input.universeId, mentions });
  } catch (error) {
    const mapped = mapDbError(error, { unique: DUPLICATE_NAME });
    if (mapped) return mapped;
    throw error;
  }
}

/** Swaps the position with the visible neighbour above or below. */
export async function moveUniverse(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  universeId: string;
  direction: "up" | "down";
}): Promise<AuthzResult<{ moved: boolean }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT 1 FROM ${worlds} WHERE ${worlds.id} = ${input.worldId} FOR UPDATE`);
    const [current] = await tx
      .select({ id: universes.id, sortOrder: universes.sortOrder })
      .from(universes)
      .where(and(eq(universes.id, input.universeId), eq(universes.worldId, input.worldId)))
      .limit(1);
    if (!current) return fail(404, "Dieses Universum gibt es nicht.");

    const up = input.direction === "up";
    const [neighbour] = await tx
      .select({ id: universes.id, sortOrder: universes.sortOrder })
      .from(universes)
      .where(
        and(
          eq(universes.worldId, input.worldId),
          up ? lt(universes.sortOrder, current.sortOrder) : gt(universes.sortOrder, current.sortOrder),
        ),
      )
      .orderBy(up ? desc(universes.sortOrder) : asc(universes.sortOrder))
      .limit(1);
    if (!neighbour) return ok({ moved: false });

    const stamp = { updatedAt: new Date(), updatedBy: input.actorId };
    await tx
      .update(universes)
      .set({ sortOrder: neighbour.sortOrder, ...stamp })
      .where(eq(universes.id, current.id));
    await tx
      .update(universes)
      .set({ sortOrder: current.sortOrder, ...stamp })
      .where(eq(universes.id, neighbour.id));
    return ok({ moved: true });
  });
}

/** The last universe of a world cannot be deleted (TRIG-UNIVERSE-LAST → 409). */
export async function deleteUniverse(input: {
  membership: MembershipRow | null;
  worldId: string;
  universeId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  try {
    const mapImages = await db
      .select({ id: maps.imageId })
      .from(maps)
      .where(eq(maps.universeId, input.universeId));
    const deleted = await db
      .delete(universes)
      .where(and(eq(universes.id, input.universeId), eq(universes.worldId, input.worldId)))
      .returning({ id: universes.id });
    if (deleted.length === 0) return fail(404, "Dieses Universum gibt es nicht.");
    await collectUnreferencedFiles(mapImages.map((row) => row.id));
    return ok({ id: input.universeId });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}
