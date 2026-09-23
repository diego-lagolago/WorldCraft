import { notFound } from "next/navigation";
import { MonsterForm } from "@/components/monsters/MonsterForm";
import { isStaff } from "@/lib/authz/types";
import { listArticles } from "@/lib/domain/articles";
import { requireWorldPage } from "@/lib/page-context";

export default async function NewMonsterPage({ params }: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await params;
  const { world, membership } = await requireWorldPage(worldId);
  if (!isStaff(membership.role)) notFound();
  const places = await listArticles(world.id, membership.role, membership.userId, "place");
  return (
    <MonsterForm
      worldId={world.id}
      actorId={membership.userId}
      placeOptions={places.map((place) => ({ id: place.id, title: place.title }))}
    />
  );
}
