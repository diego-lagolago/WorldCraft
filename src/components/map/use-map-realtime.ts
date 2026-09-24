"use client";

import { useWorldRealtime } from "@/lib/realtime/use-realtime";
import type { WorldRealtimeEvent } from "@/lib/realtime/events";
import type { MapState, MarkerDto, PinDto } from "@/lib/map/types";

export function useMapRealtime(
  worldId: string,
  universeId: string | null,
  apply: (event: WorldRealtimeEvent) => void,
  onResync: () => void,
) {
  useWorldRealtime(worldId, {
    onEvent: (event) => {
      if (event.type === "map.updated" && universeId && event.universeId !== universeId) return;
      apply(event);
    },
    onResync,
  });
}

/** Sync apply for delete signals only; pin/marker upserts refetch in use-map-state. */
export function applyMapEvent(
  current: MapState,
  event: WorldRealtimeEvent,
): MapState {
  if (event.type === "map.pin.deleted") {
    return { ...current, pins: current.pins.filter((pin) => pin.id !== event.pinId) };
  }
  if (event.type === "map.marker.deleted") {
    const removed = current.markers.find((row) => row.id === event.markerId);
    return {
      ...current,
      markers: current.markers.filter((row) => row.id !== event.markerId),
      characters: current.characters.map((row) =>
        removed?.characterId === row.id ? { ...row, placed: false, placedElsewhere: false } : row,
      ),
    };
  }
  if (event.type === "map.monsterMarker.deleted") {
    return {
      ...current,
      monsterMarkers: current.monsterMarkers.filter((row) => row.id !== event.markerId),
    };
  }
  return current;
}

export type { PinDto, MarkerDto };
