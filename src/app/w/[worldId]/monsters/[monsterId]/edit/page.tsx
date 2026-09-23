import { notFound } from "next/navigation";
import { MonsterForm } from "@/components/monsters/MonsterForm";
import { isStaff } from "@/lib/authz/types";
import { listArticles } from "@/lib/domain/articles";
import { editorMentionStates, resolveMentions } from "@/lib/domain/mention-resolve";
import { getMonster } from "@/lib/domain/monsters";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import { parseUuid } from "@/lib/http";
import { requireWorldPage } from "@/lib/page-context";

export default async function EditMonsterPage({
  params,
  searchParams,
}: {
  params: Promise<{ worldId: string; monsterId: string }>;
  searchParams: Promise<{ portraitError?: string }>;
}) {
  const { worldId, monsterId } = await params;
  const query = await searchParams;
  const { world, membership } = await requireWorldPage(worldId);
  if (!isStaff(membership.role)) notFound();
  const id = parseUuid(monsterId);
  const monster = id ? await getMonster(world.id, id, membership.role, membership.userId) : null;
  if (!monster) notFound();

  const bio = asRichDoc(monster.bioJson);
  const [mentions, places] = await Promise.all([
    resolveMentions(world.id, membership.role, membership.userId, extractMentions(bio)),
    listArticles(world.id, membership.role, membership.userId, "place"),
  ]);

  return (
    <MonsterForm
      worldId={world.id}
      actorId={membership.userId}
      monster={{
        id: monster.id,
        name: monster.name,
        class: monster.class,
        visibility: monster.visibility,
        ownerId: monster.ownerId,
        portraitId: monster.portraitId,
        kind: monster.kind,
        rarity: monster.rarity,
        isLegendary: monster.isLegendary,
        danger: monster.danger,
        size: monster.size,
        habitatArticleId: monster.habitatArticleId,
        attributes: monster.attributes,
        proficiencyBonus: monster.proficiencyBonus,
        skills: monster.skills,
        abilities: monster.abilities,
        personality: monster.personality,
        ideals: monster.ideals,
        bonds: monster.bonds,
        flaws: monster.flaws,
        bioJson: monster.bioJson,
      }}
      placeOptions={places.map((place) => ({ id: place.id, title: place.title }))}
      mentionStates={editorMentionStates(mentions)}
      initialError={
        query.portraitError === "1"
          ? "Monster angelegt, Profilbild konnte nicht hochgeladen werden."
          : undefined
      }
    />
  );
}
