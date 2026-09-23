import { and, eq } from "drizzle-orm";
import { db, type DbTx } from "@/db/client";
import { quests } from "@/db/schema";
import {
  canSeeContent,
  type ContentVisibility,
  type MembershipRole,
} from "@/lib/authz";

export type QuestAccessRow = {
  id: string;
  worldId: string;
  visibility: ContentVisibility;
  ownerId: string;
};

export type VisibleQuestRow = QuestAccessRow & {
  title: string;
  status: string;
  descriptionJson: unknown;
};

export function canSeeQuest(
  quest: QuestAccessRow,
  viewer: { role: MembershipRole; userId: string },
): boolean {
  return canSeeContent(viewer, { visibility: quest.visibility, ownerId: quest.ownerId });
}

export async function loadQuestRow(
  worldId: string,
  questId: string,
  exec: DbTx | typeof db = db,
): Promise<QuestAccessRow | null> {
  const [row] = await exec
    .select({
      id: quests.id,
      worldId: quests.worldId,
      visibility: quests.visibility,
      ownerId: quests.ownerId,
    })
    .from(quests)
    .where(and(eq(quests.id, questId), eq(quests.worldId, worldId)))
    .limit(1);
  return row ?? null;
}

/** Returns the quest row when the viewer may see it, otherwise null. */
export async function loadVisibleQuest(
  worldId: string,
  questId: string,
  viewer: { role: MembershipRole; userId: string },
  exec: DbTx | typeof db = db,
): Promise<QuestAccessRow | null> {
  const quest = await loadQuestRow(worldId, questId, exec);
  if (!quest || !canSeeQuest(quest, viewer)) return null;
  return quest;
}

/** Full quest row for detail views; one SELECT with visibility check. */
export async function loadVisibleQuestDetails(
  worldId: string,
  questId: string,
  viewer: { role: MembershipRole; userId: string },
): Promise<VisibleQuestRow | null> {
  const [row] = await db
    .select({
      id: quests.id,
      worldId: quests.worldId,
      title: quests.title,
      status: quests.status,
      visibility: quests.visibility,
      ownerId: quests.ownerId,
      descriptionJson: quests.descriptionJson,
    })
    .from(quests)
    .where(and(eq(quests.id, questId), eq(quests.worldId, worldId)))
    .limit(1);
  if (!row || !canSeeQuest(row, viewer)) return null;
  return row;
}
