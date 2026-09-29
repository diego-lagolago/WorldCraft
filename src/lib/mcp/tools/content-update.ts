import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { mcpEnum } from "../validation";
import { createMcpConfirmation, registerMcpConfirmationHandler } from "../confirmations";
import { McpToolError, resolveMcpWorld, type McpWorldContext } from "../context";
import { withMcpStubCompensation } from "../stub-compensation";
import { createStubPlan, materializeStubs } from "../write-shared";
import { formatConfirmationPreview, formatCreateResult, formatStubLines, mcpMembership } from "../write-rich";
import { requireMcpWriteScope, type ToolContext, withAudit, worldSchema } from "./shared";
import type { FieldChange, PreviewContext, RichModus } from "./update/common";
import { UPDATE_HANDLERS } from "./update";
import { parseFelder, updateArt, updateFieldsInput, type UpdateArt } from "./write-schemas";

type UpdateRequest = {
  world: McpWorldContext;
  art: UpdateArt;
  id: string;
  stand: string;
  felder: Record<string, unknown>;
  modus: RichModus;
};

type UpdatePayload = Omit<UpdateRequest, "world"> & {
  operation: "inhalt_aendern";
  stubTitles: string[];
};

type PreparedUpdate = {
  title: string;
  changes: FieldChange[];
  stubTitles: string[];
  executeImmediately: boolean;
};

function valueLines(prefix: string, value: string): string[] {
  const [first, ...rest] = value.split("\n");
  return [`  ${prefix}: ${first}`, ...rest.map((line) => `    ${line}`)];
}

function formatChanges(changes: FieldChange[]): string[] {
  return ["Geänderte Felder:", ...changes.flatMap((change) => [
    `- ${change.label}:`,
    ...valueLines("alt", change.oldValue),
    ...valueLines("neu", change.newValue),
  ])];
}

/** Phase a for previews: visibility, stand and field validation; nothing is written. */
async function prepareUpdate(input: UpdateRequest): Promise<PreparedUpdate> {
  const target = await UPDATE_HANDLERS[input.art].load(input.world, input.id, input.stand);
  const context: PreviewContext = { world: input.world, modus: input.modus, changes: [], stubs: createStubPlan() };
  const summary = await target.preview(input.felder, context);
  const stubTitles = context.stubs.list();
  return {
    title: summary.title,
    changes: context.changes,
    stubTitles,
    executeImmediately: Boolean(summary.skipConfirmation) && stubTitles.length === 0,
  };
}

/** Checks target and stand (a), creates confirmed stubs (b), then writes (c) with stub compensation. */
async function executeUpdate(input: UpdateRequest & { ctx: ToolContext; stubTitles: string[] }) {
  const handler = UPDATE_HANDLERS[input.art];
  const target = await handler.load(input.world, input.id, input.stand);
  const membership = mcpMembership(input.world);
  const stubs = await materializeStubs({
    world: input.world,
    actorId: input.ctx.userId,
    titles: handler.allowStubs ? input.stubTitles : [],
  });
  return withMcpStubCompensation({
    membership,
    actorId: input.ctx.userId,
    worldId: input.world.id,
    stubs: stubs.articles,
    write: async () => {
      const result = await target.execute(input.felder, {
        ctx: input.ctx,
        world: input.world,
        membership,
        modus: input.modus,
        stand: input.stand,
        expectedUpdatedAt: new Date(input.stand),
        stubs,
      });
      return {
        worldId: input.world.id,
        value: formatCreateResult({ art: input.art, ...result, stubs: stubs.articles }),
      };
    },
  });
}

registerMcpConfirmationHandler("inhalt_aendern", async (row) => {
  const payload = row.payload as UpdatePayload;
  return executeUpdate({
    ...payload,
    ctx: { userId: row.userId, clientId: row.clientId, scopes: ["worlds:write"] },
    world: await resolveMcpWorld(row.userId, row.worldId),
  });
});

async function previewOrExecute(ctx: ToolContext, request: UpdateRequest) {
  const audit = { targetKind: request.art, targetId: request.id, confirmed: false };
  const prepared = await prepareUpdate(request);
  if (!prepared.changes.length) {
    throw new McpToolError("Keine Änderung: Die übergebenen Werte entsprechen dem aktuellen Stand.");
  }
  if (prepared.executeImmediately) {
    return { ...await executeUpdate({ ...request, ctx, stubTitles: [] }), audit };
  }
  const { world, ...change } = request;
  const confirmation = await createMcpConfirmation({
    userId: ctx.userId,
    clientId: ctx.clientId,
    worldId: world.id,
    targetKind: request.art,
    targetId: request.id,
    expectedStand: request.stand,
    payload: { operation: "inhalt_aendern", ...change, stubTitles: prepared.stubTitles } satisfies UpdatePayload,
  });
  return {
    worldId: world.id,
    value: formatConfirmationPreview({
      lines: [
        `Art: ${request.art}`,
        `Titel: ${prepared.title}`,
        ...formatChanges(prepared.changes),
        ...formatStubLines(prepared.stubTitles),
      ],
      token: confirmation.token,
      expiresAt: confirmation.expiresAt,
    }),
    audit,
  };
}

const TOOL_DESCRIPTION = [
  "Ändert bestehende Artikel, Quests, Kapitel, Notizblöcke, Monster, Universen oder die Welt.",
  "stand ist immer Pflicht (aus inhalt_lesen, beim Notizblock die version, bei der Welt aus welten_auflisten).",
  "Rich-Text-Modus: anhaengen (Standard) oder ersetzen.",
  "Änderungen an bestehendem Inhalt brauchen eine Bestätigung (aenderung_bestaetigen), außer bei leeren Artikeln ohne Stub-Anlage.",
  "Erwähnungen als @[Titel] oder @[Titel](artikel:id); auch Verweise in vorlagenfelder und lebensraum nur in dieser Erwähnungssyntax.",
  "Notizblock und Weltbeschreibung legen keine Stubs an.",
  "Pins und Charaktere können nicht geändert werden. Gültige Felder je art stehen im Schema von felder; Vorlagenfelder nutzen deutsche Labels, etwa vorlagenfelder: { \"Seltenheit\": \"Gewöhnlich\" }. Gelöscht wird nie.",
].join(" ");

export function registerContentUpdateTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("inhalt_aendern", {
    title: "Inhalt ändern",
    description: TOOL_DESCRIPTION,
    inputSchema: z.object({
      welt: worldSchema,
      art: updateArt,
      id: z.string().uuid(),
      stand: z.string().min(1),
      felder: updateFieldsInput,
      modus: mcpEnum(["anhaengen", "ersetzen"], "modus").optional(),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ welt, art, id, stand, felder, modus }) => withAudit(ctx, "inhalt_aendern", async () => {
    requireMcpWriteScope(ctx);
    const world = await resolveMcpWorld(ctx.userId, welt);
    const parsed = parseFelder(UPDATE_HANDLERS[art].schema, felder, art);
    if (!Object.keys(parsed).length) throw new McpToolError("Mindestens ein Feld muss geändert werden.");
    return previewOrExecute(ctx, { world, art, id, stand, felder: parsed, modus: modus ?? "anhaengen" });
  }));
}
