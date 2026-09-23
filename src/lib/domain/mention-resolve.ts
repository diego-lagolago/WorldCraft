import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { articles, characters, monsters, quests, universes, worldParticipations } from "@/db/schema";
import { contentHref } from "@/lib/content-href";
import { canSeeContent, type MembershipRole } from "@/lib/authz";
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
  viewerId: string,
  refs: readonly MentionRef[],
): Promise<Record<string, ResolvedMention>> {
  const articleIds = idsOf(refs, "article");
  const questIds = idsOf(refs, "quest");
  const universeIds = idsOf(refs, "universe");
  const characterIds = idsOf(refs, "character");
  const monsterIds = idsOf(refs, "monster");

  const [articleRows, questRows, universeRows, characterRows, monsterRows] = await Promise.all([
    articleIds.length
      ? db
          .select({
            id: articles.id,
            title: articles.title,
            visibility: articles.visibility,
            ownerId: articles.ownerId,
            firstEditedAt: articles.firstEditedAt,
          })
          .from(articles)
          .where(and(eq(articles.worldId, worldId), inArray(articles.id, articleIds)))
      : [],
    questIds.length
      ? db
          .select({
            id: quests.id,
            title: quests.title,
            visibility: quests.visibility,
            ownerId: quests.ownerId,
          })
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
    monsterIds.length
      ? db
          .select({
            id: monsters.id,
            title: monsters.name,
            visibility: monsters.visibility,
            ownerId: monsters.ownerId,
          })
          .from(monsters)
          .where(and(eq(monsters.worldId, worldId), inArray(monsters.id, monsterIds)))
      : [],
  ]);

  const out: Record<string, ResolvedMention> = {};
  for (const ref of refs) out[mentionKey(ref)] = { state: "plain" };

  const put = (kind: MentionableKind, id: string, title: string, state: MentionState) => {
    out[mentionKey({ kind, id })] = { state, title, href: mentionHref(worldId, { kind, id }) };
  };
  for (const row of articleRows) {
    if (
      canSeeContent(
        { role, userId: viewerId },
        { visibility: row.visibility, ownerId: row.ownerId },
      )
    ) {
      put("article", row.id, row.title, row.firstEditedAt ? "linked" : "stub");
    }
  }
  for (const row of questRows) {
    if (
      canSeeContent(
        { role, userId: viewerId },
        { visibility: row.visibility, ownerId: row.ownerId },
      )
    ) {
      put("quest", row.id, row.title, "linked");
    }
  }
  for (const row of universeRows) {
    if (canSeeContent({ role, userId: viewerId }, { visibility: row.visibility })) {
      put("universe", row.id, row.title, "linked");
    }
  }
  for (const row of characterRows) put("character", row.id, row.title, "linked");
  for (const row of monsterRows) {
    if (
      canSeeContent(
        { role, userId: viewerId },
        { visibility: row.visibility, ownerId: row.ownerId },
      )
    ) {
      put("monster", row.id, row.title, "linked");
    }
  }
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
