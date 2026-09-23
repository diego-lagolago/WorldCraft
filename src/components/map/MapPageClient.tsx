"use client";

import dynamic from "next/dynamic";
import type { MapState } from "@/lib/map/types";

const MapView = dynamic(() => import("./MapView").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => <p className="empty">Karte wird geladen…</p>,
});

export function MapPageClient({ worldId, initial }: { worldId: string; initial: MapState }) {
  return <MapView worldId={worldId} initial={initial} />;
}
