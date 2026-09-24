import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { characterImages, characters, users, worldParticipations, worlds } from "@/db/schema";
import { fail, ok, requireCharacterOwner, type AuthzResult } from "@/lib/authz";
import {
  CHARACTER_NAME_MAX,
  IMAGE_CAPTION_MAX,
  abilitiesSchema,
  abilitySchema,
  attributesSchema,
  readAbilities,
  readSkills,
  sheetSchema,
  skillSchema,
  skillsSchema,
  type Ability,
  type Attributes,
  type Skill,
} from "@/lib/characters/sheet";
import { collectUnreferencedFiles } from "@/lib/files/gc";
import { swapSingleImage } from "@/lib/files/single-image";
import { parseWithUserMessage } from "@/lib/http";
import { mapDbError } from "./db-errors";
import { richFieldFromInput } from "./rich-field";

const NOT_FOUND = "Diesen Charakter gibt es nicht.";

/** Empty or whitespace-only text is stored as null. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));
}

const characterFields = {
  name: z.string().trim().min(1).max(CHARACTER_NAME_MAX),
  class: sheetSchema.shape.class,
  attributes: attributesSchema.partial(),
  proficiencyBonus: sheetSchema.shape.proficiencyBonus,
  /** Length and duplicate rules are validated in the domain as 422. */
  skills: z.array(skillSchema),
  abilities: z.array(abilitySchema),
  personality: sheetSchema.shape.personality,
  ideals: sheetSchema.shape.ideals,
  bonds: sheetSchema.shape.bonds,
  flaws: sheetSchema.shape.flaws,
  /** APP-BIO-NO-MENTIONS: rich text without `@`. */
  bio: z.unknown(),
  removePortrait: z.literal(true),
};

export const characterCreateSchema = z.object({
  ...characterFields,
  class: characterFields.class.optional(),
  attributes: characterFields.attributes.optional(),
  proficiencyBonus: characterFields.proficiencyBonus.optional(),
  skills: characterFields.skills.optional(),
  abilities: characterFields.abilities.optional(),
  personality: characterFields.personality.optional(),
  ideals: characterFields.ideals.optional(),
  bonds: characterFields.bonds.optional(),
  flaws: characterFields.flaws.optional(),
  bio: characterFields.bio.optional(),
  removePortrait: characterFields.removePortrait.optional(),
});

export const characterUpdateSchema = characterCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export type CharacterCreateInput = z.infer<typeof characterCreateSchema>;
export type CharacterUpdateInput = z.infer<typeof characterUpdateSchema>;

export type CharacterImage = { id: string; fileId: string; caption: string | null; sortOrder: number };

export type CharacterSheet = {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  class: string | null;
  portraitId: string | null;
  attributes: Attributes;
  proficiencyBonus: number;
  skills: Skill[];
  abilities: Ability[];
  personality: string | null;
  ideals: string | null;
  bonds: string | null;
  flaws: string | null;
  bioJson: unknown;
  images: CharacterImage[];
};

export type CharacterSummary = {
  id: string;
  name: string;
  class: string | null;
  portraitId: string | null;
  ownerId: string;
  ownerName: string;
};

const summaryColumns = {
  id: characters.id,
  name: characters.name,
  class: characters.class,
  portraitId: characters.portraitId,
  ownerId: characters.ownerId,
  ownerName: users.name,
};

async function loadSheet(characterId: string): Promise<CharacterSheet | null> {
  const [row] = await db
    .select({
      ...summaryColumns,
      attrStr: characters.attrStr,
      attrDex: characters.attrDex,
      attrCon: characters.attrCon,
      attrInt: characters.attrInt,
      attrWis: characters.attrWis,
      attrCha: characters.attrCha,
      proficiencyBonus: characters.proficiencyBonus,
      skills: characters.skills,
      abilities: characters.abilities,
      personality: characters.personality,
      ideals: characters.ideals,
      bonds: characters.bonds,
      flaws: characters.flaws,
      bioJson: characters.bioJson,
    })
    .from(characters)
    .innerJoin(users, eq(users.id, characters.ownerId))
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!row) return null;
  const images = await db
    .select({
      id: characterImages.id,
      fileId: characterImages.fileId,
      caption: characterImages.caption,
      sortOrder: characterImages.sortOrder,
    })
    .from(characterImages)
    .where(eq(characterImages.characterId, characterId))
    .orderBy(asc(characterImages.sortOrder));
  return {
    id: row.id,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    name: row.name,
    class: row.class,
    portraitId: row.portraitId,
    attributes: {
      str: row.attrStr,
      dex: row.attrDex,
      con: row.attrCon,
      int: row.attrInt,
      wis: row.attrWis,
      cha: row.attrCha,
    },
    proficiencyBonus: row.proficiencyBonus,
    skills: readSkills(row.skills),
    abilities: readAbilities(row.abilities),
    personality: row.personality,
    ideals: row.ideals,
    bonds: row.bonds,
    flaws: row.flaws,
    bioJson: row.bioJson,
    images,
  };
}

/** The owner's sheet on world-independent pages; null for everyone else. */
export async function getOwnCharacter(userId: string, characterId: string): Promise<CharacterSheet | null> {
  const sheet = await loadSheet(characterId);
  return sheet && sheet.ownerId === userId ? sheet : null;
}

async function activeParticipation(worldId: string, characterId: string) {
  const [row] = await db
    .select({ id: worldParticipations.id, archivedAt: worldParticipations.archivedAt })
    .from(worldParticipations)
    .where(and(eq(worldParticipations.worldId, worldId), eq(worldParticipations.characterId, characterId)))
    .limit(1);
  return row ?? null;
}

/** Members see brought characters; an archived participation hides it from everyone (R-3.9-4). */
export async function getWorldCharacter(worldId: string, characterId: string): Promise<CharacterSheet | null> {
  const participation = await activeParticipation(worldId, characterId);
  if (!participation || participation.archivedAt) return null;
  return loadSheet(characterId);
}

export async function listWorldCharacters(worldId: string): Promise<CharacterSummary[]> {
  return db
    .select(summaryColumns)
    .from(worldParticipations)
    .innerJoin(characters, eq(characters.id, worldParticipations.characterId))
    .innerJoin(users, eq(users.id, characters.ownerId))
    .where(and(eq(worldParticipations.worldId, worldId), isNull(worldParticipations.archivedAt)))
    .orderBy(asc(characters.name));
}

export type OwnCharacter = CharacterSummary & {
  worlds: { worldId: string; worldName: string; archived: boolean }[];
};

export async function listMyCharacters(userId: string): Promise<OwnCharacter[]> {
  const rows = await db
    .select(summaryColumns)
    .from(characters)
    .innerJoin(users, eq(users.id, characters.ownerId))
    .where(eq(characters.ownerId, userId))
    .orderBy(asc(characters.name));
  if (rows.length === 0) return [];
  const participations = await db
    .select({
      characterId: worldParticipations.characterId,
      worldId: worlds.id,
      worldName: worlds.name,
      archivedAt: worldParticipations.archivedAt,
    })
    .from(worldParticipations)
    .innerJoin(worlds, eq(worlds.id, worldParticipations.worldId))
    .where(inArray(worldParticipations.characterId, rows.map((row) => row.id)))
    .orderBy(asc(worlds.name));
  return rows.map((row) => ({
    ...row,
    worlds: participations
      .filter((entry) => entry.characterId === row.id)
      .map((entry) => ({ worldId: entry.worldId, worldName: entry.worldName, archived: entry.archivedAt !== null })),
  }));
}

type CharacterPatch = Partial<typeof characters.$inferInsert>;

function toPatch(input: CharacterUpdateInput): AuthzResult<CharacterPatch> {
  const patch: CharacterPatch = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.class !== undefined) patch.class = input.class;
  if (input.attributes) {
    const a = input.attributes;
    if (a.str !== undefined) patch.attrStr = a.str;
    if (a.dex !== undefined) patch.attrDex = a.dex;
    if (a.con !== undefined) patch.attrCon = a.con;
    if (a.int !== undefined) patch.attrInt = a.int;
    if (a.wis !== undefined) patch.attrWis = a.wis;
    if (a.cha !== undefined) patch.attrCha = a.cha;
  }
  if (input.proficiencyBonus !== undefined) patch.proficiencyBonus = input.proficiencyBonus;
  if (input.skills !== undefined) {
    const parsed = parseWithUserMessage(skillsSchema, input.skills);
    if (!parsed.ok) return fail(422, parsed.error);
    patch.skills = parsed.data;
  }
  if (input.abilities !== undefined) {
    const parsed = parseWithUserMessage(abilitiesSchema, input.abilities);
    if (!parsed.ok) return fail(422, parsed.error);
    patch.abilities = parsed.data;
  }
  if (input.personality !== undefined) patch.personality = input.personality;
  if (input.ideals !== undefined) patch.ideals = input.ideals;
  if (input.bonds !== undefined) patch.bonds = input.bonds;
  if (input.flaws !== undefined) patch.flaws = input.flaws;
  if (input.bio !== undefined) {
    const bio = richFieldFromInput(input.bio, { mentions: false });
    if (!bio.ok) return bio;
    patch.bioJson = bio.data.json;
    patch.bioPlain = bio.data.plain;
  }
  return ok(patch);
}

/** A new character starts with empty skill and ability lists (datenmodell 3.8.1/3.8.2). */
export async function createCharacter(ownerId: string, input: CharacterCreateInput): Promise<AuthzResult<{ id: string }>> {
  const patch = toPatch(input);
  if (!patch.ok) return patch;
  try {
    const [row] = await db
      .insert(characters)
      .values({ ...patch.data, name: input.name, ownerId, createdBy: ownerId, updatedBy: ownerId })
      .returning({ id: characters.id });
    return ok(row);
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

async function loadOwned(actorId: string, characterId: string) {
  const [row] = await db
    .select({ id: characters.id, ownerId: characters.ownerId, portraitId: characters.portraitId })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!row) return fail(404, NOT_FOUND);
  const owner = requireCharacterOwner(actorId, row.ownerId);
  if (!owner.ok) return owner;
  return ok(row);
}

export async function updateCharacter(
  actorId: string,
  characterId: string,
  input: CharacterUpdateInput,
): Promise<AuthzResult<{ id: string }>> {
  const owned = await loadOwned(actorId, characterId);
  if (!owned.ok) return owned;
  const patch = toPatch(input);
  if (!patch.ok) return patch;
  try {
    await db
      .update(characters)
      .set({ ...patch.data, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(characters.id, characterId));
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
  if (input.removePortrait) {
    const previousImage = await swapSingleImage({
      kind: "character_portrait",
      targetId: characterId,
      fileId: null,
      actorId,
    });
    await collectUnreferencedFiles([previousImage]);
  }
  return ok({ id: characterId });
}

/** Cascades to participations, markers, journal, relations and images (datenmodell §9). */
export async function deleteCharacter(actorId: string, characterId: string): Promise<AuthzResult<{ id: string }>> {
  const owned = await loadOwned(actorId, characterId);
  if (!owned.ok) return owned;
  const images = await db
    .select({ id: characterImages.fileId })
    .from(characterImages)
    .where(eq(characterImages.characterId, characterId));
  await db.delete(characters).where(eq(characters.id, characterId));
  await collectUnreferencedFiles([owned.data.portraitId, ...images.map((image) => image.id)]);
  return ok({ id: characterId });
}

/**
 * APP-PART-REACTIVATE: insert, or clear `archived_at` of the old participation.
 * The owner must be an active member (checked by the caller and TRIG-PART-OWNER-MEMBER).
 */
export async function bringCharacter(input: {
  actorId: string;
  worldId: string;
  characterId: string;
}): Promise<AuthzResult<{ participationId: string; brought: boolean }>> {
  const owned = await loadOwned(input.actorId, input.characterId);
  if (!owned.ok) return owned;
  const now = new Date();
  try {
    const rows = await db
      .insert(worldParticipations)
      .values({
        characterId: input.characterId,
        worldId: input.worldId,
        broughtAt: now,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })
      .onConflictDoUpdate({
        target: [worldParticipations.characterId, worldParticipations.worldId],
        set: { archivedAt: null, broughtAt: now, updatedAt: now, updatedBy: input.actorId },
        setWhere: sql`${worldParticipations.archivedAt} IS NOT NULL`,
      })
      .returning({ id: worldParticipations.id });
    if (rows.length > 0) return ok({ participationId: rows[0].id, brought: true });
    const existing = await activeParticipation(input.worldId, input.characterId);
    return ok({ participationId: existing?.id ?? "", brought: false });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export const imageUpdateSchema = z
  .object({
    caption: optionalText(IMAGE_CAPTION_MAX).optional(),
    move: z.enum(["up", "down"]).optional(),
  })
  .refine((value) => value.caption !== undefined || value.move !== undefined);

async function loadImage(characterId: string, imageId: string) {
  const [row] = await db
    .select({ id: characterImages.id, fileId: characterImages.fileId, sortOrder: characterImages.sortOrder })
    .from(characterImages)
    .where(and(eq(characterImages.id, imageId), eq(characterImages.characterId, characterId)))
    .limit(1);
  return row ?? null;
}

/** Caption and order; swapping goes through a free slot because (character, sort_order) is unique. */
export async function updateCharacterImage(input: {
  actorId: string;
  characterId: string;
  imageId: string;
  caption?: string | null;
  move?: "up" | "down";
}): Promise<AuthzResult<{ id: string }>> {
  const owned = await loadOwned(input.actorId, input.characterId);
  if (!owned.ok) return owned;
  const image = await loadImage(input.characterId, input.imageId);
  if (!image) return fail(404, "Dieses Bild gibt es nicht.");
  const stamp = { updatedAt: new Date(), updatedBy: input.actorId };

  if (input.caption !== undefined) {
    await db.update(characterImages).set({ caption: input.caption, ...stamp }).where(eq(characterImages.id, image.id));
  }
  if (input.move) {
    const images = await db
      .select({ id: characterImages.id, sortOrder: characterImages.sortOrder })
      .from(characterImages)
      .where(eq(characterImages.characterId, input.characterId))
      .orderBy(asc(characterImages.sortOrder));
    const index = images.findIndex((entry) => entry.id === image.id);
    const neighbour = images[input.move === "up" ? index - 1 : index + 1];
    if (neighbour) {
      try {
        await swapImageOrder(image, neighbour, stamp);
      } catch (error) {
        const mapped = mapDbError(error, { unique: "Die Reihenfolge hat sich gerade geändert. Bitte erneut versuchen." });
        if (mapped) return mapped;
        throw error;
      }
    }
  }
  return ok({ id: image.id });
}

function swapImageOrder(
  image: { id: string; sortOrder: number },
  neighbour: { id: string; sortOrder: number },
  stamp: { updatedAt: Date; updatedBy: string },
) {
  return db.transaction(async (tx) => {
    await tx.update(characterImages).set({ sortOrder: -1 }).where(eq(characterImages.id, image.id));
    await tx
      .update(characterImages)
      .set({ sortOrder: image.sortOrder, ...stamp })
      .where(eq(characterImages.id, neighbour.id));
    await tx
      .update(characterImages)
      .set({ sortOrder: neighbour.sortOrder, ...stamp })
      .where(eq(characterImages.id, image.id));
  });
}

export async function deleteCharacterImage(input: {
  actorId: string;
  characterId: string;
  imageId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const owned = await loadOwned(input.actorId, input.characterId);
  if (!owned.ok) return owned;
  const image = await loadImage(input.characterId, input.imageId);
  if (!image) return fail(404, "Dieses Bild gibt es nicht.");
  await db.delete(characterImages).where(eq(characterImages.id, image.id));
  await collectUnreferencedFiles([image.fileId]);
  return ok({ id: image.id });
}
