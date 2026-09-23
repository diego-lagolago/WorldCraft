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

export function applyMapEvent(
  current: MapState,
  event: WorldRealtimeEvent,
  dragging: Set<string>,
): MapState {
  if (event.type === "map.updated") return current;
  if (event.type === "map.pin") {
    if (dragging.has(event.pin.id)) return current;
    if (current.map && event.pin.mapId !== current.map.id) return current;
    return { ...current, pins: [...current.pins.filter((pin) => pin.id !== event.pin.id), event.pin] };
  }
  if (event.type === "map.pin.deleted") {
    return { ...current, pins: current.pins.filter((pin) => pin.id !== event.pinId) };
  }
  if (event.type === "map.marker") {
    if (dragging.has(event.marker.id)) return current;
    if (current.map && event.marker.mapId !== current.map.id) return current;
    return {
      ...current,
      markers: [...current.markers.filter((row) => row.id !== event.marker.id), event.marker],
    };
  }
  if (event.type === "map.marker.deleted") {
    return { ...current, markers: current.markers.filter((row) => row.id !== event.markerId) };
  }
  return current;
}

export type { PinDto, MarkerDto };
