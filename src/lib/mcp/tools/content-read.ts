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
import {
  MONSTER_DANGER_LABEL,
  MONSTER_KIND_LABEL,
  MONSTER_RARITY_LABEL,
  MONSTER_SIZE_LABEL,
} from "@/lib/monsters/labels";
import { pinTypeMeta } from "@/lib/map/pin-types";
import { MCP_QUEST_STATUS_LABEL } from "../enums";
import { McpToolError, resolveMcpWorld } from "../context";
import { renderSheet, renderTemplateFields } from "./renderers";
import { contentKind, type ToolContext, withAudit, worldSchema } from "./shared";

export function registerContentReadTool(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "inhalt_lesen",
    {
      title: "Inhalt lesen",
      description: "Lies einen sichtbaren Inhalt einer freigegebenen Welt vollständig. Bilder werden nie hier, sondern nur mit bild_lesen geliefert.",
      inputSchema: z.object({ welt: worldSchema, art: contentKind, id: z.string().uuid() }),
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

async function readContent({ world, viewerId, art, id }: ReadContentInput) {
  const role = world.role;
  switch (art) {
  case "artikel": {
    const row = await getArticle(world.id, id, role, viewerId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    return [
      `# ${row.title}`,
      `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`,
      `Stand: ${row.updatedAt.toISOString()}`,
      await renderTemplateFields(row.templateType, row.templateFields, world, viewerId),
      row.titleImageId ? "Bilder: 1 (über bild_lesen)" : "Bilder: keine",
      tiptapJsonToMcpMarkdown(row.bodyJson),
    ].filter(Boolean).join("\n\n");
  }
  case "quest": {
    const row = await getQuest(world.id, id, role, viewerId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    const note = await getQuestNote({ worldId: world.id, questId: row.id, role, viewerId });
    return [
      `# ${row.title}`,
      `Status: ${MCP_QUEST_STATUS_LABEL[row.status]}`,
      `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`,
      `Stand: ${row.updatedAt.toISOString()}`,
      row.participants.length ? `Beteiligte Charaktere: ${row.participants.map((entry) => entry.characterName).join(", ")}` : "",
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
  case "charakter": {
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
  case "monster": {
    const row = await getMonster(world.id, id, role, viewerId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    const habitat = row.habitatArticleId
      ? await getArticle(world.id, row.habitatArticleId, role, viewerId)
      : null;
    return [
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
  }
  case "universum": {
    const row = await getUniverse(world.id, id, role, viewerId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    const maps = await listMcpUniverseMaps(world.id, { role, userId: viewerId }, row.id);
    const visible = maps.find((entry) => entry.id === row.id);
    return [
      `# ${row.name}`,
      `Sichtbarkeit: ${CONTENT_VISIBILITY_LABEL[row.visibility]}`,
      `Stand: ${row.updatedAt.toISOString()}`,
      visible?.maps.length ? `Karten: ${visible.maps.map((map) => `${map.name} (${map.id})`).join(", ")}` : "Karten: keine",
      tiptapJsonToMcpMarkdown(row.descriptionJson),
    ].filter(Boolean).join("\n\n");
  }
  case "pin": {
    const row = await getMcpPin(world.id, id, { role, userId: viewerId });
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
  default: {
    const unreachable: never = art;
    throw new McpToolError(`Diese Inhaltsart wird noch nicht unterstützt: ${unreachable}`);
  }
  }
}
