import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { ContentVisibility, MembershipRow, VisibilityStatus } from "@/lib/authz";
import { updateArticle } from "@/lib/domain/articles";
import { updateMonster } from "@/lib/domain/monsters";
import { updateChapter } from "@/lib/domain/quest-chapters";
import { updateQuest } from "@/lib/domain/quests";
import { updateUniverse } from "@/lib/domain/universes";
import { createMcpConfirmation, registerMcpConfirmationHandler } from "../confirmations";
import { McpToolError, resolveMcpWorld, type McpWorldContext } from "../context";
import { findVisibleChapter, visibleArticle, visibleMonster, visibleQuest, visibleUniverse } from "../write-shared";
import {
  assertStand,
  formatConfirmationPreview,
  formatCreateResult,
  mcpMembership,
  standOf,
  throwAuthz,
  visibilityLabel,
} from "../write-rich";
import { requireMcpWriteScope, type ToolContext, withAudit, worldSchema } from "./shared";

const visibilityArt = z.enum(["artikel", "quest", "kapitel", "monster", "universum"]);
const visibilityLabelInput = z.enum(["nur ich", "nur Spielleitung", "veröffentlicht"]);

type VisibilityArt = z.infer<typeof visibilityArt>;

const VISIBILITY_MAP = {
  "nur ich": "owner_only",
  "nur Spielleitung": "gm_only",
  veröffentlicht: "published",
} as const satisfies Record<z.infer<typeof visibilityLabelInput>, ContentVisibility>;

const VISIBILITY_CONSEQUENCE: Record<ContentVisibility, string> = {
  owner_only: "Danach sieht nur noch der Owner den Inhalt; alle anderen Mitglieder, auch die Spielleitung, verlieren den Zugriff.",
  gm_only: "Danach sehen nur Game Master und Master den Inhalt; Player sehen ihn nicht.",
  published: "Danach sehen alle Mitglieder der Welt den Inhalt, auch alle Player.",
};

type VisibilityPayload = {
  operation: "sichtbarkeit_setzen";
  art: VisibilityArt;
  id: string;
  stand: string;
  sichtbarkeit: ContentVisibility;
};

type VisibilityTarget = { id: string; title: string; updatedAt: Date; current: ContentVisibility | VisibilityStatus };

type WriteInput = {
  membership: MembershipRow;
  actorId: string;
  world: McpWorldContext;
  id: string;
  visibility: ContentVisibility;
  expectedUpdatedAt: Date;
};

type VisibilityHandler = {
  load: (world: McpWorldContext, id: string) => Promise<VisibilityTarget>;
  write: (input: WriteInput) => Promise<{ ok: true } | { ok: false; error: string }>;
};

function target(row: { id: string; updatedAt: Date; visibility: ContentVisibility | VisibilityStatus }, title: string) {
  return { id: row.id, title, updatedAt: row.updatedAt, current: row.visibility };
}

const HANDLERS: Record<VisibilityArt, VisibilityHandler> = {
  artikel: {
    load: async (world, id) => { const row = await visibleArticle(world, id); return target(row, row.title); },
    write: ({ world, id, ...input }) => updateArticle({ ...input, worldId: world.id, articleId: id }),
  },
  quest: {
    load: async (world, id) => { const row = await visibleQuest(world, id); return target(row, row.title); },
    write: ({ world, id, ...input }) => updateQuest({ ...input, worldId: world.id, questId: id }),
  },
  kapitel: {
    load: async (world, id) => {
      const { chapter } = await findVisibleChapter(world, id);
      return target(chapter, chapter.title);
    },
    write: async ({ world, id, ...input }) => {
      const { questId } = await findVisibleChapter(world, id);
      return updateChapter({ ...input, worldId: world.id, questId, chapterId: id });
    },
  },
  monster: {
    load: async (world, id) => { const row = await visibleMonster(world, id); return target(row, row.name); },
    write: ({ world, id, ...input }) => updateMonster({ ...input, worldId: world.id, monsterId: id }),
  },
  universum: {
    load: async (world, id) => { const row = await visibleUniverse(world, id); return target(row, row.name); },
    write: async ({ world, id, ...input }) => {
      if (input.visibility === "owner_only") throw new McpToolError("Universen unterstützen die Sichtbarkeit „nur ich“ nicht.");
      return updateUniverse({ ...input, visibility: input.visibility, worldId: world.id, universeId: id });
    },
  },
};

async function loadCurrentTarget(world: McpWorldContext, art: VisibilityArt, id: string, stand: string) {
  const loaded = await HANDLERS[art].load(world, id);
  assertStand(loaded.updatedAt, stand);
  return loaded;
}

async function executeVisibilitySet(input: Omit<VisibilityPayload, "operation"> & {
  ctx: ToolContext;
  world: McpWorldContext;
}): Promise<{ worldId: string; value: string }> {
  await loadCurrentTarget(input.world, input.art, input.id, input.stand);
  const result = await HANDLERS[input.art].write({
    membership: mcpMembership(input.world),
    actorId: input.ctx.userId,
    world: input.world,
    id: input.id,
    visibility: input.sichtbarkeit,
    expectedUpdatedAt: new Date(input.stand),
  });
  if (!result.ok) throwAuthz(result);
  const updated = await HANDLERS[input.art].load(input.world, input.id);
  return {
    worldId: input.world.id,
    value: formatCreateResult({
      art: input.art,
      id: updated.id,
      title: updated.title,
      stand: standOf(updated.updatedAt),
      visibility: visibilityLabel(updated.current),
    }),
  };
}

registerMcpConfirmationHandler("sichtbarkeit_setzen", async (row) => {
  const payload = row.payload as VisibilityPayload;
  return executeVisibilitySet({
    ...payload,
    ctx: { userId: row.userId, clientId: row.clientId, scopes: ["worlds:write"] },
    world: await resolveMcpWorld(row.userId, row.worldId),
  });
});

const TOOL_DESCRIPTION = [
  "Ändert die Sichtbarkeit eines Inhalts. Nur auf ausdrückliche Anweisung des Benutzers verwenden und vorher die Folgen nennen (wer den Inhalt danach sieht).",
  "Immer mit Bestätigung (aenderung_bestaetigen). stand ist Pflicht.",
  "Universen akzeptieren nur „nur Spielleitung“ und „veröffentlicht“.",
  "Gelöscht wird nie.",
].join(" ");

const inputSchema = z.object({
  welt: worldSchema,
  art: visibilityArt,
  id: z.string().uuid(),
  stand: z.string().min(1),
  sichtbarkeit: visibilityLabelInput,
}).superRefine((value, ctx) => {
  if (value.art === "universum" && value.sichtbarkeit === "nur ich") {
    ctx.addIssue({ code: "custom", path: ["sichtbarkeit"], message: "Universen unterstützen die Sichtbarkeit „nur ich“ nicht." });
  }
});

export function registerVisibilitySetTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("sichtbarkeit_setzen", {
    title: "Sichtbarkeit setzen",
    description: TOOL_DESCRIPTION,
    inputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ welt, art, id, stand, sichtbarkeit }) => withAudit(ctx, "sichtbarkeit_setzen", async () => {
    requireMcpWriteScope(ctx);
    const world = await resolveMcpWorld(ctx.userId, welt);
    const next = VISIBILITY_MAP[sichtbarkeit];
    const loaded = await loadCurrentTarget(world, art, id, stand);
    const payload = { operation: "sichtbarkeit_setzen", art, id, stand, sichtbarkeit: next } satisfies VisibilityPayload;
    const confirmation = await createMcpConfirmation({
      userId: ctx.userId,
      clientId: ctx.clientId,
      worldId: world.id,
      targetKind: art,
      targetId: id,
      expectedStand: stand,
      payload,
    });
    return {
      worldId: world.id,
      value: formatConfirmationPreview({
        lines: [
          `Art: ${art}`,
          `Titel: ${loaded.title}`,
          `Sichtbarkeit: ${visibilityLabel(loaded.current)} → ${sichtbarkeit}`,
          `Folge: ${VISIBILITY_CONSEQUENCE[next]}`,
        ],
        token: confirmation.token,
        expiresAt: confirmation.expiresAt,
      }),
      audit: { targetKind: art, targetId: id, confirmed: false },
    };
  }));
}
