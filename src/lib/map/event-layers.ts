import type { ContentVisibility, VisibilityLayer, VisibilityStatus } from "@/lib/authz";

export function mapEventLayers(
  universeVisibility: VisibilityStatus,
  mapVisibility: VisibilityStatus,
): VisibilityLayer[] {
  return [{ visibility: universeVisibility }, { visibility: mapVisibility }];
}

export function monsterMarkerEventLayers(
  universeVisibility: VisibilityStatus,
  mapVisibility: VisibilityStatus,
  monsterVisibility: ContentVisibility,
  monsterOwnerId: string,
  markerVisibility: ContentVisibility,
  markerOwnerId: string,
): VisibilityLayer[] {
  return [
    { visibility: universeVisibility },
    { visibility: mapVisibility },
    { visibility: monsterVisibility, ownerId: monsterOwnerId },
    { visibility: markerVisibility, ownerId: markerOwnerId },
  ];
}
