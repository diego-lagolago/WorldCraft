import Link from "next/link";
import { worldPath } from "@/components/shell/nav";
import { VisibilityBadge } from "@/components/world/display";
import type { QuestSummary } from "@/lib/domain/quests";
import { QUEST_STATUS_LABEL, type QuestStatus } from "@/lib/quests/status";

function StatusBadge({ status }: { status: QuestStatus }) {
  return <span className={`badge st-${status}`}>{QUEST_STATUS_LABEL[status]}</span>;
}

export function QuestList({
  worldId,
  quests,
  canCreate,
}: {
  worldId: string;
  quests: QuestSummary[];
  canCreate: boolean;
}) {
  return (
    <>
      <div className="section-h">
        <h2>Quests</h2>
        {canCreate ? (
          <Link className="btn sm" href={worldPath(worldId, "/quests/new")}>
            + Quest
          </Link>
        ) : null}
      </div>
      <div className="card list" style={{ padding: "0 4px" }}>
        {quests.length === 0 ? <div className="empty">Noch keine sichtbare Quest.</div> : null}
        {quests.map((quest) => {
          const names = quest.participants.map((entry) => entry.characterName.split(" ")[0]).join(", ");
          return (
            <Link key={quest.id} className="item" href={worldPath(worldId, `/quests/${quest.id}`)}>
              <div className="grow">
                {quest.title}
                {names ? <div className="kind">{names}</div> : null}
              </div>
              <VisibilityBadge visibility={quest.visibility} />
              <StatusBadge status={quest.status} />
            </Link>
          );
        })}
      </div>
    </>
  );
}
