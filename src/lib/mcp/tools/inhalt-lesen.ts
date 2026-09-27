import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { CONTENT_VISIBILITY_LABEL } from "@/lib/authz";
import { attributeModifier, skillBonus, SKILL_LEVEL_LABEL } from "@/lib/characters/sheet";
import { getArticle } from "@/lib/domain/articles";
import { getWorldCharacter } from "@/lib/domain/characters";
import { getMcpPin, listMcpUniverseMaps } from "@/lib/domain/mcp-read";
import { getMonster } from "@/lib/domain/monsters";
import { getQuest } from "@/lib/domain/quests";
import { getQuestNote } from "@/lib/domain/quest-notes";
import { getUniverse } from "@/lib/domain/universes";
import { tiptapJsonToMcpMarkdown } from "@/lib/editor/tiptap-mcp-markdown";
import { MONSTER_DANGER_LABEL, MONSTER_KIND_LABEL, MONSTER_RARITY_LABEL, MONSTER_SIZE_LABEL } from "@/lib/monsters/labels";
import { pinTypeMeta } from "@/lib/map/pin-types";
import { templateOf } from "@/lib/templates/registry";
import { McpToolError, resolveMcpWorld } from "../context";
import { MCP_QUEST_STATUS_LABEL } from "../enums";
import { contentKind, readToolAuth, type ToolContext, withAudit, worldSchema } from "./shared";

async function renderTemplateFields(
  templateType: string,
  fields: Record<string, unknown>,
  world: { id: string; role: Parameters<typeof getArticle>[2] },
  viewerId: string,
) {
  const definition = templateOf(templateType);
  const lines = [`Vorlagentyp: ${definition.label}`];
  for (const field of definition.fields) {
    const raw = fields[field.key];
    if (raw === undefined) continue;
    if (field.type === "boolean") lines.push(`${field.label}: ${raw === true ? "Ja" : "Nein"}`);
    else if (field.type === "select") lines.push(`${field.label}: ${field.options.find((option) => option.value === raw)?.label ?? String(raw)}`);
    else if (field.type === "ref" && raw && typeof raw === "object") {
      const ref = raw as { kind?: string; id?: string };
      if (ref.kind === "article" && ref.id) {
        const article = await getArticle(world.id, ref.id, world.role, viewerId);
        if (article) lines.push(`${field.label}: @[${article.title}](artikel:${article.id})`);
      } else if (ref.kind === "character" && ref.id) {
        const character = await getWorldCharacter(world.id, ref.id);
        if (character) lines.push(`${field.label}: @[${character.name}](charakter:${character.id})`);
      }
    } else lines.push(`${field.label}: ${String(raw)}`);
  }
  if (definition.type === "item") lines.push(`Quest-Gegenstand: ${fields.quest === true ? "Ja" : "Nein"}`);
  return lines.join("\n");
}

function renderSheet(subject: {
  class: string | null;
  attributes: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number | null>;
  proficiencyBonus: number;
  skills: { name: string; attr: "str" | "dex" | "con" | "int" | "wis" | "cha"; level: "untalented" | "untrained" | "trained" | "expertise" }[];
  abilities: { text: string; attr: "str" | "dex" | "con" | "int" | "wis" | "cha" }[];
  personality: string | null;
  ideals: string | null;
  bonds: string | null;
  flaws: string | null;
  bioJson: unknown;
}) {
  const attributes = Object.entries(subject.attributes).map(([name, value]) => `${name.toUpperCase()}: ${value ?? "–"}`).join(", ");
  const skills = subject.skills.map((skill) => {
    const total = skillBonus(skill, subject.attributes, subject.proficiencyBonus);
    return `${skill.name} (${skill.attr.toUpperCase()}, ${SKILL_LEVEL_LABEL[skill.level]}): ${total >= 0 ? "+" : ""}${total}`;
  }).join("\n");
  const abilities = subject.abilities.map((ability) => {
    const modifier = attributeModifier(subject.attributes[ability.attr]);
    return `${ability.text} (${ability.attr.toUpperCase()}): ${modifier >= 0 ? "+" : ""}${modifier}`;
  }).join("\n");
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

export function registerInhaltLesenTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("inhalt_lesen", {
    title: "Inhalt lesen",
    description: "Lies einen sichtbaren Inhalt einer freigegebenen Welt vollständig. Bilder werden nie hier, sondern nur mit bild_lesen geliefert.",
    ...readToolAuth,
    inputSchema: z.object({ welt: worldSchema, art: contentKind, id: z.string().uuid() }),
  }, async ({ welt, art, id }) => withAudit(ctx, "inhalt_lesen", async () => {
    const world = await resolveMcpWorld(ctx.userId, welt);
    const role = world.role;
    let value = "";
    if (art === "artikel") {
      const row = await getArticle(world.id, id, role, ctx.userId);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      value = [
        `# ${row.title}`,
        `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`,
        `Stand: ${row.updatedAt.toISOString()}`,
        await renderTemplateFields(row.templateType, row.templateFields, world, ctx.userId),
        row.titleImageId ? "Bilder: 1 (über bild_lesen)" : "Bilder: keine",
        tiptapJsonToMcpMarkdown(row.bodyJson),
      ].filter(Boolean).join("\n\n");
    } else if (art === "quest") {
      const row = await getQuest(world.id, id, role, ctx.userId);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      const note = await getQuestNote({ worldId: world.id, questId: row.id, role, viewerId: ctx.userId });
      value = [
        `# ${row.title}`,
        `Status: ${MCP_QUEST_STATUS_LABEL[row.status]}`,
        `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`,
        `Stand: ${row.updatedAt.toISOString()}`,
        row.participants.length ? `Beteiligte Charaktere: ${row.participants.map((entry) => entry.characterName).join(", ")}` : "",
        tiptapJsonToMcpMarkdown(row.descriptionJson),
        ...row.chapters.map((chapter) => `## ${chapter.title}\nStatus: ${MCP_QUEST_STATUS_LABEL[chapter.status]}\n${tiptapJsonToMcpMarkdown(chapter.bodyJson)}`),
        note.ok ? `## Notizblock\nStand: ${note.data.version}\n${tiptapJsonToMcpMarkdown(note.data.bodyJson)}` : "",
      ].filter(Boolean).join("\n\n");
    } else if (art === "charakter") {
      const row = await getWorldCharacter(world.id, id);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      value = [`# ${row.name}`, `Stand: ${row.updatedAt.toISOString()}`, row.portraitId || row.images.length ? `Bilder: ${(row.portraitId ? 1 : 0) + row.images.length} (über bild_lesen)` : "Bilder: keine", renderSheet(row)].join("\n\n");
    } else if (art === "monster") {
      const row = await getMonster(world.id, id, role, ctx.userId);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      const habitat = row.habitatArticleId ? await getArticle(world.id, row.habitatArticleId, role, ctx.userId) : null;
      value = [
        `# ${row.name}`,
        `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`,
        `Stand: ${row.updatedAt.toISOString()}`,
        `Art: ${MONSTER_KIND_LABEL[row.kind]}`,
        `Seltenheit: ${MONSTER_RARITY_LABEL[row.rarity]}`,
        `Boss: ${row.isBoss ? "Ja" : "Nein"}`,
        `Gefahrenstufe: ${MONSTER_DANGER_LABEL[row.danger]}`,
        `Größe: ${MONSTER_SIZE_LABEL[row.size]}`,
        habitat ? `Lebensraum: ${habitat.title} (${habitat.id})` : "",
        row.portraitId ? "Bilder: 1 (über bild_lesen)" : "Bilder: keine",
        renderSheet(row),
      ].filter(Boolean).join("\n\n");
    } else if (art === "universum") {
      const row = await getUniverse(world.id, id, role, ctx.userId);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      const maps = await listMcpUniverseMaps(world.id, { role, userId: ctx.userId }, row.id);
      const visible = maps.find((entry) => entry.id === row.id);
      value = [
        `# ${row.name}`,
        `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`,
        `Stand: ${row.updatedAt.toISOString()}`,
        visible?.maps.length ? `Karten: ${visible.maps.map((map) => `${map.name} (${map.id})`).join(", ")}` : "Karten: keine",
        tiptapJsonToMcpMarkdown(row.descriptionJson),
      ].filter(Boolean).join("\n\n");
    } else if (art === "pin") {
      const row = await getMcpPin(world.id, id, { role, userId: ctx.userId });
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      value = [
        `# ${row.title}`,
        `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`,
        `Stand: ${row.updatedAt.toISOString()}`,
        `Pin-Typ: ${pinTypeMeta(row.pinType as Parameters<typeof pinTypeMeta>[0]).label}`,
        `Karte: ${row.mapName}`,
        `Universum: ${row.universeName} (${row.universeId})`,
        tiptapJsonToMcpMarkdown(row.descriptionJson),
      ].filter(Boolean).join("\n\n");
    } else throw new McpToolError("Diese Inhaltsart wird noch nicht unterstützt.");
    return { worldId: world.id, value };
  }));
}
