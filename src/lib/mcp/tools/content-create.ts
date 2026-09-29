import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { CONTENT_VISIBILITY_LABEL } from "@/lib/authz";
import { createArticle, createArticleStub, deleteArticle } from "@/lib/domain/articles";
import { createMonster } from "@/lib/domain/monsters";
import { createChapter } from "@/lib/domain/quest-chapters";
import { createQuest, getQuest } from "@/lib/domain/quests";
import { createUniverse } from "@/lib/domain/universes";
import { mcpMarkdownToTiptap, resolveMcpMarkdown, type ResolvedMcpMarkdownMention } from "@/lib/editor/mcp-markdown";
import { McpMentionError, resolveMcpMarkdownMentions } from "@/lib/domain/mcp-mentions";
import { templateOf, type TemplateType } from "@/lib/templates/registry";
import { createMcpConfirmation, registerMcpConfirmationHandler } from "../confirmations";
import { McpToolError, resolveMcpWorld, type McpWorldContext } from "../context";
import { MCP_QUEST_STATUS, MCP_TEMPLATE_TYPE } from "../enums";
import {
  mapMonsterDanger,
  mapMonsterKind,
  mapMonsterRarity,
  mapMonsterSize,
  normalizeMonsterSheet,
  normalizeTemplateFieldsInput,
} from "../write-fields";
import {
  formatConfirmationPreview,
  formatCreateResult,
  mcpMembership,
  resolveMentionRef,
  resolveRichText,
  standOf,
  throwAuthz,
  visibilityLabel,
} from "../write-rich";
import { requireMcpWriteScope, type ToolContext, withAudit, worldSchema } from "./shared";

const createArt = z.enum(["artikel", "quest", "kapitel", "monster", "universum"]);

const articleFields = z.object({
  titel: z.string().trim().min(1).max(200),
  vorlagentyp: z.enum(["person", "ort", "organisation", "gegenstand", "rasse", "ohne"]).optional(),
  vorlagenfelder: z.record(z.string(), z.unknown()).optional(),
  text: z.string().optional(),
  sichtbarkeit: z.string().optional(),
}).strict();

const questFields = z.object({
  titel: z.string().trim().min(1).max(200),
  status: z.enum(["offen", "aktiv", "abgeschlossen", "gescheitert"]).optional(),
  beschreibung: z.string().optional(),
  beteiligte: z.array(z.string().uuid()).optional(),
  sichtbarkeit: z.string().optional(),
}).strict();

const chapterFields = z.object({
  quest_id: z.string().uuid(),
  titel: z.string().trim().min(1).max(200),
  status: z.enum(["offen", "aktiv", "abgeschlossen", "gescheitert"]).optional(),
  text: z.string().optional(),
  position: z.number().int().min(1).optional(),
  sichtbarkeit: z.string().optional(),
}).strict();

const monsterFields = z.object({
  name: z.string().trim().min(1).max(120),
  monster_art: z.string().optional(),
  seltenheit: z.string().optional(),
  boss: z.boolean().optional(),
  gefahr: z.string().optional(),
  groesse: z.string().optional(),
  lebensraum: z.unknown().optional(),
  charakterblatt: z.unknown().optional(),
  bio: z.string().optional(),
  sichtbarkeit: z.string().optional(),
}).strict();

const universeFields = z.object({
  name: z.string().trim().min(1).max(200),
  beschreibung: z.string().optional(),
  sichtbarkeit: z.string().optional(),
}).strict();

const fieldsByArt = {
  artikel: articleFields,
  quest: questFields,
  kapitel: chapterFields,
  monster: monsterFields,
  universum: universeFields,
} as const;

type CreatePayload = {
  operation: "inhalt_anlegen";
  art: z.infer<typeof createArt>;
  felder: Record<string, unknown>;
  stubTitles: string[];
  ignoredVisibility: boolean;
};

async function prepareTemplateFields(input: {
  templateType: TemplateType;
  raw: unknown;
  world: McpWorldContext;
}): Promise<{ fields: Record<string, unknown>; stubTitles: string[] }> {
  const normalized = normalizeTemplateFieldsInput(input.templateType, input.raw);
  const stubTitles: string[] = [];
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(normalized)) {
    const definition = templateOf(input.templateType).fields.find((field) => field.key === key);
    if (definition?.type === "ref") {
      const resolved = await resolveMentionRef({
        value,
        worldId: input.world.id,
        role: input.world.role,
        viewerId: input.world.userId,
        allowedKinds: ["article", "character"],
      });
      stubTitles.push(...resolved.stubs);
      if (!resolved.stubs.length) fields[key] = resolved.ref;
      else fields[key] = { __stubTitle: resolved.stubs[0] };
      continue;
    }
    fields[key] = value;
  }
  return { fields, stubTitles };
}

async function resolveHabitat(input: {
  value: unknown;
  world: McpWorldContext;
}): Promise<{ habitatArticleId?: string | null; stubTitles: string[] }> {
  if (input.value === undefined || input.value === null || input.value === "") {
    return { stubTitles: [] };
  }
  const resolved = await resolveMentionRef({
    value: input.value,
    worldId: input.world.id,
    role: input.world.role,
    viewerId: input.world.userId,
    allowedKinds: ["article"],
  });
  if (resolved.stubs.length) return { stubTitles: resolved.stubs };
  if (resolved.ref.kind !== "article") throw new McpToolError("Lebensraum muss ein Ort-Artikel sein.");
  return { habitatArticleId: resolved.ref.id, stubTitles: [] };
}

async function executeCreate(input: {
  ctx: ToolContext;
  world: McpWorldContext;
  art: z.infer<typeof createArt>;
  felder: Record<string, unknown>;
  stubTitles: string[];
  ignoredVisibility: boolean;
}): Promise<{ value: string; worldId: string; id: string }> {
  // Validate the only create target that has a parent before materializing stubs.
  // This guarantees a revoked or hidden quest cannot leave orphaned articles behind.
  if (input.art === "kapitel") {
    const chapter = chapterFields.parse(input.felder);
    const quest = await getQuest(input.world.id, chapter.quest_id, input.world.role, input.world.userId);
    if (!quest) throw new McpToolError("Quest nicht gefunden.");
  }
  const membership = mcpMembership(input.world);
  const stubArticles: { id: string; title: string }[] = [];
  const stubIdByTitle = new Map<string, string>();

  for (const title of input.stubTitles) {
    const created = await createArticleStub({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      title,
    });
    if (!created.ok) throwAuthz(created);
    stubArticles.push({ id: created.data.id, title: created.data.title });
    stubIdByTitle.set(title.toLocaleLowerCase("de"), created.data.id);
  }

  const fillStubRefs = (fields: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value && typeof value === "object" && !Array.isArray(value) && "__stubTitle" in value) {
        const title = String((value as { __stubTitle: string }).__stubTitle);
        const id = stubIdByTitle.get(title.toLocaleLowerCase("de"));
        if (!id) throw new McpToolError(`Stub „${title}“ konnte nicht zugeordnet werden.`);
        out[key] = { kind: "article", id };
        continue;
      }
      out[key] = value;
    }
    return out;
  };

  const rich = async (markdown: string | undefined) => {
    if (!markdown?.trim()) return undefined;
    const parsed = mcpMarkdownToTiptap(markdown, { mentions: true });
    const resolution = await resolveMcpMarkdownMentions({
      parsed,
      worldId: input.world.id,
      role: input.world.role,
      viewerId: input.world.userId,
    });
    if (resolution.stubs.length) {
      // Stubs were already created above; resolve remaining by title.
      const resolved: ResolvedMcpMarkdownMention[] = [...resolution.resolved];
      for (const mention of parsed.mentions) {
        if (resolved.some((entry) => entry.key === mention.key)) continue;
        const id = stubIdByTitle.get(mention.title.toLocaleLowerCase("de"));
        if (!id) throw new McpToolError(`Stub „${mention.title}“ fehlt nach der Bestätigung.`);
        resolved.push({ ...mention, kind: "article", id, title: mention.title });
      }
      return resolveMcpMarkdown(parsed, resolved, { mentions: true });
    }
    return resolution.doc ?? undefined;
  };

  try {
  if (input.art === "artikel") {
    const felder = articleFields.parse(input.felder);
    const templateType = MCP_TEMPLATE_TYPE[felder.vorlagentyp ?? "ohne"];
    const prepared = await prepareTemplateFields({
      templateType,
      raw: felder.vorlagenfelder,
      world: input.world,
    });
    const body = await rich(felder.text);
    const result = await createArticle({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      title: felder.titel,
      templateType,
      templateFields: fillStubRefs(prepared.fields),
      body,
      visibility: "owner_only",
    });
    if (!result.ok) throwAuthz(result);
    return {
      worldId: input.world.id,
      id: result.data.id,
      value: formatCreateResult({
        art: "artikel",
        id: result.data.id,
        title: result.data.title,
        stand: standOf(result.data.updatedAt),
        visibility: visibilityLabel(result.data.visibility),
        stubs: stubArticles,
        ignoredVisibility: input.ignoredVisibility,
      }),
    };
  }

  if (input.art === "quest") {
    const felder = questFields.parse(input.felder);
    const description = await rich(felder.beschreibung);
    const result = await createQuest({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      title: felder.titel,
      description,
      status: felder.status ? MCP_QUEST_STATUS[felder.status] : undefined,
      participantIds: felder.beteiligte,
      visibility: "owner_only",
    });
    if (!result.ok) throwAuthz(result);
    return {
      worldId: input.world.id,
      id: result.data.id,
      value: formatCreateResult({
        art: "quest",
        id: result.data.id,
        title: result.data.title,
        stand: standOf(result.data.updatedAt),
        visibility: visibilityLabel(result.data.visibility),
        stubs: stubArticles,
        ignoredVisibility: input.ignoredVisibility,
      }),
    };
  }

  if (input.art === "kapitel") {
    const felder = chapterFields.parse(input.felder);
    const body = await rich(felder.text);
    const result = await createChapter({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      questId: felder.quest_id,
      title: felder.titel,
      body,
      status: felder.status ? MCP_QUEST_STATUS[felder.status] : undefined,
      position: felder.position,
      visibility: "owner_only",
    });
    if (!result.ok) throwAuthz(result);
    const stand = standOf(result.data.updatedAt);
    return {
      worldId: input.world.id,
      id: result.data.id,
      value: formatCreateResult({
        art: "kapitel",
        id: result.data.id,
        title: result.data.title,
        stand,
        visibility: visibilityLabel(result.data.visibility),
        stubs: stubArticles,
        ignoredVisibility: input.ignoredVisibility,
      }),
    };
  }

  if (input.art === "monster") {
    const felder = monsterFields.parse(input.felder);
    const sheet = normalizeMonsterSheet(felder.charakterblatt);
    const habitat = await resolveHabitat({ value: felder.lebensraum, world: input.world });
    let habitatArticleId = habitat.habitatArticleId;
    if (habitat.stubTitles[0]) {
      habitatArticleId = stubIdByTitle.get(habitat.stubTitles[0].toLocaleLowerCase("de"));
    }
    const bio = await rich(felder.bio);
    const result = await createMonster({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      name: felder.name,
      kind: mapMonsterKind(felder.monster_art),
      rarity: mapMonsterRarity(felder.seltenheit),
      isBoss: felder.boss,
      danger: mapMonsterDanger(felder.gefahr),
      size: mapMonsterSize(felder.groesse),
      habitatArticleId: habitatArticleId ?? null,
      bio,
      ...sheet,
      visibility: "owner_only",
    });
    if (!result.ok) throwAuthz(result);
    return {
      worldId: input.world.id,
      id: result.data.monster.id,
      value: formatCreateResult({
        art: "monster",
        id: result.data.monster.id,
        title: result.data.monster.name,
        stand: standOf(result.data.monster.updatedAt),
        visibility: visibilityLabel(result.data.monster.visibility),
        stubs: stubArticles,
        ignoredVisibility: input.ignoredVisibility,
      }),
    };
  }

  const felder = universeFields.parse(input.felder);
  const description = await rich(felder.beschreibung);
  const result = await createUniverse({
    membership,
    actorId: input.ctx.userId,
    worldId: input.world.id,
    name: felder.name,
    description,
    visibility: "gm_only",
  });
  if (!result.ok) throwAuthz(result);
  return {
    worldId: input.world.id,
    id: result.data.id,
    value: formatCreateResult({
      art: "universum",
      id: result.data.id,
      title: result.data.name,
      stand: standOf(result.data.updatedAt),
      visibility: CONTENT_VISIBILITY_LABEL.gm_only,
      stubs: stubArticles,
      ignoredVisibility: input.ignoredVisibility,
    }),
  };
  } catch (error) {
    await Promise.all(stubArticles.map(async (stub) => {
      const removed = await deleteArticle({ membership, actorId: input.ctx.userId, worldId: input.world.id, articleId: stub.id });
      if (!removed.ok) console.error(JSON.stringify({ event: "mcp_stub_compensation_error", stubId: stub.id }));
    }));
    throw error;
  }
}

async function collectCreateStubs(input: {
  world: McpWorldContext;
  art: z.infer<typeof createArt>;
  felder: Record<string, unknown>;
}): Promise<{ stubTitles: string[]; ignoredVisibility: boolean }> {
  const ignoredVisibility = Object.prototype.hasOwnProperty.call(input.felder, "sichtbarkeit");
  const stubs = new Map<string, string>();
  const add = (titles: string[]) => { for (const title of titles) stubs.set(title.toLocaleLowerCase("de"), stubs.get(title.toLocaleLowerCase("de")) ?? title); };

  try {
    if (input.art === "artikel") {
      const felder = articleFields.parse(input.felder);
      const templateType = MCP_TEMPLATE_TYPE[felder.vorlagentyp ?? "ohne"];
      const prepared = await prepareTemplateFields({ templateType, raw: felder.vorlagenfelder, world: input.world });
      add(prepared.stubTitles);
      const text = await resolveRichText({
        markdown: felder.text,
        worldId: input.world.id,
        role: input.world.role,
        viewerId: input.world.userId,
        mentions: true,
      });
      add(text.stubs);
    } else if (input.art === "quest") {
      const felder = questFields.parse(input.felder);
      const text = await resolveRichText({
        markdown: felder.beschreibung,
        worldId: input.world.id,
        role: input.world.role,
        viewerId: input.world.userId,
        mentions: true,
      });
      add(text.stubs);
    } else if (input.art === "kapitel") {
      const felder = chapterFields.parse(input.felder);
      const text = await resolveRichText({
        markdown: felder.text,
        worldId: input.world.id,
        role: input.world.role,
        viewerId: input.world.userId,
        mentions: true,
      });
      add(text.stubs);
    } else if (input.art === "monster") {
      const felder = monsterFields.parse(input.felder);
      normalizeMonsterSheet(felder.charakterblatt);
      mapMonsterKind(felder.monster_art);
      mapMonsterRarity(felder.seltenheit);
      mapMonsterDanger(felder.gefahr);
      mapMonsterSize(felder.groesse);
      const habitat = await resolveHabitat({ value: felder.lebensraum, world: input.world });
      add(habitat.stubTitles);
      const bio = await resolveRichText({
        markdown: felder.bio,
        worldId: input.world.id,
        role: input.world.role,
        viewerId: input.world.userId,
        mentions: true,
      });
      add(bio.stubs);
    } else {
      const felder = universeFields.parse(input.felder);
      const text = await resolveRichText({
        markdown: felder.beschreibung,
        worldId: input.world.id,
        role: input.world.role,
        viewerId: input.world.userId,
        mentions: true,
      });
      add(text.stubs);
    }
  } catch (error) {
    if (error instanceof McpMentionError) throw new McpToolError(error.message);
    throw error;
  }
  return { stubTitles: [...stubs.values()], ignoredVisibility };
}

registerMcpConfirmationHandler("inhalt_anlegen", async (row) => {
  const payload = row.payload as CreatePayload;
  const world = await resolveMcpWorld(row.userId, row.worldId);
  return executeCreate({
    ctx: { userId: row.userId, clientId: row.clientId, scopes: ["worlds:write"] },
    world,
    art: payload.art,
    felder: payload.felder,
    stubTitles: payload.stubTitles,
    ignoredVisibility: payload.ignoredVisibility,
  });
});

export function registerContentCreateTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("inhalt_anlegen", {
    title: "Inhalt anlegen",
    description: [
      "Legt Artikel, Quests, Kapitel, Monster oder Universen an.",
      "Neue Inhalte starten mit Sichtbarkeit „nur ich“ (Universen: „nur Spielleitung“).",
      "Erwähnungen als @[Titel] oder @[Titel](artikel:id). Unbekannte Namen vorher per suchen prüfen.",
      "Würden Stub-Artikel entstehen, liefert das Werkzeug zuerst eine Vorschau und ein Bestätigungs-Token.",
      "Pins und Charaktere können nicht angelegt werden. Gelöscht wird nie.",
    ].join(" "),
    inputSchema: z.object({
      welt: worldSchema,
      art: createArt,
      felder: z.record(z.string(), z.unknown()),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ welt, art, felder }) => withAudit(ctx, "inhalt_anlegen", async () => {
    requireMcpWriteScope(ctx);
    const world = await resolveMcpWorld(ctx.userId, welt);
    const parsedFields = fieldsByArt[art].parse(felder);
    const { stubTitles, ignoredVisibility } = await collectCreateStubs({
      world,
      art,
      felder: parsedFields,
    });

    if (stubTitles.length) {
      const title = typeof (parsedFields as { titel?: string; name?: string }).titel === "string"
        ? (parsedFields as { titel: string }).titel
        : String((parsedFields as { name?: string }).name ?? "");
      const confirmation = await createMcpConfirmation({
        userId: ctx.userId,
        clientId: ctx.clientId,
        worldId: world.id,
        targetKind: art,
        targetId: "pending",
        expectedStand: "",
        payload: {
          operation: "inhalt_anlegen",
          art,
          felder: parsedFields,
          stubTitles,
          ignoredVisibility,
        } satisfies CreatePayload,
      });
      return {
        worldId: world.id,
        value: formatConfirmationPreview({
          art,
          title,
          stubTitles,
          token: confirmation.token,
          expiresAt: confirmation.expiresAt,
        }),
        audit: { targetKind: art, targetId: "pending", confirmed: false },
      };
    }

    const created = await executeCreate({
      ctx,
      world,
      art,
      felder: parsedFields,
      stubTitles: [],
      ignoredVisibility,
    });
    return {
      ...created,
      audit: { targetKind: art, targetId: created.id, confirmed: false },
    };
  }));
}
