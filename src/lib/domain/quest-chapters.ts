import { and, asc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { questChapters, quests } from "@/db/schema";
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
import { mapDbError } from "./db-errors";
import { recalcQuestRelations } from "./relations";
import { richFieldFromInput } from "./rich-field";

export const CHAPTER_TITLE_MAX = 200;

export const chapterTitleSchema = z.string().trim().min(1).max(CHAPTER_TITLE_MAX);
export const visibilitySchema = z.enum(CONTENT_VISIBILITIES);

const QUEST_NOT_FOUND = "Diese Quest gibt es nicht.";
const CHAPTER_NOT_FOUND = "Dieses Kapitel gibt es nicht.";
const ORDER_INVALID = "Die Reihenfolge muss alle sichtbaren Kapitel genau einmal enthalten.";

const chapterFields = {
  title: chapterTitleSchema,
  body: z.unknown(),
  visibility: visibilitySchema,
};

export const chapterCreateSchema = z.object({
  title: chapterFields.title,
  body: chapterFields.body.optional(),
  visibility: chapterFields.visibility.optional(),
});

export const chapterUpdateSchema = z
  .object({
    title: chapterFields.title.optional(),
    body: chapterFields.body.optional(),
    visibility: chapterFields.visibility.optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const chapterOrderSchema = z.object({
  chapterIds: z.array(z.uuid()),
});

export type ChapterSummary = {
  id: string;
  title: string;
  bodyJson: unknown;
  visibility: ContentVisibility;
  ownerId: string;
  position: number;
};

type QuestRow = {
  id: string;
  worldId: string;
  visibility: ContentVisibility;
  ownerId: string;
};

type ChapterRow = {
  id: string;
  questId: string;
  title: string;
  bodyJson: unknown;
  visibility: ContentVisibility;
  ownerId: string;
  position: number;
};

function toSummary(row: ChapterRow): ChapterSummary {
  return {
    id: row.id,
    title: row.title,
    bodyJson: row.bodyJson,
    visibility: row.visibility,
    ownerId: row.ownerId,
    position: row.position,
  };
}

async function loadQuest(worldId: string, questId: string): Promise<QuestRow | null> {
  const [row] = await db
    .select({
      id: quests.id,
      worldId: quests.worldId,
      visibility: quests.visibility,
      ownerId: quests.ownerId,
    })
    .from(quests)
    .where(and(eq(quests.id, questId), eq(quests.worldId, worldId)))
    .limit(1);
  return row ?? null;
}

function canSeeQuest(
  quest: QuestRow,
  role: MembershipRole,
  viewerId: string,
): boolean {
  return canSeeVisibility({
    role,
    visibility: quest.visibility,
    viewerId,
    ownerId: quest.ownerId,
  });
}

/** APP-VIS-INHERIT: chapter visible only if quest and chapter are visible. */
function canSeeChapter(
  quest: QuestRow,
  chapter: { visibility: ContentVisibility; ownerId: string },
  role: MembershipRole,
  viewerId: string,
): boolean {
  return (
    canSeeQuest(quest, role, viewerId) &&
    canSeeVisibility({
      role,
      visibility: chapter.visibility,
      viewerId,
      ownerId: chapter.ownerId,
    })
  );
}

async function loadChapters(questId: string): Promise<ChapterRow[]> {
  return db
    .select({
      id: questChapters.id,
      questId: questChapters.questId,
      title: questChapters.title,
      bodyJson: questChapters.bodyJson,
      visibility: questChapters.visibility,
      ownerId: questChapters.ownerId,
      position: questChapters.position,
    })
    .from(questChapters)
    .where(eq(questChapters.questId, questId))
    .orderBy(asc(questChapters.position), asc(questChapters.createdAt));
}

/** Visible chapters of a quest for the viewer, sorted by position. */
export async function listVisibleChapters(
  worldId: string,
  questId: string,
  role: MembershipRole,
  viewerId: string,
): Promise<ChapterSummary[] | null> {
  const quest = await loadQuest(worldId, questId);
  if (!quest || !canSeeQuest(quest, role, viewerId)) return null;
  const rows = await loadChapters(questId);
  return rows
    .filter((row) => canSeeChapter(quest, row, role, viewerId))
    .map(toSummary);
}

type ChapterPatch = Partial<typeof questChapters.$inferInsert>;

async function toPatch(input: {
  title?: string;
  body?: unknown;
  visibility?: ContentVisibility;
}): Promise<AuthzResult<ChapterPatch>> {
  const patch: ChapterPatch = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.body !== undefined) {
    const body = richFieldFromInput(input.body, { mentions: true });
    if (!body.ok) return body;
    patch.bodyJson = body.data.json;
    patch.bodyPlain = body.data.plain;
  }
  return ok(patch);
}

export async function createChapter(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  questId: string;
  title: string;
  body?: unknown;
  visibility?: ContentVisibility;
}): Promise<AuthzResult<ChapterSummary>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;

  const quest = await loadQuest(input.worldId, input.questId);
  if (!quest || !canSeeQuest(quest, staff.data.role, staff.data.userId)) {
    return fail(404, QUEST_NOT_FOUND);
  }

  const patch = await toPatch(input);
  if (!patch.ok) return patch;

  const [agg] = await db
    .select({ maxPos: max(questChapters.position) })
    .from(questChapters)
    .where(eq(questChapters.questId, quest.id));
  const position = (agg?.maxPos ?? -1) + 1;

  try {
    const [row] = await db
      .insert(questChapters)
      .values({
        ...patch.data,
        questId: quest.id,
        title: input.title,
        position,
        ownerId: input.actorId,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })
      .returning({
        id: questChapters.id,
        questId: questChapters.questId,
        title: questChapters.title,
        bodyJson: questChapters.bodyJson,
        visibility: questChapters.visibility,
        ownerId: questChapters.ownerId,
        position: questChapters.position,
      });
    await recalcQuestRelations(input.worldId, input.actorId, quest.id);
    return ok(toSummary(row));
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function updateChapter(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  questId: string;
  chapterId: string;
  title?: string;
  body?: unknown;
  visibility?: ContentVisibility;
}): Promise<AuthzResult<{ id: string }>> {
  const quest = await loadQuest(input.worldId, input.questId);
  if (!quest) return fail(404, QUEST_NOT_FOUND);

  const [current] = await db
    .select({
      id: questChapters.id,
      ownerId: questChapters.ownerId,
      visibility: questChapters.visibility,
    })
    .from(questChapters)
    .where(and(eq(questChapters.id, input.chapterId), eq(questChapters.questId, quest.id)))
    .limit(1);

  if (
    !input.membership ||
    !canSeeQuest(quest, input.membership.role, input.membership.userId)
  ) {
    return fail(404, CHAPTER_NOT_FOUND);
  }

  const allowed = authorizeOwnedContentWrite({
    membership: input.membership,
    content: current ? { ownerId: current.ownerId, visibility: current.visibility } : null,
    nextVisibility: input.visibility,
    notFoundError: CHAPTER_NOT_FOUND,
  });
  if (!allowed.ok) return allowed;
  if (!current) return fail(404, CHAPTER_NOT_FOUND);

  const patch = await toPatch(input);
  if (!patch.ok) return patch;

  try {
    if (Object.keys(patch.data).length > 0) {
      await db
        .update(questChapters)
        .set({ ...patch.data, updatedAt: new Date(), updatedBy: input.actorId })
        .where(eq(questChapters.id, current.id));
    }
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
  await recalcQuestRelations(input.worldId, input.actorId, quest.id);
  return ok({ id: current.id });
}

export async function deleteChapter(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  questId: string;
  chapterId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const quest = await loadQuest(input.worldId, input.questId);
  if (!quest) return fail(404, QUEST_NOT_FOUND);

  const [current] = await db
    .select({
      id: questChapters.id,
      ownerId: questChapters.ownerId,
      visibility: questChapters.visibility,
    })
    .from(questChapters)
    .where(and(eq(questChapters.id, input.chapterId), eq(questChapters.questId, quest.id)))
    .limit(1);

  if (
    !input.membership ||
    !canSeeQuest(quest, input.membership.role, input.membership.userId)
  ) {
    return fail(404, CHAPTER_NOT_FOUND);
  }

  const allowed = authorizeOwnedContentWrite({
    membership: input.membership,
    content: current ? { ownerId: current.ownerId, visibility: current.visibility } : null,
    notFoundError: CHAPTER_NOT_FOUND,
  });
  if (!allowed.ok) return allowed;
  if (!current) return fail(404, CHAPTER_NOT_FOUND);

  await db.delete(questChapters).where(eq(questChapters.id, current.id));
  await recalcQuestRelations(input.worldId, input.actorId, quest.id);
  return ok({ id: current.id });
}

/**
 * R3: invisible chapters keep their index; visible ones fill remaining slots
 * in the order sent by the caller.
 */
export async function reorderChapters(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  questId: string;
  chapterIds: string[];
}): Promise<AuthzResult<{ chapterIds: string[] }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;

  const quest = await loadQuest(input.worldId, input.questId);
  if (!quest || !canSeeQuest(quest, staff.data.role, staff.data.userId)) {
    return fail(404, QUEST_NOT_FOUND);
  }

  const all = await loadChapters(quest.id);
  const visible = all.filter((row) =>
    canSeeVisibility({
      role: staff.data.role,
      visibility: row.visibility,
      viewerId: staff.data.userId,
      ownerId: row.ownerId,
    }),
  );
  const visibleIds = new Set(visible.map((row) => row.id));
  const unique = new Set(input.chapterIds);
  if (
    input.chapterIds.length !== visible.length ||
    unique.size !== input.chapterIds.length ||
    input.chapterIds.some((id) => !visibleIds.has(id))
  ) {
    return fail(400, ORDER_INVALID);
  }

  const sentQueue = [...input.chapterIds];
  const orderedIds: string[] = [];
  for (const row of all) {
    if (visibleIds.has(row.id)) {
      orderedIds.push(sentQueue.shift()!);
    } else {
      orderedIds.push(row.id);
    }
  }

  await db.transaction(async (tx) => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await tx
        .update(questChapters)
        .set({
          position: index,
          updatedAt: new Date(),
          updatedBy: input.actorId,
        })
        .where(and(eq(questChapters.id, orderedIds[index]!), eq(questChapters.questId, quest.id)));
    }
  });

  return ok({ chapterIds: orderedIds });
}
