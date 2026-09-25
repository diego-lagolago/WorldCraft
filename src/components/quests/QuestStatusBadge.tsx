import { QUEST_STATUS_LABEL, type QuestStatus } from "@/lib/quests/status";

export function QuestStatusBadge({ status }: { status: QuestStatus }) {
  return <span className={`badge st-${status}`}>{QUEST_STATUS_LABEL[status]}</span>;
}
