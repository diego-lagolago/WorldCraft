import type { ContentKind, MembershipRole } from "@/lib/authz/types";
import { LinkedPanel } from "@/components/linked/LinkedPanel";
import { ManualRelationForm } from "@/components/linked/ManualRelationForm";
import { listLinked, listManualLabels, listRelationTargets } from "@/lib/domain/relations";

export async function LinkedSection({
  worldId,
  role,
  viewerId,
  kind,
  id,
  canEdit,
}: {
  worldId: string;
  role: MembershipRole;
  viewerId: string;
  kind: ContentKind;
  id: string;
  canEdit: boolean;
}) {
  const [items, targets, labels] = await Promise.all([
    listLinked({ worldId, role, viewerId, kind, id }),
    canEdit ? listRelationTargets(worldId, role, viewerId) : Promise.resolve([]),
    canEdit ? listManualLabels(worldId) : Promise.resolve([]),
  ]);
  return (
    <>
      <LinkedPanel items={items} />
      {canEdit ? (
        <ManualRelationForm
          worldId={worldId}
          sourceKind={kind}
          sourceId={id}
          targets={targets}
          labels={labels}
        />
      ) : null}
    </>
  );
}
