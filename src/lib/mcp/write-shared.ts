import { createArticleStub, getArticle } from "@/lib/domain/articles";
import { resolveMcpMarkdownMentions } from "@/lib/domain/mcp-mentions";
import { getMonster } from "@/lib/domain/monsters";
import { getVisibleChapter } from "@/lib/domain/quest-chapters";
import { getQuest } from "@/lib/domain/quests";
import { getUniverse } from "@/lib/domain/universes";
import {
  mcpMarkdownToTiptap,
  resolveMcpMarkdown,
  type ResolvedMcpMarkdownMention,
} from "@/lib/editor/mcp-markdown";
import type { RichDoc } from "@/lib/editor/rich-text";
import { templateOf, type TemplateType } from "@/lib/templates/registry";
import { listMcpWorldMemberships, McpToolError, type McpWorldContext } from "./context";
import { compensateMcpStubArticles } from "./stub-compensation";
import { isPendingStubRef, type PendingStubRef } from "./pending-stub-ref";
import { normalizeTemplateFieldsInput } from "./write-fields";
import { mcpMembership, resolveMentionRef, standOf, throwAuthz } from "./write-rich";

const NOT_FOUND = "Inhalt nicht gefunden.";

export async function visibleArticle(world: McpWorldContext, id: string) {
  const row = await getArticle(world.id, id, world.role, world.userId);
  if (!row) throw new McpToolError(NOT_FOUND);
  return row;
}

export async function visibleQuest(world: McpWorldContext, id: string) {
  const row = await getQuest(world.id, id, world.role, world.userId);
  if (!row) throw new McpToolError(NOT_FOUND);
  return row;
}

export async function visibleMonster(world: McpWorldContext, id: string) {
  const row = await getMonster(world.id, id, world.role, world.userId);
  if (!row) throw new McpToolError(NOT_FOUND);
  return row;
}

export async function visibleUniverse(world: McpWorldContext, id: string) {
  const row = await getUniverse(world.id, id, world.role, world.userId);
  if (!row) throw new McpToolError(NOT_FOUND);
  return row;
}

export async function findVisibleChapter(world: McpWorldContext, chapterId: string) {
  const found = await getVisibleChapter(world.id, chapterId, world.role, world.userId);
  if (!found) throw new McpToolError(NOT_FOUND);
  return found;
}

/** The world has no own revision loader; its stand comes from the membership listing. */
export async function worldStand(userId: string, worldId: string): Promise<string> {
  const worlds = await listMcpWorldMemberships(userId);
  const row = worlds.find((entry) => entry.id === worldId);
  if (!row) throw new McpToolError(NOT_FOUND);
  return standOf(row.updatedAt);
}

/** Collects planned stub titles case-insensitively; the first spelling wins. */
export function createStubPlan() {
  const titles = new Map<string, string>();
  return {
    add(next: string[]) {
      for (const title of next) {
        const key = title.toLocaleLowerCase("de");
        if (!titles.has(key)) titles.set(key, title);
      }
    },
    list: () => [...titles.values()],
  };
}

export type StubPlan = ReturnType<typeof createStubPlan>;

export async function prepareTemplateFields(input: {
  templateType: TemplateType;
  raw: unknown;
  world: McpWorldContext;
}): Promise<{ fields: Record<string, unknown>; stubTitles: string[] }> {
  const normalized = normalizeTemplateFieldsInput(input.templateType, input.raw);
  const stubTitles: string[] = [];
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(normalized)) {
    const definition = templateOf(input.templateType).fields.find((field) => field.key === key);
    if (definition?.type !== "ref") {
      fields[key] = value;
      continue;
    }
    const resolved = await resolveMentionRef({
      value,
      worldId: input.world.id,
      role: input.world.role,
      viewerId: input.world.userId,
      allowedKinds: ["article", "character"],
    });
    stubTitles.push(...resolved.stubs);
    fields[key] = resolved.stubs.length ? { __stubTitle: resolved.stubs[0] } satisfies PendingStubRef : resolved.ref;
  }
  return { fields, stubTitles };
}

export type ResolvedHabitat = {
  /** `undefined` keeps the habitat, `null` clears it. */
  habitatArticleId?: string | null;
  title?: string;
  stubTitle?: string;
};

export async function resolveHabitat(value: unknown, world: McpWorldContext): Promise<ResolvedHabitat> {
  if (value === undefined) return {};
  if (value === null || value === "") return { habitatArticleId: null };
  const resolved = await resolveMentionRef({
    value,
    worldId: world.id,
    role: world.role,
    viewerId: world.userId,
    allowedKinds: ["article"],
  });
  if (resolved.stubs.length) return { stubTitle: resolved.stubs[0] };
  if (resolved.ref.kind !== "article") throw new McpToolError("Lebensraum muss ein Ort-Artikel sein.");
  return { habitatArticleId: resolved.ref.id, title: resolved.resolved?.title };
}

export type MaterializedStubs = {
  articles: { id: string; title: string }[];
  idFor: (title: string) => string;
  fillRefs: (fields: Record<string, unknown>) => Record<string, unknown>;
  /** `undefined` leaves the field untouched, blank text clears it. */
  richDoc: (markdown: string | undefined, mentions?: boolean) => Promise<RichDoc | null | undefined>;
};

async function createStubs(world: McpWorldContext, actorId: string, titles: string[]) {
  const membership = mcpMembership(world);
  const created: { id: string; title: string }[] = [];
  try {
    for (const title of titles) {
      const stub = await createArticleStub({ membership, actorId, worldId: world.id, title });
      if (!stub.ok) throwAuthz(stub);
      created.push({ id: stub.data.id, title: stub.data.title });
    }
  } catch (error) {
    await compensateMcpStubArticles({ membership, actorId, worldId: world.id, stubs: created });
    throw error;
  }
  return created;
}

async function richDocWithStubs(
  world: McpWorldContext,
  idFor: (title: string) => string,
  markdown: string,
): Promise<RichDoc | null> {
  const parsed = mcpMarkdownToTiptap(markdown, { mentions: true });
  const resolution = await resolveMcpMarkdownMentions({
    parsed,
    worldId: world.id,
    role: world.role,
    viewerId: world.userId,
  });
  if (!resolution.stubs.length) return resolution.doc ?? null;
  const resolved: ResolvedMcpMarkdownMention[] = [...resolution.resolved];
  for (const mention of parsed.mentions) {
    if (resolved.some((entry) => entry.key === mention.key)) continue;
    resolved.push({ ...mention, kind: "article", id: idFor(mention.title), title: mention.title });
  }
  return resolveMcpMarkdown(parsed, resolved, { mentions: true });
}

/**
 * Creates the confirmed stub articles (phase b) and returns helpers that resolve
 * pending mentions and template refs onto them. A partial failure removes the
 * stubs created so far.
 */
export async function materializeStubs(input: {
  world: McpWorldContext;
  actorId: string;
  titles: string[];
}): Promise<MaterializedStubs> {
  const articles = await createStubs(input.world, input.actorId, input.titles);
  const idByTitle = new Map(input.titles.map((title, index) => [title.toLocaleLowerCase("de"), articles[index].id]));
  const idFor = (title: string) => {
    const id = idByTitle.get(title.toLocaleLowerCase("de"));
    if (!id) throw new McpToolError(`Stub „${title}“ fehlt nach der Bestätigung.`);
    return id;
  };
  return {
    articles,
    idFor,
    fillRefs: (fields) => Object.fromEntries(Object.entries(fields).map(([key, value]) => [
      key,
      isPendingStubRef(value) ? { kind: "article", id: idFor(value.__stubTitle) } : value,
    ])),
    richDoc: async (markdown, mentions = true) => {
      if (markdown === undefined) return undefined;
      if (!markdown.trim()) return null;
      if (!mentions) return resolveMcpMarkdown(mcpMarkdownToTiptap(markdown, { mentions: false }), [], { mentions: false });
      return richDocWithStubs(input.world, idFor, markdown);
    },
  };
}
