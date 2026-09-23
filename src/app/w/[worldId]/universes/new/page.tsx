import { notFound } from "next/navigation";
import { UniverseForm } from "@/components/world/UniverseForm";
import { isStaff } from "@/lib/authz/types";
import { requireWorldPage } from "@/lib/page-context";

export default async function NewUniversePage({ params }: PageProps<"/w/[worldId]/universes/new">) {
  const { worldId } = await params;
  const { world, membership } = await requireWorldPage(worldId);
  if (!isStaff(membership.role)) notFound();
  return <UniverseForm worldId={world.id} />;
}
