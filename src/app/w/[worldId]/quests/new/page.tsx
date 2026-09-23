import { notFound } from "next/navigation";
import { QuestForm } from "@/components/quests/QuestForm";
import { isStaff } from "@/lib/authz/types";
import { listWorldCharacters } from "@/lib/domain/characters";
import { requireWorldPage } from "@/lib/page-context";

export default async function NewQuestPage({ params }: PageProps<"/w/[worldId]/quests/new">) {
  const { worldId } = await params;
  const { world, membership } = await requireWorldPage(worldId);
  if (!isStaff(membership.role)) notFound();
  const characters = await listWorldCharacters(world.id);
  return (
    <QuestForm
      worldId={world.id}
      characters={characters.map((entry) => ({ id: entry.id, name: entry.name }))}
    />
  );
}
