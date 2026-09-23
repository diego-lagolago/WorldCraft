/**
 * CR-003: authorize reading a stored file by resolving its references and
 * applying the same visibility rules as the UI (decisions in authz).
 */

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  articles,
  characterImages,
  characters,
  files,
  maps,
  memberships,
  universes,
  worldParticipations,
  worlds,
} from "@/db/schema";
import {
  canReadArticleTitleFile,
  canReadCharacterFile,
  canReadMapFile,
  canReadUnreferencedFile,
  canReadWorldTitleFile,
  type MembershipRole,
} from "@/lib/authz";

async function activeMembership(userId: string, worldId: string) {
  const [row] = await db
    .select({
      id: memberships.id,
      worldId: memberships.worldId,
      userId: memberships.userId,
      role: memberships.role,
      archivedAt: memberships.archivedAt,
    })
    .from(memberships)
    .where(
      and(eq(memberships.worldId, worldId), eq(memberships.userId, userId), isNull(memberships.archivedAt)),
    )
    .limit(1);
  return row ?? null;
}

async function hasActiveSharedWorld(viewerId: string, characterId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: worldParticipations.id })
    .from(worldParticipations)
    .innerJoin(
      memberships,
      and(
        eq(memberships.worldId, worldParticipations.worldId),
        eq(memberships.userId, viewerId),
        isNull(memberships.archivedAt),
      ),
    )
    .where(
      and(
        eq(worldParticipations.characterId, characterId),
        isNull(worldParticipations.archivedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function authorizeFileRead(userId: string, fileId: string): Promise<boolean> {
  const [file] = await db
    .select({ id: files.id, createdBy: files.createdBy })
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);
  if (!file) return false;

  let referenced = false;

  const worldRefs = await db
    .select({ worldId: worlds.id })
    .from(worlds)
    .where(eq(worlds.titleImageId, fileId));
  for (const ref of worldRefs) {
    referenced = true;
    if (canReadWorldTitleFile(await activeMembership(userId, ref.worldId))) return true;
  }

  const mapRefs = await db
    .select({
      worldId: universes.worldId,
      universeVisibility: universes.visibility,
      mapVisibility: maps.visibility,
      role: memberships.role,
      membershipUserId: memberships.userId,
      membershipArchivedAt: memberships.archivedAt,
    })
    .from(maps)
    .innerJoin(universes, eq(universes.id, maps.universeId))
    .leftJoin(
      memberships,
      and(eq(memberships.worldId, universes.worldId), eq(memberships.userId, userId)),
    )
    .where(eq(maps.imageId, fileId));
  for (const ref of mapRefs) {
    referenced = true;
    const viewer =
      ref.membershipUserId && !ref.membershipArchivedAt
        ? { role: ref.role as MembershipRole, userId: ref.membershipUserId }
        : null;
    if (
      canReadMapFile(viewer, [
        { visibility: ref.universeVisibility },
        { visibility: ref.mapVisibility },
      ])
    ) {
      return true;
    }
  }

  const articleRefs = await db
    .select({
      worldId: articles.worldId,
      visibility: articles.visibility,
      ownerId: articles.ownerId,
      role: memberships.role,
      membershipUserId: memberships.userId,
      membershipArchivedAt: memberships.archivedAt,
    })
    .from(articles)
    .leftJoin(
      memberships,
      and(eq(memberships.worldId, articles.worldId), eq(memberships.userId, userId)),
    )
    .where(eq(articles.titleImageId, fileId));
  for (const ref of articleRefs) {
    referenced = true;
    const viewer =
      ref.membershipUserId && !ref.membershipArchivedAt
        ? { role: ref.role as MembershipRole, userId: ref.membershipUserId }
        : null;
    if (canReadArticleTitleFile(viewer, { visibility: ref.visibility, ownerId: ref.ownerId })) {
      return true;
    }
  }

  const portraitRefs = await db
    .select({ id: characters.id, ownerId: characters.ownerId })
    .from(characters)
    .where(eq(characters.portraitId, fileId));
  for (const ref of portraitRefs) {
    referenced = true;
    if (
      canReadCharacterFile({
        viewerId: userId,
        ownerId: ref.ownerId,
        hasActiveSharedWorld: await hasActiveSharedWorld(userId, ref.id),
      })
    ) {
      return true;
    }
  }

  const imageRefs = await db
    .select({ characterId: characters.id, ownerId: characters.ownerId })
    .from(characterImages)
    .innerJoin(characters, eq(characters.id, characterImages.characterId))
    .where(eq(characterImages.fileId, fileId));
  for (const ref of imageRefs) {
    referenced = true;
    if (
      canReadCharacterFile({
        viewerId: userId,
        ownerId: ref.ownerId,
        hasActiveSharedWorld: await hasActiveSharedWorld(userId, ref.characterId),
      })
    ) {
      return true;
    }
  }

  if (!referenced) {
    return canReadUnreferencedFile({ viewerId: userId, createdBy: file.createdBy });
  }
  return false;
}
