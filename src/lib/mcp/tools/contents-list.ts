import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listArticles } from "@/lib/domain/articles";
import { listMonsters } from "@/lib/domain/monsters";
import { MONSTER_KIND_LABEL, MONSTER_RARITY_LABEL } from "@/lib/monsters/labels";
import { templateOf } from "@/lib/templates/registry";
import { MCP_MONSTER_KIND_LABELS, MCP_TEMPLATE_TYPE } from "../enums";
import { McpToolError, resolveMcpWorld } from "../context";
import { type ToolContext, templateTypes, withAudit, worldSchema } from "./shared";

const monsterKindLabel = z.enum(MCP_MONSTER_KIND_LABELS);

/** Visible to MCP clients as both tool and parameter guidance. */
export const QUEST_ITEM_FILTER_GUIDANCE =
  'Bei Fragen nach Quest-Gegenständen sofort diesen Aufruf verwenden: art: "artikel", vorlagentyp: "gegenstand", quest_gegenstand: true. Nicht erst alle Artikel oder mehrere Welten durchsuchen.';

export function registerContentsListTool(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "inhalte_auflisten",
    {
      title: "Artikel oder Monster auflisten",
      description: `Liste sichtbare Artikel oder Monster einer freigegebenen Welt, wenn kein Suchbegriff nötig ist. ${QUEST_ITEM_FILTER_GUIDANCE}`,
      inputSchema: z.object({
        welt: worldSchema,
        art: z.enum(["artikel", "monster"]),
        vorlagentyp: templateTypes.optional(),
        monster_art: monsterKindLabel.optional(),
        quest_gegenstand: z.boolean().optional().describe(QUEST_ITEM_FILTER_GUIDANCE),
        limit: z.number().int().min(1).max(200).optional(),
      }).strict(),
    },
    async ({ welt, art, vorlagentyp, monster_art, quest_gegenstand, limit }) => withAudit(
      ctx,
      "inhalte_auflisten",
      async () => {
        validateContentsListInput({ art, vorlagentyp, monster_art, quest_gegenstand });

        const world = await resolveMcpWorld(ctx.userId, welt);
        if (art === "artikel") {
          const rows = await listArticles(
            world.id,
            world.role,
            ctx.userId,
            vorlagentyp ? MCP_TEMPLATE_TYPE[vorlagentyp] : "all",
          );
          const filtered = rows
            .filter((row) => quest_gegenstand === undefined || row.isQuestItem === quest_gegenstand)
            .slice(0, limit ?? 50);
          const value = filtered.length
            ? filtered.map((row) => renderArticleListItem(row)).join("\n")
            : "Keine Inhalte.";
          return { worldId: world.id, value };
        }

        const rows = await listMonsters(world.id, world.role, ctx.userId, "all");
        const filtered = rows
          .filter((row) => !monster_art || MONSTER_KIND_LABEL[row.kind] === monster_art)
          .slice(0, limit ?? 50);
        const value = filtered.length
          ? filtered.map((row) => {
              const boss = row.isBoss ? ", Boss" : "";
              return `- ${row.name} (${MONSTER_KIND_LABEL[row.kind]}, ${row.id}) – ${MONSTER_RARITY_LABEL[row.rarity]}${boss}`;
            }).join("\n")
          : "Keine Monster.";
        return { worldId: world.id, value };
      },
    ),
  );
}

type ContentsListInput = {
  art: "artikel" | "monster";
  vorlagentyp?: z.infer<typeof templateTypes>;
  monster_art?: z.infer<typeof monsterKindLabel>;
  quest_gegenstand?: boolean;
};

export function validateContentsListInput(input: ContentsListInput) {
  if (input.art === "artikel" && input.monster_art) {
    throw new McpToolError("monster_art ist nur bei art: monster erlaubt.");
  }
  if (input.art === "monster" && (input.vorlagentyp || input.quest_gegenstand !== undefined)) {
    throw new McpToolError("vorlagentyp und quest_gegenstand sind nur bei art: artikel erlaubt.");
  }
  if (input.quest_gegenstand !== undefined && input.vorlagentyp !== "gegenstand") {
    throw new McpToolError("quest_gegenstand ist nur bei vorlagentyp: gegenstand erlaubt.");
  }
}

export function renderArticleListItem(row: Awaited<ReturnType<typeof listArticles>>[number]) {
  const definition = templateOf(row.templateType);
  const rarityField = definition.fields.find(
    (field) => field.type === "select" && field.display === "rarity",
  );
  const rarity = rarityField?.type === "select"
    ? rarityField.options.find((option) => option.value === row.rarity)?.label
    : undefined;
  const questItem = row.isQuestItem ? " – Quest-Gegenstand" : "";
  return `- ${row.title} (${definition.label}, ${row.id})${rarity ? ` – ${rarity}` : ""}${questItem}`;
}
