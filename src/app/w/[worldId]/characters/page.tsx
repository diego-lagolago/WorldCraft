import { MyWorldCharactersCard, WorldCharactersCard } from "@/components/characters/WorldCharacterCards";
import { listMyCharacters, listWorldCharacters } from "@/lib/domain/characters";
import { requireWorldPage } from "@/lib/page-context";

export default async function WorldCharactersPage({ params }: PageProps<"/w/[worldId]/characters">) {
  const { worldId } = await params;
  const { world, user } = await requireWorldPage(worldId);
  const [characters, mine] = await Promise.all([listWorldCharacters(world.id), listMyCharacters(user.id)]);

  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 14 }}>Charaktere</h1>
      <div className="grid2">
        <WorldCharactersCard worldId={world.id} characters={characters} />
        <MyWorldCharactersCard worldId={world.id} mine={mine} />
      </div>
    </>
  );
}
