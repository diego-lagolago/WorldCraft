import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getWorldDetails } from "@/lib/domain/worlds";
import { getAuthUrl } from "@/lib/env";
import type { ImageKind } from "@/lib/files/kinds";
import { createMcpConfirmation, registerMcpConfirmationHandler } from "../confirmations";
import { McpToolError, resolveMcpWorld, type McpWorldContext } from "../context";
import { createMcpUploadTicket } from "../upload-tickets";
import { visibleArticle, visibleMonster, worldStand } from "../write-shared";
import { assertStand, formatConfirmationPreview } from "../write-rich";
import { requireMcpWriteScope, type ToolContext, withAudit, worldSchema } from "./shared";

const uploadZiel = z.enum(["welt", "artikel", "monster"]);

const IMAGE_KIND_BY_ZIEL = {
  welt: "world_title",
  artikel: "article_title",
  monster: "monster_portrait",
} as const satisfies Record<z.infer<typeof uploadZiel>, ImageKind>;

const ZIEL_LABEL = {
  welt: "Welt-Titelbild",
  artikel: "Artikel-Titelbild",
  monster: "Monster-Profilbild",
} as const;

type UploadPayload = {
  operation: "bild_hochladen";
  ziel: z.infer<typeof uploadZiel>;
  id: string;
  stand: string;
};

async function loadUploadTarget(input: {
  world: McpWorldContext;
  ziel: z.infer<typeof uploadZiel>;
  id: string;
  stand: string;
}): Promise<{ title: string; hasImage: boolean; targetId: string }> {
  if (input.ziel === "welt") {
    if (input.id !== input.world.id) {
      throw new McpToolError("Für ein Weltbild muss die id der Welt entsprechen.");
    }
    const details = await getWorldDetails(input.world.id);
    if (!details) throw new McpToolError("Inhalt nicht gefunden.");
    const stand = await worldStand(input.world.userId, input.world.id);
    if (stand !== input.stand) {
      throw new McpToolError("Inhalt wurde inzwischen geändert, bitte neu lesen.");
    }
    return {
      title: details.name,
      hasImage: Boolean(details.titleImageId),
      targetId: input.world.id,
    };
  }
  if (input.ziel === "artikel") {
    const row = await visibleArticle(input.world, input.id);
    assertStand(row.updatedAt, input.stand);
    return {
      title: row.title,
      hasImage: Boolean(row.titleImageId),
      targetId: row.id,
    };
  }
  const row = await visibleMonster(input.world, input.id);
  assertStand(row.updatedAt, input.stand);
  return {
    title: row.name,
    hasImage: Boolean(row.portraitId),
    targetId: row.id,
  };
}

function formatUploadLink(input: {
  ziel: z.infer<typeof uploadZiel>;
  title: string;
  token: string;
  expiresAt: Date;
}): string {
  const url = `${getAuthUrl()}/upload/${input.token}`;
  return [
    `Upload-Link für ${ZIEL_LABEL[input.ziel]}: ${input.title}`,
    `Link: ${url}`,
    `Gültig bis: ${input.expiresAt.toISOString()} (15 Minuten, einmal nutzbar)`,
    `Agenten: curl -F "datei=@<pfad>" ${url}`,
    "Browser: Link öffnen und Datei wählen.",
  ].join("\n");
}

async function issueUploadTicket(input: {
  userId: string;
  clientId: string;
  world: McpWorldContext;
  ziel: z.infer<typeof uploadZiel>;
  id: string;
  stand: string;
}): Promise<{ worldId: string; value: string }> {
  const target = await loadUploadTarget({
    world: input.world,
    ziel: input.ziel,
    id: input.id,
    stand: input.stand,
  });
  const ticket = await createMcpUploadTicket({
    userId: input.userId,
    clientId: input.clientId,
    worldId: input.world.id,
    targetKind: input.ziel,
    targetId: target.targetId,
    imageKind: IMAGE_KIND_BY_ZIEL[input.ziel],
    expectedStand: input.stand,
  });
  return {
    worldId: input.world.id,
    value: formatUploadLink({
      ziel: input.ziel,
      title: target.title,
      token: ticket.token,
      expiresAt: ticket.expiresAt,
    }),
  };
}

registerMcpConfirmationHandler("bild_hochladen", async (row) => {
  const payload = row.payload as UploadPayload;
  const world = await resolveMcpWorld(row.userId, row.worldId);
  return issueUploadTicket({
    userId: row.userId,
    clientId: row.clientId,
    world,
    ziel: payload.ziel,
    id: payload.id,
    stand: payload.stand,
  });
});

export function registerImageUploadTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("bild_hochladen", {
    title: "Bild hochladen",
    description: [
      "Erzeugt einen einmaligen Upload-Link für ein Welt-Titelbild, Artikel-Titelbild oder Monster-Profilbild.",
      "stand ist immer Pflicht. Karten und Charaktere sind ausgeschlossen.",
      "Hat das Ziel bereits ein Bild, braucht der Ersetzen-Schritt zuerst eine Bestätigung (aenderung_bestaetigen).",
      "Gelöscht wird nie.",
    ].join(" "),
    inputSchema: z.object({
      welt: worldSchema,
      ziel: uploadZiel,
      id: z.string().uuid(),
      stand: z.string().min(1),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ welt, ziel, id, stand }) => withAudit(ctx, "bild_hochladen", async () => {
    requireMcpWriteScope(ctx);
    const world = await resolveMcpWorld(ctx.userId, welt);
    const target = await loadUploadTarget({ world, ziel, id, stand });

    if (target.hasImage) {
      const confirmation = await createMcpConfirmation({
        userId: ctx.userId,
        clientId: ctx.clientId,
        worldId: world.id,
        targetKind: ziel,
        targetId: target.targetId,
        expectedStand: stand,
        payload: {
          operation: "bild_hochladen",
          ziel,
          id: target.targetId,
          stand,
        } satisfies UploadPayload,
      });
      return {
        worldId: world.id,
        value: formatConfirmationPreview({
          lines: [
            `Ziel: ${ZIEL_LABEL[ziel]} – ${target.title}`,
            "Folge: Das vorhandene Bild wird durch den späteren Upload ersetzt.",
          ],
          token: confirmation.token,
          expiresAt: confirmation.expiresAt,
        }),
        audit: { targetKind: ziel, targetId: target.targetId, confirmed: false },
      };
    }

    const issued = await issueUploadTicket({
      userId: ctx.userId,
      clientId: ctx.clientId,
      world,
      ziel,
      id,
      stand,
    });
    return {
      ...issued,
      audit: { targetKind: ziel, targetId: target.targetId, confirmed: false },
    };
  }));
}
