import { and, asc, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { questChapters, quests } from "@/db/schema";
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
import { CHAPTER_TITLE_MAX, QUEST_STATUSES, type QuestStatus } from "@/lib/quests/status";
import { mapDbError } from "./db-errors";
import {
  canSeeQuest,
  loadQuestRow,
  loadVisibleQuest,
  type QuestAccessRow,
} from "./quest-access";
import { recalcQuestMentions } from "./relations";
import { richFieldFromInput } from "./rich-field";
import { matchesExpectedUpdatedAt } from "./expected-updated-at";

export const chapterTitleSchema = z.string().trim().min(1).max(CHAPTER_TITLE_MAX);

const QUEST_NOT_FOUND = "Diese Quest gibt es nicht.";
const CHAPTER_NOT_FOUND = "Dieses Kapitel gibt es nicht.";
const ORDER_INVALID = "Die Reihenfolge muss alle sichtbaren Kapitel genau einmal enthalten.";

const chapterFields = {
  title: chapterTitleSchema,
  body: z.unknown(),
  status: z.enum(QUEST_STATUSES),
  visibility: contentVisibilitySchema,
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
    status: chapterFields.status.optional(),
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
  status: QuestStatus;
  visibility: ContentVisibility;
  ownerId: string;
  position: number;
  updatedAt: Date;
};

type ChapterRow = {
  id: string;
  questId: string;
  title: string;
  bodyJson: unknown;
  status: QuestStatus;
  visibility: ContentVisibility;
  ownerId: string;
  position: number;
  updatedAt: Date;
};

type WritableChapterRow = {
  id: string;
  ownerId: string;
  visibility: ContentVisibility;
  position: number;
  updatedAt: Date;
};

function toSummary(row: ChapterRow): ChapterSummary {
  return {
    id: row.id,
    title: row.title,
    bodyJson: row.bodyJson,
    status: row.status,
    visibility: row.visibility,
    ownerId: row.ownerId,
    position: row.position,
    updatedAt: row.updatedAt,
  };
}

/** APP-VIS-INHERIT: chapter visible only if quest and chapter are visible. */
function canSeeChapter(
  quest: QuestAccessRow,
  chapter: { visibility: ContentVisibility; ownerId: string },
  role: MembershipRole,
  viewerId: string,
): boolean {
  return (
    canSeeQuest(quest, { role, userId: viewerId }) &&
    canSeeContent(
      { role, userId: viewerId },
      { visibility: chapter.visibility, ownerId: chapter.ownerId },
    )
  );
}

async function loadChapters(questId: string): Promise<ChapterRow[]> {
  return db
    .select({
      id: questChapters.id,
      questId: questChapters.questId,
      title: questChapters.title,
      bodyJson: questChapters.bodyJson,
      status: questChapters.status,
      visibility: questChapters.visibility,
      ownerId: questChapters.ownerId,
      position: questChapters.position,
      updatedAt: questChapters.updatedAt,
    })
    .from(questChapters)
    .where(eq(questChapters.questId, questId))
    .orderBy(asc(questChapters.position), asc(questChapters.createdAt));
}

/** Visible chapters when the quest is already loaded and checked. */
export async function listVisibleChaptersForQuest(
  quest: QuestAccessRow,
  role: MembershipRole,
  viewerId: string,
): Promise<ChapterSummary[]> {
  const rows = await loadChapters(quest.id);
  return rows
    .filter((row) => canSeeChapter(quest, row, role, viewerId))
    .map(toSummary);
}

/** Visible chapters of a quest for the viewer, sorted by position. */
export async function listVisibleChapters(
  worldId: string,
  questId: string,
  role: MembershipRole,
  viewerId: string,
): Promise<ChapterSummary[] | null> {
  const quest = await loadVisibleQuest(worldId, questId, { role, userId: viewerId });
  if (!quest) return null;
  return listVisibleChaptersForQuest(quest, role, viewerId);
}

/** Finds one visible chapter without enumerating every quest of the world. */
export async function getVisibleChapter(
  worldId: string,
  chapterId: string,
  role: MembershipRole,
  viewerId: string,
): Promise<{ questId: string; questTitle: string; chapter: ChapterSummary } | null> {
  const [row] = await db.select({ questId: questChapters.questId, questTitle: quests.title })
    .from(questChapters)
    .innerJoin(quests, eq(quests.id, questChapters.questId))
    .where(and(eq(questChapters.id, chapterId), eq(quests.worldId, worldId)))
    .limit(1);
  if (!row) return null;
  const quest = await loadVisibleQuest(worldId, row.questId, { role, userId: viewerId });
  if (!quest) return null;
  const chapters = await listVisibleChaptersForQuest(quest, role, viewerId);
  const chapter = chapters.find((entry) => entry.id === chapterId);
  return chapter ? { questId: quest.id, questTitle: row.questTitle, chapter } : null;
}

type ChapterPatch = Partial<typeof questChapters.$inferInsert>;

function toPatch(input: {
  title?: string;
  body?: unknown;
  status?: QuestStatus;
  visibility?: ContentVisibility;
}): AuthzResult<ChapterPatch> {
  const patch: ChapterPatch = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.status !== undefined) patch.status = input.status;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.body !== undefined) {
    const body = richFieldFromInput(input.body, { mentions: true });
    if (!body.ok) return body;
    patch.bodyJson = body.data.json;
    patch.bodyPlain = body.data.plain;
  }
  return ok(patch);
}

function needsMentionRecalc(input: {
  body?: unknown;
  visibility?: ContentVisibility;
}): boolean {
  return input.body !== undefined || input.visibility !== undefined;
}

async function loadWritableChapter(
  input: {
    membership: MembershipRow | null;
    worldId: string;
    questId: string;
    chapterId: string;
    nextVisibility?: ContentVisibility;
  },
  notFoundError = CHAPTER_NOT_FOUND,
): Promise<
  AuthzResult<{
    staff: MembershipRow;
    quest: QuestAccessRow;
    chapter: WritableChapterRow;
  }>
> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;

  const viewer = { role: staff.data.role, userId: staff.data.userId };
  const quest = await loadQuestRow(input.worldId, input.questId);
  if (!quest) return fail(404, QUEST_NOT_FOUND);
  if (!canSeeQuest(quest, viewer)) return fail(404, notFoundError);

  const [chapter] = await db
    .select({
      id: questChapters.id,
      ownerId: questChapters.ownerId,
      visibility: questChapters.visibility,
      position: questChapters.position,
      updatedAt: questChapters.updatedAt,
    })
    .from(questChapters)
    .where(and(eq(questChapters.id, input.chapterId), eq(questChapters.questId, quest.id)))
    .limit(1);

  const allowed = authorizeOwnedContentWrite({
    membership: staff.data,
    content: chapter ? { ownerId: chapter.ownerId, visibility: chapter.visibility } : null,
    nextVisibility: input.nextVisibility,
    notFoundError,
  });
  if (!allowed.ok) return allowed;
  if (!chapter) return fail(404, notFoundError);

  return ok({ staff: staff.data, quest, chapter });
}

export async function createChapter(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  questId: string;
  title: string;
  body?: unknown;
  status?: QuestStatus;
  position?: number;
  visibility?: ContentVisibility;
}): Promise<AuthzResult<ChapterSummary>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;

  const quest = await loadVisibleQuest(input.worldId, input.questId, {
    role: staff.data.role,
    userId: staff.data.userId,
  });
  if (!quest) return fail(404, QUEST_NOT_FOUND);

  const patch = toPatch(input);
  if (!patch.ok) return patch;

  try {
    const row = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT 1 FROM ${quests} WHERE ${quests.id} = ${quest.id} AND ${quests.worldId} = ${input.worldId} FOR UPDATE`,
      );
      const [agg] = await tx
        .select({ maxPos: max(questChapters.position) })
        .from(questChapters)
        .where(eq(questChapters.questId, quest.id));
      const count = (agg?.maxPos ?? -1) + 1;
      if (input.position !== undefined && input.position > count + 1) {
        throw Object.assign(new Error("position"), { positionInvalid: true });
      }
      const position = input.position === undefined ? count : input.position - 1;
      if (position < count) {
        await tx.update(questChapters)
          .set({ position: sql`${questChapters.position} + 1`, updatedAt: new Date(), updatedBy: input.actorId })
          .where(and(eq(questChapters.questId, quest.id), sql`${questChapters.position} >= ${position}`));
      }

      const [created] = await tx
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
          status: questChapters.status,
          visibility: questChapters.visibility,
          ownerId: questChapters.ownerId,
          position: questChapters.position,
          updatedAt: questChapters.updatedAt,
        });
      await recalcQuestMentions(input.worldId, input.actorId, quest.id, tx);
      return created;
    });
    return ok(toSummary(row));
  } catch (error) {
    if (error && typeof error === "object" && "positionInvalid" in error) return fail(400, "Die Position ist ungültig.");
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
  status?: QuestStatus;
  visibility?: ContentVisibility;
  position?: number;
  expectedUpdatedAt?: Date;
}): Promise<AuthzResult<{ id: string; updatedAt: Date }>> {
  const loaded = await loadWritableChapter({
    membership: input.membership,
    worldId: input.worldId,
    questId: input.questId,
    chapterId: input.chapterId,
    nextVisibility: input.visibility,
  });
  if (!loaded.ok) return loaded;
  const { quest, chapter } = loaded.data;

  const patch = toPatch(input);
  if (!patch.ok) return patch;

  const recalcMentions = needsMentionRecalc(input);

  try {
    const updated = await db.transaction(async (tx) => {
      if (input.position !== undefined && input.position < 1) throw Object.assign(new Error("position"), { positionInvalid: true });
      if (input.expectedUpdatedAt && chapter.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) return null;
      await tx.execute(sql`SELECT 1 FROM ${quests} WHERE ${quests.id} = ${quest.id} FOR UPDATE`);
      if (input.position !== undefined) {
        const rows = await tx.select({ id: questChapters.id, position: questChapters.position })
          .from(questChapters).where(eq(questChapters.questId, quest.id)).orderBy(asc(questChapters.position));
        if (input.position > rows.length) throw Object.assign(new Error("position"), { positionInvalid: true });
        const target = input.position - 1;
        if (target !== chapter.position) {
          for (const row of rows) {
            if (row.id === chapter.id) continue;
            const next = row.position > chapter.position && row.position <= target ? row.position - 1
              : row.position < chapter.position && row.position >= target ? row.position + 1 : row.position;
            if (next !== row.position) await tx.update(questChapters).set({ position: next, updatedAt: new Date(), updatedBy: input.actorId }).where(eq(questChapters.id, row.id));
          }
          patch.data.position = target;
        }
      }
      if (Object.keys(patch.data).length > 0) {
        const rows = await tx
          .update(questChapters)
          .set({ ...patch.data, updatedAt: new Date(), updatedBy: input.actorId })
          .where(and(eq(questChapters.id, chapter.id), ...matchesExpectedUpdatedAt(questChapters.updatedAt, input.expectedUpdatedAt)))
          .returning({ updatedAt: questChapters.updatedAt });
        if (rows.length === 0) return null;
        if (recalcMentions) await recalcQuestMentions(input.worldId, input.actorId, quest.id, tx);
        return rows[0];
      }
      return { updatedAt: chapter.updatedAt };
    });
    if (!updated) return fail(409, "Inhalt wurde inzwischen geändert, bitte neu lesen.");
    return ok({ id: chapter.id, updatedAt: updated.updatedAt });
  } catch (error) {
    if (error && typeof error === "object" && "positionInvalid" in error) return fail(400, "Die Position ist ungültig.");
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function deleteChapter(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  questId: string;
  chapterId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const loaded = await loadWritableChapter({
    membership: input.membership,
    worldId: input.worldId,
    questId: input.questId,
    chapterId: input.chapterId,
  });
  if (!loaded.ok) return loaded;
  const { quest, chapter } = loaded.data;

  await db.transaction(async (tx) => {
    await tx.delete(questChapters).where(eq(questChapters.id, chapter.id));
    await recalcQuestMentions(input.worldId, input.actorId, quest.id, tx);
  });
  return ok({ id: chapter.id });
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

  const quest = await loadVisibleQuest(input.worldId, input.questId, {
    role: staff.data.role,
    userId: staff.data.userId,
  });
  if (!quest) return fail(404, QUEST_NOT_FOUND);

  const viewer = { role: staff.data.role, userId: staff.data.userId };

  try {
    const orderedIds = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT 1 FROM ${quests} WHERE ${quests.id} = ${quest.id} AND ${quests.worldId} = ${input.worldId} FOR UPDATE`,
      );

      const all = await tx
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
        .where(eq(questChapters.questId, quest.id))
        .orderBy(asc(questChapters.position), asc(questChapters.createdAt));

      const visible = all.filter((row) =>
        canSeeContent(viewer, { visibility: row.visibility, ownerId: row.ownerId }),
      );
      const visibleIds = new Set(visible.map((row) => row.id));
      const unique = new Set(input.chapterIds);
      if (
        input.chapterIds.length !== visible.length ||
        unique.size !== input.chapterIds.length ||
        input.chapterIds.some((id) => !visibleIds.has(id))
      ) {
        throw Object.assign(new Error("order"), { orderInvalid: true });
      }

      const sentQueue = [...input.chapterIds];
      const nextOrderedIds: string[] = [];
      for (const row of all) {
        if (visibleIds.has(row.id)) {
          nextOrderedIds.push(sentQueue.shift()!);
        } else {
          nextOrderedIds.push(row.id);
        }
      }

      const positionById = new Map(all.map((row) => [row.id, row.position]));
      for (let index = 0; index < nextOrderedIds.length; index += 1) {
        const chapterId = nextOrderedIds[index]!;
        const currentPosition = positionById.get(chapterId);
        if (currentPosition === index) continue;
        await tx
          .update(questChapters)
          .set({
            position: index,
            updatedAt: new Date(),
            updatedBy: input.actorId,
          })
          .where(and(eq(questChapters.id, chapterId), eq(questChapters.questId, quest.id)));
      }

      return nextOrderedIds;
    });

    return ok({ chapterIds: orderedIds });
  } catch (error) {
    if (error && typeof error === "object" && "orderInvalid" in error) {
      return fail(400, ORDER_INVALID);
    }
    throw error;
  }
}
