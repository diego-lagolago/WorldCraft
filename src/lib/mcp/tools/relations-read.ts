import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listLinked } from "@/lib/domain/relations";
import {
  MCP_CONTENT_KIND,
  MCP_CONTENT_KIND_FROM_INTERNAL,
  MCP_CONTENT_KIND_LABEL,
} from "../enums";
import { resolveMcpWorld } from "../context";
import { contentKind, type ToolContext, withAudit, worldSchema } from "./shared";

export function registerRelationsReadTool(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "relationen_abrufen",
    {
      title: "Relationen abrufen",
      description: "Lies sichtbare Verknüpfungen eines Inhalts. Unsichtbare Inhalte und Pfade werden nie ausgegeben.",
      inputSchema: z.object({
        welt: worldSchema,
        art: contentKind,
        id: z.string().uuid(),
        tiefe: z.union([z.literal(1), z.literal(2)]).optional(),
      }).strict(),
    },
    async ({ welt, art, id, tiefe }) => withAudit(ctx, "relationen_abrufen", async () => {
      const world = await resolveMcpWorld(ctx.userId, welt);
      const first = await listLinked({
        worldId: world.id,
        role: world.role,
        viewerId: ctx.userId,
        kind: MCP_CONTENT_KIND[art],
        id,
      });
      const lines = first.map((row) => formatRelation(row));
      if (tiefe === 2) {
        for (const row of first) {
          const next = await listLinked({
            worldId: world.id,
            role: world.role,
            viewerId: ctx.userId,
            kind: row.kind,
            id: row.id,
          });
          for (const child of next.filter((entry) => !(entry.kind === MCP_CONTENT_KIND[art] && entry.id === id))) {
            lines.push(`  - ${row.title} → ${formatRelation(child).slice(2)}`);
          }
        }
      }
      return {
        worldId: world.id,
        value: lines.length ? lines.join("\n") : "Keine sichtbaren Relationen.",
      };
    }),
  );
}

function formatRelation(row: Awaited<ReturnType<typeof listLinked>>[number]) {
  const kind = MCP_CONTENT_KIND_FROM_INTERNAL[row.kind];
  const label = row.manualLabel ? ` – ${row.manualLabel}` : "";
  return `- ${row.title} (${MCP_CONTENT_KIND_LABEL[kind]}, ${row.id}) – Herkunft: ${row.originLabels.join(", ")}${label}`;
}
