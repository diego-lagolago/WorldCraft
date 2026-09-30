import { getArticle } from "@/lib/domain/articles";
import { getWorldCharacter } from "@/lib/domain/characters";
import { tiptapJsonToMcpMarkdown } from "@/lib/editor/tiptap-mcp-markdown";
import { attributeModifier, skillBonus, SKILL_LEVEL_LABEL } from "@/lib/characters/sheet";
import { templateOf, type TemplateType } from "@/lib/templates/registry";
import { isPendingStubRef } from "../pending-stub-ref";
import { MCP_NOT_SET } from "../enums";
import { labelFor, templateFieldsFor, writeKeyTable, type FieldArt } from "../field-catalog";

type VisibleWorld = {
  id: string;
  role: Parameters<typeof getArticle>[2];
};

type CharacterSheetRendererInput = {
  class: string | null;
  attributes: {
    str: number | null;
    dex: number | null;
    con: number | null;
    int: number | null;
    wis: number | null;
    cha: number | null;
  };
  proficiencyBonus: number;
  skills: {
    name: string;
    attr: "str" | "dex" | "con" | "int" | "wis" | "cha";
    level: "untalented" | "untrained" | "trained" | "expertise";
  }[];
  abilities: { text: string; attr: "str" | "dex" | "con" | "int" | "wis" | "cha" }[];
  personality: string | null;
  ideals: string | null;
  bonds: string | null;
  flaws: string | null;
  bioJson: unknown;
};

export type DisplayEntry = readonly [label: string, value: string];

/** Renders a template reference; hidden or missing targets appear as „–“ without title or ID. */
async function renderReference(raw: unknown, world: VisibleWorld, viewerId: string): Promise<string> {
  if (isPendingStubRef(raw)) return `@[${raw.__stubTitle}] (neuer Stub)`;
  if (!raw || typeof raw !== "object") return MCP_NOT_SET;
  const ref = raw as { kind?: string; id?: string };
  if (ref.kind === "article" && ref.id) {
    const article = await getArticle(world.id, ref.id, world.role, viewerId);
    return article ? `@[${article.title}](artikel:${article.id})` : MCP_NOT_SET;
  }
  if (ref.kind === "character" && ref.id) {
    const character = await getWorldCharacter(world.id, ref.id);
    return character ? `@[${character.name}](charakter:${character.id})` : MCP_NOT_SET;
  }
  return MCP_NOT_SET;
}

/**
 * Lists every field of the template in registry order, unset ones as „–“ (T-006), so clients
 * learn all fields and can write the output back unchanged (002 D18). Labels come from the catalog.
 */
export async function templateFieldEntries(
  templateType: string,
  fields: Record<string, unknown>,
  world: VisibleWorld,
  viewerId: string,
) : Promise<DisplayEntry[]> {
  const definition = templateOf(templateType);
  const catalog = templateFieldsFor(definition.type);
  const lines = await Promise.all(definition.fields.map(async (field, index): Promise<DisplayEntry> => {
    const entry = catalog[index];
    const raw = fields[field.key];
    if (field.type === "boolean") {
      return [entry.label, raw === true ? "Ja" : "Nein"];
    }
    if (raw === undefined || raw === null || raw === "") {
      return [entry.label, MCP_NOT_SET];
    }
    if (field.type === "select") {
      return [entry.label, labelFor(entry, raw)];
    }
    if (field.type === "ref") {
      return [entry.label, await renderReference(raw, world, viewerId)];
    }
    return [entry.label, String(raw)];
  }));
  return lines;
}

export async function renderTemplateFields(
  templateType: string,
  fields: Record<string, unknown>,
  world: VisibleWorld,
  viewerId: string,
) {
  const definition = templateOf(templateType);
  const entries = await templateFieldEntries(templateType, fields, world, viewerId);
  return [`Vorlagentyp: ${definition.label}`, ...entries.map(([label, value]) => `${label}: ${value}`)].join("\n");
}

export type WriteKeySection = { art: FieldArt; heading: string; vorlagentyp?: TemplateType };

/** Block „Schreibschlüssel“ (E6): maps every display label of inhalt_lesen to its `felder` key. */
export function renderWriteKeys(sections: readonly WriteKeySection[]) {
  const blocks = sections.map((section) => [
    `${section.heading} (art = ${section.art}):`,
    ...writeKeyTable(section.art, section.vorlagentyp).map((row) => `- ${row.label} → \`${row.key}\``),
  ].join("\n"));
  return ["## Schreibschlüssel", "Anzeige-Label → Schlüssel in felder für inhalt_aendern:", ...blocks].join("\n\n");
}

export function sheetEntries(subject: CharacterSheetRendererInput): DisplayEntry[] {
  const attributes = Object.entries(subject.attributes)
    .map(([name, value]) => `${name.toUpperCase()}: ${value ?? "–"}`)
    .join(", ");
  const skills = subject.skills
    .map((skill) => {
      const total = skillBonus(skill, subject.attributes, subject.proficiencyBonus);
      return `${skill.name} (${skill.attr.toUpperCase()}, ${SKILL_LEVEL_LABEL[skill.level]}): ${total >= 0 ? "+" : ""}${total}`;
    })
    .join("\n");
  const abilities = subject.abilities
    .map((ability) => {
      const modifier = attributeModifier(subject.attributes[ability.attr]);
      return `${ability.text} (${ability.attr.toUpperCase()}): ${modifier >= 0 ? "+" : ""}${modifier}`;
    })
    .join("\n");

  return [
    ["Klasse", subject.class ?? "–"],
    ["Attribute", attributes],
    ["Übungsbonus", `+${subject.proficiencyBonus}`],
    ...(skills ? [["Fertigkeiten", skills] as DisplayEntry] : []),
    ...(abilities ? [["Fähigkeiten", abilities] as DisplayEntry] : []),
    ...(subject.personality ? [["Persönlichkeitsmerkmale", subject.personality] as DisplayEntry] : []),
    ...(subject.ideals ? [["Ideale", subject.ideals] as DisplayEntry] : []),
    ...(subject.bonds ? [["Bindungen", subject.bonds] as DisplayEntry] : []),
    ...(subject.flaws ? [["Makel", subject.flaws] as DisplayEntry] : []),
  ];
}

export function renderSheet(subject: CharacterSheetRendererInput) {
  return [
    ...sheetEntries(subject).map(([label, value]) => `${label}: ${value}`),
    tiptapJsonToMcpMarkdown(subject.bioJson),
  ].filter(Boolean).join("\n\n");
}
