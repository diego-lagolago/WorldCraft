import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, type DbTx } from "@/db/client";
import { characters, questParticipants, quests, worldParticipations } from "@/db/schema";
import {
  authorizeOwnedContentWrite,
  canSeeContent,
  contentVisibilitySchema,
  fail,
  ok,
  requireStaff,
  type AuthzResult,
  type ContentVisibility,
  type MembershipRole,
  type MembershipRow,
} from "@/lib/authz";
import { parseUuid } from "@/lib/http";
import {
  QUEST_STATUSES,
  type QuestParticipant,
  type QuestStatus,
} from "@/lib/quests/status";
import { mapDbError } from "./db-errors";
import { loadVisibleQuestDetails } from "./quest-access";
import { listVisibleChaptersForQuest, type ChapterSummary } from "./quest-chapters";
import { recalcQuestRelations } from "./relations";
import { visibleContentWhere } from "./visibility-sql";
import { richFieldFromInput } from "./rich-field";

export type { ChapterSummary } from "./quest-chapters";

export {
  QUEST_STATUS_LABEL,
  QUEST_STATUSES,
  type QuestParticipant,
  type QuestStatus,
} from "@/lib/quests/status";
import { matchesExpectedUpdatedAt } from "./expected-updated-at";

export const QUEST_TITLE_MAX = 200;

export const questTitleSchema = z.string().trim().min(1).max(QUEST_TITLE_MAX);
export const questStatusSchema = z.enum(QUEST_STATUSES);

const NOT_FOUND = "Diese Quest gibt es nicht.";

const questFields = {
  title: questTitleSchema,
  description: z.unknown(),
  status: questStatusSchema,
  visibility: contentVisibilitySchema,
  /** Active brought characters of this world; empty array clears active participants (snapshots kept on update). */
  participantIds: z.array(z.uuid()),
  addParticipantIds: z.array(z.uuid()),
  /** Character ids or quest_participants row ids (for deleted-character snapshots). */
  removeParticipantIds: z.array(z.uuid()),
};

export const questCreateSchema = z.object({
  title: questFields.title,
  description: questFields.description.optional(),
  status: questFields.status.optional(),
  visibility: questFields.visibility.optional(),
  participantIds: questFields.participantIds.optional(),
});

export const questUpdateSchema = z
  .object({
    title: questFields.title.optional(),
    description: questFields.description.optional(),
    status: questFields.status.optional(),
    visibility: questFields.visibility.optional(),
    participantIds: questFields.participantIds.optional(),
    addParticipantIds: questFields.addParticipantIds.optional(),
    removeParticipantIds: questFields.removeParticipantIds.optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export type QuestSummary = {
  id: string;
  title: string;
  status: QuestStatus;
  visibility: ContentVisibility;
  ownerId: string;
  updatedAt: Date;
  participants: QuestParticipant[];
};

export type QuestDetails = QuestSummary & {
  worldId: string;
  descriptionJson: unknown;
  chapters: ChapterSummary[];
};

function asStatus(value: string): QuestStatus {
  return (QUEST_STATUSES as readonly string[]).includes(value) ? (value as QuestStatus) : "open";
}

async function loadParticipants(questIds: string[], worldId: string): Promise<Map<string, QuestParticipant[]>> {
  if (questIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: questParticipants.id,
      questId: questParticipants.questId,
      characterId: questParticipants.characterId,
      snapshotName: questParticipants.characterName,
      liveName: characters.name,
      archivedAt: worldParticipations.archivedAt,
    })
    .from(questParticipants)
    .leftJoin(characters, eq(characters.id, questParticipants.characterId))
    .leftJoin(
      worldParticipations,
      and(
        eq(worldParticipations.characterId, questParticipants.characterId),
        eq(worldParticipations.worldId, worldId),
      ),
    )
    .where(inArray(questParticipants.questId, questIds))
    .orderBy(asc(questParticipants.characterName));

  const out = new Map<string, QuestParticipant[]>();
  for (const row of rows) {
    const active = Boolean(row.characterId && row.archivedAt === null);
    const list = out.get(row.questId) ?? [];
    list.push({
      id: row.id,
      characterId: row.characterId,
      characterName: active && row.liveName ? row.liveName : row.snapshotName,
      href: active,
    });
    out.set(row.questId, list);
  }
  return out;
}

/** APP-QUEST-PART: only characters actively brought into this world. */
async function resolveParticipants(
  worldId: string,
  ids: string[],
  exec: DbTx | typeof db = db,
): Promise<AuthzResult<{ characterId: string; characterName: string }[]>> {
  const unique = [...new Set(ids)];
  for (const id of unique) {
    if (!parseUuid(id)) return fail(400, "Ein Beteiligter ist ungültig.");
  }
  if (unique.length === 0) return ok([]);

  const rows = await exec
    .select({ id: characters.id, name: characters.name })
    .from(characters)
    .innerJoin(
      worldParticipations,
      and(
        eq(worldParticipations.characterId, characters.id),
        eq(worldParticipations.worldId, worldId),
        isNull(worldParticipations.archivedAt),
      ),
    )
    .where(inArray(characters.id, unique));

  if (rows.length !== unique.length) {
    return fail(400, "Nur mitgebrachte Charaktere dieser Welt können beteiligt werden.");
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ok(unique.map((id) => ({ characterId: id, characterName: byId.get(id)!.name })));
}

async function replaceParticipants(
  questId: string,
  actorId: string,
  participants: { characterId: string; characterName: string }[],
  tx: DbTx,
): Promise<void> {
  await tx.delete(questParticipants).where(eq(questParticipants.questId, questId));
  if (participants.length === 0) return;
  await tx.insert(questParticipants).values(
    participants.map((row) => ({
      questId,
      characterId: row.characterId,
      characterName: row.characterName,
      createdBy: actorId,
      updatedBy: actorId,
    })),
  );
}

/**
 * CR-005: add/remove or sync actives via participantIds; snapshot rows (left or
 * deleted) are never dropped unless explicitly removed.
 */
async function applyParticipantChanges(
  input: {
    questId: string;
    worldId: string;
    actorId: string;
    addParticipantIds?: string[];
    removeParticipantIds?: string[];
    participantIds?: string[];
  },
  tx: DbTx,
): Promise<AuthzResult<true>> {
  const existing = await tx
    .select({
      id: questParticipants.id,
      characterId: questParticipants.characterId,
      archivedAt: worldParticipations.archivedAt,
    })
    .from(questParticipants)
    .leftJoin(
      worldParticipations,
      and(
        eq(worldParticipations.characterId, questParticipants.characterId),
        eq(worldParticipations.worldId, input.worldId),
      ),
    )
    .where(eq(questParticipants.questId, input.questId));

  const isSnapshot = (row: { characterId: string | null; archivedAt: Date | null }) =>
    !row.characterId || row.archivedAt !== null;

  if (input.removeParticipantIds?.length) {
    const removeSet = new Set(input.removeParticipantIds);
    const toDelete = existing
      .filter((row) => removeSet.has(row.id) || (row.characterId !== null && removeSet.has(row.characterId)))
      .map((row) => row.id);
    if (toDelete.length > 0) {
      await tx.delete(questParticipants).where(inArray(questParticipants.id, toDelete));
    }
  }

  if (input.addParticipantIds?.length) {
    const resolved = await resolveParticipants(input.worldId, input.addParticipantIds, tx);
    if (!resolved.ok) return resolved;
    const remaining = await tx
      .select({ characterId: questParticipants.characterId })
      .from(questParticipants)
      .where(eq(questParticipants.questId, input.questId));
    const have = new Set(remaining.map((row) => row.characterId).filter(Boolean));
    const toInsert = resolved.data.filter((row) => !have.has(row.characterId));
    if (toInsert.length > 0) {
      await tx.insert(questParticipants).values(
        toInsert.map((row) => ({
          questId: input.questId,
          characterId: row.characterId,
          characterName: row.characterName,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        })),
      );
    }
  }

  if (input.participantIds !== undefined) {
    const resolved = await resolveParticipants(input.worldId, input.participantIds, tx);
    if (!resolved.ok) return resolved;
    const currentRows = await tx
      .select({
        id: questParticipants.id,
        characterId: questParticipants.characterId,
        archivedAt: worldParticipations.archivedAt,
      })
      .from(questParticipants)
      .leftJoin(
        worldParticipations,
        and(
          eq(worldParticipations.characterId, questParticipants.characterId),
          eq(worldParticipations.worldId, input.worldId),
        ),
      )
      .where(eq(questParticipants.questId, input.questId));
    const wanted = new Set(resolved.data.map((row) => row.characterId));
    const actives = currentRows.filter((row) => !isSnapshot(row));
    const deleteIds = actives
      .filter((row) => row.characterId && !wanted.has(row.characterId))
      .map((row) => row.id);
    if (deleteIds.length > 0) {
      await tx.delete(questParticipants).where(inArray(questParticipants.id, deleteIds));
    }
    const haveActive = new Set(
      actives.filter((row) => row.characterId && wanted.has(row.characterId)).map((row) => row.characterId!),
    );
    const toInsert = resolved.data.filter((row) => !haveActive.has(row.characterId));
    if (toInsert.length > 0) {
      await tx.insert(questParticipants).values(
        toInsert.map((row) => ({
          questId: input.questId,
          characterId: row.characterId,
          characterName: row.characterName,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        })),
      );
    }
  }

  // Refresh stored names for currently active participants.
  const activeRows = await tx
    .select({
      id: questParticipants.id,
      name: characters.name,
    })
    .from(questParticipants)
    .innerJoin(characters, eq(characters.id, questParticipants.characterId))
    .innerJoin(
      worldParticipations,
      and(
        eq(worldParticipations.characterId, characters.id),
        eq(worldParticipations.worldId, input.worldId),
        isNull(worldParticipations.archivedAt),
      ),
    )
    .where(eq(questParticipants.questId, input.questId));
  for (const row of activeRows) {
    await tx
      .update(questParticipants)
      .set({ characterName: row.name, updatedAt: new Date(), updatedBy: input.actorId })
      .where(eq(questParticipants.id, row.id));
  }

  return ok(true);
}

/** Visible quests of a world, title A–Z. */
export async function listQuests(
  worldId: string,
  role: MembershipRole,
  viewerId: string,
): Promise<QuestSummary[]> {
  const filters = [
    eq(quests.worldId, worldId),
    visibleContentWhere({ visibility: quests.visibility, ownerId: quests.ownerId }, { role, userId: viewerId }),
  ];

  const rows = await db
    .select({
      id: quests.id,
      title: quests.title,
      status: quests.status,
      visibility: quests.visibility,
      ownerId: quests.ownerId,
      updatedAt: quests.updatedAt,
    })
    .from(quests)
    .where(and(...filters))
    .orderBy(asc(quests.title));
  const visible = rows.filter((row) =>
    canSeeContent({ role, userId: viewerId }, { visibility: row.visibility, ownerId: row.ownerId }),
  );
  const participants = await loadParticipants(
    visible.map((row) => row.id),
    worldId,
  );
  return visible.map((row) => ({
    id: row.id,
    title: row.title,
    status: asStatus(row.status),
    visibility: row.visibility,
    ownerId: row.ownerId,
    updatedAt: row.updatedAt,
    participants: participants.get(row.id) ?? [],
  }));
}

export async function getQuest(
  worldId: string,
  questId: string,
  role: MembershipRole,
  viewerId: string,
): Promise<QuestDetails | null> {
  const row = await loadVisibleQuestDetails(worldId, questId, { role, userId: viewerId });
  if (!row) return null;
  const participants = await loadParticipants([row.id], worldId);
  const chapters = await listVisibleChaptersForQuest(row, role, viewerId);
  return {
    id: row.id,
    worldId: row.worldId,
    title: row.title,
    status: asStatus(row.status),
    visibility: row.visibility,
    ownerId: row.ownerId,
    updatedAt: row.updatedAt,
    descriptionJson: row.descriptionJson,
    participants: participants.get(row.id) ?? [],
    chapters,
  };
}

type QuestPatch = Partial<typeof quests.$inferInsert>;

async function toPatch(input: {
  title?: string;
  description?: unknown;
  status?: QuestStatus;
  visibility?: ContentVisibility;
}): Promise<AuthzResult<QuestPatch>> {
  const patch: QuestPatch = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.status !== undefined) patch.status = input.status;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.description !== undefined) {
    const body = richFieldFromInput(input.description, { mentions: true });
    if (!body.ok) return body;
    patch.descriptionJson = body.data.json;
    patch.descriptionPlain = body.data.plain;
  }
  return ok(patch);
}

export async function createQuest(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  title: string;
  description?: unknown;
  status?: QuestStatus;
  visibility?: ContentVisibility;
  participantIds?: string[];
}): Promise<AuthzResult<QuestSummary>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const patch = await toPatch(input);
  if (!patch.ok) return patch;
  const participants =
    input.participantIds !== undefined
      ? await resolveParticipants(input.worldId, input.participantIds)
      : ok([] as { characterId: string; characterName: string }[]);
  if (!participants.ok) return participants;

  try {
    const summary = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(quests)
        .values({
          ...patch.data,
          worldId: input.worldId,
          title: input.title,
          ownerId: input.actorId,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        })
        .returning({
          id: quests.id,
          title: quests.title,
          status: quests.status,
          visibility: quests.visibility,
          ownerId: quests.ownerId,
          updatedAt: quests.updatedAt,
        });
      await replaceParticipants(row.id, input.actorId, participants.data, tx);
      await recalcQuestRelations(input.worldId, input.actorId, row.id, tx);
      return row;
    });
    const loaded = await loadParticipants([summary.id], input.worldId);
    return ok({
      id: summary.id,
      title: summary.title,
      status: asStatus(summary.status),
      visibility: summary.visibility,
      ownerId: summary.ownerId,
      updatedAt: summary.updatedAt,
      participants: loaded.get(summary.id) ?? [],
    });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function updateQuest(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  questId: string;
  title?: string;
  description?: unknown;
  status?: QuestStatus;
  visibility?: ContentVisibility;
  participantIds?: string[];
  addParticipantIds?: string[];
  removeParticipantIds?: string[];
  expectedUpdatedAt?: Date;
}): Promise<AuthzResult<{ id: string }>> {
  const [current] = await db
    .select({ id: quests.id, ownerId: quests.ownerId, visibility: quests.visibility })
    .from(quests)
    .where(and(eq(quests.id, input.questId), eq(quests.worldId, input.worldId)))
    .limit(1);
  const allowed = authorizeOwnedContentWrite({
    membership: input.membership,
    content: current ? { ownerId: current.ownerId, visibility: current.visibility } : null,
    nextVisibility: input.visibility,
    notFoundError: NOT_FOUND,
  });
  if (!allowed.ok) return allowed;
  if (!current) return fail(404, NOT_FOUND);

  const patch = await toPatch(input);
  if (!patch.ok) return patch;
  const touchesParticipants =
    input.participantIds !== undefined ||
    input.addParticipantIds !== undefined ||
    input.removeParticipantIds !== undefined;

  try {
    await db.transaction(async (tx) => {
      if (Object.keys(patch.data).length > 0) {
        const rows = await tx
          .update(quests)
          .set({ ...patch.data, updatedAt: new Date(), updatedBy: input.actorId })
          .where(and(eq(quests.id, current.id), ...matchesExpectedUpdatedAt(quests.updatedAt, input.expectedUpdatedAt)))
          .returning({ id: quests.id });
        if (!rows.length) throw Object.assign(new Error("stale"), { stale: true });
      }
      if (touchesParticipants) {
        const changed = await applyParticipantChanges(
          {
            questId: current.id,
            worldId: input.worldId,
            actorId: input.actorId,
            addParticipantIds: input.addParticipantIds,
            removeParticipantIds: input.removeParticipantIds,
            participantIds: input.participantIds,
          },
          tx,
        );
        if (!changed.ok) {
          throw Object.assign(new Error("authz"), { authzResult: changed });
        }
      }
      await recalcQuestRelations(input.worldId, input.actorId, current.id, tx);
    });
  } catch (error) {
    if (error && typeof error === "object" && "stale" in error) return fail(409, "Inhalt wurde inzwischen geändert, bitte neu lesen.");
    if (error && typeof error === "object" && "authzResult" in error) {
      return (error as { authzResult: AuthzResult<never> }).authzResult;
    }
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
  return ok({ id: current.id });
}

export async function deleteQuest(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  questId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const [current] = await db
    .select({ id: quests.id, ownerId: quests.ownerId, visibility: quests.visibility })
    .from(quests)
    .where(and(eq(quests.id, input.questId), eq(quests.worldId, input.worldId)))
    .limit(1);
  const allowed = authorizeOwnedContentWrite({
    membership: input.membership,
    content: current ? { ownerId: current.ownerId, visibility: current.visibility } : null,
    notFoundError: NOT_FOUND,
  });
  if (!allowed.ok) return allowed;
  if (!current) return fail(404, NOT_FOUND);
  await db.delete(quests).where(eq(quests.id, current.id));
  return ok({ id: current.id });
}
