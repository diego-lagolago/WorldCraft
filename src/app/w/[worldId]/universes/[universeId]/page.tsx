import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkedSection } from "@/components/linked/LinkedSection";
import { RichTextView } from "@/components/editor/RichTextView";
import { worldPath } from "@/components/shell/nav";
import { GmBadge } from "@/components/world/display";
import { isStaff } from "@/lib/authz/types";
import { resolveMentions } from "@/lib/domain/mention-resolve";
import { getUniverse } from "@/lib/domain/universes";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import { parseUuid } from "@/lib/http";
import { requireWorldPage } from "@/lib/page-context";

export default async function UniversePage({ params }: PageProps<"/w/[worldId]/universes/[universeId]">) {
  const { worldId, universeId } = await params;
  const { world, membership } = await requireWorldPage(worldId);
  const id = parseUuid(universeId);
  const universe = id ? await getUniverse(world.id, id, membership.role, membership.userId) : null;
  if (!universe) notFound();

  const doc = asRichDoc(universe.descriptionJson);
  const mentions = await resolveMentions(world.id, membership.role, membership.userId, extractMentions(doc));

  return (
    <>
      <Link className="back" href={worldPath(world.id)}>
        ‹ Kampagne
      </Link>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>🪐 {universe.name}</h1>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <span className="badge">Universum</span>
        <GmBadge visibility={universe.visibility} />
        {isStaff(membership.role) ? (
          <Link
            className="btn sm"
            style={{ marginLeft: "auto" }}
            href={worldPath(world.id, `/universes/${universe.id}/edit`)}
          >
            Bearbeiten
          </Link>
        ) : null}
      </div>
      <div className="grid2">
        <div className="stack">
          <div className="card">
            <RichTextView doc={doc} mentions={mentions} empty={<p className="muted">Noch keine Beschreibung.</p>} />
          </div>
          <div className="card">
            <h2>Karte</h2>
            <Link className="item" href={`${worldPath(world.id, "/map")}?universe=${universe.id}`}>
              <span aria-hidden="true">🗺️</span>
              <div className="grow">Karte dieses Universums</div>
              <span className="muted" aria-hidden="true">
                ›
              </span>
            </Link>
          </div>
          <LinkedSection
            worldId={world.id}
            role={membership.role}
            viewerId={membership.userId}
            kind="universe"
            id={universe.id}
            canEdit={isStaff(membership.role)}
          />
        </div>
      </div>
    </>
  );
}
