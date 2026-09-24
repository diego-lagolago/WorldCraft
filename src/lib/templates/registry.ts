/**
 * Vorlagen-Registry (Plan 003, datenmodell.md Abschnitt 6). Keys English,
 * labels German. A new template type is a new entry here, never a migration.
 */

import type { ContentKind } from "@/lib/authz/types";
import {
  MONSTER_DANGERS,
  MONSTER_DANGER_LABEL,
  MONSTER_RARITIES,
  MONSTER_RARITY_LABEL,
} from "@/lib/monsters/labels";

export const TEMPLATE_TYPES = ["none", "person", "place", "organization", "item", "race"] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export type TemplateRefTarget =
  | { kind: "article"; templateType: Exclude<TemplateType, "none"> }
  | { kind: "character" };

export type TemplateField =
  | { key: string; label: string; type: "text" }
  | {
      key: string;
      label: string;
      type: "select";
      options: readonly { value: string; label: string }[];
      display?: "rarity";
    }
  | { key: string; label: string; type: "ref"; targets: readonly TemplateRefTarget[] };

export type TemplateDefinition = {
  type: TemplateType;
  label: string;
  plural: string;
  fields: readonly TemplateField[];
};

export const TEMPLATE_TEXT_MAX = 200;

const monsterDangerOptions = MONSTER_DANGERS.map((value) => ({
  value,
  label: MONSTER_DANGER_LABEL[value],
}));

const monsterRarityOptions = MONSTER_RARITIES.map((value) => ({
  value,
  label: MONSTER_RARITY_LABEL[value],
}));

export const TEMPLATES: Record<TemplateType, TemplateDefinition> = {
  none: { type: "none", label: "Ohne Vorlage", plural: "Ohne Vorlage", fields: [] },
  person: {
    type: "person",
    label: "Person",
    plural: "Personen",
    fields: [
      { key: "aliases", label: "Andere Namen", type: "text" },
      { key: "occupation", label: "Beruf / Rolle", type: "text" },
      {
        key: "race",
        label: "Rasse",
        type: "ref",
        targets: [{ kind: "article", templateType: "race" }],
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "alive", label: "lebendig" },
          { value: "incapacitated", label: "kampfunfähig" },
          { value: "sealed", label: "versiegelt" },
          { value: "dead", label: "tot" },
          { value: "missing", label: "verschollen" },
          { value: "unknown", label: "unbekannt" },
        ],
      },
      {
        key: "location",
        label: "Aufenthaltsort",
        type: "ref",
        targets: [{ kind: "article", templateType: "place" }],
      },
      {
        key: "organization",
        label: "Organisation",
        type: "ref",
        targets: [{ kind: "article", templateType: "organization" }],
      },
    ],
  },
  place: {
    type: "place",
    label: "Ort",
    plural: "Orte",
    fields: [
      {
        key: "kind",
        label: "Art",
        type: "select",
        options: [
          { value: "city", label: "Stadt" },
          { value: "village", label: "Dorf" },
          { value: "building", label: "Gebäude" },
          { value: "continent", label: "Kontinent" },
          { value: "region", label: "Region" },
          { value: "dungeon", label: "Dungeon" },
          { value: "wilderness", label: "Wildnis" },
          { value: "plane", label: "Ebene" },
          { value: "other", label: "sonstiges" },
        ],
      },
      {
        key: "danger",
        label: "Gefahrenstufe",
        type: "select",
        options: monsterDangerOptions.slice(0, 3),
      },
      {
        key: "reputation",
        label: "Ruf",
        type: "select",
        options: [
          { value: "hated", label: "Gehasst" },
          { value: "disreputable", label: "Verrufen" },
          { value: "neutral", label: "Neutral" },
          { value: "accepted", label: "Akzeptiert" },
          { value: "beloved", label: "Geliebt" },
        ],
      },
      {
        key: "ruler",
        label: "Herrscher",
        type: "ref",
        targets: [{ kind: "article", templateType: "person" }],
      },
      {
        key: "parent",
        label: "Übergeordneter Ort",
        type: "ref",
        targets: [{ kind: "article", templateType: "place" }],
      },
    ],
  },
  organization: {
    type: "organization",
    label: "Organisation",
    plural: "Organisationen",
    fields: [
      {
        key: "kind",
        label: "Art",
        type: "select",
        options: [
          { value: "guild", label: "Gilde" },
          { value: "religion", label: "Religion" },
          { value: "house", label: "Adelshaus" },
          { value: "company", label: "Freie Kompanie" },
          { value: "state", label: "Staat" },
          { value: "cult", label: "Kult" },
          { value: "other", label: "sonstiges" },
        ],
      },
      {
        key: "size",
        label: "Größe",
        type: "select",
        options: [
          { value: "up_to_10", label: "1–10" },
          { value: "up_to_50", label: "11–50" },
          { value: "up_to_100", label: "51–100" },
          { value: "over_100", label: "101+" },
        ],
      },
      {
        key: "danger",
        label: "Gefahrenstufe",
        type: "select",
        options: monsterDangerOptions,
      },
      {
        key: "leader",
        label: "Anführer",
        type: "ref",
        targets: [{ kind: "article", templateType: "person" }],
      },
      {
        key: "seat",
        label: "Sitz",
        type: "ref",
        targets: [{ kind: "article", templateType: "place" }],
      },
    ],
  },
  item: {
    type: "item",
    label: "Gegenstand",
    plural: "Gegenstände",
    fields: [
      {
        key: "kind",
        label: "Art",
        type: "select",
        options: [
          { value: "weapon", label: "Waffe" },
          { value: "armor", label: "Rüstung" },
          { value: "artifact", label: "Artefakt" },
          { value: "relic", label: "Relikt" },
          { value: "mundane", label: "alltäglich" },
          { value: "fish", label: "Fisch" },
          { value: "plant", label: "Pflanze" },
          { value: "other", label: "sonstiges" },
        ],
      },
      {
        key: "rarity",
        label: "Seltenheit",
        type: "select",
        options: monsterRarityOptions,
        display: "rarity",
      },
      {
        key: "owner",
        label: "Besitzer",
        type: "ref",
        targets: [{ kind: "article", templateType: "person" }, { kind: "character" }],
      },
    ],
  },
  race: { type: "race", label: "Rasse", plural: "Rassen", fields: [] },
};

export function isTemplateType(value: unknown): value is TemplateType {
  return typeof value === "string" && (TEMPLATE_TYPES as readonly string[]).includes(value);
}

/** Unknown keys in the database (older registry) fall back to „ohne Vorlage“. */
export function templateOf(value: string): TemplateDefinition {
  return isTemplateType(value) ? TEMPLATES[value] : TEMPLATES.none;
}

/** Badge text for an article: only the template type, nothing for `none`. */
export function templateBadge(value: string): string | null {
  const template = templateOf(value);
  return template.type === "none" ? null : template.label;
}

export type TemplateRefValue = { kind: Extract<ContentKind, "article" | "character">; id: string };
