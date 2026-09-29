import { getArticle } from "@/lib/domain/articles";
import { getWorldCharacter } from "@/lib/domain/characters";
import { tiptapJsonToMcpMarkdown } from "@/lib/editor/tiptap-mcp-markdown";
import { attributeModifier, skillBonus, SKILL_LEVEL_LABEL } from "@/lib/characters/sheet";
import { templateOf } from "@/lib/templates/registry";
import { isPendingStubRef } from "../pending-stub-ref";
import { labelFor, templateFieldsFor } from "../field-catalog";

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

/** Resolves template references through the same visibility-aware domain loaders as the app. */
export async function renderTemplateFields(
  templateType: string,
  fields: Record<string, unknown>,
  world: VisibleWorld,
  viewerId: string,
) {
  const definition = templateOf(templateType);
  const lines = [`Vorlagentyp: ${definition.label}`];
  const catalog = templateFieldsFor(definition.type);

  for (const field of definition.fields) {
    const raw = fields[field.key];
    if (raw === undefined) continue;

    if (field.type === "boolean") {
      lines.push(`${field.label}: ${raw === true ? "Ja" : "Nein"}`);
      continue;
    }
    if (field.type === "select") {
      const label = labelFor(
        catalog.find((entry) => entry.label === field.label) ?? { allowedValues: field.options },
        raw,
      );
      lines.push(`${field.label}: ${label}`);
      continue;
    }
    if (field.type === "ref" && isPendingStubRef(raw)) {
      lines.push(`${field.label}: @[${raw.__stubTitle}] (neuer Stub)`);
      continue;
    }
    if (field.type === "ref" && raw && typeof raw === "object") {
      const ref = raw as { kind?: string; id?: string };
      if (ref.kind === "article" && ref.id) {
        const article = await getArticle(world.id, ref.id, world.role, viewerId);
        if (article) lines.push(`${field.label}: @[${article.title}](artikel:${article.id})`);
        continue;
      }
      if (ref.kind === "character" && ref.id) {
        const character = await getWorldCharacter(world.id, ref.id);
        if (character) lines.push(`${field.label}: @[${character.name}](charakter:${character.id})`);
        continue;
      }
      continue;
    }
    lines.push(`${field.label}: ${String(raw)}`);
  }

  if (definition.type === "item") {
    lines.push(`Quest-Gegenstand: ${fields.quest === true ? "Ja" : "Nein"}`);
  }
  return lines.join("\n");
}

export function renderSheet(subject: CharacterSheetRendererInput) {
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
    `Klasse: ${subject.class ?? "–"}`,
    `Attribute: ${attributes}`,
    `Übungsbonus: +${subject.proficiencyBonus}`,
    skills ? `Fertigkeiten:\n${skills}` : "",
    abilities ? `Fähigkeiten:\n${abilities}` : "",
    subject.personality ? `Persönlichkeitsmerkmale: ${subject.personality}` : "",
    subject.ideals ? `Ideale: ${subject.ideals}` : "",
    subject.bonds ? `Bindungen: ${subject.bonds}` : "",
    subject.flaws ? `Makel: ${subject.flaws}` : "",
    tiptapJsonToMcpMarkdown(subject.bioJson),
  ].filter(Boolean).join("\n\n");
}
