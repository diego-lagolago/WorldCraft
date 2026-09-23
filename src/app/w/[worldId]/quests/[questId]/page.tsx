import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkedSection } from "@/components/linked/LinkedSection";
import { RichTextView } from "@/components/editor/RichTextView";
import { QuestChapters } from "@/components/quests/QuestChapters";
import { QuestNotesSheet } from "@/components/quests/QuestNotesSheet";
import { worldPath } from "@/components/shell/nav";
import { GmBadge } from "@/components/world/display";
import { isStaff } from "@/lib/authz/types";
import { editorMentionStates, resolveMentions } from "@/lib/domain/mention-resolve";
import { getQuestNote } from "@/lib/domain/quest-notes";
import { getQuest, QUEST_STATUS_LABEL } from "@/lib/domain/quests";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import { parseUuid } from "@/lib/http";
import { requireWorldPage } from "@/lib/page-context";

export default async function QuestPage({ params }: PageProps<"/w/[worldId]/quests/[questId]">) {
  const { worldId, questId } = await params;
  const { world, membership } = await requireWorldPage(worldId);
  const id = parseUuid(questId);
  const quest = id ? await getQuest(world.id, id, membership.role, membership.userId) : null;
  if (!quest) notFound();

  const doc = asRichDoc(quest.descriptionJson);
  const chapterRefs = quest.chapters.flatMap((chapter) => extractMentions(asRichDoc(chapter.bodyJson)));
  const noteResult = await getQuestNote({
    worldId: world.id,
    questId: quest.id,
    role: membership.role,
    viewerId: membership.userId,
  });
  const note = noteResult.ok ? noteResult.data : null;
  const mentions = await resolveMentions(world.id, membership.role, membership.userId, [
    ...extractMentions(doc),
    ...chapterRefs,
  ]);
  const staff = isStaff(membership.role);
  const pageMentions = { ...mentions, ...(note?.mentions ?? {}) };
  const allMentionStates = editorMentionStates(pageMentions);

  return (
    <>
      <Link className="back" href={worldPath(world.id)}>
        ‹ Kampagne
      </Link>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>{quest.title}</h1>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <span className="badge">Quest</span>
        <GmBadge visibility={quest.visibility} />
        <span className={`badge st-${quest.status}`}>{QUEST_STATUS_LABEL[quest.status]}</span>
        {staff ? (
          <Link className="btn sm" style={{ marginLeft: "auto" }} href={worldPath(world.id, `/quests/${quest.id}/edit`)}>
            Bearbeiten
          </Link>
        ) : null}
      </div>
      <div className="grid2">
        <div className="stack">
          <div className="card">
            <h2>Beteiligte</h2>
            {quest.participants.length === 0 ? (
              <p className="muted">Noch keine Beteiligten.</p>
            ) : (
              <div className="row wrap">
                {quest.participants.map((entry) =>
                  entry.href && entry.characterId ? (
                    <Link
                      key={entry.id}
                      className="chip"
                      href={worldPath(world.id, `/characters/${entry.characterId}`)}
                    >
                      {entry.characterName}
                    </Link>
                  ) : (
                    <span key={entry.id} className="chip">
                      {entry.characterName}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
          <div className="card">
            <RichTextView doc={doc} mentions={pageMentions} empty={<p className="muted">Noch keine Beschreibung.</p>} />
          </div>
        </div>
        <div className="quest-side">
          {note ? (
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <QuestNotesSheet
                worldId={world.id}
                questId={quest.id}
                canCreateArticle={staff}
                mentionStates={allMentionStates}
                initialNote={{
                  bodyJson: note.bodyJson,
                  version: note.version,
                  updatedAt: note.updatedAt ? note.updatedAt.toISOString() : null,
                  updatedByName: note.updatedByName,
                  mentions: note.mentions,
                }}
              />
            </div>
          ) : null}
          <LinkedSection
            worldId={world.id}
            role={membership.role}
            viewerId={membership.userId}
            kind="quest"
            id={quest.id}
            canEdit={staff}
          />
        </div>
      </div>
      <QuestChapters
        worldId={world.id}
        questId={quest.id}
        chapters={quest.chapters}
        actorId={membership.userId}
        staff={staff}
        mentions={pageMentions}
        mentionStates={allMentionStates}
      />
    </>
  );
}
