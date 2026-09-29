import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getArticle, updateArticle, createArticleStub } from "@/lib/domain/articles";
import { getMonster, updateMonster } from "@/lib/domain/monsters";
import {
  listVisibleChapters,
  reorderChapters,
  updateChapter,
  type ChapterSummary,
} from "@/lib/domain/quest-chapters";
import { getQuest, listQuests, updateQuest } from "@/lib/domain/quests";
import { getQuestNote, saveQuestNote } from "@/lib/domain/quest-notes";
import { getUniverse, updateUniverse } from "@/lib/domain/universes";
import { getWorldDetails, updateWorld } from "@/lib/domain/worlds";
import { McpMentionError, resolveMcpMarkdownMentions } from "@/lib/domain/mcp-mentions";
import {
  mcpMarkdownToTiptap,
  resolveMcpMarkdown,
  type ResolvedMcpMarkdownMention,
} from "@/lib/editor/mcp-markdown";
import { asRichDoc, plainTextOf, type RichDoc } from "@/lib/editor/rich-text";
import { tiptapJsonToMcpMarkdown } from "@/lib/editor/tiptap-mcp-markdown";
import {
  MONSTER_DANGER_LABEL,
  MONSTER_KIND_LABEL,
  MONSTER_RARITY_LABEL,
  MONSTER_SIZE_LABEL,
} from "@/lib/monsters/labels";
import { templateFieldsHaveValue, type StoredTemplateFields } from "@/lib/templates/fields";
import { isTemplateType, templateOf, type TemplateType } from "@/lib/templates/registry";
import { createMcpConfirmation, registerMcpConfirmationHandler } from "../confirmations";
import { listMcpWorldMemberships, McpToolError, resolveMcpWorld, type McpWorldContext } from "../context";
import { MCP_QUEST_STATUS, MCP_QUEST_STATUS_LABEL, MCP_TEMPLATE_TYPE } from "../enums";
import {
  mapMonsterDanger,
  mapMonsterKind,
  mapMonsterRarity,
  mapMonsterSize,
  normalizeMonsterSheet,
  normalizeTemplateFieldsInput,
} from "../write-fields";
import {
  assertStand,
  formatCreateResult,
  mcpMembership,
  resolveMentionRef,
  resolveRichText,
  standOf,
  throwAuthz,
  visibilityLabel,
} from "../write-rich";
import { requireMcpWriteScope, type ToolContext, withAudit, worldSchema } from "./shared";

const updateArt = z.enum(["artikel", "quest", "kapitel", "notizblock", "monster", "universum", "welt"]);
const richModus = z.enum(["anhaengen", "ersetzen"]).default("anhaengen");

const articleFields = z.object({
  titel: z.string().trim().min(1).max(200).optional(),
  vorlagentyp: z.enum(["person", "ort", "organisation", "gegenstand", "rasse", "ohne"]).optional(),
  vorlagenfelder: z.record(z.string(), z.unknown()).optional(),
  text: z.string().optional(),
}).passthrough();

const questFields = z.object({
  titel: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["offen", "aktiv", "abgeschlossen", "gescheitert"]).optional(),
  beschreibung: z.string().optional(),
  beteiligte: z.array(z.string().uuid()).optional(),
}).passthrough();

const chapterFields = z.object({
  titel: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["offen", "aktiv", "abgeschlossen", "gescheitert"]).optional(),
  text: z.string().optional(),
  position: z.number().int().min(1).optional(),
}).passthrough();

const noteFields = z.object({
  text: z.string().optional(),
}).passthrough();

const monsterFields = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  monster_art: z.string().optional(),
  seltenheit: z.string().optional(),
  boss: z.boolean().optional(),
  gefahr: z.string().optional(),
  groesse: z.string().optional(),
  lebensraum: z.unknown().optional(),
  charakterblatt: z.unknown().optional(),
  bio: z.string().optional(),
}).passthrough();

const universeFields = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  beschreibung: z.string().optional(),
}).passthrough();

const worldFields = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  beschreibung: z.string().optional(),
}).passthrough();

const fieldsByArt = {
  artikel: articleFields,
  quest: questFields,
  kapitel: chapterFields,
  notizblock: noteFields,
  monster: monsterFields,
  universum: universeFields,
  welt: worldFields,
} as const;

type UpdatePayload = {
  operation: "inhalt_aendern";
  art: z.infer<typeof updateArt>;
  id: string;
  stand: string;
  felder: Record<string, unknown>;
  modus: "anhaengen" | "ersetzen";
  stubTitles: string[];
};

type FieldChange = { label: string; oldValue: string; newValue: string };

function requireFields(parsed: Record<string, unknown>) {
  const keys = Object.keys(parsed).filter((key) => !key.startsWith("_"));
  if (!keys.length) throw new McpToolError("Mindestens ein Feld muss geändert werden.");
}

function markdownOf(json: unknown): string {
  return tiptapJsonToMcpMarkdown(json).trim();
}

function plainOfJson(json: unknown): string {
  const doc = asRichDoc(json);
  return doc ? plainTextOf(doc).trim() : "";
}

function isEmptyArticle(bodyJson: unknown, templateFields: StoredTemplateFields): boolean {
  return !plainOfJson(bodyJson) && !templateFieldsHaveValue(templateFields);
}

function appendRichDocs(existing: unknown, next: RichDoc | null): RichDoc | null {
  if (!next) return asRichDoc(existing);
  const current = asRichDoc(existing);
  if (!current?.content?.length) return next;
  return { type: "doc", content: [...current.content, ...next.content] };
}

function applyRichMode(input: {
  existing: unknown;
  next: RichDoc | null;
  modus: "anhaengen" | "ersetzen";
  touched: boolean;
}): RichDoc | null | undefined {
  if (!input.touched) return undefined;
  if (input.modus === "ersetzen") return input.next;
  return appendRichDocs(input.existing, input.next);
}

function previewRichChange(input: {
  label: string;
  oldJson: unknown;
  newMarkdown: string | undefined;
  modus: "anhaengen" | "ersetzen";
}): FieldChange | null {
  if (input.newMarkdown === undefined) return null;
  const oldPlain = plainOfJson(input.oldJson);
  const oldMd = markdownOf(input.oldJson);
  if (input.modus === "anhaengen") {
    return {
      label: input.label,
      oldValue: oldMd || "(leer)",
      newValue: `Anhängen: ${input.newMarkdown.trim() || "(leer)"}`,
    };
  }
  const nextPlain = input.newMarkdown.trim();
  return {
    label: input.label,
    oldValue: oldMd || "(leer)",
    newValue: `ersetzt ${oldPlain.length} Zeichen durch ${nextPlain.length} Zeichen: ${nextPlain.slice(0, 120)}${nextPlain.length > 120 ? "…" : ""}`,
  };
}

function formatUpdatePreview(input: {
  art: string;
  title: string;
  changes: FieldChange[];
  stubTitles: string[];
  token: string;
  expiresAt: Date;
}): string {
  const lines = [
    "Änderung noch nicht ausgeführt. Bitte mit aenderung_bestaetigen bestätigen.",
    `Art: ${input.art}`,
    `Titel: ${input.title}`,
    "Geänderte Felder:",
  ];
  for (const change of input.changes) {
    lines.push(`- ${change.label}:`);
    lines.push(`  alt: ${change.oldValue}`);
    lines.push(`  neu: ${change.newValue}`);
  }
  if (input.stubTitles.length) {
    lines.push("Geplante Stub-Artikel:");
    for (const title of input.stubTitles) lines.push(`- ${title}`);
  }
  lines.push(`Bestätigungs-Token: ${input.token}`);
  lines.push(`Gültig bis: ${input.expiresAt.toISOString()}`);
  return lines.join("\n");
}

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
  if (input.value === undefined) return { stubTitles: [] };
  if (input.value === null || input.value === "") return { habitatArticleId: null, stubTitles: [] };
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

async function worldStand(userId: string, worldId: string): Promise<string> {
  const worlds = await listMcpWorldMemberships(userId);
  const row = worlds.find((entry) => entry.id === worldId);
  if (!row) throw new McpToolError("Inhalt nicht gefunden.");
  return standOf(row.updatedAt);
}

async function resolveBodyDoc(input: {
  markdown: string | undefined;
  world: McpWorldContext;
  mentions: boolean;
  allowStubs: boolean;
}): Promise<{ doc: RichDoc | null; stubs: string[]; touched: boolean }> {
  if (input.markdown === undefined) return { doc: null, stubs: [], touched: false };
  const resolution = await resolveRichText({
    markdown: input.markdown,
    worldId: input.world.id,
    role: input.world.role,
    viewerId: input.world.userId,
    mentions: input.mentions,
  });
  if (!input.allowStubs && resolution.stubs.length) {
    throw new McpToolError(`Unbekannte Erwähnung: „${resolution.stubs[0]}“.`);
  }
  return { doc: resolution.doc, stubs: resolution.stubs, touched: true };
}

async function materializeUpdateDocs(input: {
  ctx: ToolContext;
  world: McpWorldContext;
  stubTitles: string[];
  mentions: boolean;
}): Promise<{
  stubArticles: { id: string; title: string }[];
  stubIdByTitle: Map<string, string>;
  rich: (markdown: string | undefined) => Promise<RichDoc | null | undefined>;
  fillStubRefs: (fields: Record<string, unknown>) => Record<string, unknown>;
}> {
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
    if (markdown === undefined) return undefined;
    if (!markdown.trim()) return null;
    const parsed = mcpMarkdownToTiptap(markdown, { mentions: input.mentions });
    if (!input.mentions) {
      return resolveMcpMarkdown(parsed, [], { mentions: false });
    }
    const resolution = await resolveMcpMarkdownMentions({
      parsed,
      worldId: input.world.id,
      role: input.world.role,
      viewerId: input.world.userId,
    });
    if (resolution.stubs.length) {
      const resolved: ResolvedMcpMarkdownMention[] = [...resolution.resolved];
      for (const mention of parsed.mentions) {
        if (resolved.some((entry) => entry.key === mention.key)) continue;
        const id = stubIdByTitle.get(mention.title.toLocaleLowerCase("de"));
        if (!id) throw new McpToolError(`Stub „${mention.title}“ fehlt nach der Bestätigung.`);
        resolved.push({ ...mention, kind: "article", id, title: mention.title });
      }
      return resolveMcpMarkdown(parsed, resolved, { mentions: true });
    }
    return resolution.doc ?? null;
  };

  return { stubArticles, stubIdByTitle, rich, fillStubRefs };
}

type PreparedUpdate = {
  title: string;
  emptyArticle: boolean;
  stubTitles: string[];
  changes: FieldChange[];
  visibility: string;
};

async function prepareUpdate(input: {
  world: McpWorldContext;
  art: z.infer<typeof updateArt>;
  id: string;
  stand: string;
  felder: Record<string, unknown>;
  modus: "anhaengen" | "ersetzen";
}): Promise<PreparedUpdate> {
  const stubs = new Set<string>();
  const add = (titles: string[]) => { for (const title of titles) stubs.add(title); };
  const changes: FieldChange[] = [];

  try {
    if (input.art === "artikel") {
      const row = await getArticle(input.world.id, input.id, input.world.role, input.world.userId);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      assertStand(row.updatedAt, input.stand);
      const felder = articleFields.parse(input.felder);
      requireFields(felder);
      const emptyArticle = isEmptyArticle(row.bodyJson, row.templateFields);
      if (felder.titel !== undefined && felder.titel !== row.title) {
        changes.push({ label: "titel", oldValue: row.title, newValue: felder.titel });
      }
      const nextType = felder.vorlagentyp
        ? MCP_TEMPLATE_TYPE[felder.vorlagentyp]
        : isTemplateType(row.templateType) ? row.templateType : "none";
      if (felder.vorlagentyp !== undefined) {
        const oldLabel = isTemplateType(row.templateType) ? templateOf(row.templateType).label : row.templateType;
        changes.push({ label: "vorlagentyp", oldValue: oldLabel, newValue: templateOf(nextType).label });
      }
      if (felder.vorlagenfelder !== undefined) {
        const prepared = await prepareTemplateFields({
          templateType: nextType,
          raw: felder.vorlagenfelder,
          world: input.world,
        });
        add(prepared.stubTitles);
        changes.push({
          label: "vorlagenfelder",
          oldValue: JSON.stringify(row.templateFields),
          newValue: JSON.stringify(prepared.fields),
        });
      }
      const body = await resolveBodyDoc({
        markdown: felder.text,
        world: input.world,
        mentions: true,
        allowStubs: true,
      });
      add(body.stubs);
      const richPreview = previewRichChange({
        label: "text",
        oldJson: row.bodyJson,
        newMarkdown: felder.text,
        modus: input.modus,
      });
      if (richPreview) changes.push(richPreview);
      return {
        title: felder.titel ?? row.title,
        emptyArticle,
        stubTitles: [...stubs],
        changes,
        visibility: visibilityLabel(row.visibility),
      };
    }

    if (input.art === "quest") {
      const row = await getQuest(input.world.id, input.id, input.world.role, input.world.userId);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      assertStand(row.updatedAt, input.stand);
      const felder = questFields.parse(input.felder);
      requireFields(felder);
      if (felder.titel !== undefined && felder.titel !== row.title) {
        changes.push({ label: "titel", oldValue: row.title, newValue: felder.titel });
      }
      if (felder.status !== undefined) {
        changes.push({
          label: "status",
          oldValue: MCP_QUEST_STATUS_LABEL[row.status],
          newValue: felder.status,
        });
      }
      if (felder.beteiligte !== undefined) {
        changes.push({
          label: "beteiligte",
          oldValue: row.participants.map((entry) => entry.characterId).join(", ") || "(keine)",
          newValue: felder.beteiligte.join(", ") || "(keine)",
        });
      }
      const body = await resolveBodyDoc({
        markdown: felder.beschreibung,
        world: input.world,
        mentions: true,
        allowStubs: true,
      });
      add(body.stubs);
      const richPreview = previewRichChange({
        label: "beschreibung",
        oldJson: row.descriptionJson,
        newMarkdown: felder.beschreibung,
        modus: input.modus,
      });
      if (richPreview) changes.push(richPreview);
      return {
        title: felder.titel ?? row.title,
        emptyArticle: false,
        stubTitles: [...stubs],
        changes,
        visibility: visibilityLabel(row.visibility),
      };
    }

    if (input.art === "kapitel") {
      const found = await findVisibleChapter(input.world, input.id);
      assertStand(found.chapter.updatedAt, input.stand);
      const felder = chapterFields.parse(input.felder);
      requireFields(felder);
      if (felder.titel !== undefined && felder.titel !== found.chapter.title) {
        changes.push({ label: "titel", oldValue: found.chapter.title, newValue: felder.titel });
      }
      if (felder.status !== undefined) {
        changes.push({
          label: "status",
          oldValue: MCP_QUEST_STATUS_LABEL[found.chapter.status],
          newValue: felder.status,
        });
      }
      if (felder.position !== undefined) {
        changes.push({
          label: "position",
          oldValue: String(found.chapter.position + 1),
          newValue: String(felder.position),
        });
      }
      const body = await resolveBodyDoc({
        markdown: felder.text,
        world: input.world,
        mentions: true,
        allowStubs: true,
      });
      add(body.stubs);
      const richPreview = previewRichChange({
        label: "text",
        oldJson: found.chapter.bodyJson,
        newMarkdown: felder.text,
        modus: input.modus,
      });
      if (richPreview) changes.push(richPreview);
      return {
        title: felder.titel ?? found.chapter.title,
        emptyArticle: false,
        stubTitles: [...stubs],
        changes,
        visibility: visibilityLabel(found.chapter.visibility),
      };
    }

    if (input.art === "notizblock") {
      const quest = await getQuest(input.world.id, input.id, input.world.role, input.world.userId);
      if (!quest) throw new McpToolError("Inhalt nicht gefunden.");
      const note = await getQuestNote({
        worldId: input.world.id,
        questId: quest.id,
        role: input.world.role,
        viewerId: input.world.userId,
      });
      if (!note.ok) throwAuthz(note);
      if (String(note.data.version) !== input.stand) {
        throw new McpToolError("Inhalt wurde inzwischen geändert, bitte neu lesen.");
      }
      const felder = noteFields.parse(input.felder);
      requireFields(felder);
      if (felder.text === undefined) throw new McpToolError("Notizblock braucht das Feld „text“.");
      // Mentions resolve existing targets only; stubs are rejected (no relations, like the app).
      await resolveBodyDoc({
        markdown: felder.text,
        world: input.world,
        mentions: true,
        allowStubs: false,
      });
      const richPreview = previewRichChange({
        label: "text",
        oldJson: note.data.bodyJson,
        newMarkdown: felder.text,
        modus: input.modus,
      });
      if (richPreview) changes.push(richPreview);
      return {
        title: quest.title,
        emptyArticle: false,
        stubTitles: [],
        changes,
        visibility: visibilityLabel(quest.visibility),
      };
    }

    if (input.art === "monster") {
      const row = await getMonster(input.world.id, input.id, input.world.role, input.world.userId);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      assertStand(row.updatedAt, input.stand);
      const felder = monsterFields.parse(input.felder);
      requireFields(felder);
      if (felder.name !== undefined && felder.name !== row.name) {
        changes.push({ label: "name", oldValue: row.name, newValue: felder.name });
      }
      if (felder.monster_art !== undefined) {
        const kind = mapMonsterKind(felder.monster_art);
        if (!kind) throw new McpToolError("„monster_art“ fehlt oder ist ungültig.");
        changes.push({
          label: "monster_art",
          oldValue: MONSTER_KIND_LABEL[row.kind],
          newValue: MONSTER_KIND_LABEL[kind],
        });
      }
      if (felder.seltenheit !== undefined) {
        const rarity = mapMonsterRarity(felder.seltenheit);
        if (!rarity) throw new McpToolError("„seltenheit“ fehlt oder ist ungültig.");
        changes.push({
          label: "seltenheit",
          oldValue: MONSTER_RARITY_LABEL[row.rarity],
          newValue: MONSTER_RARITY_LABEL[rarity],
        });
      }
      if (felder.boss !== undefined) {
        changes.push({ label: "boss", oldValue: row.isBoss ? "Ja" : "Nein", newValue: felder.boss ? "Ja" : "Nein" });
      }
      if (felder.gefahr !== undefined) {
        const danger = mapMonsterDanger(felder.gefahr);
        if (!danger) throw new McpToolError("„gefahr“ fehlt oder ist ungültig.");
        changes.push({
          label: "gefahr",
          oldValue: MONSTER_DANGER_LABEL[row.danger],
          newValue: MONSTER_DANGER_LABEL[danger],
        });
      }
      if (felder.groesse !== undefined) {
        const size = mapMonsterSize(felder.groesse);
        if (!size) throw new McpToolError("„groesse“ fehlt oder ist ungültig.");
        changes.push({
          label: "groesse",
          oldValue: MONSTER_SIZE_LABEL[row.size],
          newValue: MONSTER_SIZE_LABEL[size],
        });
      }
      if (felder.lebensraum !== undefined) {
        const habitat = await resolveHabitat({ value: felder.lebensraum, world: input.world });
        add(habitat.stubTitles);
        changes.push({
          label: "lebensraum",
          oldValue: row.habitatArticleId ?? "(keiner)",
          newValue: habitat.habitatArticleId ?? (habitat.stubTitles[0] ? `Stub: ${habitat.stubTitles[0]}` : "(keiner)"),
        });
      }
      if (felder.charakterblatt !== undefined) {
        normalizeMonsterSheet(felder.charakterblatt);
        changes.push({
          label: "charakterblatt",
          oldValue: "(bisheriges Blatt)",
          newValue: JSON.stringify(felder.charakterblatt),
        });
      }
      const body = await resolveBodyDoc({
        markdown: felder.bio,
        world: input.world,
        mentions: true,
        allowStubs: true,
      });
      add(body.stubs);
      const richPreview = previewRichChange({
        label: "bio",
        oldJson: row.bioJson,
        newMarkdown: felder.bio,
        modus: input.modus,
      });
      if (richPreview) changes.push(richPreview);
      return {
        title: felder.name ?? row.name,
        emptyArticle: false,
        stubTitles: [...stubs],
        changes,
        visibility: visibilityLabel(row.visibility),
      };
    }

    if (input.art === "universum") {
      const row = await getUniverse(input.world.id, input.id, input.world.role, input.world.userId);
      if (!row) throw new McpToolError("Inhalt nicht gefunden.");
      assertStand(row.updatedAt, input.stand);
      const felder = universeFields.parse(input.felder);
      requireFields(felder);
      if (felder.name !== undefined && felder.name !== row.name) {
        changes.push({ label: "name", oldValue: row.name, newValue: felder.name });
      }
      const body = await resolveBodyDoc({
        markdown: felder.beschreibung,
        world: input.world,
        mentions: true,
        allowStubs: true,
      });
      add(body.stubs);
      const richPreview = previewRichChange({
        label: "beschreibung",
        oldJson: row.descriptionJson,
        newMarkdown: felder.beschreibung,
        modus: input.modus,
      });
      if (richPreview) changes.push(richPreview);
      return {
        title: felder.name ?? row.name,
        emptyArticle: false,
        stubTitles: [...stubs],
        changes,
        visibility: visibilityLabel(row.visibility),
      };
    }

    // welt
    const details = await getWorldDetails(input.world.id);
    if (!details || details.id !== input.id) throw new McpToolError("Inhalt nicht gefunden.");
    const currentStand = await worldStand(input.world.userId, input.world.id);
    if (currentStand !== input.stand) {
      throw new McpToolError("Inhalt wurde inzwischen geändert, bitte neu lesen.");
    }
    const felder = worldFields.parse(input.felder);
    requireFields(felder);
    if (felder.name !== undefined && felder.name !== details.name) {
      changes.push({ label: "name", oldValue: details.name, newValue: felder.name });
    }
    await resolveBodyDoc({
      markdown: felder.beschreibung,
      world: input.world,
      mentions: false,
      allowStubs: false,
    });
    const richPreview = previewRichChange({
      label: "beschreibung",
      oldJson: details.descriptionJson,
      newMarkdown: felder.beschreibung,
      modus: input.modus,
    });
    if (richPreview) changes.push(richPreview);
    return {
      title: felder.name ?? details.name,
      emptyArticle: false,
      stubTitles: [],
      changes,
      visibility: "—",
    };
  } catch (error) {
    if (error instanceof McpMentionError) throw new McpToolError(error.message);
    throw error;
  }
}

async function executeUpdate(input: {
  ctx: ToolContext;
  world: McpWorldContext;
  art: z.infer<typeof updateArt>;
  id: string;
  stand: string;
  felder: Record<string, unknown>;
  modus: "anhaengen" | "ersetzen";
  stubTitles: string[];
}): Promise<{ value: string; worldId: string }> {
  const membership = mcpMembership(input.world);
  const mentions = input.art !== "welt";
  const allowStubs = input.art !== "notizblock" && input.art !== "welt";
  const { stubArticles, stubIdByTitle, rich, fillStubRefs } = await materializeUpdateDocs({
    ctx: input.ctx,
    world: input.world,
    stubTitles: allowStubs ? input.stubTitles : [],
    mentions,
  });

  if (input.art === "artikel") {
    const row = await getArticle(input.world.id, input.id, input.world.role, input.world.userId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    assertStand(row.updatedAt, input.stand);
    const felder = articleFields.parse(input.felder);
    const nextType = felder.vorlagentyp
      ? MCP_TEMPLATE_TYPE[felder.vorlagentyp]
      : undefined;
    const templateTypeForFields = nextType
      ?? (isTemplateType(row.templateType) ? row.templateType : "none");
    let templateFields: Record<string, unknown> | undefined;
    if (felder.vorlagenfelder !== undefined) {
      const prepared = await prepareTemplateFields({
        templateType: templateTypeForFields,
        raw: felder.vorlagenfelder,
        world: input.world,
      });
      templateFields = fillStubRefs(prepared.fields);
    }
    const nextBody = await rich(felder.text);
    const body = applyRichMode({
      existing: row.bodyJson,
      next: nextBody ?? null,
      modus: input.modus,
      touched: felder.text !== undefined,
    });
    const result = await updateArticle({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      articleId: input.id,
      title: felder.titel,
      templateType: nextType,
      templateFields,
      body,
    });
    if (!result.ok) throwAuthz(result);
    const updated = await getArticle(input.world.id, input.id, input.world.role, input.world.userId);
    if (!updated) throw new McpToolError("Inhalt nicht gefunden.");
    return {
      worldId: input.world.id,
      value: formatCreateResult({
        art: "artikel",
        id: updated.id,
        title: updated.title,
        stand: standOf(updated.updatedAt),
        visibility: visibilityLabel(updated.visibility),
        stubs: stubArticles,
      }),
    };
  }

  if (input.art === "quest") {
    const row = await getQuest(input.world.id, input.id, input.world.role, input.world.userId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    assertStand(row.updatedAt, input.stand);
    const felder = questFields.parse(input.felder);
    const nextDescription = await rich(felder.beschreibung);
    const description = applyRichMode({
      existing: row.descriptionJson,
      next: nextDescription ?? null,
      modus: input.modus,
      touched: felder.beschreibung !== undefined,
    });
    const result = await updateQuest({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      questId: input.id,
      title: felder.titel,
      status: felder.status ? MCP_QUEST_STATUS[felder.status] : undefined,
      description,
      participantIds: felder.beteiligte,
    });
    if (!result.ok) throwAuthz(result);
    const updated = await getQuest(input.world.id, input.id, input.world.role, input.world.userId);
    if (!updated) throw new McpToolError("Inhalt nicht gefunden.");
    return {
      worldId: input.world.id,
      value: formatCreateResult({
        art: "quest",
        id: updated.id,
        title: updated.title,
        stand: standOf(updated.updatedAt),
        visibility: visibilityLabel(updated.visibility),
        stubs: stubArticles,
      }),
    };
  }

  if (input.art === "kapitel") {
    const found = await findVisibleChapter(input.world, input.id);
    assertStand(found.chapter.updatedAt, input.stand);
    const felder = chapterFields.parse(input.felder);
    const nextBody = await rich(felder.text);
    const body = applyRichMode({
      existing: found.chapter.bodyJson,
      next: nextBody ?? null,
      modus: input.modus,
      touched: felder.text !== undefined,
    });
    const result = await updateChapter({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      questId: found.questId,
      chapterId: input.id,
      title: felder.titel,
      status: felder.status ? MCP_QUEST_STATUS[felder.status] : undefined,
      body,
    });
    if (!result.ok) throwAuthz(result);
    if (felder.position !== undefined) {
      const chapters = await listVisibleChapters(input.world.id, found.questId, input.world.role, input.world.userId);
      if (!chapters) throw new McpToolError("Quest nicht gefunden.");
      const ids = chapters.map((chapter) => chapter.id).filter((id) => id !== input.id);
      const index = Math.min(Math.max(felder.position, 1), ids.length + 1) - 1;
      ids.splice(index, 0, input.id);
      const reordered = await reorderChapters({
        membership,
        actorId: input.ctx.userId,
        worldId: input.world.id,
        questId: found.questId,
        chapterIds: ids,
      });
      if (!reordered.ok) throwAuthz(reordered);
    }
    const refreshed = await findVisibleChapter(input.world, input.id);
    return {
      worldId: input.world.id,
      value: formatCreateResult({
        art: "kapitel",
        id: refreshed.chapter.id,
        title: refreshed.chapter.title,
        stand: standOf(refreshed.chapter.updatedAt),
        visibility: visibilityLabel(refreshed.chapter.visibility),
        stubs: stubArticles,
      }),
    };
  }

  if (input.art === "notizblock") {
    const quest = await getQuest(input.world.id, input.id, input.world.role, input.world.userId);
    if (!quest) throw new McpToolError("Inhalt nicht gefunden.");
    const note = await getQuestNote({
      worldId: input.world.id,
      questId: quest.id,
      role: input.world.role,
      viewerId: input.world.userId,
    });
    if (!note.ok) throwAuthz(note);
    if (String(note.data.version) !== input.stand) {
      throw new McpToolError("Inhalt wurde inzwischen geändert, bitte neu lesen.");
    }
    const felder = noteFields.parse(input.felder);
    const nextBody = await rich(felder.text);
    const body = applyRichMode({
      existing: note.data.bodyJson,
      next: nextBody ?? null,
      modus: input.modus,
      touched: felder.text !== undefined,
    });
    if (body === undefined) throw new McpToolError("Notizblock braucht das Feld „text“.");
    const saved = await saveQuestNote({
      actorId: input.ctx.userId,
      worldId: input.world.id,
      questId: quest.id,
      role: input.world.role,
      bodyJson: body,
      version: Number(input.stand),
    });
    if (!saved.ok) {
      if ("version" in saved) throw new McpToolError("Inhalt wurde inzwischen geändert, bitte neu lesen.");
      throwAuthz(saved);
    }
    return {
      worldId: input.world.id,
      value: formatCreateResult({
        art: "notizblock",
        id: quest.id,
        title: quest.title,
        stand: String(saved.data.version),
        visibility: visibilityLabel(quest.visibility),
      }),
    };
  }

  if (input.art === "monster") {
    const row = await getMonster(input.world.id, input.id, input.world.role, input.world.userId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    assertStand(row.updatedAt, input.stand);
    const felder = monsterFields.parse(input.felder);
    const sheet = normalizeMonsterSheet(felder.charakterblatt);
    let habitatArticleId: string | null | undefined;
    if (felder.lebensraum !== undefined) {
      const habitat = await resolveHabitat({ value: felder.lebensraum, world: input.world });
      habitatArticleId = habitat.habitatArticleId ?? null;
      if (habitat.stubTitles[0]) {
        habitatArticleId = stubIdByTitle.get(habitat.stubTitles[0].toLocaleLowerCase("de")) ?? null;
      }
    }
    const nextBio = await rich(felder.bio);
    const bio = applyRichMode({
      existing: row.bioJson,
      next: nextBio ?? null,
      modus: input.modus,
      touched: felder.bio !== undefined,
    });
    const result = await updateMonster({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      monsterId: input.id,
      name: felder.name,
      kind: mapMonsterKind(felder.monster_art),
      rarity: mapMonsterRarity(felder.seltenheit),
      isBoss: felder.boss,
      danger: mapMonsterDanger(felder.gefahr),
      size: mapMonsterSize(felder.groesse),
      habitatArticleId,
      bio,
      ...sheet,
    });
    if (!result.ok) throwAuthz(result);
    const updated = await getMonster(input.world.id, input.id, input.world.role, input.world.userId);
    if (!updated) throw new McpToolError("Inhalt nicht gefunden.");
    return {
      worldId: input.world.id,
      value: formatCreateResult({
        art: "monster",
        id: updated.id,
        title: updated.name,
        stand: standOf(updated.updatedAt),
        visibility: visibilityLabel(updated.visibility),
        stubs: stubArticles,
      }),
    };
  }

  if (input.art === "universum") {
    const row = await getUniverse(input.world.id, input.id, input.world.role, input.world.userId);
    if (!row) throw new McpToolError("Inhalt nicht gefunden.");
    assertStand(row.updatedAt, input.stand);
    const felder = universeFields.parse(input.felder);
    const nextDescription = await rich(felder.beschreibung);
    const description = applyRichMode({
      existing: row.descriptionJson,
      next: nextDescription ?? null,
      modus: input.modus,
      touched: felder.beschreibung !== undefined,
    });
    const result = await updateUniverse({
      membership,
      actorId: input.ctx.userId,
      worldId: input.world.id,
      universeId: input.id,
      name: felder.name,
      description,
    });
    if (!result.ok) throwAuthz(result);
    const updated = await getUniverse(input.world.id, input.id, input.world.role, input.world.userId);
    if (!updated) throw new McpToolError("Inhalt nicht gefunden.");
    return {
      worldId: input.world.id,
      value: formatCreateResult({
        art: "universum",
        id: updated.id,
        title: updated.name,
        stand: standOf(updated.updatedAt),
        visibility: visibilityLabel(updated.visibility),
        stubs: stubArticles,
      }),
    };
  }

  const details = await getWorldDetails(input.world.id);
  if (!details || details.id !== input.id) throw new McpToolError("Inhalt nicht gefunden.");
  const currentStand = await worldStand(input.world.userId, input.world.id);
  if (currentStand !== input.stand) {
    throw new McpToolError("Inhalt wurde inzwischen geändert, bitte neu lesen.");
  }
  const felder = worldFields.parse(input.felder);
  const nextDescription = await rich(felder.beschreibung);
  const description = applyRichMode({
    existing: details.descriptionJson,
    next: nextDescription ?? null,
    modus: input.modus,
    touched: felder.beschreibung !== undefined,
  });
  const result = await updateWorld({
    membership,
    actorId: input.ctx.userId,
    worldId: input.world.id,
    name: felder.name,
    description,
  });
  if (!result.ok) throwAuthz(result);
  const updatedDetails = await getWorldDetails(input.world.id);
  if (!updatedDetails) throw new McpToolError("Inhalt nicht gefunden.");
  const stand = await worldStand(input.world.userId, input.world.id);
  return {
    worldId: input.world.id,
    value: formatCreateResult({
      art: "welt",
      id: updatedDetails.id,
      title: updatedDetails.name,
      stand,
      visibility: "—",
    }),
  };
}

registerMcpConfirmationHandler("inhalt_aendern", async (row) => {
  const payload = row.payload as UpdatePayload;
  const world = await resolveMcpWorld(row.userId, row.worldId);
  return executeUpdate({
    ctx: { userId: row.userId, clientId: row.clientId, scopes: ["worlds:write"] },
    world,
    art: payload.art,
    id: payload.id,
    stand: payload.stand,
    felder: payload.felder,
    modus: payload.modus,
    stubTitles: payload.stubTitles,
  });
});

export function registerContentUpdateTool(server: McpServer, ctx: ToolContext) {
  server.registerTool("inhalt_aendern", {
    title: "Inhalt ändern",
    description: [
      "Ändert bestehende Artikel, Quests, Kapitel, Notizblöcke, Monster, Universen oder die Welt.",
      "stand ist immer Pflicht (aus inhalt_lesen, beim Notizblock die version, bei der Welt aus welten_auflisten).",
      "Rich-Text-Modus: anhaengen (Standard) oder ersetzen.",
      "Änderungen an bestehendem Inhalt brauchen eine Bestätigung (aenderung_bestaetigen), außer bei leeren Artikeln ohne Stub-Anlage.",
      "Erwähnungen als @[Titel] oder @[Titel](artikel:id). Notizblock und Weltbeschreibung legen keine Stubs an.",
      "Pins und Charaktere können nicht geändert werden. Gelöscht wird nie.",
    ].join(" "),
    inputSchema: z.object({
      welt: worldSchema,
      art: updateArt,
      id: z.string().uuid(),
      stand: z.string().min(1),
      felder: z.record(z.string(), z.unknown()),
      modus: richModus.optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ welt, art, id, stand, felder, modus }) => withAudit(ctx, "inhalt_aendern", async () => {
    requireMcpWriteScope(ctx);
    const world = await resolveMcpWorld(ctx.userId, welt);
    const parsedFields = fieldsByArt[art].parse(felder);
    const richMode = modus ?? "anhaengen";
    const prepared = await prepareUpdate({
      world,
      art,
      id,
      stand,
      felder: parsedFields,
      modus: richMode,
    });

    const executeImmediately = prepared.emptyArticle && prepared.stubTitles.length === 0;
    if (executeImmediately) {
      const updated = await executeUpdate({
        ctx,
        world,
        art,
        id,
        stand,
        felder: parsedFields,
        modus: richMode,
        stubTitles: [],
      });
      return {
        ...updated,
        audit: { targetKind: art, targetId: id, confirmed: false },
      };
    }

    const confirmation = await createMcpConfirmation({
      userId: ctx.userId,
      clientId: ctx.clientId,
      worldId: world.id,
      targetKind: art,
      targetId: id,
      expectedStand: stand,
      payload: {
        operation: "inhalt_aendern",
        art,
        id,
        stand,
        felder: parsedFields,
        modus: richMode,
        stubTitles: prepared.stubTitles,
      } satisfies UpdatePayload,
    });
    return {
      worldId: world.id,
      value: formatUpdatePreview({
        art,
        title: prepared.title,
        changes: prepared.changes,
        stubTitles: prepared.stubTitles,
        token: confirmation.token,
        expiresAt: confirmation.expiresAt,
      }),
      audit: { targetKind: art, targetId: id, confirmed: false },
    };
  }));
}
