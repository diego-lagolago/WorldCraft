import Link from "next/link";
import { portraitUrl } from "@/components/characters/CharacterSheetView";
import { CreateCharacterForm } from "@/components/characters/CreateCharacterForm";
import { worldPath } from "@/components/shell/nav";
import { Avatar } from "@/components/world/display";
import { listMyCharacters } from "@/lib/domain/characters";
import { requirePageUser } from "@/lib/page-context";

export default async function MyCharactersPage() {
  const user = await requirePageUser();
  const characters = await listMyCharacters(user.id);
  const journals = characters.flatMap((character) =>
    character.worlds.filter((world) => !world.archived).map((world) => ({ character, world })),
  );

  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 14 }}>Meine Charaktere</h1>
      <div className="grid2">
        <div className="card list">
          {characters.length === 0 ? <div className="empty">Du hast noch keine Charaktere.</div> : null}
          {characters.map((character) => {
            const active = character.worlds.filter((world) => !world.archived);
            return (
              <Link key={character.id} href={`/characters/${character.id}`} className="item">
                <Avatar name={character.name} image={portraitUrl(character.portraitId)} size="sm" />
                <div className="grow">
                  {character.name}
                  <div className="kind">
                    {[character.class, active.length ? active.map((world) => world.worldName).join(", ") : "in keiner Welt"]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <span className="muted" aria-hidden="true">
                  ›
                </span>
              </Link>
            );
          })}
        </div>
        <div className="stack">
          <CreateCharacterForm />
          {journals.length > 0 ? (
            <div className="card list">
              {journals.map(({ character, world }) => (
                <Link
                  key={`${character.id}-${world.worldId}`}
                  href={worldPath(world.worldId, `/journal/${character.id}`)}
                  className="item"
                >
                  <div className="grow">
                    Tagebuch: {character.name}
                    <div className="kind">{world.worldName}</div>
                  </div>
                  <span className="muted" aria-hidden="true">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
