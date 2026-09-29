import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { ContentVisibility, VisibilityStatus } from "@/lib/authz";
import { getArticle, updateArticle } from "@/lib/domain/articles";
import { getMonster, updateMonster } from "@/lib/domain/monsters";
import { listVisibleChapters, updateChapter, type ChapterSummary } from "@/lib/domain/quest-chapters";
import { getQuest, listQuests, updateQuest } from "@/lib/domain/quests";
import { getUniverse, updateUniverse } from "@/lib/domain/universes";
import { createMcpConfirmation, registerMcpConfirmationHandler } from "../confirmations";
import { McpToolError, resolveMcpWorld, type McpWorldContext } from "../context";
import {
  assertStand,
  formatCreateResult,
  mcpMembership,
  standOf,
  throwAuthz,
  visibilityLabel,
} from "../write-rich";
import { requireMcpWriteScope, type ToolContext, withAudit, worldSchema } from "./shared";

const visibilityArt = z.enum(["artikel", "quest", "kapitel", "monster", "universum"]);
const visibilityLabelInput = z.enum(["nur ich", "nur Spielleitung", "veröffentlicht"]);

const VISIBILITY_MAP = {
  "nur ich": "owner_only",
  "nur Spielleitung": "gm_only",
  veröffentlicht: "published",
} as const satisfies Record<z.infer<typeof visibilityLabelInput>, ContentVisibility>;

type VisibilityPayload = {
  operation: "sichtbarkeit_setzen";
  art: z.infer<typeof visibilityArt>;
  id: string;
  stand: string;
  sichtbarkeit: ContentVisibility;
};

async function findVisibleChapter(
  world: McpWorldContext,
  chapterId: string,
): Promise<{ questId: string; questTitle: string; chapter: ChapterSummary }> {
  const quests = await listQuests(world.id, world.role, world.userId);
  for (const quest of quests) {
    const chapters = await listVisibleChapters(world.id, quest.id, world.role, world.userId);
    if (!chapters) continue;
    const chapter = chapters.find((entry) => entry.id === chapterId);
    if (chapter) return { questId: quest.id, questTitle: quest.title, chapter };
  }
  throw new McpToolError("Inhalt nicht gefunden.");
}

async function loadVisibilityTarget(input: {
  world: McpWorldContext;
  art: z.infer<typeof visibilityArt>;
  id: string;
  stand: string;
}): Promise<{ title: string; current: ContentVisibility | VisibilityStatus }> {
  if (input.art === "artikel") {
    const row = await getArticle(input.world.id, input.id, input.world.role, input.world.userId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    assertStand(row.updatedAt, input.stand);
    return { title: row.title, current: row.visibility };
  }
  if (input.art === "quest") {
    const row = await getQuest(input.world.id, input.id, input.world.role, input.world.userId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    assertStand(row.updatedAt, input.stand);
    return { title: row.title, current: row.visibility };
  }
  if (input.art === "kapitel") {
    const found = await findVisibleChapter(input.world, input.id);
    assertStand(found.chapter.updatedAt, input.stand);
    return { title: found.chapter.title, current: found.chapter.visibility };
  }
  if (input.art === "monster") {
    const row = await getMonster(input.world.id, input.id, input.world.role, input.world.userId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    assertStand(row.updatedAt, input.stand);
    return { title: row.name, current: row.visibility };
  }
  const row = await getUniverse(input.world.id, input.id, input.world.role, input.world.userId);
  if (!row) throw new McpToolError("Inhalt nicht gefunden.");
  assertStand(row.updatedAt, input.stand);
  return { title: row.name, current: row.visibility };
}

async function executeVisibilitySet(input: {
  ctx: ToolContext;
  world: McpWorldContext;
  art: z.infer<typeof visibilityArt>;
  id: string;
  stand: string;
  sichtbarkeit: ContentVisibility;
}): Promise<{ worldId: string; value: string }> {
  const membership = mcpMembership(input.world);
  await loadVisibilityTarget({
    world: input.world,
    art: input.art,
    id: input.id,
    stand: input.stand,
  });

  if (input.art === "artikel") {
    const result = await updateArticle({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      articleId: input.id,
      visibility: input.sichtbarkeit,
    });
    if (!result.ok) throwAuthz(result);
    const row = await getArticle(input.world.id, input.id, input.world.role, input.world.userId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    return {
      worldId: input.world.id,
      value: formatCreateResult({
        art: "artikel",
        id: row.id,
        title: row.title,
        stand: standOf(row.updatedAt),
        visibility: visibilityLabel(row.visibility),
      }),
    };
  }

  if (input.art === "quest") {
    const result = await updateQuest({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      questId: input.id,
      visibility: input.sichtbarkeit,
    });
    if (!result.ok) throwAuthz(result);
    const row = await getQuest(input.world.id, input.id, input.world.role, input.world.userId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    return {
      worldId: input.world.id,
      value: formatCreateResult({
        art: "quest",
        id: row.id,
        title: row.title,
        stand: standOf(row.updatedAt),
        visibility: visibilityLabel(row.visibility),
      }),
    };
  }

  if (input.art === "kapitel") {
    const found = await findVisibleChapter(input.world, input.id);
    const result = await updateChapter({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      questId: found.questId,
      chapterId: input.id,
      visibility: input.sichtbarkeit,
    });
    if (!result.ok) throwAuthz(result);
    const refreshed = await findVisibleChapter(input.world, input.id);
    return {
      worldId: input.world.id,
      value: formatCreateResult({
        art: "kapitel",
        id: refreshed.chapter.id,
        title: refreshed.chapter.title,
        stand: standOf(refreshed.chapter.updatedAt),
        visibility: visibilityLabel(refreshed.chapter.visibility),
      }),
    };
  }

  if (input.art === "monster") {
    const result = await updateMonster({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      monsterId: input.id,
      visibility: input.sichtbarkeit,
    });
    if (!result.ok) throwAuthz(result);
    const row = await getMonster(input.world.id, input.id, input.world.role, input.world.userId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    return {
      worldId: input.world.id,
      value: formatCreateResult({
        art: "monster",
        id: row.id,
        title: row.name,
        stand: standOf(row.updatedAt),
        visibility: visibilityLabel(row.visibility),
      }),
    };
  }

  if (input.sichtbarkeit === "owner_only") {
    throw new McpToolError("Universen unterstützen die Sichtbarkeit „nur ich“ nicht.");
  }
  const result = await updateUniverse({
    membership,
    actorId: input.ctx.userId,
    worldId: input.world.id,
    universeId: input.id,
    visibility: input.sichtbarkeit,
  });
  if (!result.ok) throwAuthz(result);
  const row = await getUniverse(input.world.id, input.id, input.world.role, input.world.userId);
  if (!row) throw new McpToolError("Inhalt nicht gefunden.");
  return {
    worldId: input.world.id,
    value: formatCreateResult({
      art: "universum",
      id: row.id,
      title: row.name,
      stand: standOf(row.updatedAt),
      visibility: visibilityLabel(row.visibility),
    }),
  };
}

registerMcpConfirmationHandler("sichtbarkeit_setzen", async (row) => {
  const payload = row.payload as VisibilityPayload;
  const world = await resolveMcpWorld(row.userId, row.worldId);
  return executeVisibilitySet({
    ctx: { userId: row.userId, clientId: row.clientId, scopes: ["worlds:write"] },
    world,
    art: payload.art,
    id: payload.id,
    stand: payload.stand,
    sichtbarkeit: payload.sichtbarkeit,
  });
});

function formatVisibilityPreview(input: {
  art: string;
  title: string;
  from: string;
  to: string;
  token: string;
  expiresAt: Date;
}): string {
  return [
    "Änderung noch nicht ausgeführt. Bitte mit aenderung_bestaetigen bestätigen.",
    `Art: ${input.art}`,
    `Titel: ${input.title}`,
    `Sichtbarkeit: ${input.from} → ${input.to}`,
    "Folge: Wer den Inhalt danach sieht, hängt von der neuen Stufe ab (nur ich = nur Owner; nur Spielleitung = Spielleitung; veröffentlicht = alle Mitglieder).",
    `Bestätigungs-Token: ${input.token}`,
    `Gültig bis: ${input.expiresAt.toISOString()}`,
  ].join("\n");
}

export function registerVisibilitySetTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("sichtbarkeit_setzen", {
    title: "Sichtbarkeit setzen",
    description: [
      "Ändert die Sichtbarkeit eines Inhalts. Nur auf ausdrückliche Anweisung des Benutzers verwenden und vorher die Folgen nennen (wer den Inhalt danach sieht).",
      "Immer mit Bestätigung (aenderung_bestaetigen). stand ist Pflicht.",
      "Universen akzeptieren nur „nur Spielleitung“ und „veröffentlicht“.",
      "Gelöscht wird nie.",
    ].join(" "),
    inputSchema: z.object({
      welt: worldSchema,
      art: visibilityArt,
      id: z.string().uuid(),
      stand: z.string().min(1),
      sichtbarkeit: visibilityLabelInput,
    }).superRefine((value, ctx) => {
      if (value.art === "universum" && value.sichtbarkeit === "nur ich") {
        ctx.addIssue({
          code: "custom",
          path: ["sichtbarkeit"],
          message: "Universen unterstützen die Sichtbarkeit „nur ich“ nicht.",
        });
      }
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ welt, art, id, stand, sichtbarkeit }) => withAudit(ctx, "sichtbarkeit_setzen", async () => {
    requireMcpWriteScope(ctx);
    const world = await resolveMcpWorld(ctx.userId, welt);
    const next = VISIBILITY_MAP[sichtbarkeit];
    const loaded = await loadVisibilityTarget({ world, art, id, stand });
    const confirmation = await createMcpConfirmation({
      userId: ctx.userId,
      clientId: ctx.clientId,
      worldId: world.id,
      targetKind: art,
      targetId: id,
      expectedStand: stand,
      payload: {
        operation: "sichtbarkeit_setzen",
        art,
        id,
        stand,
        sichtbarkeit: next,
      } satisfies VisibilityPayload,
    });
    return {
      worldId: world.id,
      value: formatVisibilityPreview({
        art,
        title: loaded.title,
        from: visibilityLabel(loaded.current),
        to: sichtbarkeit,
        token: confirmation.token,
        expiresAt: confirmation.expiresAt,
      }),
      audit: { targetKind: art, targetId: id, confirmed: false },
    };
  }));
}
