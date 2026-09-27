import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listLinked } from "@/lib/domain/relations";
import { resolveMcpWorld } from "../context";
import { MCP_CONTENT_KIND, MCP_CONTENT_KIND_FROM_INTERNAL, MCP_CONTENT_KIND_LABEL } from "../enums";
import { contentKind, readToolAuth, type ToolContext, withAudit, worldSchema } from "./shared";

export function registerRelationenAbrufenTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("relationen_abrufen", {
    title: "Relationen abrufen",
    description: "Lies sichtbare Verknüpfungen eines Inhalts. Unsichtbare Inhalte und Pfade werden nie ausgegeben.",
    ...readToolAuth,
    inputSchema: z.object({ welt: worldSchema, art: contentKind, id: z.string().uuid(), tiefe: z.union([z.literal(1), z.literal(2)]).optional() }),
  }, async ({ welt, art, id, tiefe }) => withAudit(ctx, "relationen_abrufen", async () => {
    const world = await resolveMcpWorld(ctx.userId, welt);
    const first = await listLinked({ worldId: world.id, role: world.role, viewerId: ctx.userId, kind: MCP_CONTENT_KIND[art], id });
    const lines = first.map((row) => `- ${row.title} (${MCP_CONTENT_KIND_LABEL[MCP_CONTENT_KIND_FROM_INTERNAL[row.kind]]}, ${row.id}) – Herkunft: ${row.originLabels.join(", ")}${row.manualLabel ? ` – ${row.manualLabel}` : ""}`);
    if (tiefe === 2) for (const row of first) {
      const next = await listLinked({ worldId: world.id, role: world.role, viewerId: ctx.userId, kind: row.kind, id: row.id });
      for (const child of next.filter((entry) => !(entry.kind === MCP_CONTENT_KIND[art] && entry.id === id))) {
        lines.push(`  - ${row.title} → ${child.title} (${MCP_CONTENT_KIND_LABEL[MCP_CONTENT_KIND_FROM_INTERNAL[child.kind]]}, ${child.id}) – Herkunft: ${child.originLabels.join(", ")}${child.manualLabel ? ` – ${child.manualLabel}` : ""}`);
      }
    }
    return { worldId: world.id, value: lines.length ? lines.join("\n") : "Keine sichtbaren Relationen." };
  }));
}
