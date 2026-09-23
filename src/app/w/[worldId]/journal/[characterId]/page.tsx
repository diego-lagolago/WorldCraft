import Link from "next/link";
import { notFound } from "next/navigation";
import { portraitUrl } from "@/components/characters/CharacterSheetView";
import { JournalEntryForm } from "@/components/characters/JournalEntryForm";
import { JournalVisibilityPill } from "@/components/characters/JournalVisibilityPill";
import { RichTextView } from "@/components/editor/RichTextView";
import { worldPath } from "@/components/shell/nav";
import { Avatar } from "@/components/world/display";
import { isStaff } from "@/lib/authz/types";
import { getWorldCharacter } from "@/lib/domain/characters";
import { listJournal } from "@/lib/domain/journal";
import { resolveMentions } from "@/lib/domain/mention-resolve";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import { parseUuid } from "@/lib/http";
import { requireWorldPage } from "@/lib/page-context";

/** Owner writes and sees everything; staff read shared entries; other players get 404 (R-3.9). */
export default async function JournalPage({ params }: PageProps<"/w/[worldId]/journal/[characterId]">) {
  const { worldId, characterId } = await params;
  const { world, membership, user } = await requireWorldPage(worldId);
  const id = parseUuid(characterId);
  const character = id ? await getWorldCharacter(world.id, id) : null;
  if (!character) notFound();
  const owner = character.ownerId === user.id;
  const staff = isStaff(membership.role);
  if (!owner && !staff) notFound();

  const entries = await listJournal({ worldId: world.id, characterId: character.id, viewerId: user.id, role: membership.role });
  if (!entries.ok) notFound();
  const docs = entries.data.map((entry) => asRichDoc(entry.bodyJson));
  const mentions = await resolveMentions(world.id, membership.role, docs.flatMap((doc) => extractMentions(doc)));

  return (
    <>
      <Link className="back" href={worldPath(world.id, `/characters/${character.id}`)}>
        ‹ {character.name}
      </Link>
      <div className="row" style={{ marginBottom: 12 }}>
        <Avatar name={character.name} image={portraitUrl(character.portraitId)} />
        <div>
          <h1 style={{ fontSize: 22 }}>Tagebuch</h1>
          <div className="muted small">
            {character.name} · {world.name}
          </div>
        </div>
      </div>
      <div className="hint" style={{ marginBottom: 12 }}>
        {owner
          ? "„Privat“ siehst nur du. „Mit Spielleitung geteilt“ sehen du, der Game Master und die Master. Einträge erzeugen keine Verknüpfungen."
          : "Du siehst nur Einträge, die mit der Spielleitung geteilt sind."}
      </div>
      <div className="stack">
        {entries.data.length === 0 ? <div className="card empty">Noch keine Einträge.</div> : null}
        {entries.data.map((entry, index) => (
          <article key={entry.id} className="card">
            <div className="row wrap">
              <b className="grow">{entry.title ?? "Ohne Titel"}</b>
              <JournalVisibilityPill
                worldId={world.id}
                entryId={entry.id}
                visibility={entry.visibility}
                canChange={owner}
              />
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {entry.createdAt.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
            </div>
            <div style={{ marginTop: 8 }}>
              <RichTextView doc={docs[index]} mentions={mentions} />
            </div>
          </article>
        ))}
        {owner ? <JournalEntryForm worldId={world.id} characterId={character.id} canCreateArticle={staff} /> : null}
      </div>
    </>
  );
}
