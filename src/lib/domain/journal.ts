import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { characters, journalEntries, worldParticipations } from "@/db/schema";
import {
  JOURNAL_VISIBILITIES,
  authorizeJournalWrite,
  canSeeJournal,
  fail,
  isStaff,
  ok,
  type AuthzResult,
  type JournalVisibility,
  type MembershipRole,
} from "@/lib/authz";
import { JOURNAL_TITLE_MAX } from "@/lib/characters/sheet";
import { mapDbError } from "./db-errors";
import { richFieldFromInput } from "./rich-field";

const NOT_FOUND = "Diesen Tagebucheintrag gibt es nicht.";
const BODY_REQUIRED = "Der Eintrag braucht einen Inhalt.";

const titleSchema = z
  .string()
  .trim()
  .max(JOURNAL_TITLE_MAX)
  .nullable()
  .transform((value) => (value ? value : null));

export const journalCreateSchema = z.object({
  title: titleSchema.optional(),
  body: z.unknown(),
  visibility: z.enum(JOURNAL_VISIBILITIES).optional(),
});

export const journalUpdateSchema = journalCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export type JournalEntry = {
  id: string;
  characterId: string;
  title: string | null;
  bodyJson: unknown;
  visibility: JournalVisibility;
  createdAt: Date;
  updatedAt: Date;
};

async function characterInWorld(worldId: string, characterId: string) {
  const [row] = await db
    .select({
      ownerId: characters.ownerId,
      participationId: worldParticipations.id,
      archivedAt: worldParticipations.archivedAt,
    })
    .from(characters)
    .leftJoin(
      worldParticipations,
      and(eq(worldParticipations.characterId, characters.id), eq(worldParticipations.worldId, worldId)),
    )
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!row) return null;
  return { ownerId: row.ownerId, participation: row.participationId ? { archivedAt: row.archivedAt } : null };
}

/**
 * Entries of one character in one world the viewer may read: the owner all,
 * staff only shared ones, nobody when the participation is archived.
 */
export async function listJournal(input: {
  worldId: string;
  characterId: string;
  viewerId: string;
  role: MembershipRole;
}): Promise<AuthzResult<JournalEntry[]>> {
  const character = await characterInWorld(input.worldId, input.characterId);
  if (!character?.participation || character.participation.archivedAt) {
    return fail(404, "Dieser Charakter ist nicht in dieser Welt.");
  }

  const filters = [
    eq(journalEntries.worldId, input.worldId),
    eq(journalEntries.characterId, input.characterId),
  ];
  if (input.viewerId === character.ownerId) {
    // Owner sees every entry of this character.
  } else if (isStaff(input.role)) {
    filters.push(eq(journalEntries.visibility, "shared_with_gm"));
  } else {
    return ok([]);
  }

  const rows = await db
    .select({
      id: journalEntries.id,
      characterId: journalEntries.characterId,
      title: journalEntries.title,
      bodyJson: journalEntries.bodyJson,
      visibility: journalEntries.visibility,
      createdAt: journalEntries.createdAt,
      updatedAt: journalEntries.updatedAt,
    })
    .from(journalEntries)
    .where(and(...filters))
    .orderBy(desc(journalEntries.createdAt));
  return ok(
    rows.filter((row) =>
      canSeeJournal({
        actorId: input.viewerId,
        role: input.role,
        ownerId: character.ownerId,
        visibility: row.visibility,
        participationArchived: false,
      }),
    ),
  );
}

function bodyFrom(input: unknown): AuthzResult<{ json: unknown; plain: string }> {
  const body = richFieldFromInput(input, { mentions: true });
  if (!body.ok) return body;
  if (!body.data.json || !body.data.plain) return fail(400, BODY_REQUIRED);
  return ok({ json: body.data.json, plain: body.data.plain });
}

/** APP-JOURNAL-NO-REL: mentions stay in the text and never become relations. */
export async function createJournalEntry(input: {
  actorId: string;
  worldId: string;
  characterId: string;
  title?: string | null;
  body: unknown;
  visibility?: JournalVisibility;
}): Promise<AuthzResult<{ id: string }>> {
  const character = await characterInWorld(input.worldId, input.characterId);
  if (!character) return fail(404, "Diesen Charakter gibt es nicht.");
  const allowed = authorizeJournalWrite({
    actorId: input.actorId,
    ownerId: character.ownerId,
    participation: character.participation,
  });
  if (!allowed.ok) return allowed;
  const body = bodyFrom(input.body);
  if (!body.ok) return body;
  try {
    const [row] = await db
      .insert(journalEntries)
      .values({
        characterId: input.characterId,
        worldId: input.worldId,
        title: input.title ?? null,
        bodyJson: body.data.json,
        bodyPlain: body.data.plain,
        visibility: input.visibility ?? "private",
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })
      .returning({ id: journalEntries.id });
    return ok(row);
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

async function loadEntryForWrite(actorId: string, worldId: string, entryId: string) {
  const [entry] = await db
    .select({ id: journalEntries.id, characterId: journalEntries.characterId })
    .from(journalEntries)
    .where(and(eq(journalEntries.id, entryId), eq(journalEntries.worldId, worldId)))
    .limit(1);
  if (!entry) return fail(404, NOT_FOUND);
  const character = await characterInWorld(worldId, entry.characterId);
  if (!character || character.ownerId !== actorId) return fail(404, NOT_FOUND);
  const allowed = authorizeJournalWrite({ actorId, ownerId: character.ownerId, participation: character.participation });
  if (!allowed.ok) return allowed;
  return ok(entry);
}

/** Owner only; the visibility pill sends `{ visibility }` after the confirmation dialog. */
export async function updateJournalEntry(input: {
  actorId: string;
  worldId: string;
  entryId: string;
  title?: string | null;
  body?: unknown;
  visibility?: JournalVisibility;
}): Promise<AuthzResult<{ id: string }>> {
  const entry = await loadEntryForWrite(input.actorId, input.worldId, input.entryId);
  if (!entry.ok) return entry;
  const patch: Partial<typeof journalEntries.$inferInsert> = { updatedAt: new Date(), updatedBy: input.actorId };
  if (input.title !== undefined) patch.title = input.title;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.body !== undefined) {
    const body = bodyFrom(input.body);
    if (!body.ok) return body;
    patch.bodyJson = body.data.json;
    patch.bodyPlain = body.data.plain;
  }
  await db.update(journalEntries).set(patch).where(eq(journalEntries.id, entry.data.id));
  return ok({ id: entry.data.id });
}

export async function deleteJournalEntry(input: {
  actorId: string;
  worldId: string;
  entryId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const entry = await loadEntryForWrite(input.actorId, input.worldId, input.entryId);
  if (!entry.ok) return entry;
  await db.delete(journalEntries).where(eq(journalEntries.id, entry.data.id));
  return ok({ id: entry.data.id });
}
