import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { mcpEnum } from "../validation";
import { createManualRelation } from "@/lib/domain/relations";
import { resolveMcpWorld } from "../context";
import { MCP_CONTENT_KIND, MCP_CONTENT_KIND_LABEL } from "../enums";
import { mcpMembership, throwAuthz } from "../write-rich";
import { requireMcpWriteScope, type ToolContext, withAudit, worldSchema } from "./shared";

const endpoint = (name: "quelle" | "ziel") => z.object({
  art: mcpEnum(["artikel", "quest", "monster", "universum"], `${name}.art`),
  id: z.string().uuid(),
}).strict();

export function registerRelationCreateTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("relation_anlegen", {
    title: "Relation anlegen",
    description: [
      "Legt eine manuelle Verknüpfung zwischen zwei sichtbaren Inhalten an (nur Spielleitung).",
      "Quelle und Ziel: artikel, quest, monster oder universum — nie pin oder charakter.",
      "Keine Bestätigung nötig. Gelöscht wird nie.",
    ].join(" "),
    inputSchema: z.object({
      welt: worldSchema,
      quelle: endpoint("quelle"),
      ziel: endpoint("ziel"),
      bezeichnung: z.string().trim().min(1).max(120),
      gegenbezeichnung: z.string().trim().min(1).max(120).optional(),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async ({ welt, quelle, ziel, bezeichnung, gegenbezeichnung }) => withAudit(ctx, "relation_anlegen", async () => {
    requireMcpWriteScope(ctx);
    const world = await resolveMcpWorld(ctx.userId, welt);
    const result = await createManualRelation({
      membership: mcpMembership(world),
      actorId: ctx.userId,
      worldId: world.id,
      sourceKind: MCP_CONTENT_KIND[quelle.art],
      sourceId: quelle.id,
      targetKind: MCP_CONTENT_KIND[ziel.art],
      targetId: ziel.id,
      label: bezeichnung,
      counterLabel: gegenbezeichnung,
    });
    if (!result.ok) throwAuthz(result);
    return {
      worldId: world.id,
      value: [
        "Relation angelegt.",
        `ID: ${result.data.id}`,
        `Quelle: ${MCP_CONTENT_KIND_LABEL[quelle.art]} (${quelle.id})`,
        `Ziel: ${MCP_CONTENT_KIND_LABEL[ziel.art]} (${ziel.id})`,
        `Bezeichnung: ${bezeichnung}`,
        gegenbezeichnung ? `Gegenbezeichnung: ${gegenbezeichnung}` : null,
      ].filter(Boolean).join("\n"),
      audit: { targetKind: "relation", targetId: result.data.id, confirmed: false },
    };
  }));
}
