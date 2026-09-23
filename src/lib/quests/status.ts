/** Client-safe quest status labels (no DB). */

export const QUEST_STATUSES = ["open", "active", "completed", "failed"] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];

export const QUEST_STATUS_LABEL: Record<QuestStatus, string> = {
  open: "offen",
  active: "aktiv",
  completed: "abgeschlossen",
  failed: "gescheitert",
};

export type QuestParticipant = {
  characterId: string | null;
  characterName: string;
  /** Link only when the character is still actively brought into the world. */
  href: boolean;
};
