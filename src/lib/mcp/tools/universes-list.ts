import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listMcpUniverseMaps } from "@/lib/domain/mcp-read";
import { tiptapJsonToMcpMarkdown } from "@/lib/editor/tiptap-mcp-markdown";
import { resolveMcpWorld } from "../context";
import { type ToolContext, withAudit, worldSchema } from "./shared";

export function registerUniversesListTool(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "universen_auflisten",
    {
      title: "Universen auflisten",
      description: "Liste sichtbare Universen einer freigegebenen Welt und ihre Karten. Pins, Marker, Kartenbilder und Koordinaten werden nicht geliefert.",
      inputSchema: z.object({ welt: worldSchema }).strict(),
    },
    async ({ welt }) => withAudit(ctx, "universen_auflisten", async () => {
      const world = await resolveMcpWorld(ctx.userId, welt);
      const rows = await listMcpUniverseMaps(world.id, { role: world.role, userId: ctx.userId });
      const value = rows.length
        ? rows.map((row) => [
            `## ${row.name}`,
            `ID: ${row.id}`,
            tiptapJsonToMcpMarkdown(row.descriptionJson),
            row.maps.length
              ? `Karten: ${row.maps.map((map) => `${map.name} (${map.id})`).join(", ")}`
              : "Karten: keine",
          ].filter(Boolean).join("\n")).join("\n\n")
        : "Keine Universen.";
      return { worldId: world.id, value };
    }),
  );
}
