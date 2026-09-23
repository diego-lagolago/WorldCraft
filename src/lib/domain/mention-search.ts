import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { articles } from "@/db/schema";
import { isStaff, type MembershipRole } from "@/lib/authz";
import {
  MENTION_QUERY_MAX,
  MENTION_RESULT_LIMIT,
  escapeLikePattern,
  rankMentionHits,
  type MentionHit,
} from "@/lib/editor/mentions";

/** `title ILIKE '%q%'` plus a word-start flag for ranking (Fachmodell 2.4). */
function titleMatch(column: typeof articles.title, query: string) {
  const escaped = escapeLikePattern(query);
  const contains = ilike(column, `%${escaped}%`);
  const wordStart = or(ilike(column, `${escaped}%`), ilike(column, `% ${escaped}%`)) as SQL;
  return { contains, wordStart };
}

async function searchArticles(worldId: string, role: MembershipRole, query: string) {
  const filters: SQL[] = [eq(articles.worldId, worldId)];
  if (!isStaff(role)) filters.push(eq(articles.visibility, "published"));
  let order: SQL[] = [asc(articles.title)];
  if (query) {
    const match = titleMatch(articles.title, query);
    filters.push(match.contains);
    order = [desc(sql`(${match.wordStart})`), asc(articles.title)];
  }
  const rows = await db
    .select({ id: articles.id, title: articles.title, templateType: articles.templateType })
    .from(articles)
    .where(and(...filters))
    .orderBy(...order)
    .limit(MENTION_RESULT_LIMIT);
  return rows.map((row): MentionHit => ({ kind: "article", ...row }));
}

/**
 * APP-MENTION-SEARCH: visible mention targets of one world for the actor.
 * Each source is limited in SQL, the merged list is ranked once more.
 */
export async function searchMentionTargets(input: {
  worldId: string;
  role: MembershipRole;
  query: string;
}): Promise<MentionHit[]> {
  const query = input.query.trim().slice(0, MENTION_QUERY_MAX);
  const hits = await searchArticles(input.worldId, input.role, query);
  return rankMentionHits(hits, query);
}
