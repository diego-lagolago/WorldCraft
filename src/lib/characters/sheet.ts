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
  .max(SKILLS_MAX)
  .superRefine((skills, ctx) => {
    const duplicate = firstDuplicate(skills.map((skill) => skill.name));
    if (duplicate) {
      ctx.addIssue({
        code: "custom",
        message: `Die Fertigkeit „${duplicate}“ gibt es doppelt.`,
        params: { [USER_MESSAGE]: true },
      });
    }
  });

export const abilitiesSchema = z
  .array(abilitySchema)
  .max(ABILITIES_MAX)
  .superRefine((abilities, ctx) => {
    const duplicate = firstDuplicate(abilities.map((ability) => ability.text));
    if (duplicate) {
      ctx.addIssue({
        code: "custom",
        message: `Die Fähigkeit „${duplicate}“ gibt es doppelt.`,
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

/** Stored JSON is trusted only after parsing; broken rows show as empty lists. */
export function readSkills(value: unknown): Skill[] {
  const parsed = z.array(skillSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function readAbilities(value: unknown): Ability[] {
  const parsed = z.array(abilitySchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}
