import { and, eq, ilike, isNull, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  articles,
  characters,
  maps,
  pins,
  questChapters,
  quests,
  universes,
  worldParticipations,
} from "@/db/schema";
import { canSeePublishedLayer, canSeeVisibility, isStaff, type MembershipRole } from "@/lib/authz";
import { contentHref } from "@/lib/content-href";
import { escapeLikePattern } from "@/lib/editor/mentions";
import {
  clampSearchLimit,
  searchSnippet,
  SEARCH_KINDS,
  SEARCH_QUERY_MAX,
  SEARCH_QUERY_MIN,
  type SearchHit,
  type SearchKind,
} from "@/lib/search";
import { templateOf } from "@/lib/templates/registry";

export {
  clampSearchLimit,
  isSearchKind,
  searchSnippet,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_KINDS,
  SEARCH_MAX_LIMIT,
  SEARCH_QUERY_MAX,
  SEARCH_QUERY_MIN,
  SEARCH_SNIPPET_MAX,
  type SearchHit,
  type SearchKind,
} from "@/lib/search";

const KIND_LABEL: Record<SearchKind, string> = {
  article: "Artikel",
  quest: "Quest",
  character: "Charakter",
  pin: "Pin",
  universe: "Universum",
};

function kindLabel(kind: SearchKind, templateType?: string): string {
  if (kind === "article" && templateType) {
    const template = templateOf(templateType);
    if (template.type !== "none") return `${KIND_LABEL.article} · ${template.label}`;
  }
  return KIND_LABEL[kind];
}

function matchTitleOrPlain(title: AnyColumn, plain: SQL, tsv: AnyColumn, query: string): SQL {
  const pattern = `%${escapeLikePattern(query)}%`;
  return or(
    ilike(title, pattern),
    ilike(plain, pattern),
    sql`${tsv} @@ plainto_tsquery('german', ${query})`,
  ) as SQL;
}

type RawHit = {
  kind: SearchKind;
  id: string;
  title: string;
  plain: string | null;
  templateType?: string;
};

/**
 * World search for the campaign hub (and later MCP `suchen`). Journal is never
 * included. Visibility follows APP-AUTHZ / APP-VIS-INHERIT / APP-VIS-OWNER.
 */
export async function searchWorld(input: {
  worldId: string;
  role: MembershipRole;
  viewerId: string;
  query: string;
  limit?: number;
  kind?: SearchKind | "all";
}): Promise<SearchHit[]> {
  const query = input.query.trim().slice(0, SEARCH_QUERY_MAX);
  if (query.length < SEARCH_QUERY_MIN) return [];
  const limit = clampSearchLimit(input.limit);
  const kinds = !input.kind || input.kind === "all" ? SEARCH_KINDS : [input.kind];
  const viewer = { role: input.role, userId: input.viewerId };

  const parts: Promise<RawHit[]>[] = [];
  if (kinds.includes("article")) parts.push(searchArticles(input.worldId, viewer, query));
  if (kinds.includes("quest")) parts.push(searchQuests(input.worldId, viewer, query));
  if (kinds.includes("universe")) parts.push(searchUniverses(input.worldId, viewer, query));
  if (kinds.includes("pin")) parts.push(searchPins(input.worldId, viewer, query));
  if (kinds.includes("character")) parts.push(searchCharacters(input.worldId, query));

  const rows = (await Promise.all(parts)).flat();
  rows.sort((a, b) => a.title.localeCompare(b.title, "de"));
  return rows.slice(0, limit).map((row) => ({
    kind: row.kind,
    id: row.id,
    title: row.title,
    href: contentHref(input.worldId, row.kind, row.id),
    templateType: row.templateType,
    kindLabel: kindLabel(row.kind, row.templateType),
    snippet: searchSnippet(row.plain, query),
  }));
}

type Viewer = { role: MembershipRole; userId: string };

async function searchArticles(worldId: string, viewer: Viewer, query: string): Promise<RawHit[]> {
  const filters: SQL[] = [
    eq(articles.worldId, worldId),
    matchTitleOrPlain(articles.title, sql`coalesce(${articles.bodyPlain}, '')`, articles.bodyTsv, query),
  ];
  if (!isStaff(viewer.role)) filters.push(eq(articles.visibility, "published"));
  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      plain: articles.bodyPlain,
      templateType: articles.templateType,
      visibility: articles.visibility,
      ownerId: articles.ownerId,
    })
    .from(articles)
    .where(and(...filters));
  return rows
    .filter((row) =>
      canSeeVisibility({
        role: viewer.role,
        visibility: row.visibility,
        viewerId: viewer.userId,
        ownerId: row.ownerId,
      }),
    )
    .map((row) => ({
      kind: "article" as const,
      id: row.id,
      title: row.title,
      plain: row.plain,
      templateType: row.templateType,
    }));
}

async function searchQuests(worldId: string, viewer: Viewer, query: string): Promise<RawHit[]> {
  const filters: SQL[] = [
    eq(quests.worldId, worldId),
    matchTitleOrPlain(quests.title, sql`coalesce(${quests.descriptionPlain}, '')`, quests.descriptionTsv, query),
  ];
  if (!isStaff(viewer.role)) filters.push(eq(quests.visibility, "published"));
  const rows = await db
    .select({
      id: quests.id,
      title: quests.title,
      plain: quests.descriptionPlain,
      visibility: quests.visibility,
      ownerId: quests.ownerId,
    })
    .from(quests)
    .where(and(...filters));
  const fromDescription = rows
    .filter((row) =>
      canSeeVisibility({
        role: viewer.role,
        visibility: row.visibility,
        viewerId: viewer.userId,
        ownerId: row.ownerId,
      }),
    )
    .map((row) => ({ kind: "quest" as const, id: row.id, title: row.title, plain: row.plain }));

  const fromChapters = await searchQuestChapters(worldId, viewer, query);
  const byId = new Map<string, RawHit>();
  for (const hit of fromDescription) byId.set(hit.id, hit);
  for (const hit of fromChapters) {
    if (!byId.has(hit.id)) byId.set(hit.id, hit);
  }
  return [...byId.values()];
}

/**
 * Chapter text hits the quest (APP-VIS-OWNER + inheritance). Snippet from the
 * matching chapter. Notes are not searched.
 */
async function searchQuestChapters(worldId: string, viewer: Viewer, query: string): Promise<RawHit[]> {
  const filters: SQL[] = [
    eq(quests.worldId, worldId),
    matchTitleOrPlain(
      questChapters.title,
      sql`coalesce(${questChapters.bodyPlain}, '')`,
      questChapters.bodyTsv,
      query,
    ),
  ];
  if (!isStaff(viewer.role)) {
    filters.push(eq(quests.visibility, "published"));
    filters.push(eq(questChapters.visibility, "published"));
  }
  const rows = await db
    .select({
      id: quests.id,
      title: quests.title,
      plain: questChapters.bodyPlain,
      chapterTitle: questChapters.title,
      questVisibility: quests.visibility,
      questOwnerId: quests.ownerId,
      chapterVisibility: questChapters.visibility,
      chapterOwnerId: questChapters.ownerId,
    })
    .from(questChapters)
    .innerJoin(quests, eq(quests.id, questChapters.questId))
    .where(and(...filters));

  const byQuest = new Map<string, RawHit>();
  for (const row of rows) {
    const questVisible = canSeeVisibility({
      role: viewer.role,
      visibility: row.questVisibility,
      viewerId: viewer.userId,
      ownerId: row.questOwnerId,
    });
    const chapterVisible = canSeeVisibility({
      role: viewer.role,
      visibility: row.chapterVisibility,
      viewerId: viewer.userId,
      ownerId: row.chapterOwnerId,
    });
    if (!questVisible || !chapterVisible) continue;
    if (byQuest.has(row.id)) continue;
    const plain = row.plain?.trim() ? row.plain : row.chapterTitle;
    byQuest.set(row.id, { kind: "quest", id: row.id, title: row.title, plain });
  }
  return [...byQuest.values()];
}

async function searchUniverses(worldId: string, viewer: Viewer, query: string): Promise<RawHit[]> {
  const filters: SQL[] = [
    eq(universes.worldId, worldId),
    matchTitleOrPlain(universes.name, sql`coalesce(${universes.descriptionPlain}, '')`, universes.descriptionTsv, query),
  ];
  if (!isStaff(viewer.role)) filters.push(eq(universes.visibility, "published"));
  const rows = await db
    .select({
      id: universes.id,
      title: universes.name,
      plain: universes.descriptionPlain,
      visibility: universes.visibility,
    })
    .from(universes)
    .where(and(...filters));
  return rows
    .filter((row) =>
      canSeeVisibility({ role: viewer.role, visibility: row.visibility, viewerId: viewer.userId }),
    )
    .map((row) => ({ kind: "universe" as const, id: row.id, title: row.title, plain: row.plain }));
}

async function searchPins(worldId: string, viewer: Viewer, query: string): Promise<RawHit[]> {
  const filters: SQL[] = [
    eq(universes.worldId, worldId),
    matchTitleOrPlain(pins.title, sql`coalesce(${pins.descriptionPlain}, '')`, pins.descriptionTsv, query),
  ];
  const rows = await db
    .select({
      id: pins.id,
      title: pins.title,
      plain: pins.descriptionPlain,
      visibility: pins.visibility,
      ownerId: pins.ownerId,
      mapVisibility: maps.visibility,
      universeVisibility: universes.visibility,
    })
    .from(pins)
    .innerJoin(maps, eq(maps.id, pins.mapId))
    .innerJoin(universes, eq(universes.id, maps.universeId))
    .where(and(...filters));
  return rows
    .filter((row) =>
      canSeePublishedLayer(viewer, [
        { visibility: row.universeVisibility },
        { visibility: row.mapVisibility },
        { visibility: row.visibility, ownerId: row.ownerId },
      ]),
    )
    .map((row) => ({ kind: "pin" as const, id: row.id, title: row.title, plain: row.plain }));
}

async function searchCharacters(worldId: string, query: string): Promise<RawHit[]> {
  const pattern = `%${escapeLikePattern(query)}%`;
  const rows = await db
    .select({
      id: characters.id,
      title: characters.name,
      plain: characters.bioPlain,
    })
    .from(worldParticipations)
    .innerJoin(characters, eq(characters.id, worldParticipations.characterId))
    .where(
      and(
        eq(worldParticipations.worldId, worldId),
        isNull(worldParticipations.archivedAt),
        or(
          ilike(characters.name, pattern),
          ilike(sql`coalesce(${characters.bioPlain}, '')`, pattern),
          sql`${characters.bioTsv} @@ plainto_tsquery('german', ${query})`,
        ),
      ),
    );
  return rows.map((row) => ({ kind: "character" as const, id: row.id, title: row.title, plain: row.plain }));
}
