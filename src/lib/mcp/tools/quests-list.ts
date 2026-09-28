import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listQuests } from "@/lib/domain/quests";
import { MCP_QUEST_STATUS, MCP_QUEST_STATUS_LABEL } from "../enums";
import { resolveMcpWorld } from "../context";
import { type ToolContext, questStatus, withAudit, worldSchema } from "./shared";

export function registerQuestsListTool(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "quests_auflisten",
    {
      title: "Quests auflisten",
      description: "Liste sichtbare Quests einer freigegebenen Welt, optional gefiltert nach Status.",
      inputSchema: z.object({ welt: worldSchema, status: questStatus.optional() }),
    },
    async ({ welt, status: requestedStatus }) => withAudit(ctx, "quests_auflisten", async () => {
      const world = await resolveMcpWorld(ctx.userId, welt);
      const rows = (await listQuests(world.id, world.role, ctx.userId))
        .filter((row) => !requestedStatus || row.status === MCP_QUEST_STATUS[requestedStatus]);
      const value = rows.length
        ? rows.map((row) => {
            const participants = row.participants.length
              ? ` – Beteiligte: ${row.participants.map((entry) => entry.characterName).join(", ")}`
              : "";
            return `- ${row.title} (${row.id}) – ${MCP_QUEST_STATUS_LABEL[row.status]}${participants}`;
          }).join("\n")
        : "Keine Quests.";
      return { worldId: world.id, value };
    }),
  );
}
