import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { questNotes, quests, users } from "@/db/schema";
import {
  canSeeVisibility,
  fail,
  ok,
  type AuthzResult,
  type ContentVisibility,
  type MembershipRole,
} from "@/lib/authz";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import { mapDbError } from "./db-errors";
import { resolveMentions, type ResolvedMention } from "./mention-resolve";
import { richFieldFromInput } from "./rich-field";

const QUEST_NOT_FOUND = "Diese Quest gibt es nicht.";
const VERSION_CONFLICT = "Die Notiz wurde inzwischen geändert.";

export const noteUpdateSchema = z.object({
  bodyJson: z.unknown(),
  version: z.number().int().min(0),
});

export type QuestNote = {
  bodyJson: unknown;
  version: number;
  updatedAt: Date | null;
  updatedBy: string | null;
  updatedByName: string | null;
  mentions: Record<string, ResolvedMention>;
};

export type NoteConflict = {
  ok: false;
  status: 409;
  error: string;
  version: number;
};

export type NoteSaveResult = AuthzResult<QuestNote> | NoteConflict;

type QuestRow = {
  id: string;
  visibility: ContentVisibility;
  ownerId: string;
};

function canSeeQuest(quest: QuestRow, role: MembershipRole, viewerId: string): boolean {
  return canSeeVisibility({
    role,
    visibility: quest.visibility,
    viewerId,
    ownerId: quest.ownerId,
  });
}

async function loadQuest(worldId: string, questId: string): Promise<QuestRow | null> {
  const [row] = await db
    .select({
      id: quests.id,
      visibility: quests.visibility,
      ownerId: quests.ownerId,
    })
    .from(quests)
    .where(and(eq(quests.id, questId), eq(quests.worldId, worldId)))
    .limit(1);
  return row ?? null;
}

async function loadNoteRow(questId: string) {
  const [row] = await db
    .select({
      bodyJson: questNotes.bodyJson,
      version: questNotes.version,
      updatedAt: questNotes.updatedAt,
      updatedBy: questNotes.updatedBy,
      updatedByName: users.name,
    })
    .from(questNotes)
    .leftJoin(users, eq(users.id, questNotes.updatedBy))
    .where(eq(questNotes.questId, questId))
    .limit(1);
  return row ?? null;
}

async function withMentions(
  worldId: string,
  role: MembershipRole,
  viewerId: string,
  bodyJson: unknown,
  version: number,
  updatedAt: Date | null,
  updatedBy: string | null,
  updatedByName: string | null,
): Promise<QuestNote> {
  const mentions = await resolveMentions(
    worldId,
    role,
    viewerId,
    extractMentions(asRichDoc(bodyJson)),
  );
  return { bodyJson, version, updatedAt, updatedBy, updatedByName, mentions };
}

function conflict(version: number): NoteConflict {
  return { ok: false, status: 409, error: VERSION_CONFLICT, version };
}

/**
 * APP-NOTE-NO-REL / APP-VIS-INHERIT: shared note pad for everyone who can see the quest.
 * Missing row → empty body with version 0.
 */
export async function getQuestNote(input: {
  worldId: string;
  questId: string;
  role: MembershipRole;
  viewerId: string;
}): Promise<AuthzResult<QuestNote>> {
  const quest = await loadQuest(input.worldId, input.questId);
  if (!quest || !canSeeQuest(quest, input.role, input.viewerId)) {
    return fail(404, QUEST_NOT_FOUND);
  }
  const row = await loadNoteRow(quest.id);
  if (!row) {
    return ok(await withMentions(input.worldId, input.role, input.viewerId, null, 0, null, null, null));
  }
  return ok(
    await withMentions(
      input.worldId,
      input.role,
      input.viewerId,
      row.bodyJson,
      row.version,
      row.updatedAt,
      row.updatedBy,
      row.updatedByName,
    ),
  );
}

/**
 * APP-NOTE-VERSION: save only when `version` matches; bump +1. First save creates the row.
 * APP-NOTE-NO-REL: mentions stay in the text and never become relations.
 */
export async function saveQuestNote(input: {
  actorId: string;
  worldId: string;
  questId: string;
  role: MembershipRole;
  bodyJson: unknown;
  version: number;
}): Promise<NoteSaveResult> {
  const quest = await loadQuest(input.worldId, input.questId);
  if (!quest || !canSeeQuest(quest, input.role, input.actorId)) {
    return fail(404, QUEST_NOT_FOUND);
  }

  const body = richFieldFromInput(input.bodyJson, { mentions: true });
  if (!body.ok) return body;

  const existing = await loadNoteRow(quest.id);
  const expectedVersion = existing?.version ?? 0;
  if (input.version !== expectedVersion) return conflict(expectedVersion);

  const nextVersion = expectedVersion + 1;
  const now = new Date();

  try {
    if (!existing) {
      await db.insert(questNotes).values({
        questId: quest.id,
        bodyJson: body.data.json,
        bodyPlain: body.data.plain,
        version: nextVersion,
        updatedAt: now,
        updatedBy: input.actorId,
      });
    } else {
      const updated = await db
        .update(questNotes)
        .set({
          bodyJson: body.data.json,
          bodyPlain: body.data.plain,
          version: nextVersion,
          updatedAt: now,
          updatedBy: input.actorId,
        })
        .where(and(eq(questNotes.questId, quest.id), eq(questNotes.version, expectedVersion)))
        .returning({ version: questNotes.version });
      if (updated.length === 0) {
        const current = await loadNoteRow(quest.id);
        return conflict(current?.version ?? expectedVersion);
      }
    }
  } catch (error) {
    const mapped = mapDbError(error);
    // Concurrent first insert: unique PK → treat as version conflict.
    if (mapped?.status === 409) {
      const current = await loadNoteRow(quest.id);
      if (current) return conflict(current.version);
    }
    if (mapped) return mapped;
    throw error;
  }

  const saved = await loadNoteRow(quest.id);
  return ok(
    await withMentions(
      input.worldId,
      input.role,
      input.actorId,
      saved?.bodyJson ?? body.data.json,
      saved?.version ?? nextVersion,
      saved?.updatedAt ?? now,
      saved?.updatedBy ?? input.actorId,
      saved?.updatedByName ?? null,
    ),
  );
}
