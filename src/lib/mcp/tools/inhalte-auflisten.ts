import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listArticles } from "@/lib/domain/articles";
import { listMonsters } from "@/lib/domain/monsters";
import { MONSTER_KIND_LABEL, MONSTER_RARITY_LABEL } from "@/lib/monsters/labels";
import { templateOf } from "@/lib/templates/registry";
import { McpToolError, resolveMcpWorld } from "../context";
import { MCP_TEMPLATE_TYPE } from "../enums";
import { monsterKindLabel, readToolAuth, templateTypes, type ToolContext, withAudit, worldSchema } from "./shared";

export function registerInhalteAuflistenTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("inhalte_auflisten", {
    title: "Artikel oder Monster auflisten",
    description: "Liste sichtbare Artikel oder Monster einer freigegebenen Welt, wenn kein Suchbegriff nötig ist.",
    ...readToolAuth,
    inputSchema: z.object({
      welt: worldSchema,
      art: z.enum(["artikel", "monster"]),
      vorlagentyp: templateTypes.optional(),
      monster_art: monsterKindLabel.optional(),
      quest_gegenstand: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
  }, async ({ welt, art, vorlagentyp, monster_art, quest_gegenstand, limit }) => withAudit(ctx, "inhalte_auflisten", async () => {
    if (art === "artikel" && monster_art) throw new McpToolError("monster_art ist nur bei art: monster erlaubt.");
    if (art === "monster" && (vorlagentyp || quest_gegenstand !== undefined)) throw new McpToolError("vorlagentyp und quest_gegenstand sind nur bei art: artikel erlaubt.");
    if (quest_gegenstand !== undefined && vorlagentyp !== "gegenstand") throw new McpToolError("quest_gegenstand ist nur bei vorlagentyp: gegenstand erlaubt.");
    const world = await resolveMcpWorld(ctx.userId, welt);
    if (art === "artikel") {
      const rows = await listArticles(world.id, world.role, ctx.userId, vorlagentyp ? MCP_TEMPLATE_TYPE[vorlagentyp] : "all");
      const filtered = rows.filter((row) => quest_gegenstand === undefined || row.isQuestItem === quest_gegenstand).slice(0, limit ?? 50);
      return {
        worldId: world.id,
        value: filtered.length ? filtered.map((row) => {
          const rarityField = templateOf(row.templateType).fields.find((field) => field.type === "select" && field.display === "rarity");
          const rarity = rarityField?.type === "select" ? rarityField.options.find((option) => option.value === row.rarity)?.label : undefined;
          return `- ${row.title} (${templateOf(row.templateType).label}, ${row.id})${rarity ? ` – ${rarity}` : ""}${row.isQuestItem ? " – Quest-Gegenstand" : ""}`;
        }).join("\n") : "Keine Inhalte.",
      };
    }
    const rows = await listMonsters(world.id, world.role, ctx.userId, "all");
    const filtered = rows.filter((row) => !monster_art || MONSTER_KIND_LABEL[row.kind] === monster_art).slice(0, limit ?? 50);
    return {
      worldId: world.id,
      value: filtered.length ? filtered.map((row) => `- ${row.name} (${MONSTER_KIND_LABEL[row.kind]}, ${row.id}) – ${MONSTER_RARITY_LABEL[row.rarity]}${row.isBoss ? ", Boss" : ""}`).join("\n") : "Keine Monster.",
    };
  }));
}
