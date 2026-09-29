import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { searchWorld } from "@/lib/domain/search";
import type { SearchHit } from "@/lib/search";
import { templateOf } from "@/lib/templates/registry";
import {
  MCP_CONTENT_KIND,
  MCP_CONTENT_KIND_FROM_INTERNAL,
  MCP_CONTENT_KIND_LABEL,
} from "../enums";
import { resolveMcpWorld } from "../context";
import { contentKind, type ToolContext, withAudit, worldSchema } from "./shared";

export function registerSearchTool(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "suchen",
    {
      title: "Inhalte suchen",
      description: "Suche sichtbare Inhalte in genau einer freigegebenen Welt. Wenn keine Welt bekannt ist, zuerst welten_auflisten nutzen; nie weltübergreifend suchen.",
      inputSchema: z.object({
        welt: worldSchema,
        suchbegriff: z.string().trim().min(2).max(200),
        art: contentKind.optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }).strict(),
    },
    async ({ welt, suchbegriff, art, limit }) => withAudit(ctx, "suchen", async () => {
      const world = await resolveMcpWorld(ctx.userId, welt);
      const hits = await searchWorld({
        worldId: world.id,
        role: world.role,
        viewerId: ctx.userId,
        query: suchbegriff,
        limit: limit ?? 20,
        kind: art ? MCP_CONTENT_KIND[art] : "all",
      });
      const value = hits.length
        ? hits.map(renderSearchHit).join("\n")
        : "Keine Treffer.";
      return { worldId: world.id, value };
    }),
  );
}

export function renderSearchHit(hit: SearchHit) {
  const kind = MCP_CONTENT_KIND_FROM_INTERNAL[hit.kind];
  const template = hit.templateType ? ` – ${templateOf(hit.templateType).label}` : "";
  const snippet = hit.snippet ? `\n  ${hit.snippet}` : "";
  return `- ${hit.title} (${MCP_CONTENT_KIND_LABEL[kind]}, ${hit.id})${template}${snippet}`;
}
