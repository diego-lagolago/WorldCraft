import Link from "next/link";
import { worldPath } from "@/components/shell/nav";
import { Avatar } from "@/components/world/display";
import type { CharacterSummary, OwnCharacter } from "@/lib/domain/characters";
import { BringCharacterForm } from "./BringCharacterForm";
import { portraitUrl } from "./CharacterSheetView";

/** All brought, non-archived characters; every member may open the sheet (R-3.8-2). */
export function WorldCharactersCard({ worldId, characters }: { worldId: string; characters: CharacterSummary[] }) {
  return (
    <div className="card">
      <h2>Charaktere der Welt</h2>
      <div className="list">
        {characters.length === 0 ? <div className="empty">Noch niemand hat einen Charakter mitgebracht.</div> : null}
        {characters.map((character) => (
          <Link key={character.id} className="item" href={worldPath(worldId, `/characters/${character.id}`)}>
            <Avatar name={character.name} image={portraitUrl(character.portraitId)} size="sm" />
            <div className="grow">
              {character.name}
              <div className="kind">{[character.class, character.ownerName].filter(Boolean).join(" · ")}</div>
            </div>
            <span className="muted" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** The viewer's own characters: brought ones with journal and edit, the rest can be brought. */
export function MyWorldCharactersCard({ worldId, mine }: { worldId: string; mine: OwnCharacter[] }) {
  const inWorld = (character: OwnCharacter) =>
    character.worlds.some((world) => world.worldId === worldId && !world.archived);
  const brought = mine.filter(inWorld);
  const available = mine.filter((character) => !inWorld(character));
  const back = encodeURIComponent(worldPath(worldId, "/menu"));

  return (
    <div className="card">
      <h2>Meine Charaktere</h2>
      <div className="list">
        {brought.length === 0 ? <div className="empty">Du hast hier noch keinen Charakter mitgebracht.</div> : null}
        {brought.map((character) => (
          <div key={character.id} className="item">
            <Avatar name={character.name} image={portraitUrl(character.portraitId)} size="sm" />
            <Link className="grow" href={worldPath(worldId, `/characters/${character.id}`)}>
              {character.name}
              <div className="kind">in dieser Welt mitgebracht</div>
            </Link>
            <Link className="btn sm" href={worldPath(worldId, `/journal/${character.id}`)}>
              Tagebuch
            </Link>
            <Link className="btn sm" href={`/characters/${character.id}?back=${back}`}>
              Bearbeiten
            </Link>
          </div>
        ))}
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        {available.length > 0 ? (
          <BringCharacterForm worldId={worldId} characters={available.map(({ id, name }) => ({ id, name }))} />
        ) : null}
        <Link className="btn sm" href="/characters" style={{ alignSelf: "flex-start" }}>
          ＋ Charakter
        </Link>
      </div>
    </div>
  );
}
