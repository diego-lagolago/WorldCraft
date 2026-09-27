import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listQuests } from "@/lib/domain/quests";
import { resolveMcpWorld } from "../context";
import { MCP_QUEST_STATUS, MCP_QUEST_STATUS_LABEL } from "../enums";
import { readToolAuth, status, type ToolContext, withAudit, worldSchema } from "./shared";

export function registerQuestsAuflistenTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("quests_auflisten", {
    title: "Quests auflisten",
    description: "Liste sichtbare Quests einer freigegebenen Welt, optional gefiltert nach Status.",
    ...readToolAuth,
    inputSchema: z.object({ welt: worldSchema, status: status.optional() }),
  }, async ({ welt, status: requestedStatus }) => withAudit(ctx, "quests_auflisten", async () => {
    const world = await resolveMcpWorld(ctx.userId, welt);
    const rows = (await listQuests(world.id, world.role, ctx.userId)).filter((row) => !requestedStatus || row.status === MCP_QUEST_STATUS[requestedStatus]);
    return {
      worldId: world.id,
      value: rows.length ? rows.map((row) => `- ${row.title} (${row.id}) – ${MCP_QUEST_STATUS_LABEL[row.status]}${row.participants.length ? ` – Beteiligte: ${row.participants.map((entry) => entry.characterName).join(", ")}` : ""}`).join("\n") : "Keine Quests.",
    };
  }));
}
