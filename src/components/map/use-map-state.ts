"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client/api-fetch";
import type { MapState, MarkerDto, PinDetails, PinDto } from "@/lib/map/types";
import type { PinType } from "@/lib/map/pin-types";
import type { RichDoc } from "@/lib/editor/rich-text";
import type { VisibilityStatus } from "@/lib/authz";
import { applyMapEvent } from "./use-map-realtime";
import type { WorldRealtimeEvent } from "@/lib/realtime/events";

export function useMapState(worldId: string, initial: MapState) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const failAndReload = useCallback(
    async (message: string) => {
      setError(message);
      const universeId = stateRef.current.universe?.id;
      const path = `/api/worlds/${worldId}/map${universeId ? `?universe=${universeId}` : ""}`;
      const result = await apiFetch<MapState>(path);
      if (result.ok) setState(result.data);
    },
    [worldId],
  );

  const reload = useCallback(async () => {
    const universeId = stateRef.current.universe?.id;
    const path = `/api/worlds/${worldId}/map${universeId ? `?universe=${universeId}` : ""}`;
    const result = await apiFetch<MapState>(path);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setState(result.data);
  }, [worldId]);

  const loadPin = useCallback(
    async (pinId: string) => {
      const result = await apiFetch<PinDetails>(`/api/worlds/${worldId}/map/pins/${pinId}`);
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      return result.data;
    },
    [worldId],
  );

  async function uploadMap(universeId: string, file: File) {
    const form = new FormData();
    form.set("universeId", universeId);
    form.set("image", file);
    const result = await apiFetch<{ map: MapState["map"] }>(`/api/worlds/${worldId}/map`, {
      method: "POST",
      body: form,
    });
    if (!result.ok) {
      await failAndReload(result.error);
      return;
    }
    await reload();
  }

  async function replaceImage(mapId: string, file: File) {
    const form = new FormData();
    form.set("kind", "map");
    form.set("worldId", worldId);
    form.set("targetId", mapId);
    form.set("image", file);
    const result = await apiFetch<{ fileId: string }>("/api/files", { method: "POST", body: form });
    if (!result.ok) {
      await failAndReload(result.error);
      return;
    }
    await reload();
  }

  async function setMapVisibility(mapId: string, visibility: VisibilityStatus) {
    const result = await apiFetch(`/api/worlds/${worldId}/map`, {
      method: "PATCH",
      body: JSON.stringify({ mapId, visibility }),
    });
    if (!result.ok) await failAndReload(result.error);
    else await reload();
  }

  async function createPin(input: {
    mapId: string;
    pinType: PinType;
    title: string;
    description: RichDoc | null;
    posX: number;
    posY: number;
    visibility: VisibilityStatus;
  }) {
    const result = await apiFetch<{ pin: PinDto }>(`/api/worlds/${worldId}/map/pins`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!result.ok) {
      await failAndReload(result.error);
      return null;
    }
    setState((current) => ({ ...current, pins: [...current.pins.filter((pin) => pin.id !== result.data.pin.id), result.data.pin] }));
    return result.data.pin;
  }

  async function patchPin(pinId: string, patch: Record<string, unknown>) {
    const result = await apiFetch<{ pin: PinDto }>(`/api/worlds/${worldId}/map/pins/${pinId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!result.ok) {
      await failAndReload(result.error);
      return false;
    }
    setState((current) => ({
      ...current,
      pins: current.pins.map((pin) => (pin.id === pinId ? result.data.pin : pin)),
    }));
    return true;
  }

  async function removePin(pinId: string) {
    const result = await apiFetch(`/api/worlds/${worldId}/map/pins/${pinId}`, { method: "DELETE" });
    if (!result.ok) {
      await failAndReload(result.error);
      return;
    }
    setState((current) => ({ ...current, pins: current.pins.filter((pin) => pin.id !== pinId) }));
  }

  async function dropPin(pin: PinDto) {
    setState((current) => ({
      ...current,
      pins: current.pins.map((row) => (row.id === pin.id ? pin : row)),
    }));
    const result = await apiFetch<{ pin: PinDto }>(`/api/worlds/${worldId}/map/pins/${pin.id}`, {
      method: "PATCH",
      body: JSON.stringify({ posX: pin.posX, posY: pin.posY }),
    });
    if (!result.ok) await failAndReload(result.error);
  }

  async function placeCharacter(mapId: string, characterId: string) {
    const result = await apiFetch<{ marker: MarkerDto }>(`/api/worlds/${worldId}/map/markers`, {
      method: "POST",
      body: JSON.stringify({ mapId, characterId, posX: 0.5, posY: 0.5 }),
    });
    if (!result.ok) {
      await failAndReload(result.error);
      return;
    }
    setState((current) => ({
      ...current,
      markers: [...current.markers.filter((row) => row.id !== result.data.marker.id), result.data.marker],
      characters: current.characters.map((row) =>
        row.id === characterId ? { ...row, placed: true } : row,
      ),
    }));
  }

  async function dropMarker(marker: MarkerDto) {
    setState((current) => ({
      ...current,
      markers: current.markers.map((row) => (row.id === marker.id ? marker : row)),
    }));
    const result = await apiFetch<{ marker: MarkerDto }>(`/api/worlds/${worldId}/map/markers/${marker.id}`, {
      method: "PATCH",
      body: JSON.stringify({ posX: marker.posX, posY: marker.posY }),
    });
    if (!result.ok) await failAndReload(result.error);
  }

  async function removeMarker(markerId: string) {
    const result = await apiFetch(`/api/worlds/${worldId}/map/markers/${markerId}`, { method: "DELETE" });
    if (!result.ok) {
      await failAndReload(result.error);
      return;
    }
    setState((current) => ({
      ...current,
      markers: current.markers.filter((row) => row.id !== markerId),
      characters: current.characters.map((row) =>
        current.markers.find((marker) => marker.id === markerId)?.characterId === row.id
          ? { ...row, placed: false }
          : row,
      ),
    }));
  }

  function applyEvent(event: WorldRealtimeEvent, dragging: Set<string>) {
    if (event.type === "map.updated") {
      void reload();
      return;
    }
    setState((current) => applyMapEvent(current, event, dragging));
  }

  return {
    state,
    error,
    setError,
    applyEvent,
    reload,
    loadPin,
    uploadMap,
    replaceImage,
    setMapVisibility,
    createPin,
    patchPin,
    removePin,
    dropPin,
    placeCharacter,
    dropMarker,
    removeMarker,
  };
}
