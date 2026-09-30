import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { mcpEnum } from "../validation";
import { createManualRelation, manualRelationExists } from "@/lib/domain/relations";
import { requireStaff } from "@/lib/authz";
import { createMcpConfirmation, registerMcpConfirmationHandler } from "../confirmations";
import { McpToolError, resolveMcpWorld, type McpWorldContext } from "../context";
import { MCP_CONTENT_KIND, MCP_CONTENT_KIND_LABEL, MCP_NOT_SET } from "../enums";
import { contentTitle, formatReceipt } from "../receipt";
import { formatConfirmationPreview, mcpMembership, throwAuthz } from "../write-rich";
import { requireMcpWriteScope, type ToolContext, withAudit, worldSchema } from "./shared";

const endpoint = (name: "quelle" | "ziel") => z.object({
  art: mcpEnum(["artikel", "quest", "monster", "universum"], `${name}.art`),
  id: z.string().uuid(),
}).strict();

type RelationArt = "artikel" | "quest" | "monster" | "universum";
type RelationEnd = { art: RelationArt; id: string };

type RelationPayload = {
  operation: "relation_anlegen";
  quelle: RelationEnd;
  ziel: RelationEnd;
  bezeichnung: string;
  gegenbezeichnung?: string;
};

/** Rights, visibility and titles of both ends; nothing is written (phase a). */
async function checkRelation(world: McpWorldContext, input: Omit<RelationPayload, "operation">) {
  const staff = requireStaff(mcpMembership(world));
  if (!staff.ok) throwAuthz(staff);
  if (input.quelle.art === input.ziel.art && input.quelle.id === input.ziel.id) {
    throw new McpToolError("Quelle und Ziel dürfen nicht identisch sein.");
  }
  if (await manualRelationExists({
    worldId: world.id,
    sourceKind: MCP_CONTENT_KIND[input.quelle.art], sourceId: input.quelle.id,
    targetKind: MCP_CONTENT_KIND[input.ziel.art], targetId: input.ziel.id,
  })) throw new McpToolError("Diese Verknüpfung gibt es schon.");
  const [sourceTitle, targetTitle] = await Promise.all([
    contentTitle(world, input.quelle.art, input.quelle.id),
    contentTitle(world, input.ziel.art, input.ziel.id),
  ]);
  return { sourceTitle, targetTitle };
}

const endLine = (end: RelationEnd, title: string) => `${MCP_CONTENT_KIND_LABEL[end.art]} „${title}“ (${end.id})`;

async function executeRelation(input: Omit<RelationPayload, "operation"> & { userId: string; world: McpWorldContext }) {
  const { sourceTitle, targetTitle } = await checkRelation(input.world, input);
  const result = await createManualRelation({
    membership: mcpMembership(input.world),
    actorId: input.userId,
    worldId: input.world.id,
    sourceKind: MCP_CONTENT_KIND[input.quelle.art],
    sourceId: input.quelle.id,
    targetKind: MCP_CONTENT_KIND[input.ziel.art],
    targetId: input.ziel.id,
    label: input.bezeichnung,
    counterLabel: input.gegenbezeichnung,
  });
  if (!result.ok) throwAuthz(result);
  return {
    worldId: input.world.id,
    value: formatReceipt({
      art: "relation", id: result.data.id, after: { title: `${sourceTitle} → ${targetTitle}` },
      extraLines: [`Quelle: ${endLine(input.quelle, sourceTitle)}`, `Ziel: ${endLine(input.ziel, targetTitle)}`],
      changes: [
        { label: "Bezeichnung", oldValue: MCP_NOT_SET, newValue: result.data.label ?? input.bezeichnung },
        { label: "Gegenbezeichnung", oldValue: MCP_NOT_SET, newValue: result.data.counterLabel ?? MCP_NOT_SET },
      ],
    }),
  };
}

registerMcpConfirmationHandler("relation_anlegen", async (row) => {
  const payload = row.payload as RelationPayload;
  return executeRelation({ ...payload, userId: row.userId, world: await resolveMcpWorld(row.userId, row.worldId) });
});

export function registerRelationCreateTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("relation_anlegen", {
    title: "Relation anlegen",
    description: [
      "Legt eine manuelle Verknüpfung zwischen zwei sichtbaren Inhalten an (nur Spielleitung).",
      "Quelle und Ziel: artikel, quest, monster oder universum — nie pin oder charakter.",
      "Immer mit Bestätigung: liefert zuerst eine Vorschau und ein Bestätigungs-Token (aenderung_bestaetigen). Gelöscht wird nie.",
    ].join(" "),
    inputSchema: z.object({
      welt: worldSchema,
      quelle: endpoint("quelle"),
      ziel: endpoint("ziel"),
      bezeichnung: z.string().trim().min(1).max(120),
      gegenbezeichnung: z.string().trim().min(1).max(120).optional(),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ welt, quelle, ziel, bezeichnung, gegenbezeichnung }) => withAudit(ctx, "relation_anlegen", async () => {
    requireMcpWriteScope(ctx);
    const world = await resolveMcpWorld(ctx.userId, welt);
    const change = { quelle, ziel, bezeichnung, gegenbezeichnung };
    const { sourceTitle, targetTitle } = await checkRelation(world, change);
    const confirmation = await createMcpConfirmation({
      userId: ctx.userId,
      clientId: ctx.clientId,
      worldId: world.id,
      targetKind: "relation",
      targetId: quelle.id,
      expectedStand: "",
      payload: { operation: "relation_anlegen", ...change } satisfies RelationPayload,
    });
    return {
      worldId: world.id,
      value: formatConfirmationPreview({
        art: "relation",
        title: `${sourceTitle} → ${targetTitle}`,
        lines: [
          "Neue Relation:",
          `- Quelle: ${endLine(quelle, sourceTitle)}`,
          `- Ziel: ${endLine(ziel, targetTitle)}`,
        ],
        changes: [
          { label: "Bezeichnung", oldValue: MCP_NOT_SET, newValue: bezeichnung },
          { label: "Gegenbezeichnung", oldValue: MCP_NOT_SET, newValue: gegenbezeichnung ?? MCP_NOT_SET },
        ],
        token: confirmation.token,
        expiresAt: confirmation.expiresAt,
      }),
      audit: { targetKind: "relation", targetId: quelle.id, confirmed: false },
    };
  }));
}
