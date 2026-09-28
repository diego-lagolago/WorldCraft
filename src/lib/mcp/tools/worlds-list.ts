import { McpServer } from "@modelcontextprotocol/server";
import { listWorldCharacters } from "@/lib/domain/characters";
import { listMembers } from "@/lib/domain/members";
import { getWorldDetails } from "@/lib/domain/worlds";
import { tiptapJsonToMcpMarkdown } from "@/lib/editor/tiptap-mcp-markdown";
import { listMcpWorldMemberships } from "../context";
import { type ToolContext, withAudit } from "./shared";

export function registerWorldsListTool(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "welten_auflisten",
    {
      title: "Welten auflisten",
      description: "Liste die Welten des angemeldeten Benutzers. Vor einer Anfrage ohne bekannte Welt zuerst dieses Werkzeug nutzen.",
    },
    async () => withAudit(ctx, "welten_auflisten", async () => {
      const worlds = await listMcpWorldMemberships(ctx.userId);
      const lines = await Promise.all(worlds.map(async (world) => {
        if (!world.mcpEnabled) {
          return `## ${world.name}\nID: ${world.id}\nEigene Rolle: ${world.role}\nMCP für diese Welt nicht freigegeben.`;
        }
        const [details, members, characters] = await Promise.all([
          getWorldDetails(world.id),
          listMembers(world.id),
          listWorldCharacters(world.id),
        ]);
        const mine = characters.filter((character) => character.ownerId === ctx.userId);
        return [
          `## ${world.name}`,
          `ID: ${world.id}`,
          `Stand: ${world.updatedAt.toISOString()}`,
          details?.descriptionJson ? tiptapJsonToMcpMarkdown(details.descriptionJson) : "",
          `Eigene Rolle: ${world.role}`,
          mine.length ? `Eigene Charaktere: ${mine.map((character) => `${character.name} (${character.id})`).join(", ")}` : "",
          `Mitglieder: ${members.filter((member) => member.userId !== ctx.userId)
            .map((member) => `${member.name} (${member.role})`).join(", ") || "keine weiteren"}`,
        ].filter(Boolean).join("\n");
      }));
      return { value: lines.join("\n\n") || "Keine Welten vorhanden." };
    }),
  );
}
