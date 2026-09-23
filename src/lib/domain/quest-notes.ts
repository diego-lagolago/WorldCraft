import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { questNotes, users } from "@/db/schema";
import {
  fail,
  ok,
  type AuthzResult,
  type MembershipRole,
} from "@/lib/authz";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import { mapDbError } from "./db-errors";
import { resolveMentions, type ResolvedMention } from "./mention-resolve";
import { loadVisibleQuest, type QuestAccessRow } from "./quest-access";
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

type QuestNoteRow = {
  bodyJson: unknown;
  version: number;
  updatedAt: Date | null;
  updatedBy: string | null;
  updatedByName: string | null;
};

const EMPTY_NOTE_ROW: QuestNoteRow = {
  bodyJson: null,
  version: 0,
  updatedAt: null,
  updatedBy: null,
  updatedByName: null,
};

type NoteViewer = {
  role: MembershipRole;
  viewerId: string;
};

async function loadNoteRow(questId: string): Promise<QuestNoteRow | null> {
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
  viewer: NoteViewer,
  row: QuestNoteRow,
): Promise<QuestNote> {
  const mentions = await resolveMentions(
    worldId,
    viewer.role,
    viewer.viewerId,
    extractMentions(asRichDoc(row.bodyJson)),
  );
  return {
    bodyJson: row.bodyJson,
    version: row.version,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    updatedByName: row.updatedByName,
    mentions,
  };
}

export type QuestNoteClient = {
  bodyJson: unknown;
  version: number;
  updatedAt: string | null;
  updatedByName: string | null;
  mentions: Record<string, ResolvedMention>;
};

/** ISO date strings for JSON and SSR props; convert once at the server boundary. */
export function serializeQuestNoteClient(note: QuestNote): QuestNoteClient {
  return {
    bodyJson: note.bodyJson,
    version: note.version,
    updatedAt: note.updatedAt ? note.updatedAt.toISOString() : null,
    updatedByName: note.updatedByName,
    mentions: note.mentions,
  };
}

function conflict(version: number): NoteConflict {
  return { ok: false, status: 409, error: VERSION_CONFLICT, version };
}

/** Load note for a quest that is already visibility-checked. */
export async function getQuestNoteForQuest(input: {
  worldId: string;
  quest: QuestAccessRow;
  role: MembershipRole;
  viewerId: string;
}): Promise<AuthzResult<QuestNote>> {
  const row = await loadNoteRow(input.quest.id);
  return ok(
    await withMentions(
      input.worldId,
      { role: input.role, viewerId: input.viewerId },
      row ?? EMPTY_NOTE_ROW,
    ),
  );
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
  /** When set, skips loading and checking the quest row. */
  quest?: QuestAccessRow;
}): Promise<AuthzResult<QuestNote>> {
  const quest =
    input.quest ??
    (await loadVisibleQuest(input.worldId, input.questId, {
      role: input.role,
      userId: input.viewerId,
    }));
  if (!quest) return fail(404, QUEST_NOT_FOUND);
  return getQuestNoteForQuest({
    worldId: input.worldId,
    quest,
    role: input.role,
    viewerId: input.viewerId,
  });
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
  const quest = await loadVisibleQuest(input.worldId, input.questId, {
    role: input.role,
    userId: input.actorId,
  });
  if (!quest) return fail(404, QUEST_NOT_FOUND);

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
  const row: QuestNoteRow = saved ?? {
    bodyJson: body.data.json,
    version: nextVersion,
    updatedAt: now,
    updatedBy: input.actorId,
    updatedByName: null,
  };
  return ok(
    await withMentions(input.worldId, { role: input.role, viewerId: input.actorId }, row),
  );
}
