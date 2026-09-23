import { and, asc, eq, ilike, isNull, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
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
import { canSeeContent, canSeePublishedLayer, isStaff, type MembershipRole } from "@/lib/authz";
import { contentHref } from "@/lib/content-href";
import { visibleContentWhere } from "./visibility-sql";
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
  if (kinds.includes("article")) parts.push(searchArticles(input.worldId, viewer, query, limit));
  if (kinds.includes("quest")) parts.push(searchQuests(input.worldId, viewer, query, limit));
  if (kinds.includes("universe")) parts.push(searchUniverses(input.worldId, viewer, query, limit));
  if (kinds.includes("pin")) parts.push(searchPins(input.worldId, viewer, query, limit));
  if (kinds.includes("character")) parts.push(searchCharacters(input.worldId, query, limit));

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

async function searchArticles(
  worldId: string,
  viewer: Viewer,
  query: string,
  limit: number,
): Promise<RawHit[]> {
  const filters: SQL[] = [
    eq(articles.worldId, worldId),
    matchTitleOrPlain(articles.title, sql`coalesce(${articles.bodyPlain}, '')`, articles.bodyTsv, query),
    visibleContentWhere({ visibility: articles.visibility, ownerId: articles.ownerId }, viewer),
  ];
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
    .where(and(...filters))
    .limit(limit);
  return rows
    .filter((row) =>
      canSeeContent(viewer, { visibility: row.visibility, ownerId: row.ownerId }),
    )
    .map((row) => ({
      kind: "article" as const,
      id: row.id,
      title: row.title,
      plain: row.plain,
      templateType: row.templateType,
    }));
}

async function searchQuests(
  worldId: string,
  viewer: Viewer,
  query: string,
  limit: number,
): Promise<RawHit[]> {
  const filters: SQL[] = [
    eq(quests.worldId, worldId),
    matchTitleOrPlain(quests.title, sql`coalesce(${quests.descriptionPlain}, '')`, quests.descriptionTsv, query),
    visibleContentWhere({ visibility: quests.visibility, ownerId: quests.ownerId }, viewer),
  ];
  const rows = await db
    .select({
      id: quests.id,
      title: quests.title,
      plain: quests.descriptionPlain,
      visibility: quests.visibility,
      ownerId: quests.ownerId,
    })
    .from(quests)
    .where(and(...filters))
    .limit(limit);
  const fromDescription = rows
    .filter((row) =>
      canSeeContent(viewer, { visibility: row.visibility, ownerId: row.ownerId }),
    )
    .map((row) => ({ kind: "quest" as const, id: row.id, title: row.title, plain: row.plain }));

  const fromChapters = await searchQuestChapters(worldId, viewer, query, limit);
  const byId = new Map<string, RawHit>();
  for (const hit of fromDescription) byId.set(hit.id, hit);
  for (const hit of fromChapters) {
    if (!byId.has(hit.id)) byId.set(hit.id, hit);
  }
  return [...byId.values()].slice(0, limit);
}

/**
 * Chapter text hits the quest (APP-VIS-OWNER + inheritance). Snippet from the
 * matching chapter. Notes are not searched.
 */
async function searchQuestChapters(
  worldId: string,
  viewer: Viewer,
  query: string,
  limit: number,
): Promise<RawHit[]> {
  const filters: SQL[] = [
    eq(quests.worldId, worldId),
    matchTitleOrPlain(
      questChapters.title,
      sql`coalesce(${questChapters.bodyPlain}, '')`,
      questChapters.bodyTsv,
      query,
    ),
    visibleContentWhere({ visibility: quests.visibility, ownerId: quests.ownerId }, viewer),
    visibleContentWhere(
      { visibility: questChapters.visibility, ownerId: questChapters.ownerId },
      viewer,
    ),
  ];
  const rows = await db
    .selectDistinctOn([quests.id], {
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
    .where(and(...filters))
    .orderBy(quests.id, asc(questChapters.position))
    .limit(limit);

  return rows
    .filter((row) => {
      const questVisible = canSeeContent(viewer, {
        visibility: row.questVisibility,
        ownerId: row.questOwnerId,
      });
      const chapterVisible = canSeeContent(viewer, {
        visibility: row.chapterVisibility,
        ownerId: row.chapterOwnerId,
      });
      return questVisible && chapterVisible;
    })
    .map((row) => ({
      kind: "quest" as const,
      id: row.id,
      title: row.title,
      plain: row.plain?.trim() ? row.plain : row.chapterTitle,
    }));
}

async function searchUniverses(
  worldId: string,
  viewer: Viewer,
  query: string,
  limit: number,
): Promise<RawHit[]> {
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
    .where(and(...filters))
    .limit(limit);
  return rows
    .filter((row) =>
      canSeeContent(viewer, { visibility: row.visibility }),
    )
    .map((row) => ({ kind: "universe" as const, id: row.id, title: row.title, plain: row.plain }));
}

async function searchPins(
  worldId: string,
  viewer: Viewer,
  query: string,
  limit: number,
): Promise<RawHit[]> {
  const filters: SQL[] = [
    eq(universes.worldId, worldId),
    matchTitleOrPlain(pins.title, sql`coalesce(${pins.descriptionPlain}, '')`, pins.descriptionTsv, query),
    visibleContentWhere({ visibility: pins.visibility, ownerId: pins.ownerId }, viewer),
  ];
  if (!isStaff(viewer.role)) {
    filters.push(eq(universes.visibility, "published"));
    filters.push(eq(maps.visibility, "published"));
  }
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
    .where(and(...filters))
    .limit(limit);
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

async function searchCharacters(worldId: string, query: string, limit: number): Promise<RawHit[]> {
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
    )
    .limit(limit);
  return rows.map((row) => ({ kind: "character" as const, id: row.id, title: row.title, plain: row.plain }));
}
