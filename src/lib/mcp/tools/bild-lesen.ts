import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getArticle } from "@/lib/domain/articles";
import { getWorldCharacter } from "@/lib/domain/characters";
import { readMcpImage } from "@/lib/domain/mcp-read";
import { getMonster } from "@/lib/domain/monsters";
import { getWorldDetails } from "@/lib/domain/worlds";
import { McpToolError, resolveMcpWorld } from "../context";
import { readToolAuth, type ToolContext, withAudit, worldSchema } from "./shared";

export function registerBildLesenTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("bild_lesen", {
    title: "Bild lesen",
    description: "Liefert ein sichtbares Inhaltsbild als Bilddaten. Kartenbilder sind ausgeschlossen; niemals URLs oder Datei-IDs ausgeben.",
    ...readToolAuth,
    inputSchema: z.object({ welt: worldSchema, art: z.enum(["welt", "artikel", "charakter", "monster"]), id: z.string().uuid().optional(), bild_nr: z.number().int().min(1).max(10).optional() }),
  }, async ({ welt, art, id, bild_nr }) => withAudit(ctx, "bild_lesen", async () => {
    const world = await resolveMcpWorld(ctx.userId, welt);
    let fileId: string | null = null;
    let description = "";
    if (art === "welt") {
      if (id) throw new McpToolError("Für ein Weltbild ist keine id erlaubt.");
      fileId = (await getWorldDetails(world.id))?.titleImageId ?? null;
      description = `Bild der Welt ${world.name}.`;
    } else if (art === "artikel") {
      if (!id) throw new McpToolError("id fehlt.");
      const article = await getArticle(world.id, id, world.role, ctx.userId);
      fileId = article?.titleImageId ?? null;
      description = article ? `Titelbild des Artikels ${article.title}.` : "";
    } else if (art === "monster") {
      if (!id) throw new McpToolError("id fehlt.");
      const monster = await getMonster(world.id, id, world.role, ctx.userId);
      fileId = monster?.portraitId ?? null;
      description = monster ? `Profilbild des Monsters ${monster.name}.` : "";
    } else {
      if (!id) throw new McpToolError("id fehlt.");
      const character = await getWorldCharacter(world.id, id);
      fileId = bild_nr ? character?.images[bild_nr - 1]?.fileId ?? null : character?.portraitId ?? null;
      description = character ? `${bild_nr ? `Bild ${bild_nr}` : "Profilbild"} des Charakters ${character.name}.` : "";
    }
    if (!fileId) throw new McpToolError("Bild nicht gefunden.");
    const image = await readMcpImage(ctx.userId, fileId);
    if (!image) throw new McpToolError("Bild nicht gefunden.");
    return { worldId: world.id, value: description, image };
  }));
}
