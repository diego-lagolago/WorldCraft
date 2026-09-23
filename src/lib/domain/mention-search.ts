import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { articles, characters, universes, worldParticipations } from "@/db/schema";
import { isStaff, type MembershipRole } from "@/lib/authz";
import {
  MENTION_QUERY_MAX,
  MENTION_RESULT_LIMIT,
  escapeLikePattern,
  rankMentionHits,
  type MentionHit,
} from "@/lib/editor/mentions";

/** `title ILIKE '%q%'` plus a word-start flag for ranking (Fachmodell 2.4). */
function titleMatch(column: typeof articles.title | typeof universes.name | typeof characters.name, query: string) {
  const escaped = escapeLikePattern(query);
  const contains = ilike(column, `%${escaped}%`);
  const wordStart = or(ilike(column, `${escaped}%`), ilike(column, `% ${escaped}%`)) as SQL;
  return { contains, wordStart };
}

function orderFor(column: typeof articles.title | typeof universes.name | typeof characters.name, query: string): SQL[] {
  if (!query) return [asc(column)];
  const match = titleMatch(column, query);
  return [desc(sql`(${match.wordStart})`), asc(column)];
}

async function searchArticles(worldId: string, role: MembershipRole, query: string): Promise<MentionHit[]> {
  const filters: SQL[] = [eq(articles.worldId, worldId)];
  if (!isStaff(role)) filters.push(eq(articles.visibility, "published"));
  if (query) filters.push(titleMatch(articles.title, query).contains);
  const rows = await db
    .select({ id: articles.id, title: articles.title, templateType: articles.templateType })
    .from(articles)
    .where(and(...filters))
    .orderBy(...orderFor(articles.title, query))
    .limit(MENTION_RESULT_LIMIT);
  return rows.map((row): MentionHit => ({ kind: "article", ...row }));
}

async function searchUniverses(worldId: string, role: MembershipRole, query: string): Promise<MentionHit[]> {
  const filters: SQL[] = [eq(universes.worldId, worldId)];
  if (!isStaff(role)) filters.push(eq(universes.visibility, "published"));
  if (query) filters.push(titleMatch(universes.name, query).contains);
  const rows = await db
    .select({ id: universes.id, title: universes.name })
    .from(universes)
    .where(and(...filters))
    .orderBy(...orderFor(universes.name, query))
    .limit(MENTION_RESULT_LIMIT);
  return rows.map((row): MentionHit => ({ kind: "universe", ...row }));
}

async function searchCharacters(worldId: string, query: string): Promise<MentionHit[]> {
  const filters: SQL[] = [eq(worldParticipations.worldId, worldId), isNull(worldParticipations.archivedAt)];
  if (query) filters.push(titleMatch(characters.name, query).contains);
  const rows = await db
    .select({ id: characters.id, title: characters.name })
    .from(worldParticipations)
    .innerJoin(characters, eq(characters.id, worldParticipations.characterId))
    .where(and(...filters))
    .orderBy(...orderFor(characters.name, query))
    .limit(MENTION_RESULT_LIMIT);
  return rows.map((row): MentionHit => ({ kind: "character", ...row }));
}

/**
 * APP-MENTION-SEARCH: visible mention targets of one world. T-011 adds quests
 * as one more source with the same limit and ranking.
 */
export async function searchMentionTargets(input: {
  worldId: string;
  role: MembershipRole;
  query: string;
}): Promise<MentionHit[]> {
  const query = input.query.trim().slice(0, MENTION_QUERY_MAX);
  const [articleHits, universeHits, characterHits] = await Promise.all([
    searchArticles(input.worldId, input.role, query),
    searchUniverses(input.worldId, input.role, query),
    searchCharacters(input.worldId, query),
  ]);
  return rankMentionHits([...articleHits, ...universeHits, ...characterHits], query);
}
