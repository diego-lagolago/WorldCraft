import { ATTRIBUTE_KEYS, SKILL_LEVELS } from "@/lib/characters/sheet";
import { MCP_QUEST_STATUS, MCP_TEMPLATE_TYPE } from "@/lib/mcp/enums";
import {
  MONSTER_DANGER_LABEL,
  MONSTER_DANGERS,
  MONSTER_KIND_LABEL,
  MONSTER_KINDS,
  MONSTER_RARITY_LABEL,
  MONSTER_RARITIES,
  MONSTER_SIZE_LABEL,
  MONSTER_SIZES,
} from "@/lib/monsters/labels";
import { TEMPLATE_TYPES, TEMPLATES, templateOf, type TemplateDefinition, type TemplateField, type TemplateType } from "@/lib/templates/registry";
import { MCP_SHEET_FIELDS } from "./write-fields";

export type FieldOperation = "anlegen" | "aendern";
export type FieldArt = "artikel" | "quest" | "kapitel" | "notizblock" | "monster" | "universum" | "welt";
export type FieldType = "text" | "markdown" | "boolean" | "number" | "select" | "reference" | "list" | "object";

export type AllowedValue = { value: string; label: string };
export type FieldDefinition = {
  key: string;
  label: string;
  type: FieldType;
  requiredOnCreate?: boolean;
  description: string;
  allowedValues?: readonly AllowedValue[];
  referenceTargets?: readonly string[];
  path?: string;
  /** Keys clients sent by mistake (E2E-Lauf 1); only used for the hint in tool errors. */
  mistakenKeys?: readonly string[];
};

const values = <T extends string>(source: readonly T[], labels: Record<T, string>): AllowedValue[] =>
  source.map((value) => ({ value, label: labels[value] }));

const templateTypes = Object.entries(MCP_TEMPLATE_TYPE).map(([label, value]) => ({ value, label }));
const questStatuses = Object.entries(MCP_QUEST_STATUS).map(([label, value]) => ({ value, label }));
const monsterKinds = values(MONSTER_KINDS, MONSTER_KIND_LABEL);
const monsterRarities = values(MONSTER_RARITIES, MONSTER_RARITY_LABEL);
const monsterDangers = values(MONSTER_DANGERS, MONSTER_DANGER_LABEL);
const monsterSizes = values(MONSTER_SIZES, MONSTER_SIZE_LABEL);
const catalogTemplateFieldLabels = Object.fromEntries(
  Object.values(TEMPLATES).map((definition) => [definition.type, definition.fields.map((entry) => entry.label)]),
) as unknown as Record<TemplateType, readonly string[]>;

const field = (
  key: string,
  label: string,
  type: FieldType,
  description: string,
  options: Partial<Omit<FieldDefinition, "key" | "label" | "type" | "description">> = {},
): FieldDefinition => ({ key, label, type, description, ...options });

const VISIBILITY = field("sichtbarkeit", "Sichtbarkeit", "select", "Wird beim Anlegen ignoriert; neue Inhalte starten privat.", {
  allowedValues: [{ value: "owner_only", label: "nur ich" }, { value: "gm_only", label: "nur Spielleitung" }, { value: "published", label: "veröffentlicht" }],
});

const articleFields = [
  field("titel", "Titel", "text", "Anzeige: Titel.", { requiredOnCreate: true }),
  field("vorlagentyp", "Vorlagentyp", "select", "Anzeige: Vorlagentyp.", { allowedValues: templateTypes }),
  field("vorlagenfelder", "Vorlagenfelder", "object", "Anzeige: Vorlagenfelder. Schlüssel sind die deutschen Labels des Vorlagentyps. Beim Ändern werden nur die genannten Felder geändert; null oder „–“ leert ein Feld."),
  field("text", "Text", "markdown", "Anzeige: Text."),
];
const questFields = [
  field("titel", "Titel", "text", "Anzeige: Titel.", { requiredOnCreate: true }),
  field("status", "Status", "select", "Anzeige: Status.", { allowedValues: questStatuses }),
  field("beschreibung", "Beschreibung", "markdown", "Anzeige: Beschreibung."),
  field("beteiligte", "Beteiligte Charaktere", "list", "Anzeige: Beteiligte Charaktere. Liste aus Charakter-IDs oder @[Name](charakter:id) wie von inhalt_lesen ausgegeben; nur in die Welt mitgebrachte Charaktere. Gelöschte Charaktere erscheinen als @[Name](teilnahme:id) und bleiben beteiligt, solange sie mitgeschickt werden.", { referenceTargets: ["charakter"] }),
];
const chapterFields = [
  field("quest_id", "Quest", "reference", "Anzeige: Quest.", { requiredOnCreate: true, referenceTargets: ["quest"] }),
  field("titel", "Titel", "text", "Anzeige: Titel.", { requiredOnCreate: true }),
  field("status", "Status", "select", "Anzeige: Status.", { allowedValues: questStatuses }),
  field("text", "Text", "markdown", "Anzeige: Text."),
  field("position", "Position", "number", "Anzeige: Position."),
];
const monsterFields = [
  field("name", "Name", "text", "Anzeige: Name.", { requiredOnCreate: true }),
  field("monster_art", "Art", "select", "Anzeige: Art.", { allowedValues: monsterKinds }),
  field("seltenheit", "Seltenheit", "select", "Anzeige: Seltenheit.", { allowedValues: monsterRarities }),
  field("boss", "Boss", "boolean", "Anzeige: Boss."),
  field("gefahr", "Gefahrenstufe", "select", "Anzeige: Gefahrenstufe.", { allowedValues: monsterDangers }),
  field("groesse", "Größe", "select", "Anzeige: Größe.", { allowedValues: monsterSizes }),
  field("lebensraum", "Lebensraum", "reference", "Anzeige: Lebensraum.", { referenceTargets: ["artikel:ort"] }),
  field("charakterblatt", "Charakterblatt", "object", "Anzeige: Charakterblatt."),
  field("bio", "Bio", "markdown", "Anzeige: Bio."),
];

const baseFields: Record<FieldArt, readonly FieldDefinition[]> = {
  artikel: articleFields,
  quest: questFields,
  kapitel: chapterFields,
  notizblock: [field("text", "Text", "markdown", "Anzeige: Text.", { mistakenKeys: ["inhalt", "notiz"] })],
  monster: monsterFields,
  universum: [
    field("name", "Name", "text", "Anzeige: Name.", { requiredOnCreate: true }),
    field("beschreibung", "Beschreibung", "markdown", "Anzeige: Beschreibung."),
  ],
  welt: [
    field("name", "Name", "text", "Anzeige: Name."),
    field("beschreibung", "Beschreibung", "markdown", "Anzeige: Beschreibung."),
  ],
};

export function fieldsFor(operation: FieldOperation, art: FieldArt): readonly FieldDefinition[] {
  const fields = baseFields[art];
  if (operation === "aendern") return fields.filter((field) => field.key !== "quest_id");
  return art === "welt" || art === "notizblock" ? fields : [...fields, VISIBILITY];
}

export function fieldFor(art: FieldArt, key: string): FieldDefinition | undefined {
  return fieldsFor("aendern", art).find((entry) => entry.key === key);
}

function templateField(fieldDefinition: TemplateField): FieldDefinition {
  if (fieldDefinition.type === "text") return field(fieldDefinition.label, fieldDefinition.label, "text", "Anzeige: " + fieldDefinition.label + ".", { path: "vorlagenfelder." + fieldDefinition.label });
  if (fieldDefinition.type === "boolean") return field(fieldDefinition.label, fieldDefinition.label, "boolean", "Anzeige: " + fieldDefinition.label + ".", { path: "vorlagenfelder." + fieldDefinition.label });
  if (fieldDefinition.type === "ref") return field(fieldDefinition.label, fieldDefinition.label, "reference", "Anzeige: " + fieldDefinition.label + ".", {
    path: "vorlagenfelder." + fieldDefinition.label,
    referenceTargets: fieldDefinition.targets.map((target) => target.kind === "article" ? "artikel:" + target.templateType : "charakter"),
  });
  return field(fieldDefinition.label, fieldDefinition.label, "select", "Anzeige: " + fieldDefinition.label + ".", {
    path: "vorlagenfelder." + fieldDefinition.label,
    allowedValues: fieldDefinition.options,
  });
}

/** The item flag `quest` is shown and written as „Quest-Gegenstand“ (T-006). */
const QUEST_ITEM_FIELD = field("Quest-Gegenstand", "Quest-Gegenstand", "boolean", "Anzeige: Quest-Gegenstand.", {
  path: "vorlagenfelder.Quest-Gegenstand",
});

export function templateFieldsFor(vorlagentyp: TemplateType): readonly FieldDefinition[] {
  const definition = templateOf(vorlagentyp);
  return definition.fields.map((entry) => (
    definition.type === "item" && entry.key === "quest" ? QUEST_ITEM_FIELD : templateField(entry)
  ));
}

export function allowedValuesFor(fieldDefinition: Pick<FieldDefinition, "allowedValues">): readonly AllowedValue[] {
  return fieldDefinition.allowedValues ?? [];
}

export function labelFor(fieldDefinition: Pick<FieldDefinition, "allowedValues">, internalValue: unknown): string {
  return fieldDefinition.allowedValues?.find((value) => value.value === internalValue)?.label ?? String(internalValue);
}

export type WriteKeyRow = { label: string; key: string };

export function writeKeyTable(art: FieldArt, vorlagentyp?: TemplateType): readonly WriteKeyRow[] {
  const rows = fieldsFor("aendern", art).map((entry) => ({ label: entry.label, key: entry.key }));
  if (art === "artikel" && vorlagentyp) rows.push(...templateFieldsFor(vorlagentyp).map((entry) => ({ label: entry.label, key: entry.path ?? entry.key })));
  if (art === "monster") rows.push(...MCP_SHEET_FIELDS.map((entry) => ({ label: entry.label, key: "charakterblatt." + entry.key })));
  return rows;
}

export function writeKeyForLabel(art: FieldArt, label: string, vorlagentyp?: TemplateType): string | undefined {
  return writeKeyTable(art, vorlagentyp).find((row) => row.label.localeCompare(label, "de", { sensitivity: "accent" }) === 0)?.key;
}

export type WriteKeyHint = { key: string; writeKey: string; isLabel: boolean; art: FieldArt };

/**
 * Finds the write key for a key a client sent although it is not a valid `felder` key (E6):
 * an Anzeige-Label (also of any template field for artikel) or a known mistake from E2E-Lauf 1.
 */
export function writeKeyHints(key: string, arts: readonly FieldArt[]): WriteKeyHint[] {
  const hints: WriteKeyHint[] = [];
  for (const art of arts) {
    const types = art === "artikel" ? TEMPLATE_TYPES : [undefined];
    const found = new Set<string>();
    for (const type of types) {
      const writeKey = writeKeyForLabel(art, key, type);
      if (writeKey && writeKey !== key && !found.has(writeKey)) {
        found.add(writeKey);
        hints.push({ key, writeKey, isLabel: true, art });
      }
    }
    const mistaken = fieldsFor("aendern", art).find((entry) => entry.mistakenKeys?.includes(key.toLocaleLowerCase("de")));
    if (mistaken && !found.has(mistaken.key)) hints.push({ key, writeKey: mistaken.key, isLabel: false, art });
  }
  return hints;
}

/** Guard used by tests so a registry or enum extension cannot bypass the catalog. */
export function assertFieldCatalogComplete(templates: Record<TemplateType, TemplateDefinition> = TEMPLATES) {
  for (const definition of Object.values(templates)) {
    const catalog = catalogTemplateFieldLabels[definition.type];
    for (const templateField of definition.fields) {
      if (!catalog.includes(templateField.label)) throw new Error("Feldkatalog fehlt Vorlagenfeld: " + templateField.label);
    }
  }
  const expected = [monsterKinds, monsterRarities, monsterDangers, monsterSizes, questStatuses];
  if (expected.some((group) => group.length === 0)
    || Array.from(MCP_SHEET_FIELDS).length === 0
    || Array.from(ATTRIBUTE_KEYS).length === 0
    || Array.from(SKILL_LEVELS).length === 0) {
    throw new Error("Feldkatalog ist unvollständig.");
  }
}

export const FIELD_CATALOG_COMPLETE = assertFieldCatalogComplete();
