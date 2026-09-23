import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { characters, questParticipants, quests, worldParticipations } from "@/db/schema";
import {
  CONTENT_VISIBILITIES,
  authorizeOwnedContentWrite,
  canSeeVisibility,
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
import { recalcQuestRelations } from "./relations";
import { richFieldFromInput } from "./rich-field";

export {
  QUEST_STATUS_LABEL,
  QUEST_STATUSES,
  type QuestParticipant,
  type QuestStatus,
} from "@/lib/quests/status";

export const QUEST_TITLE_MAX = 200;

export const questTitleSchema = z.string().trim().min(1).max(QUEST_TITLE_MAX);
export const questStatusSchema = z.enum(QUEST_STATUSES);
export const visibilitySchema = z.enum(CONTENT_VISIBILITIES);

const NOT_FOUND = "Diese Quest gibt es nicht.";

const questFields = {
  title: questTitleSchema,
  description: z.unknown(),
  status: questStatusSchema,
  visibility: visibilitySchema,
  /** Active brought characters of this world; empty array clears participants. */
  participantIds: z.array(z.uuid()),
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
  })
  .refine((value) => Object.keys(value).length > 0);

export type QuestSummary = {
  id: string;
  title: string;
  status: QuestStatus;
  visibility: ContentVisibility;
  ownerId: string;
  participants: QuestParticipant[];
};

export type QuestDetails = QuestSummary & {
  worldId: string;
  descriptionJson: unknown;
};

function asStatus(value: string): QuestStatus {
  return (QUEST_STATUSES as readonly string[]).includes(value) ? (value as QuestStatus) : "open";
}

async function loadParticipants(questIds: string[], worldId: string): Promise<Map<string, QuestParticipant[]>> {
  if (questIds.length === 0) return new Map();
  const rows = await db
    .select({
      questId: questParticipants.questId,
      characterId: questParticipants.characterId,
      characterName: questParticipants.characterName,
      archivedAt: worldParticipations.archivedAt,
    })
    .from(questParticipants)
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
    const list = out.get(row.questId) ?? [];
    list.push({
      characterId: row.characterId,
      characterName: row.characterName,
      href: Boolean(row.characterId && row.archivedAt === null),
    });
    out.set(row.questId, list);
  }
  return out;
}

/** APP-QUEST-PART: only characters actively brought into this world. */
async function resolveParticipants(
  worldId: string,
  ids: string[],
): Promise<AuthzResult<{ characterId: string; characterName: string }[]>> {
  const unique = [...new Set(ids)];
  for (const id of unique) {
    if (!parseUuid(id)) return fail(400, "Ein Beteiligter ist ungültig.");
  }
  if (unique.length === 0) return ok([]);

  const rows = await db
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
): Promise<void> {
  await db.delete(questParticipants).where(eq(questParticipants.questId, questId));
  if (participants.length === 0) return;
  await db.insert(questParticipants).values(
    participants.map((row) => ({
      questId,
      characterId: row.characterId,
      characterName: row.characterName,
      createdBy: actorId,
      updatedBy: actorId,
    })),
  );
}

/** Visible quests of a world, title A–Z. */
export async function listQuests(
  worldId: string,
  role: MembershipRole,
  viewerId: string,
): Promise<QuestSummary[]> {
  const rows = await db
    .select({
      id: quests.id,
      title: quests.title,
      status: quests.status,
      visibility: quests.visibility,
      ownerId: quests.ownerId,
    })
    .from(quests)
    .where(eq(quests.worldId, worldId))
    .orderBy(asc(quests.title));
  const visible = rows.filter((row) =>
    canSeeVisibility({ role, visibility: row.visibility, viewerId, ownerId: row.ownerId }),
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
    participants: participants.get(row.id) ?? [],
  }));
}

export async function getQuest(
  worldId: string,
  questId: string,
  role: MembershipRole,
  viewerId: string,
): Promise<QuestDetails | null> {
  const [row] = await db
    .select({
      id: quests.id,
      worldId: quests.worldId,
      title: quests.title,
      status: quests.status,
      visibility: quests.visibility,
      ownerId: quests.ownerId,
      descriptionJson: quests.descriptionJson,
    })
    .from(quests)
    .where(and(eq(quests.id, questId), eq(quests.worldId, worldId)))
    .limit(1);
  if (
    !row ||
    !canSeeVisibility({ role, visibility: row.visibility, viewerId, ownerId: row.ownerId })
  ) {
    return null;
  }
  const participants = await loadParticipants([row.id], worldId);
  return {
    id: row.id,
    worldId: row.worldId,
    title: row.title,
    status: asStatus(row.status),
    visibility: row.visibility,
    ownerId: row.ownerId,
    descriptionJson: row.descriptionJson,
    participants: participants.get(row.id) ?? [],
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
    const [row] = await db
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
      });
    await replaceParticipants(row.id, input.actorId, participants.data);
    await recalcQuestRelations(input.worldId, input.actorId, row.id);
    const loaded = await loadParticipants([row.id], input.worldId);
    return ok({
      id: row.id,
      title: row.title,
      status: asStatus(row.status),
      visibility: row.visibility,
      ownerId: row.ownerId,
      participants: loaded.get(row.id) ?? [],
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
  const participants =
    input.participantIds !== undefined
      ? await resolveParticipants(input.worldId, input.participantIds)
      : null;
  if (participants && !participants.ok) return participants;

  try {
    if (Object.keys(patch.data).length > 0) {
      await db
        .update(quests)
        .set({ ...patch.data, updatedAt: new Date(), updatedBy: input.actorId })
        .where(eq(quests.id, current.id));
    }
    if (participants) {
      await replaceParticipants(current.id, input.actorId, participants.data);
    }
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
  await recalcQuestRelations(input.worldId, input.actorId, current.id);
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
