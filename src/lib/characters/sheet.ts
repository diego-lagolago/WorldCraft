/**
 * Character sheet rules (Fachmodell 3.8, datenmodell 3.8.1/3.8.2). Pure, so
 * server validation and the sheet view compute bonuses the same way.
 */

import { z } from "zod";
import { USER_MESSAGE } from "@/lib/http";

export const ATTRIBUTE_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number | null>;

export const ATTRIBUTE_SHORT: Record<AttributeKey, string> = {
  str: "STÄ",
  dex: "GES",
  con: "KON",
  int: "INT",
  wis: "WEI",
  cha: "CHA",
};

export const ATTRIBUTE_LONG: Record<AttributeKey, string> = {
  str: "Stärke",
  dex: "Geschicklichkeit",
  con: "Konstitution",
  int: "Intelligenz",
  wis: "Weisheit",
  cha: "Charisma",
};

export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 30;

export const SKILL_LEVELS = ["untalented", "untrained", "trained", "expertise"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  untalented: "untalentiert",
  untrained: "ungeübt",
  trained: "geübt",
  expertise: "Expertise",
};

export const UNTALENTED_MALUS = -4;
export const UNTRAINED_MALUS = -2;
export const PROFICIENCY_MIN = 0;
export const PROFICIENCY_MAX = 10;
export const PROFICIENCY_DEFAULT = 2;

export const CHARACTER_NAME_MAX = 120;
export const CHARACTER_CLASS_MAX = 60;
export const CHARACTER_TRAIT_MAX = 1000;
export const SKILL_NAME_MAX = 60;
export const SKILLS_MAX = 30;
export const ABILITY_TEXT_MAX = 120;
export const ABILITIES_MAX = 30;
export const IMAGE_CAPTION_MAX = 200;
export const JOURNAL_TITLE_MAX = 200;
/** TRIG-CHAR-IMAGES-MAX enforces the same limit in the database. */
export const CHARACTER_IMAGES_MAX = 10;

export type Skill = { name: string; level: SkillLevel; attr: AttributeKey };
export type Ability = { text: string; attr: AttributeKey };

export const EMPTY_ATTRIBUTES: Attributes = { str: null, dex: null, con: null, int: null, wis: null, cha: null };

export const SHEET_SKILL_REQUIRED = "Jede Fertigkeit braucht einen Namen.";
export const SHEET_ABILITY_REQUIRED = "Jede Fähigkeit braucht einen Text.";
export const SHEET_SKILLS_MAX_ERROR = `Höchstens ${SKILLS_MAX} Fertigkeiten sind erlaubt.`;
export const SHEET_ABILITIES_MAX_ERROR = `Höchstens ${ABILITIES_MAX} Fähigkeiten sind erlaubt.`;
export const duplicateSkillError = (skill: string) => `Die Fertigkeit „${skill}“ gibt es doppelt.`;
export const duplicateAbilityError = (ability: string) => `Die Fähigkeit „${ability}“ gibt es doppelt.`;

/** abgerundet((Wert − 10) / 2); an empty attribute counts as 0. */
export function attributeModifier(value: number | null | undefined): number {
  return typeof value === "number" ? Math.floor((value - 10) / 2) : 0;
}

export function skillBonus(skill: Pick<Skill, "level" | "attr">, attributes: Attributes, proficiency: number): number {
  const base = attributeModifier(attributes[skill.attr]);
  switch (skill.level) {
    case "untalented":
      return base + UNTALENTED_MALUS;
    case "untrained":
      return base + UNTRAINED_MALUS;
    case "trained":
      return base + proficiency;
    case "expertise":
      return base + 2 * proficiency;
  }
}

export function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

/** First value that appears twice ignoring case, else null. */
export function firstDuplicate(values: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.toLocaleLowerCase("de");
    if (seen.has(key)) return value;
    seen.add(key);
  }
  return null;
}

/** Shared browser-side validation for character and monster sheets. */
export function sheetLocalError(input: {
  attributes: Attributes;
  skills: readonly Skill[];
  abilities: readonly Ability[];
}): string | null {
  for (const key of ATTRIBUTE_KEYS) {
    const value = input.attributes[key];
    if (value !== null && (!Number.isInteger(value) || value < ATTRIBUTE_MIN || value > ATTRIBUTE_MAX)) {
      return `${ATTRIBUTE_LONG[key]} muss zwischen ${ATTRIBUTE_MIN} und ${ATTRIBUTE_MAX} liegen.`;
    }
  }
  if (input.skills.some((skill) => !skill.name.trim())) return SHEET_SKILL_REQUIRED;
  if (input.abilities.some((ability) => !ability.text.trim())) return SHEET_ABILITY_REQUIRED;
  const skill = firstDuplicate(input.skills.map((entry) => entry.name.trim()));
  if (skill) return duplicateSkillError(skill);
  const ability = firstDuplicate(input.abilities.map((entry) => entry.text.trim()));
  if (ability) return duplicateAbilityError(ability);
  return null;
}

const attributeKeySchema = z.enum(ATTRIBUTE_KEYS);

export const skillSchema = z.object({
  name: z.string().trim().min(1).max(SKILL_NAME_MAX),
  level: z.enum(SKILL_LEVELS),
  attr: attributeKeySchema,
});

export const abilitySchema = z.object({
  text: z.string().trim().min(1).max(ABILITY_TEXT_MAX),
  attr: attributeKeySchema,
});

export const skillsSchema = z
  .array(skillSchema)
  .max(SKILLS_MAX, SHEET_SKILLS_MAX_ERROR)
  .superRefine((skills, ctx) => {
    const duplicate = firstDuplicate(skills.map((skill) => skill.name));
    if (duplicate) {
      ctx.addIssue({
        code: "custom",
        message: duplicateSkillError(duplicate),
        params: { [USER_MESSAGE]: true },
      });
    }
  });

export const abilitiesSchema = z
  .array(abilitySchema)
  .max(ABILITIES_MAX, SHEET_ABILITIES_MAX_ERROR)
  .superRefine((abilities, ctx) => {
    const duplicate = firstDuplicate(abilities.map((ability) => ability.text));
    if (duplicate) {
      ctx.addIssue({
        code: "custom",
        message: duplicateAbilityError(duplicate),
        params: { [USER_MESSAGE]: true },
      });
    }
  });

const attributeValueSchema = z.number().int().min(ATTRIBUTE_MIN).max(ATTRIBUTE_MAX).nullable();

export const attributesSchema = z.object({
  str: attributeValueSchema,
  dex: attributeValueSchema,
  con: attributeValueSchema,
  int: attributeValueSchema,
  wis: attributeValueSchema,
  cha: attributeValueSchema,
});

/** Empty or whitespace-only text is stored as null (shared by character and monster sheets). */
function optionalSheetText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));
}

/**
 * Shared character-sheet fields (Fachmodell 3.8 without owner, images, bio).
 * Character and monster compose this with their own identity/media/bio rules.
 */
export const sheetSchema = z.object({
  class: optionalSheetText(CHARACTER_CLASS_MAX),
  attributes: attributesSchema,
  proficiencyBonus: z.number().int().min(PROFICIENCY_MIN).max(PROFICIENCY_MAX),
  skills: skillsSchema,
  abilities: abilitiesSchema,
  personality: optionalSheetText(CHARACTER_TRAIT_MAX),
  ideals: optionalSheetText(CHARACTER_TRAIT_MAX),
  bonds: optionalSheetText(CHARACTER_TRAIT_MAX),
  flaws: optionalSheetText(CHARACTER_TRAIT_MAX),
});

export type SheetFields = z.infer<typeof sheetSchema>;

/** Stored JSON is trusted only after parsing; broken rows show as empty lists. */
export function readSkills(value: unknown): Skill[] {
  const parsed = z.array(skillSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function readAbilities(value: unknown): Ability[] {
  const parsed = z.array(abilitySchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}
