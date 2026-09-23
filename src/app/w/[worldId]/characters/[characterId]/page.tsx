import Link from "next/link";
import { notFound } from "next/navigation";
import { CharacterSheetView } from "@/components/characters/CharacterSheetView";
import { LinkedSection } from "@/components/linked/LinkedSection";
import { worldPath } from "@/components/shell/nav";
import { isStaff } from "@/lib/authz/types";
import { getWorldCharacter } from "@/lib/domain/characters";
import { parseUuid } from "@/lib/http";
import { requireWorldPage } from "@/lib/page-context";

/** Every member sees a brought character (R-3.8-2); the journal link only for owner and staff. */
export default async function WorldCharacterPage({ params }: PageProps<"/w/[worldId]/characters/[characterId]">) {
  const { worldId, characterId } = await params;
  const { world, membership, user } = await requireWorldPage(worldId);
  const id = parseUuid(characterId);
  const sheet = id ? await getWorldCharacter(world.id, id) : null;
  if (!sheet) notFound();
  const owner = sheet.ownerId === user.id;
  const here = worldPath(world.id, `/characters/${sheet.id}`);

  return (
    <>
      <Link className="back" href={worldPath(world.id, "/menu")}>
        ‹ Menü
      </Link>
      <CharacterSheetView
        sheet={sheet}
        actions={
          <div className="row">
            {owner || isStaff(membership.role) ? (
              <Link className="btn sm" href={worldPath(world.id, `/journal/${sheet.id}`)}>
                Tagebuch
              </Link>
            ) : null}
            {owner ? (
              <Link className="btn sm" href={`/characters/${sheet.id}?back=${encodeURIComponent(here)}`}>
                Bearbeiten
              </Link>
            ) : null}
          </div>
        }
      />
      <LinkedSection
        worldId={world.id}
        role={membership.role}
        viewerId={membership.userId}
        kind="character"
        id={sheet.id}
        canEdit={isStaff(membership.role)}
      />
    </>
  );
}
