import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { articles, characters, quests, universes, worldParticipations } from "@/db/schema";
import { contentHref } from "@/lib/content-href";
import { canSeeVisibility, type MembershipRole } from "@/lib/authz";
import { mentionKey, type MentionRef, type MentionState, type MentionableKind } from "@/lib/editor/mentions";

/** Reader view of one mention: a link, a red stub link, or plain text when missing or hidden. */
export type ResolvedMention = { state: MentionState; href: string; title: string } | { state: "plain" };

export function mentionHref(worldId: string, ref: MentionRef): string {
  return contentHref(worldId, ref.kind, ref.id);
}

function idsOf(refs: readonly MentionRef[], kind: MentionableKind): string[] {
  return refs.filter((ref) => ref.kind === kind).map((ref) => ref.id);
}

/**
 * APP-MENTION-RENDER: one query per kind. Targets that are gone, in another
 * world or hidden for the role render as their stored label without a link.
 */
export async function resolveMentions(
  worldId: string,
  role: MembershipRole,
  refs: readonly MentionRef[],
): Promise<Record<string, ResolvedMention>> {
  const articleIds = idsOf(refs, "article");
  const questIds = idsOf(refs, "quest");
  const universeIds = idsOf(refs, "universe");
  const characterIds = idsOf(refs, "character");

  const [articleRows, questRows, universeRows, characterRows] = await Promise.all([
    articleIds.length
      ? db
          .select({
            id: articles.id,
            title: articles.title,
            visibility: articles.visibility,
            firstEditedAt: articles.firstEditedAt,
          })
          .from(articles)
          .where(and(eq(articles.worldId, worldId), inArray(articles.id, articleIds)))
      : [],
    questIds.length
      ? db
          .select({ id: quests.id, title: quests.title, visibility: quests.visibility })
          .from(quests)
          .where(and(eq(quests.worldId, worldId), inArray(quests.id, questIds)))
      : [],
    universeIds.length
      ? db
          .select({ id: universes.id, title: universes.name, visibility: universes.visibility })
          .from(universes)
          .where(and(eq(universes.worldId, worldId), inArray(universes.id, universeIds)))
      : [],
    characterIds.length
      ? db
          .select({ id: characters.id, title: characters.name })
          .from(characters)
          .innerJoin(
            worldParticipations,
            and(
              eq(worldParticipations.characterId, characters.id),
              eq(worldParticipations.worldId, worldId),
              isNull(worldParticipations.archivedAt),
            ),
          )
          .where(inArray(characters.id, characterIds))
      : [],
  ]);

  const out: Record<string, ResolvedMention> = {};
  for (const ref of refs) out[mentionKey(ref)] = { state: "plain" };

  const put = (kind: MentionableKind, id: string, title: string, state: MentionState) => {
    out[mentionKey({ kind, id })] = { state, title, href: mentionHref(worldId, { kind, id }) };
  };
  for (const row of articleRows) {
    if (canSeeVisibility(role, row.visibility)) put("article", row.id, row.title, row.firstEditedAt ? "linked" : "stub");
  }
  for (const row of questRows) {
    if (canSeeVisibility(role, row.visibility)) put("quest", row.id, row.title, "linked");
  }
  for (const row of universeRows) {
    if (canSeeVisibility(role, row.visibility)) put("universe", row.id, row.title, "linked");
  }
  for (const row of characterRows) put("character", row.id, row.title, "linked");
  return out;
}

/** Editor input: states of the mentions a document already contains. */
export function editorMentionStates(resolved: Record<string, ResolvedMention>): Record<string, MentionState> {
  const out: Record<string, MentionState> = {};
  for (const [key, value] of Object.entries(resolved)) {
    if (value.state !== "plain") out[key] = value.state;
  }
  return out;
}
