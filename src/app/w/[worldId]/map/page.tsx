import { MapPageClient } from "@/components/map/MapPageClient";
import { optionalUuid } from "@/lib/chat/query";
import { loadMapState } from "@/lib/map/repository";
import { requireWorldPage } from "@/lib/page-context";

export default async function MapPage({
  params,
  searchParams,
}: {
  params: Promise<{ worldId: string }>;
  searchParams: Promise<{ universe?: string; map?: string; pin?: string }>;
}) {
  const { worldId } = await params;
  const query = await searchParams;
  const { world, membership, user } = await requireWorldPage(worldId);
  const universe = optionalUuid(query.universe ?? null);
  const map = optionalUuid(query.map ?? null);
  const pin = optionalUuid(query.pin ?? null);
  const state = await loadMapState({
    worldId: world.id,
    actorId: user.id,
    role: membership.role,
    universeId: universe.ok ? universe.id : null,
    mapId: map.ok ? map.id : null,
    pinId: pin.ok ? pin.id : null,
  });
  if (!state.ok) return <p className="empty">{state.error}</p>;
  return (
    <MapPageClient
      key={`${state.data.map?.id ?? ""}:${state.data.highlightPinId ?? ""}`}
      worldId={world.id}
      initial={state.data}
    />
  );
}
