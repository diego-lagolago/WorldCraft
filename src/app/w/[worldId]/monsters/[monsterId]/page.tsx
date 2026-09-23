import { notFound } from "next/navigation";
import { MonsterDetailView } from "@/components/monsters/MonsterDetailView";
import { isStaff } from "@/lib/authz/types";
import { getArticle } from "@/lib/domain/articles";
import { resolveMentions } from "@/lib/domain/mention-resolve";
import { getMonster } from "@/lib/domain/monsters";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import { parseUuid } from "@/lib/http";
import { requireWorldPage } from "@/lib/page-context";

export default async function MonsterPage({
  params,
}: {
  params: Promise<{ worldId: string; monsterId: string }>;
}) {
  const { worldId, monsterId } = await params;
  const { world, membership } = await requireWorldPage(worldId);
  const id = parseUuid(monsterId);
  const monster = id ? await getMonster(world.id, id, membership.role, membership.userId) : null;
  if (!monster) notFound();

  const doc = asRichDoc(monster.bioJson);
  const mentions = await resolveMentions(
    world.id,
    membership.role,
    membership.userId,
    extractMentions(doc),
  );
  const habitat =
    monster.habitatArticleId
      ? await getArticle(world.id, monster.habitatArticleId, membership.role, membership.userId)
      : null;
  const staff = isStaff(membership.role);

  return (
    <MonsterDetailView
      worldId={world.id}
      monster={monster}
      habitat={habitat ? { id: habitat.id, title: habitat.title } : null}
      mentions={mentions}
      canEdit={staff}
      role={membership.role}
      viewerId={membership.userId}
    />
  );
}
