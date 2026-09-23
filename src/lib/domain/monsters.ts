import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { articles, monsterDanger, monsterKind, monsterRarity, monsterSize, monsters } from "@/db/schema";
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
import {
  CHARACTER_NAME_MAX,
  PROFICIENCY_DEFAULT,
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
import { parseUuid, USER_MESSAGE } from "@/lib/http";
import { collectUnreferencedFiles } from "@/lib/files/gc";
import { mapDbError } from "./db-errors";
import { recalcMonsterRelations } from "./relations";
import { richFieldFromInput } from "./rich-field";
import { visibleContentWhere } from "./visibility-sql";

export const MONSTER_KINDS = monsterKind.enumValues;
export type MonsterKind = (typeof MONSTER_KINDS)[number];

export const MONSTER_RARITIES = monsterRarity.enumValues;
export type MonsterRarity = (typeof MONSTER_RARITIES)[number];

export const MONSTER_DANGERS = monsterDanger.enumValues;
export type MonsterDanger = (typeof MONSTER_DANGERS)[number];

export const MONSTER_SIZES = monsterSize.enumValues;
export type MonsterSize = (typeof MONSTER_SIZES)[number];

export const MONSTER_KIND_LABEL: Record<MonsterKind, string> = {
  beast: "Bestie",
  undead: "Untoter",
  demon: "Dämon",
  dragon: "Drache",
  humanoid: "Humanoid",
  construct: "Konstrukt",
  aberration: "Aberration",
  plant: "Pflanze",
  magical: "Magisch",
  other: "sonstiges",
};

/** Rarity pill labels stay English (Plan 005 Begriffe). */
export const MONSTER_RARITY_LABEL: Record<MonsterRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export const MONSTER_DANGER_LABEL: Record<MonsterDanger, string> = {
  harmless: "Harmlos",
  dangerous: "Gefährlich",
  deadly: "Tödlich",
  devastating: "Verheerend",
  divine: "Göttlich",
  apocalyptic: "Apokalyptisch",
};

export const MONSTER_SIZE_LABEL: Record<MonsterSize, string> = {
  tiny: "Winzig",
  small: "Klein",
  medium: "Durchschnitt",
  large: "Groß",
  gigantic: "Gigantisch",
};

export const monsterKindSchema = z.enum(MONSTER_KINDS);
export const monsterRaritySchema = z.enum(MONSTER_RARITIES);
export const monsterDangerSchema = z.enum(MONSTER_DANGERS);
export const monsterSizeSchema = z.enum(MONSTER_SIZES);
export const monsterNameSchema = z.string().trim().min(1).max(CHARACTER_NAME_MAX);

const NOT_FOUND = "Dieses Monster gibt es nicht.";
const HABITAT_INVALID = "Lebensraum muss ein sichtbarer Ort-Artikel dieser Welt sein.";

const monsterFields = {
  name: monsterNameSchema,
  class: sheetSchema.shape.class,
  attributes: attributesSchema.partial(),
  proficiencyBonus: sheetSchema.shape.proficiencyBonus,
  /** Length/duplicates checked in `toPatch` (422) so API Zod stays at 400 only for shape. */
  skills: z.array(skillSchema),
  abilities: z.array(abilitySchema),
  personality: sheetSchema.shape.personality,
  ideals: sheetSchema.shape.ideals,
  bonds: sheetSchema.shape.bonds,
  flaws: sheetSchema.shape.flaws,
  /** Bio allows `@` mentions (unlike characters). */
  bio: z.unknown(),
  kind: monsterKindSchema,
  rarity: monsterRaritySchema,
  isLegendary: z.boolean(),
  danger: monsterDangerSchema,
  size: monsterSizeSchema,
  habitatArticleId: z.uuid().nullable(),
  visibility: contentVisibilitySchema,
  removePortrait: z.literal(true),
};

export const monsterCreateSchema = z.object({
  name: monsterFields.name,
  class: monsterFields.class.optional(),
  attributes: monsterFields.attributes.optional(),
  proficiencyBonus: monsterFields.proficiencyBonus.optional(),
  skills: monsterFields.skills.optional(),
  abilities: monsterFields.abilities.optional(),
  personality: monsterFields.personality.optional(),
  ideals: monsterFields.ideals.optional(),
  bonds: monsterFields.bonds.optional(),
  flaws: monsterFields.flaws.optional(),
  bio: monsterFields.bio.optional(),
  kind: monsterFields.kind.optional(),
  rarity: monsterFields.rarity.optional(),
  isLegendary: monsterFields.isLegendary.optional(),
  danger: monsterFields.danger.optional(),
  size: monsterFields.size.optional(),
  habitatArticleId: monsterFields.habitatArticleId.optional(),
  visibility: monsterFields.visibility.optional(),
});

export const monsterUpdateSchema = z
  .object({
    name: monsterFields.name.optional(),
    class: monsterFields.class.optional(),
    attributes: monsterFields.attributes.optional(),
    proficiencyBonus: monsterFields.proficiencyBonus.optional(),
    skills: monsterFields.skills.optional(),
    abilities: monsterFields.abilities.optional(),
    personality: monsterFields.personality.optional(),
    ideals: monsterFields.ideals.optional(),
    bonds: monsterFields.bonds.optional(),
    flaws: monsterFields.flaws.optional(),
    bio: monsterFields.bio.optional(),
    kind: monsterFields.kind.optional(),
    rarity: monsterFields.rarity.optional(),
    isLegendary: monsterFields.isLegendary.optional(),
    danger: monsterFields.danger.optional(),
    size: monsterFields.size.optional(),
    habitatArticleId: monsterFields.habitatArticleId.optional(),
    visibility: monsterFields.visibility.optional(),
    removePortrait: monsterFields.removePortrait.optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export type MonsterCreateInput = z.infer<typeof monsterCreateSchema>;
export type MonsterUpdateInput = z.infer<typeof monsterUpdateSchema>;

export type MonsterSummary = {
  id: string;
  name: string;
  class: string | null;
  kind: MonsterKind;
  rarity: MonsterRarity;
  isLegendary: boolean;
  danger: MonsterDanger;
  size: MonsterSize;
  visibility: ContentVisibility;
  ownerId: string;
  portraitId: string | null;
  habitatArticleId: string | null;
};

export type MonsterDetails = MonsterSummary & {
  worldId: string;
  attributes: Attributes;
  proficiencyBonus: number;
  skills: Skill[];
  abilities: Ability[];
  personality: string | null;
  ideals: string | null;
  bonds: string | null;
  flaws: string | null;
  bioJson: unknown;
};

const summaryColumns = {
  id: monsters.id,
  name: monsters.name,
  class: monsters.class,
  kind: monsters.kind,
  rarity: monsters.rarity,
  isLegendary: monsters.isLegendary,
  danger: monsters.danger,
  size: monsters.size,
  visibility: monsters.visibility,
  ownerId: monsters.ownerId,
  portraitId: monsters.portraitId,
  habitatArticleId: monsters.habitatArticleId,
};

function asKind(value: string): MonsterKind {
  return (MONSTER_KINDS as readonly string[]).includes(value) ? (value as MonsterKind) : "other";
}

function asRarity(value: string): MonsterRarity {
  return (MONSTER_RARITIES as readonly string[]).includes(value) ? (value as MonsterRarity) : "common";
}

function asDanger(value: string): MonsterDanger {
  return (MONSTER_DANGERS as readonly string[]).includes(value) ? (value as MonsterDanger) : "harmless";
}

function asSize(value: string): MonsterSize {
  return (MONSTER_SIZES as readonly string[]).includes(value) ? (value as MonsterSize) : "medium";
}

function toSummary(row: {
  id: string;
  name: string;
  class: string | null;
  kind: string;
  rarity: string;
  isLegendary: boolean;
  danger: string;
  size: string;
  visibility: ContentVisibility;
  ownerId: string;
  portraitId: string | null;
  habitatArticleId: string | null;
}): MonsterSummary {
  return {
    id: row.id,
    name: row.name,
    class: row.class,
    kind: asKind(row.kind),
    rarity: asRarity(row.rarity),
    isLegendary: row.isLegendary,
    danger: asDanger(row.danger),
    size: asSize(row.size),
    visibility: row.visibility,
    ownerId: row.ownerId,
    portraitId: row.portraitId,
    habitatArticleId: row.habitatArticleId,
  };
}

/** APP-MONSTER-HABITAT: optional place article of this world, visible to the actor. */
async function resolveHabitat(
  worldId: string,
  habitatArticleId: string | null | undefined,
  viewer: { role: MembershipRole; userId: string },
): Promise<AuthzResult<string | null | undefined>> {
  if (habitatArticleId === undefined) return ok(undefined);
  if (habitatArticleId === null) return ok(null);
  if (!parseUuid(habitatArticleId)) return fail(422, HABITAT_INVALID);

  const [row] = await db
    .select({
      id: articles.id,
      templateType: articles.templateType,
      visibility: articles.visibility,
      ownerId: articles.ownerId,
    })
    .from(articles)
    .where(and(eq(articles.id, habitatArticleId), eq(articles.worldId, worldId)))
    .limit(1);

  if (
    !row ||
    row.templateType !== "place" ||
    !canSeeContent(viewer, { visibility: row.visibility, ownerId: row.ownerId })
  ) {
    return fail(422, HABITAT_INVALID);
  }
  return ok(row.id);
}

type MonsterPatch = Partial<typeof monsters.$inferInsert>;

async function toPatch(
  worldId: string,
  input: MonsterUpdateInput,
  viewer: { role: MembershipRole; userId: string },
): Promise<AuthzResult<MonsterPatch>> {
  const patch: MonsterPatch = {};
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
    const parsed = skillsSchema.safeParse(input.skills);
    if (!parsed.success) {
      const shown = parsed.error.issues.find(
        (issue) => issue.code === "custom" && issue.params?.[USER_MESSAGE],
      );
      return fail(422, shown?.message ?? "Die Eingaben sind ungültig.");
    }
    patch.skills = parsed.data;
  }
  if (input.abilities !== undefined) {
    const parsed = abilitiesSchema.safeParse(input.abilities);
    if (!parsed.success) {
      const shown = parsed.error.issues.find(
        (issue) => issue.code === "custom" && issue.params?.[USER_MESSAGE],
      );
      return fail(422, shown?.message ?? "Die Eingaben sind ungültig.");
    }
    patch.abilities = parsed.data;
  }
  if (input.personality !== undefined) patch.personality = input.personality;
  if (input.ideals !== undefined) patch.ideals = input.ideals;
  if (input.bonds !== undefined) patch.bonds = input.bonds;
  if (input.flaws !== undefined) patch.flaws = input.flaws;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.rarity !== undefined) patch.rarity = input.rarity;
  if (input.isLegendary !== undefined) patch.isLegendary = input.isLegendary;
  if (input.danger !== undefined) patch.danger = input.danger;
  if (input.size !== undefined) patch.size = input.size;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.removePortrait) patch.portraitId = null;

  if (input.bio !== undefined) {
    const bio = richFieldFromInput(input.bio, { mentions: true });
    if (!bio.ok) return bio;
    patch.bioJson = bio.data.json;
    patch.bioPlain = bio.data.plain;
  }

  if (input.habitatArticleId !== undefined) {
    const habitat = await resolveHabitat(worldId, input.habitatArticleId, viewer);
    if (!habitat.ok) return habitat;
    patch.habitatArticleId = habitat.data ?? null;
  }

  return ok(patch);
}

/** Visible monsters of a world, name A–Z; optional kind filter. */
export async function listMonsters(
  worldId: string,
  role: MembershipRole,
  viewerId: string,
  kind?: MonsterKind | "all",
): Promise<MonsterSummary[]> {
  const filters = [
    eq(monsters.worldId, worldId),
    visibleContentWhere({ visibility: monsters.visibility, ownerId: monsters.ownerId }, { role, userId: viewerId }),
  ];
  if (kind && kind !== "all") filters.push(eq(monsters.kind, kind));

  const rows = await db
    .select(summaryColumns)
    .from(monsters)
    .where(and(...filters))
    .orderBy(asc(monsters.name));
  return rows
    .filter((row) => canSeeContent({ role, userId: viewerId }, { visibility: row.visibility, ownerId: row.ownerId }))
    .map(toSummary);
}

export async function getMonster(
  worldId: string,
  monsterId: string,
  role: MembershipRole,
  viewerId: string,
): Promise<MonsterDetails | null> {
  const [row] = await db
    .select({
      ...summaryColumns,
      worldId: monsters.worldId,
      attrStr: monsters.attrStr,
      attrDex: monsters.attrDex,
      attrCon: monsters.attrCon,
      attrInt: monsters.attrInt,
      attrWis: monsters.attrWis,
      attrCha: monsters.attrCha,
      proficiencyBonus: monsters.proficiencyBonus,
      skills: monsters.skills,
      abilities: monsters.abilities,
      personality: monsters.personality,
      ideals: monsters.ideals,
      bonds: monsters.bonds,
      flaws: monsters.flaws,
      bioJson: monsters.bioJson,
    })
    .from(monsters)
    .where(and(eq(monsters.id, monsterId), eq(monsters.worldId, worldId)))
    .limit(1);
  if (
    !row ||
    !canSeeContent({ role, userId: viewerId }, { visibility: row.visibility, ownerId: row.ownerId })
  ) {
    return null;
  }
  return {
    ...toSummary(row),
    worldId: row.worldId,
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
  };
}

export async function createMonster(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
} & MonsterCreateInput): Promise<AuthzResult<{ monster: MonsterSummary }>> {
  const staff = requireStaff(input.membership);
  if (!staff.ok) return staff;
  const viewer = { role: staff.data.role, userId: staff.data.userId };
  const patch = await toPatch(input.worldId, input, viewer);
  if (!patch.ok) return patch;
  try {
    const row = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(monsters)
        .values({
          ...patch.data,
          worldId: input.worldId,
          name: input.name,
          proficiencyBonus: patch.data.proficiencyBonus ?? PROFICIENCY_DEFAULT,
          ownerId: input.actorId,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        })
        .returning(summaryColumns);
      await recalcMonsterRelations(input.worldId, input.actorId, created.id, tx);
      return created;
    });
    return ok({ monster: toSummary(row) });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function updateMonster(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  monsterId: string;
} & MonsterUpdateInput): Promise<AuthzResult<{ id: string }>> {
  const [current] = await db
    .select({
      id: monsters.id,
      portraitId: monsters.portraitId,
      ownerId: monsters.ownerId,
      visibility: monsters.visibility,
    })
    .from(monsters)
    .where(and(eq(monsters.id, input.monsterId), eq(monsters.worldId, input.worldId)))
    .limit(1);
  const allowed = authorizeOwnedContentWrite({
    membership: input.membership,
    content: current ? { ownerId: current.ownerId, visibility: current.visibility } : null,
    nextVisibility: input.visibility,
    notFoundError: NOT_FOUND,
  });
  if (!allowed.ok) return allowed;
  if (!current || !input.membership) return fail(404, NOT_FOUND);
  const patch = await toPatch(input.worldId, input, {
    role: input.membership.role,
    userId: input.membership.userId,
  });
  if (!patch.ok) return patch;
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(monsters)
        .set({ ...patch.data, updatedAt: new Date(), updatedBy: input.actorId })
        .where(eq(monsters.id, current.id));
      await recalcMonsterRelations(input.worldId, input.actorId, current.id, tx);
    });
  } catch (error) {
    const mapped = mapDbError(error);
    if (mapped) return mapped;
    throw error;
  }
  if (input.removePortrait) await collectUnreferencedFiles([current.portraitId]);
  return ok({ id: current.id });
}

export async function deleteMonster(input: {
  membership: MembershipRow | null;
  actorId: string;
  worldId: string;
  monsterId: string;
}): Promise<AuthzResult<{ id: string }>> {
  const [current] = await db
    .select({
      id: monsters.id,
      portraitId: monsters.portraitId,
      ownerId: monsters.ownerId,
      visibility: monsters.visibility,
    })
    .from(monsters)
    .where(and(eq(monsters.id, input.monsterId), eq(monsters.worldId, input.worldId)))
    .limit(1);
  const allowed = authorizeOwnedContentWrite({
    membership: input.membership,
    content: current ? { ownerId: current.ownerId, visibility: current.visibility } : null,
    notFoundError: NOT_FOUND,
  });
  if (!allowed.ok) return allowed;
  if (!current) return fail(404, NOT_FOUND);
  await db.delete(monsters).where(eq(monsters.id, current.id));
  await collectUnreferencedFiles([current.portraitId]);
  return ok({ id: current.id });
}

export function isMonsterKind(value: string): value is MonsterKind {
  return (MONSTER_KINDS as readonly string[]).includes(value);
}
