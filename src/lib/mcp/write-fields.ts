import { allowedList, McpToolError } from "./errors";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LONG,
  ATTRIBUTE_SHORT,
  SKILL_LEVEL_LABEL,
  SKILL_LEVELS,
  type AttributeKey,
  type SkillLevel,
} from "@/lib/characters/sheet";
import {
  MONSTER_DANGER_LABEL,
  MONSTER_DANGERS,
  MONSTER_KIND_LABEL,
  MONSTER_KINDS,
  MONSTER_RARITY_LABEL,
  MONSTER_RARITIES,
  MONSTER_SIZE_LABEL,
  MONSTER_SIZES,
  type MonsterDanger,
  type MonsterKind,
  type MonsterRarity,
  type MonsterSize,
} from "@/lib/monsters/labels";
import { templateOf, type TemplateType } from "@/lib/templates/registry";
import { MCP_NOT_SET } from "./enums";

const QUEST_ITEM_ALIASES = new Set(["quest", "Quest", "Quest-Gegenstand"]);

function invertLabels<T extends string>(labels: Record<T, string>): Map<string, T> {
  const map = new Map<string, T>();
  for (const [value, label] of Object.entries(labels) as [T, string][]) {
    map.set(label.toLocaleLowerCase("de"), value);
    map.set(value.toLocaleLowerCase("de"), value);
  }
  return map;
}

const KIND_BY_LABEL = invertLabels(MONSTER_KIND_LABEL);
const RARITY_BY_LABEL = invertLabels(MONSTER_RARITY_LABEL);
const DANGER_BY_LABEL = invertLabels(MONSTER_DANGER_LABEL);
const SIZE_BY_LABEL = invertLabels(MONSTER_SIZE_LABEL);
const SKILL_LEVEL_BY_LABEL = invertLabels(SKILL_LEVEL_LABEL);

const ATTR_BY_LABEL = new Map<string, AttributeKey>();
for (const key of ATTRIBUTE_KEYS) {
  ATTR_BY_LABEL.set(key, key);
  ATTR_BY_LABEL.set(ATTRIBUTE_SHORT[key].toLocaleLowerCase("de"), key);
  ATTR_BY_LABEL.set(ATTRIBUTE_LONG[key].toLocaleLowerCase("de"), key);
}

function invalidValue(path: string, raw: unknown, allowed: readonly string[]) {
  const problem = typeof raw === "string" && raw.trim() ? `hat den ungültigen Wert „${raw}“` : "fehlt oder ist kein Text";
  return new McpToolError(`Feld „${path}“ ${problem}. Erlaubte Werte: ${allowedList(allowed)}.`);
}

function lookupEnum<T extends string>(map: Map<string, T>, raw: unknown, key: string, labels: Record<T, string>): T {
  const value = typeof raw === "string" ? map.get(raw.trim().toLocaleLowerCase("de")) : undefined;
  if (!value) throw invalidValue(`felder.${key}`, raw, Object.values(labels));
  return value;
}

/**
 * Registry keys a client explicitly cleared in `vorlagenfelder` (null, "", „–“, or false for Ja/Nein).
 * `inhalt_aendern` changes only the named template fields and keeps the others (012 T-007).
 */
export function clearedTemplateFieldKeys(templateType: TemplateType, raw: unknown): Set<string> {
  const cleared = new Set<string>();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return cleared;
  const definition = templateOf(templateType);
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(value === null || value === "" || value === MCP_NOT_SET || value === false)) continue;
    if (definition.type === "item" && QUEST_ITEM_ALIASES.has(key)) {
      cleared.add("quest");
      continue;
    }
    const field = definition.fields.find(
      (candidate) => candidate.key === key || candidate.label.localeCompare(key, "de", { sensitivity: "accent" }) === 0,
    );
    if (field) cleared.add(field.key);
  }
  return cleared;
}

/** Accepts German labels or English registry keys; unknown keys are errors (S11). */
export function normalizeTemplateFieldsInput(
  templateType: TemplateType,
  raw: unknown,
): Record<string, unknown> {
  if (raw === undefined || raw === null) return {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new McpToolError("Feld „felder.vorlagenfelder“ muss ein Objekt sein.");
  }
  const input = raw as Record<string, unknown>;
  const definition = templateOf(templateType);
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "" || value === MCP_NOT_SET) continue;
    if (definition.type === "item" && QUEST_ITEM_ALIASES.has(key)) {
      if (typeof value !== "boolean") throw new McpToolError("Feld „felder.vorlagenfelder.Quest-Gegenstand“ muss true oder false sein.");
      if (value) out.quest = true;
      continue;
    }
    const field = definition.fields.find(
      (candidate) => candidate.key === key || candidate.label.localeCompare(key, "de", { sensitivity: "accent" }) === 0,
    );
    if (!field) {
      const valid = [...definition.fields.map((entry) => entry.label), ...(definition.type === "item" ? ["Quest-Gegenstand"] : [])];
      throw new McpToolError(`Unbekanntes Feld „felder.vorlagenfelder.${key}“. Gültige Vorlagenfelder für diesen Vorlagentyp: ${valid.join(", ") || "keine"}.`);
    }
    const path = `felder.vorlagenfelder.${field.label}`;
    if (field.type === "boolean") {
      if (typeof value !== "boolean") throw new McpToolError(`Feld „${path}“ muss true oder false sein.`);
      if (value) out[field.key] = true;
      continue;
    }
    if (field.type === "text") {
      if (typeof value !== "string") throw new McpToolError(`Feld „${path}“ muss Text sein.`);
      out[field.key] = value;
      continue;
    }
    if (field.type === "select") {
      const option = typeof value === "string" ? field.options.find(
        (entry) => entry.value === value || entry.label.localeCompare(value, "de", { sensitivity: "accent" }) === 0,
      ) : undefined;
      if (!option) throw invalidValue(path, value, field.options.map((entry) => entry.label));
      out[field.key] = option.value;
      continue;
    }
    // refs stay as mention strings (or already {kind,id}) for later resolution
    out[field.key] = value;
  }
  return out;
}

export type NormalizedMonsterSheet = {
  class?: string;
  attributes?: Partial<Record<AttributeKey, number>>;
  proficiencyBonus?: number;
  skills?: { name: string; level: SkillLevel; attr: AttributeKey }[];
  abilities?: { text: string; attr: AttributeKey }[];
  personality?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
};

export const MCP_SHEET_FIELDS = [
  { key: "klasse", label: "Klasse" },
  { key: "attribute", label: "Attribute" },
  { key: "uebungsbonus", label: "Übungsbonus" },
  { key: "fertigkeiten", label: "Fertigkeiten" },
  { key: "faehigkeiten", label: "Fähigkeiten" },
  { key: "persoenlichkeit", label: "Persönlichkeitsmerkmale" },
  { key: "ideale", label: "Ideale" },
  { key: "bindungen", label: "Bindungen" },
  { key: "schwaechen", label: "Makel" },
] as const;

export const SHEET_KEY_MAP: Record<string, keyof NormalizedMonsterSheet | "attributes" | "skills" | "abilities"> = {
  klasse: "class",
  class: "class",
  attribute: "attributes",
  attributes: "attributes",
  uebungsbonus: "proficiencyBonus",
  übungsbonus: "proficiencyBonus",
  proficiencybonus: "proficiencyBonus",
  fertigkeiten: "skills",
  skills: "skills",
  faehigkeiten: "abilities",
  fähigkeiten: "abilities",
  abilities: "abilities",
  persoenlichkeit: "personality",
  persönlichkeit: "personality",
  personality: "personality",
  ideale: "ideals",
  ideals: "ideals",
  bindungen: "bonds",
  bonds: "bonds",
  schwaechen: "flaws",
  schwächen: "flaws",
  flaws: "flaws",
};

function mapAttributeKey(raw: string): AttributeKey {
  const key = ATTR_BY_LABEL.get(raw.trim().toLocaleLowerCase("de"));
  if (!key) throw invalidValue("felder.charakterblatt.attribute", raw, ATTRIBUTE_KEYS.map((entry) => ATTRIBUTE_SHORT[entry]));
  return key;
}

function mapSkillLevel(raw: unknown): SkillLevel {
  const level = typeof raw === "string" ? SKILL_LEVEL_BY_LABEL.get(raw.trim().toLocaleLowerCase("de")) : undefined;
  if (!level) throw invalidValue("felder.charakterblatt.fertigkeiten.stufe", raw, SKILL_LEVELS.map((entry) => SKILL_LEVEL_LABEL[entry]));
  return level;
}

/** Maps German MCP charakterblatt keys onto monsterCreateSchema fields (S12). */
export function normalizeMonsterSheet(raw: unknown): NormalizedMonsterSheet {
  if (raw === undefined || raw === null) return {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new McpToolError("Feld „felder.charakterblatt“ muss ein Objekt sein.");
  }
  const out: NormalizedMonsterSheet = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const mapped = SHEET_KEY_MAP[key.toLocaleLowerCase("de")];
    if (!mapped) {
      throw new McpToolError(`Unbekanntes Feld „felder.charakterblatt.${key}“. Gültige Felder: ${MCP_SHEET_FIELDS.map((entry) => entry.key).join(", ")}.`);
    }
    if (mapped === "class" || mapped === "personality" || mapped === "ideals" || mapped === "bonds" || mapped === "flaws") {
      if (typeof value !== "string") throw new McpToolError(`Feld „felder.charakterblatt.${key}“ muss Text sein.`);
      out[mapped] = value;
      continue;
    }
    if (mapped === "proficiencyBonus") {
      if (typeof value !== "number") throw new McpToolError(`Feld „felder.charakterblatt.${key}“ muss eine Zahl sein.`);
      out.proficiencyBonus = value;
      continue;
    }
    if (mapped === "attributes") {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new McpToolError(`Feld „felder.charakterblatt.${key}“ muss ein Objekt sein, z. B. { "STR": 12 }.`);
      }
      const attributes: Partial<Record<AttributeKey, number>> = {};
      for (const [attrKey, attrValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof attrValue !== "number") throw new McpToolError(`Feld „felder.charakterblatt.${key}.${attrKey}“ muss eine Zahl sein.`);
        attributes[mapAttributeKey(attrKey)] = attrValue;
      }
      out.attributes = attributes;
      continue;
    }
    if (mapped === "skills") {
      if (!Array.isArray(value)) throw new McpToolError(`Feld „felder.charakterblatt.${key}“ muss eine Liste sein.`);
      out.skills = value.map((entry) => {
        if (!entry || typeof entry !== "object") throw new McpToolError("Fertigkeit muss ein Objekt sein.");
        const row = entry as Record<string, unknown>;
        const nameValue = typeof row.name === "string" ? row.name : typeof row.titel === "string" ? row.titel : null;
        if (!nameValue) throw new McpToolError("Jede Fertigkeit braucht einen Namen.");
        const levelRaw = row.stufe ?? row.level;
        const attrRaw = row.attribut ?? row.attr;
        if (typeof attrRaw !== "string") throw new McpToolError("Jede Fertigkeit braucht ein Attribut.");
        return { name: nameValue, level: mapSkillLevel(levelRaw), attr: mapAttributeKey(attrRaw) };
      });
      continue;
    }
    if (mapped === "abilities") {
      if (!Array.isArray(value)) throw new McpToolError(`Feld „felder.charakterblatt.${key}“ muss eine Liste sein.`);
      out.abilities = value.map((entry) => {
        if (!entry || typeof entry !== "object") throw new McpToolError("Fähigkeit muss ein Objekt sein.");
        const row = entry as Record<string, unknown>;
        const text = typeof row.text === "string" ? row.text : null;
        const attrRaw = row.attribut ?? row.attr;
        if (!text) throw new McpToolError("Jede Fähigkeit braucht einen Text.");
        if (typeof attrRaw !== "string") throw new McpToolError("Jede Fähigkeit braucht ein Attribut.");
        return { text, attr: mapAttributeKey(attrRaw) };
      });
    }
  }
  return out;
}

export function mapMonsterKind(raw: unknown): MonsterKind | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  return lookupEnum(KIND_BY_LABEL, raw, "monster_art", MONSTER_KIND_LABEL);
}

export function mapMonsterRarity(raw: unknown): MonsterRarity | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  return lookupEnum(RARITY_BY_LABEL, raw, "seltenheit", MONSTER_RARITY_LABEL);
}

export function mapMonsterDanger(raw: unknown): MonsterDanger | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  return lookupEnum(DANGER_BY_LABEL, raw, "gefahr", MONSTER_DANGER_LABEL);
}

export function mapMonsterSize(raw: unknown): MonsterSize | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  return lookupEnum(SIZE_BY_LABEL, raw, "groesse", MONSTER_SIZE_LABEL);
}

/**
 * Monster select fields always hold a value; when changing one, an empty value is an error with
 * path and allowed values instead of „nicht gesetzt“ (011 Review 2 CR-001).
 */
export const requiredMonsterEnum = {
  monster_art: (raw: unknown) => lookupEnum(KIND_BY_LABEL, raw, "monster_art", MONSTER_KIND_LABEL),
  seltenheit: (raw: unknown) => lookupEnum(RARITY_BY_LABEL, raw, "seltenheit", MONSTER_RARITY_LABEL),
  gefahr: (raw: unknown) => lookupEnum(DANGER_BY_LABEL, raw, "gefahr", MONSTER_DANGER_LABEL),
  groesse: (raw: unknown) => lookupEnum(SIZE_BY_LABEL, raw, "groesse", MONSTER_SIZE_LABEL),
};

/** Completeness guard for S12 / D14-style enum coverage. */
export const MCP_WRITE_ENUMS_COMPLETE = {
  kinds: MONSTER_KINDS.every((kind) => KIND_BY_LABEL.has(MONSTER_KIND_LABEL[kind].toLocaleLowerCase("de"))),
  rarities: MONSTER_RARITIES.every((rarity) => RARITY_BY_LABEL.has(MONSTER_RARITY_LABEL[rarity].toLocaleLowerCase("de"))),
  dangers: MONSTER_DANGERS.every((danger) => DANGER_BY_LABEL.has(MONSTER_DANGER_LABEL[danger].toLocaleLowerCase("de"))),
  sizes: MONSTER_SIZES.every((size) => SIZE_BY_LABEL.has(MONSTER_SIZE_LABEL[size].toLocaleLowerCase("de"))),
  skillLevels: SKILL_LEVELS.every((level) => SKILL_LEVEL_BY_LABEL.has(SKILL_LEVEL_LABEL[level].toLocaleLowerCase("de"))),
};
