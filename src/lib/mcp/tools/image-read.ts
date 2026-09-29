import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getArticle } from "@/lib/domain/articles";
import { getWorldCharacter } from "@/lib/domain/characters";
import { getMonster } from "@/lib/domain/monsters";
import { readMcpImage } from "@/lib/domain/mcp-read";
import { getWorldDetails } from "@/lib/domain/worlds";
import { McpToolError, resolveMcpWorld } from "../context";
import { type ToolContext, withAudit, worldSchema } from "./shared";

export function registerImageReadTool(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "bild_lesen",
    {
      title: "Bild lesen",
      description: "Liefert ein sichtbares Inhaltsbild als Bilddaten. Kartenbilder sind ausgeschlossen; niemals URLs oder Datei-IDs ausgeben.",
      inputSchema: z.object({
        welt: worldSchema,
        art: z.enum(["welt", "artikel", "charakter", "monster"]),
        id: z.string().uuid().optional(),
        bild_nr: z.number().int().min(1).max(10).optional(),
      }).strict(),
    },
    async ({ welt, art, id, bild_nr }) => withAudit(ctx, "bild_lesen", async () => {
      const world = await resolveMcpWorld(ctx.userId, welt);
      const selected = await selectImage({
        world,
        viewerId: ctx.userId,
        art,
        id,
        imageNumber: bild_nr,
      });
      if (!selected.fileId) throw new McpToolError("Bild nicht gefunden.");
      const image = await readMcpImage(ctx.userId, selected.fileId);
      if (!image) throw new McpToolError("Bild nicht gefunden.");
      return { worldId: world.id, value: selected.description, image };
    }),
  );
}

type ImageRequest = {
  world: Awaited<ReturnType<typeof resolveMcpWorld>>;
  viewerId: string;
  art: "welt" | "artikel" | "charakter" | "monster";
  id?: string;
  imageNumber?: number;
};

async function selectImage({ world, viewerId, art, id, imageNumber }: ImageRequest) {
  if (art === "welt") {
    if (id) throw new McpToolError("Für ein Weltbild ist keine id erlaubt.");
    const details = await getWorldDetails(world.id);
    return { fileId: details?.titleImageId ?? null, description: `Bild der Welt ${world.name}.` };
  }
  if (!id) throw new McpToolError("id fehlt.");

  if (art === "artikel") {
    const article = await getArticle(world.id, id, world.role, viewerId);
    return {
      fileId: article?.titleImageId ?? null,
      description: article ? `Titelbild des Artikels ${article.title}.` : "",
    };
  }
  if (art === "monster") {
    const monster = await getMonster(world.id, id, world.role, viewerId);
    return {
      fileId: monster?.portraitId ?? null,
      description: monster ? `Profilbild des Monsters ${monster.name}.` : "",
    };
  }

  const character = await getWorldCharacter(world.id, id);
  return {
    fileId: imageNumber ? character?.images[imageNumber - 1]?.fileId ?? null : character?.portraitId ?? null,
    description: character ? `${imageNumber ? `Bild ${imageNumber}` : "Profilbild"} des Charakters ${character.name}.` : "",
  };
}
