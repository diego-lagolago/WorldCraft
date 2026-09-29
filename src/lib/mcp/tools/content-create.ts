import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createMcpConfirmation, registerMcpConfirmationHandler } from "../confirmations";
import { resolveMcpWorld, type McpWorldContext } from "../context";
import { withMcpStubCompensation } from "../stub-compensation";
import { createStubPlan, materializeStubs } from "../write-shared";
import { receiptAfterWrite } from "../receipt";
import { formatConfirmationPreview, IGNORED_VISIBILITY, mcpMembership } from "../write-rich";
import { CREATE_HANDLERS } from "./create";
import { requireMcpWriteScope, type ToolContext, withAudit, worldSchema } from "./shared";
import { createArt, createFieldsInput, parseFelder, type CreateArt } from "./write-schemas";

type CreateRequest = {
  world: McpWorldContext;
  art: CreateArt;
  felder: Record<string, unknown>;
  ignoredVisibility: boolean;
};

type CreatePayload = Omit<CreateRequest, "world"> & {
  operation: "inhalt_anlegen";
  stubTitles: string[];
};

/** Checks the target (a), creates confirmed stubs (b), then writes (c) with stub compensation. */
async function executeCreate(input: CreateRequest & { ctx: ToolContext; stubTitles: string[] }) {
  const handler = CREATE_HANDLERS[input.art];
  await handler.check(input.felder, input.world);
  const membership = mcpMembership(input.world);
  const stubs = await materializeStubs({ world: input.world, actorId: input.ctx.userId, titles: input.stubTitles });
  const result = await withMcpStubCompensation({
    membership,
    actorId: input.ctx.userId,
    worldId: input.world.id,
    stubs: stubs.articles,
    write: () => handler.execute(input.felder, { ctx: input.ctx, world: input.world, membership, stubs }),
  });
  return {
    worldId: input.world.id,
    id: result.id,
    value: await receiptAfterWrite({
      world: input.world,
      art: input.art,
      id: result.id,
      before: null,
      result,
      stubs: stubs.articles,
      notes: input.ignoredVisibility ? [IGNORED_VISIBILITY] : [],
    }),
  };
}

registerMcpConfirmationHandler("inhalt_anlegen", async (row) => {
  const payload = row.payload as CreatePayload;
  return executeCreate({
    ...payload,
    ctx: { userId: row.userId, clientId: row.clientId, scopes: ["worlds:write"] },
    world: await resolveMcpWorld(row.userId, row.worldId),
  });
});

async function previewOrCreate(ctx: ToolContext, request: CreateRequest) {
  const handler = CREATE_HANDLERS[request.art];
  await handler.check(request.felder, request.world);
  const plan = createStubPlan();
  await handler.collect(request.felder, { world: request.world, stubs: plan });
  const stubTitles = plan.list();
  if (!stubTitles.length) {
    const created = await executeCreate({ ...request, ctx, stubTitles });
    return { ...created, audit: { targetKind: request.art, targetId: created.id, confirmed: false } };
  }
  const { world, ...change } = request;
  const confirmation = await createMcpConfirmation({
    userId: ctx.userId,
    clientId: ctx.clientId,
    worldId: world.id,
    targetKind: request.art,
    targetId: "pending",
    expectedStand: "",
    payload: { operation: "inhalt_anlegen", ...change, stubTitles } satisfies CreatePayload,
  });
  return {
    worldId: world.id,
    value: formatConfirmationPreview({
      art: request.art,
      title: handler.titleOf(request.felder),
      visibility: request.art === "universum" ? "nur Spielleitung" : "nur ich",
      lines: ["Folge: Der Inhalt und die geplanten Stub-Artikel werden angelegt."],
      stubTitles,
      token: confirmation.token,
      expiresAt: confirmation.expiresAt,
    }),
    audit: { targetKind: request.art, targetId: "pending", confirmed: false },
  };
}

const TOOL_DESCRIPTION = [
  "Legt Artikel, Quests, Kapitel, Monster oder Universen an.",
  "Neue Inhalte starten mit Sichtbarkeit „nur ich“ (Universen: „nur Spielleitung“).",
  "Erwähnungen als @[Titel] oder @[Titel](artikel:id); auch Verweise in vorlagenfelder und lebensraum nur in dieser Erwähnungssyntax.",
  "Unbekannte Namen vorher per suchen prüfen.",
  "Würden Stub-Artikel entstehen, liefert das Werkzeug zuerst eine Vorschau und ein Bestätigungs-Token.",
  "Pins und Charaktere können nicht angelegt werden. Gültige Felder je art stehen im Schema von felder; Vorlagenfelder nutzen deutsche Labels, etwa vorlagenfelder: { \"Seltenheit\": \"Gewöhnlich\" }. Gelöscht wird nie.",
].join(" ");

export function registerContentCreateTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("inhalt_anlegen", {
    title: "Inhalt anlegen",
    description: TOOL_DESCRIPTION,
    inputSchema: z.object({
      welt: worldSchema,
      art: createArt,
      felder: createFieldsInput,
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ welt, art, felder }) => withAudit(ctx, "inhalt_anlegen", async () => {
    requireMcpWriteScope(ctx);
    const world = await resolveMcpWorld(ctx.userId, welt);
    const parsed = parseFelder(CREATE_HANDLERS[art].schema, felder, art);
    const ignoredVisibility = Object.prototype.hasOwnProperty.call(parsed, "sichtbarkeit");
    return previewOrCreate(ctx, { world, art, felder: parsed, ignoredVisibility });
  }));
}
