import { notFound } from "next/navigation";
import { UniverseForm } from "@/components/world/UniverseForm";
import { isStaff } from "@/lib/authz/types";
import { editorMentionStates, resolveMentions } from "@/lib/domain/mention-resolve";
import { getUniverse } from "@/lib/domain/universes";
import { asRichDoc, extractMentions } from "@/lib/editor/rich-text";
import { parseUuid } from "@/lib/http";
import { requireWorldPage } from "@/lib/page-context";

export default async function EditUniversePage({
  params,
}: PageProps<"/w/[worldId]/universes/[universeId]/edit">) {
  const { worldId, universeId } = await params;
  const { world, membership } = await requireWorldPage(worldId);
  if (!isStaff(membership.role)) notFound();
  const id = parseUuid(universeId);
  const universe = id ? await getUniverse(world.id, id, membership.role) : null;
  if (!universe) notFound();

  const description = asRichDoc(universe.descriptionJson);
  const mentions = await resolveMentions(world.id, membership.role, extractMentions(description));

  return (
    <UniverseForm
      worldId={world.id}
      universe={{ id: universe.id, name: universe.name, visibility: universe.visibility, description }}
      mentionStates={editorMentionStates(mentions)}
    />
  );
}
