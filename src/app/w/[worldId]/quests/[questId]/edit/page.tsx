import { notFound } from "next/navigation";
import { QuestForm } from "@/components/quests/QuestForm";
import { isStaff } from "@/lib/authz/types";
import { listWorldCharacters } from "@/lib/domain/characters";
import { editorMentionStates, resolveMentions } from "@/lib/domain/mention-resolve";
import { getQuest } from "@/lib/domain/quests";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import { parseUuid } from "@/lib/http";
import { requireWorldPage } from "@/lib/page-context";

export default async function EditQuestPage({ params }: PageProps<"/w/[worldId]/quests/[questId]/edit">) {
  const { worldId, questId } = await params;
  const { world, membership } = await requireWorldPage(worldId);
  if (!isStaff(membership.role)) notFound();
  const id = parseUuid(questId);
  const quest = id ? await getQuest(world.id, id, membership.role) : null;
  if (!quest) notFound();

  const doc = asRichDoc(quest.descriptionJson);
  const [characters, mentions] = await Promise.all([
    listWorldCharacters(world.id),
    resolveMentions(world.id, membership.role, extractMentions(doc)),
  ]);

  return (
    <QuestForm
      worldId={world.id}
      characters={characters.map((entry) => ({ id: entry.id, name: entry.name }))}
      mentionStates={editorMentionStates(mentions)}
      quest={{
        id: quest.id,
        title: quest.title,
        status: quest.status,
        visibility: quest.visibility,
        description: doc,
        participants: quest.participants,
      }}
    />
  );
}
