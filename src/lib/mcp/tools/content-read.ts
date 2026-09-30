import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { CONTENT_VISIBILITY_LABEL } from "@/lib/authz";
import { getArticle } from "@/lib/domain/articles";
import { getWorldCharacter } from "@/lib/domain/characters";
import { getMcpPin, listMcpUniverseMaps } from "@/lib/domain/mcp-read";
import { getMonster } from "@/lib/domain/monsters";
import { getQuest } from "@/lib/domain/quests";
import { getQuestNote } from "@/lib/domain/quest-notes";
import { getUniverse } from "@/lib/domain/universes";
import { tiptapJsonToMcpMarkdown } from "@/lib/editor/tiptap-mcp-markdown";
import { pinTypeMeta } from "@/lib/map/pin-types";
import { templateOf } from "@/lib/templates/registry";
import { MCP_NOT_SET, MCP_QUEST_STATUS_LABEL } from "../enums";
import { McpToolError, resolveMcpWorld } from "../context";
import { fieldFor, labelFor } from "../field-catalog";
import { renderSheet, renderTemplateFields, renderWriteKeys } from "./renderers";
import { contentKind, type ToolContext, withAudit, worldSchema } from "./shared";

export function registerContentReadTool(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "inhalt_lesen",
    {
      title: "Inhalt lesen",
      description: "Lies einen sichtbaren Inhalt einer freigegebenen Welt vollständig. Bilder werden nie hier, sondern nur mit bild_lesen geliefert.",
      inputSchema: z.object({ welt: worldSchema, art: contentKind, id: z.string().uuid() }).strict(),
    },
    async ({ welt, art, id }) => withAudit(ctx, "inhalt_lesen", async () => {
      const world = await resolveMcpWorld(ctx.userId, welt);
      const value = await readContent({ world, viewerId: ctx.userId, art, id });
      return { worldId: world.id, value };
    }),
  );
}

type ReadContentInput = {
  world: Awaited<ReturnType<typeof resolveMcpWorld>>;
  viewerId: string;
  art: z.infer<typeof contentKind>;
  id: string;
};

type ReadWorld = ReadContentInput["world"];

/** Display labels come from the field catalog so they match the Schreibschlüssel table (E6). */
function label(art: "quest" | "monster", key: string) {
  return fieldFor(art, key)?.label ?? key;
}

/** Writable form of a participant (T-006); snapshots of deleted characters keep their row ID. */
function participantMention(entry: { id: string; characterId: string | null; characterName: string; href: boolean }) {
  return entry.characterId && entry.href
    ? `@[${entry.characterName}](charakter:${entry.characterId})`
    : `@[${entry.characterName}](teilnahme:${entry.id})`;
}

async function readArticle(world: ReadWorld, viewerId: string, id: string) {
  const row = await getArticle(world.id, id, world.role, viewerId);
  if (!row) throw new McpToolError("Inhalt nicht gefunden.");
  return [
    `# ${row.title}`,
    `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`,
    `Stand: ${row.updatedAt.toISOString()}`,
    await renderTemplateFields(row.templateType, row.templateFields, world, viewerId),
    row.titleImageId ? "Bilder: 1 (über bild_lesen)" : "Bilder: keine",
    renderWriteKeys([{ art: "artikel", heading: "Artikel", vorlagentyp: templateOf(row.templateType).type }]),
    tiptapJsonToMcpMarkdown(row.bodyJson),
  ].filter(Boolean).join("\n\n");
}

async function readQuest(world: ReadWorld, viewerId: string, id: string) {
  const role = world.role;
  const row = await getQuest(world.id, id, role, viewerId);
  if (!row) throw new McpToolError("Inhalt nicht gefunden.");
  const note = await getQuestNote({ worldId: world.id, questId: row.id, role, viewerId });
  return [
    `# ${row.title}`,
    `${label("quest", "status")}: ${MCP_QUEST_STATUS_LABEL[row.status]}`,
    `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`,
    `Stand: ${row.updatedAt.toISOString()}`,
    `${label("quest", "beteiligte")}: ${row.participants.map(participantMention).join(", ") || MCP_NOT_SET}`,
    renderWriteKeys([
      { art: "quest", heading: "Quest (id = Quest-ID)" },
      { art: "kapitel", heading: "Kapitel (id = Kapitel-ID)" },
      ...(note.ok ? [{ art: "notizblock" as const, heading: "Notizblock (id = Quest-ID, Stand des Notizblocks)" }] : []),
    ]),
    tiptapJsonToMcpMarkdown(row.descriptionJson),
    ...row.chapters.map((chapter) => [
      `## ${chapter.title}`,
      `ID: ${chapter.id}`,
      `Status: ${MCP_QUEST_STATUS_LABEL[chapter.status]}`,
      `Stand: ${chapter.updatedAt.toISOString()}`,
      tiptapJsonToMcpMarkdown(chapter.bodyJson),
    ].join("\n")),
    note.ok ? `## Notizblock\nStand: ${note.data.version}\n${tiptapJsonToMcpMarkdown(note.data.bodyJson)}` : "",
  ].filter(Boolean).join("\n\n");
}

async function readCharacter(world: ReadWorld, id: string) {
  const row = await getWorldCharacter(world.id, id);
  if (!row) throw new McpToolError("Inhalt nicht gefunden.");
  const imageCount = (row.portraitId ? 1 : 0) + row.images.length;
  return [
    `# ${row.name}`,
    `Stand: ${row.updatedAt.toISOString()}`,
    imageCount ? `Bilder: ${imageCount} (über bild_lesen)` : "Bilder: keine",
    renderSheet(row),
  ].join("\n\n");
}

async function readMonster(world: ReadWorld, viewerId: string, id: string) {
  const row = await getMonster(world.id, id, world.role, viewerId);
  if (!row) throw new McpToolError("Inhalt nicht gefunden.");
  const habitat = row.habitatArticleId
    ? await getArticle(world.id, row.habitatArticleId, world.role, viewerId)
    : null;
  return [
    `# ${row.name}`,
    `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`,
    `Stand: ${row.updatedAt.toISOString()}`,
    `${label("monster", "monster_art")}: ${labelFor(fieldFor("monster", "monster_art")!, row.kind)}`,
    `${label("monster", "seltenheit")}: ${labelFor(fieldFor("monster", "seltenheit")!, row.rarity)}`,
    `${label("monster", "boss")}: ${row.isBoss ? "Ja" : "Nein"}`,
    `${label("monster", "gefahr")}: ${labelFor(fieldFor("monster", "gefahr")!, row.danger)}`,
    `${label("monster", "groesse")}: ${labelFor(fieldFor("monster", "groesse")!, row.size)}`,
    `${label("monster", "lebensraum")}: ${habitat ? `@[${habitat.title}](artikel:${habitat.id})` : MCP_NOT_SET}`,
    row.portraitId ? "Bilder: 1 (über bild_lesen)" : "Bilder: keine",
    renderSheet(row),
    renderWriteKeys([{ art: "monster", heading: "Monster" }]),
  ].filter(Boolean).join("\n\n");
}

async function readUniverse(world: ReadWorld, viewerId: string, id: string) {
  const row = await getUniverse(world.id, id, world.role, viewerId);
  if (!row) throw new McpToolError("Inhalt nicht gefunden.");
  const maps = await listMcpUniverseMaps(world.id, { role: world.role, userId: viewerId }, row.id);
  const visible = maps.find((entry) => entry.id === row.id);
  return [
    `# ${row.name}`,
    `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`,
    `Stand: ${row.updatedAt.toISOString()}`,
    visible?.maps.length ? `Karten: ${visible.maps.map((map) => `${map.name} (${map.id})`).join(", ")}` : "Karten: keine",
    tiptapJsonToMcpMarkdown(row.descriptionJson),
    renderWriteKeys([{ art: "universum", heading: "Universum" }]),
  ].filter(Boolean).join("\n\n");
}

async function readPin(world: ReadWorld, viewerId: string, id: string) {
  const row = await getMcpPin(world.id, id, { role: world.role, userId: viewerId });
  if (!row) throw new McpToolError("Inhalt nicht gefunden.");
  return [
    `# ${row.title}`,
    `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`,
    `Stand: ${row.updatedAt.toISOString()}`,
    `Pin-Typ: ${pinTypeMeta(row.pinType as Parameters<typeof pinTypeMeta>[0]).label}`,
    `Karte: ${row.mapName}`,
    `Universum: ${row.universeName} (${row.universeId})`,
    tiptapJsonToMcpMarkdown(row.descriptionJson),
  ].filter(Boolean).join("\n\n");
}

async function readContent({ world, viewerId, art, id }: ReadContentInput) {
  switch (art) {
  case "artikel": return readArticle(world, viewerId, id);
  case "quest": return readQuest(world, viewerId, id);
  case "charakter": return readCharacter(world, id);
  case "monster": return readMonster(world, viewerId, id);
  case "universum": return readUniverse(world, viewerId, id);
  case "pin": return readPin(world, viewerId, id);
  default: {
    const unreachable: never = art;
    throw new McpToolError(`Diese Inhaltsart wird noch nicht unterstützt: ${unreachable}`);
  }
  }
}
