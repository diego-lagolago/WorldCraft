import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { consumeMcpConfirmation, executeMcpConfirmation } from "../confirmations";
import { McpToolError } from "../context";
import { requireMcpWriteScope, type ToolContext, withAudit } from "./shared";

export function registerChangeConfirmTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("aenderung_bestaetigen", {
    title: "Änderung bestätigen",
    description: "Führt eine zuvor angezeigte Änderung mit ihrem Bestätigungs-Token aus.",
    inputSchema: z.object({ token: z.string().min(20) }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ token }) => withAudit(ctx, "aenderung_bestaetigen", async () => {
    requireMcpWriteScope(ctx);
    const confirmation = await consumeMcpConfirmation({ token, userId: ctx.userId, clientId: ctx.clientId });
    if (!confirmation) throw new McpToolError("Bestätigungs-Token ist ungültig oder abgelaufen.");
    const result = await executeMcpConfirmation(confirmation);
    return {
      worldId: result.worldId ?? confirmation.worldId,
      value: result.value,
      audit: {
        targetKind: confirmation.targetKind,
        targetId: confirmation.targetId,
        confirmed: true,
      },
    };
  }));
}
