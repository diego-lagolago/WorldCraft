"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client/api-fetch";
import { uploadImage } from "@/lib/client/api";
import type { MapState, MarkerDto, MonsterMarkerDto, PinDetails, PinDto } from "@/lib/map/types";
import type { PinType } from "@/lib/map/pin-types";
import type { RichDoc } from "@/lib/editor/rich-text";
import type { ContentVisibility, VisibilityStatus } from "@/lib/authz";
import {
  clearDeletedOnSync,
  forgetDeleted,
  nextRefetchSeq,
  rememberDeleted,
  resolveRefetchResponse,
  isEventForCurrentMap,
  shouldScheduleReload,
} from "./map-refetch";
import { applyMapEvent } from "./use-map-realtime";
import type { WorldRealtimeEvent } from "@/lib/realtime/events";

function mapQuery(state: MapState) {
  if (state.map?.id) return `?map=${state.map.id}`;
  if (state.universe?.id) return `?universe=${state.universe.id}`;
  return "";
}

export function useMapState(worldId: string, initial: MapState) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const pinSeqRef = useRef(new Map<string, number>());
  const markerSeqRef = useRef(new Map<string, number>());
  const monsterMarkerSeqRef = useRef(new Map<string, number>());
  const pinDeletedRef = useRef(new Set<string>());
  const markerDeletedRef = useRef(new Set<string>());
  const monsterMarkerDeletedRef = useRef(new Set<string>());
  const reloadPendingRef = useRef(false);
  const waitResyncRef = useRef(false);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearRefetchTracking = useCallback(() => {
    pinDeletedRef.current = clearDeletedOnSync();
    markerDeletedRef.current = clearDeletedOnSync();
    monsterMarkerDeletedRef.current = clearDeletedOnSync();
    pinSeqRef.current.clear();
    markerSeqRef.current.clear();
    monsterMarkerSeqRef.current.clear();
  }, []);

  const failAndReload = useCallback(
    async (message: string) => {
      setError(message);
      const path = `/api/worlds/${worldId}/map${mapQuery(stateRef.current)}`;
      const result = await apiFetch<MapState>(path);
      if (result.ok) setState(result.data);
    },
    [worldId],
  );

  const reload = useCallback(async () => {
    const path = `/api/worlds/${worldId}/map${mapQuery(stateRef.current)}`;
    const result = await apiFetch<MapState>(path);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    clearRefetchTracking();
    setState(result.data);
  }, [worldId, clearRefetchTracking]);

  const scheduleRefetchReload = useCallback(() => {
    if (!shouldScheduleReload(reloadPendingRef.current)) return;
    reloadPendingRef.current = true;
    void reload().finally(() => {
      reloadPendingRef.current = false;
    });
  }, [reload]);

  const onResync = useCallback(() => {
    waitResyncRef.current = false;
    reloadPendingRef.current = false;
    void reload();
  }, [reload]);

  const selectMap = useCallback(
    async (mapId: string) => {
      const result = await apiFetch<MapState>(`/api/worlds/${worldId}/map?map=${mapId}`);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      clearRefetchTracking();
      setState(result.data);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("pin");
        url.searchParams.delete("universe");
        url.searchParams.set("map", mapId);
        window.history.replaceState(null, "", url.pathname + url.search);
      }
    },
    [worldId, clearRefetchTracking],
  );

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

  async function createMap(universeId: string, name: string) {
    const result = await apiFetch<{ map: { id: string } }>(`/api/worlds/${worldId}/map`, {
      method: "POST",
      body: JSON.stringify({ universeId, name }),
    });
    if (!result.ok) {
      await failAndReload(result.error);
      return null;
    }
    await selectMap(result.data.map.id);
    return result.data.map.id;
  }

  async function deleteMap(mapId: string) {
    const result = await apiFetch(`/api/worlds/${worldId}/map`, {
      method: "DELETE",
      body: JSON.stringify({ mapId }),
    });
    if (!result.ok) {
      await failAndReload(result.error);
      return false;
    }
    const path = `/api/worlds/${worldId}/map`;
    const next = await apiFetch<MapState>(path);
    if (next.ok) {
      setState(next.data);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("pin");
        if (next.data.map?.id) {
          url.searchParams.set("map", next.data.map.id);
          url.searchParams.delete("universe");
        } else {
          url.searchParams.delete("map");
        }
        window.history.replaceState(null, "", url.pathname + url.search);
      }
    }
    return true;
  }

  async function replaceImage(mapId: string, file: File) {
    const result = await uploadImage({ file, kind: "map", worldId, targetId: mapId });
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
    visibility: ContentVisibility;
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

  async function placeCharacter(mapId: string, characterId: string, posX: number, posY: number) {
    const result = await apiFetch<{ marker: MarkerDto }>(`/api/worlds/${worldId}/map/markers`, {
      method: "POST",
      body: JSON.stringify({ mapId, characterId, posX, posY }),
    });
    if (!result.ok) {
      await failAndReload(result.error);
      return;
    }
    setState((current) => ({
      ...current,
      markers: [...current.markers.filter((row) => row.characterId !== characterId), result.data.marker],
      characters: current.characters.map((row) =>
        row.id === characterId
          ? { ...row, placed: true, placedElsewhere: false }
          : row,
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
    const deleted = await apiFetch(`/api/worlds/${worldId}/map/markers/${markerId}`, { method: "DELETE" });
    if (!deleted.ok) {
      await failAndReload(deleted.error);
      return;
    }
    setState((current) => {
      const removed = current.markers.find((marker) => marker.id === markerId);
      return {
        ...current,
        markers: current.markers.filter((row) => row.id !== markerId),
        characters: current.characters.map((row) =>
          removed?.characterId === row.id ? { ...row, placed: false, placedElsewhere: false } : row,
        ),
      };
    });
  }

  async function placeMonsterMarker(mapId: string, monsterId: string, posX: number, posY: number) {
    return postMonsterMarker({ mapId, monsterId, posX, posY });
  }

  async function copyMonsterMarker(sourceMarkerId: string, posX: number, posY: number) {
    return postMonsterMarker({ sourceMarkerId, posX, posY });
  }

  async function postMonsterMarker(
    body: { mapId: string; monsterId: string; posX: number; posY: number } | { sourceMarkerId: string; posX: number; posY: number },
  ) {
    const result = await apiFetch<{ marker: MonsterMarkerDto }>(
      `/api/worlds/${worldId}/map/monster-markers`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    if (!result.ok) {
      await failAndReload(result.error);
      return false;
    }
    setState((current) => ({
      ...current,
      monsterMarkers: [
        ...current.monsterMarkers.filter((row) => row.id !== result.data.marker.id),
        result.data.marker,
      ],
    }));
    return true;
  }

  async function dropMonsterMarker(marker: MonsterMarkerDto) {
    setState((current) => ({
      ...current,
      monsterMarkers: current.monsterMarkers.map((row) =>
        row.id === marker.id ? marker : row,
      ),
    }));
    const result = await apiFetch<{ marker: MonsterMarkerDto }>(
      `/api/worlds/${worldId}/map/monster-markers/${marker.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ posX: marker.posX, posY: marker.posY }),
      },
    );
    if (!result.ok) await failAndReload(result.error);
  }

  async function removeMonsterMarker(markerId: string) {
    const deleted = await apiFetch(`/api/worlds/${worldId}/map/monster-markers/${markerId}`, {
      method: "DELETE",
    });
    if (!deleted.ok) {
      await failAndReload(deleted.error);
      return;
    }
    setState((current) => ({
      ...current,
      monsterMarkers: current.monsterMarkers.filter((row) => row.id !== markerId),
    }));
  }

  async function patchMonsterMarker(
    markerId: string,
    patch: { visibility?: ContentVisibility; posX?: number; posY?: number },
  ) {
    const result = await apiFetch<{ marker: MonsterMarkerDto }>(
      `/api/worlds/${worldId}/map/monster-markers/${markerId}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    );
    if (!result.ok) {
      await failAndReload(result.error);
      return false;
    }
    setState((current) => ({
      ...current,
      monsterMarkers: current.monsterMarkers.map((row) =>
        row.id === markerId ? result.data.marker : row,
      ),
    }));
    return true;
  }

  function bumpSeq(ref: { current: Map<string, number> }, id: string): number {
    const seq = nextRefetchSeq(ref.current.get(id) ?? 0);
    ref.current.set(id, seq);
    return seq;
  }

  function applyRefetchOutcome<T>(input: {
    id: string;
    seq: number;
    status: number;
    data: T | undefined;
    seqRef: { current: Map<string, number> };
    deletedRef: { current: Set<string> };
    onRemove: () => void;
    onUpsert: (data: T) => void;
  }) {
    const outcome = resolveRefetchResponse({
      seq: input.seq,
      latestSeq: input.seqRef.current.get(input.id) ?? 0,
      status: input.status,
      data: input.data,
      deleted: input.deletedRef.current,
      id: input.id,
    });
    if (outcome.action === "ignore") return;
    if (outcome.action === "remove") {
      input.deletedRef.current = rememberDeleted(input.deletedRef.current, input.id);
      input.onRemove();
      return;
    }
    if (outcome.action === "keep_and_reload") {
      scheduleRefetchReload();
      return;
    }
    if (outcome.action === "keep_and_wait_resync") {
      waitResyncRef.current = true;
      return;
    }
    if (outcome.action === "upsert") input.onUpsert(outcome.data);
  }

  function applyPinRefetchOutcome(
    pinId: string,
    seq: number,
    status: number,
    data: PinDetails | undefined,
  ) {
    applyRefetchOutcome({
      id: pinId,
      seq,
      status,
      data,
      seqRef: pinSeqRef,
      deletedRef: pinDeletedRef,
      onRemove: () => setState((current) => ({
        ...current,
        pins: current.pins.filter((pin) => pin.id !== pinId),
      })),
      onUpsert: (pin) => setState((current) => {
        if (current.map && pin.mapId !== current.map.id) return current;
        return { ...current, pins: [...current.pins.filter((row) => row.id !== pin.id), pin] };
      }),
    });
  }

  function applyMarkerRefetchOutcome(
    markerId: string,
    seq: number,
    status: number,
    data: MarkerDto | undefined,
  ) {
    applyRefetchOutcome({
      id: markerId,
      seq,
      status,
      data,
      seqRef: markerSeqRef,
      deletedRef: markerDeletedRef,
      onRemove: () => setState((current) => {
        const removed = current.markers.find((row) => row.id === markerId);
        return {
          ...current,
          markers: current.markers.filter((row) => row.id !== markerId),
          characters: current.characters.map((row) =>
            removed?.characterId === row.id ? { ...row, placed: false, placedElsewhere: false } : row,
          ),
        };
      }),
      onUpsert: (marker) => setState((current) => {
      if (current.map && marker.mapId !== current.map.id) {
        return {
          ...current,
          markers: current.markers.filter((row) => row.characterId !== marker.characterId),
          characters: current.characters.map((row) =>
            row.id === marker.characterId
              ? { ...row, placed: false, placedElsewhere: true }
              : row,
          ),
        };
      }
      return {
        ...current,
        markers: [
          ...current.markers.filter(
            (row) => row.id !== marker.id && row.characterId !== marker.characterId,
          ),
          marker,
        ],
        characters: current.characters.map((row) =>
          row.id === marker.characterId
          ? { ...row, placed: true, placedElsewhere: false }
          : row,
      ),
        };
      }),
    });
  }

  async function applyEvent(event: WorldRealtimeEvent, dragging: Set<string>) {
    if (event.type === "map.updated") {
      void reload();
      return;
    }
    if (event.type === "map.pin.deleted") {
      pinDeletedRef.current = rememberDeleted(pinDeletedRef.current, event.pinId);
      bumpSeq(pinSeqRef, event.pinId);
      setState((current) => applyMapEvent(current, event));
      return;
    }
    if (event.type === "map.marker.deleted") {
      markerDeletedRef.current = rememberDeleted(markerDeletedRef.current, event.markerId);
      bumpSeq(markerSeqRef, event.markerId);
      setState((current) => applyMapEvent(current, event));
      return;
    }
    if (event.type === "map.monsterMarker.deleted") {
      monsterMarkerDeletedRef.current = rememberDeleted(
        monsterMarkerDeletedRef.current,
        event.markerId,
      );
      bumpSeq(monsterMarkerSeqRef, event.markerId);
      setState((current) => applyMapEvent(current, event));
      return;
    }
    if (event.type === "map.pin") {
      if (dragging.has(event.pinId)) return;
      if (!isEventForCurrentMap(event.mapId, stateRef.current.map?.id)) return;
      // New upsert signal (e.g. published after gm_only) must clear a prior delete marker.
      pinDeletedRef.current = forgetDeleted(pinDeletedRef.current, event.pinId);
      const seq = bumpSeq(pinSeqRef, event.pinId);
      const result = await apiFetch<PinDetails>(`/api/worlds/${worldId}/map/pins/${event.pinId}`);
      applyPinRefetchOutcome(event.pinId, seq, result.status, result.ok ? result.data : undefined);
      return;
    }
    if (event.type === "map.marker") {
      if (dragging.has(event.markerId)) return;
      markerDeletedRef.current = forgetDeleted(markerDeletedRef.current, event.markerId);
      const seq = bumpSeq(markerSeqRef, event.markerId);
      const result = await apiFetch<MarkerDto>(`/api/worlds/${worldId}/map/markers/${event.markerId}`);
      applyMarkerRefetchOutcome(
        event.markerId,
        seq,
        result.status,
        result.ok ? result.data : undefined,
      );
      return;
    }
    if (event.type === "map.monsterMarker") {
      if (dragging.has(event.markerId)) return;
      if (!isEventForCurrentMap(event.mapId, stateRef.current.map?.id)) return;
      monsterMarkerDeletedRef.current = forgetDeleted(
        monsterMarkerDeletedRef.current,
        event.markerId,
      );
      const seq = bumpSeq(monsterMarkerSeqRef, event.markerId);
      const result = await apiFetch<MonsterMarkerDto>(
        `/api/worlds/${worldId}/map/monster-markers/${event.markerId}`,
      );
      applyRefetchOutcome({
        id: event.markerId,
        seq,
        status: result.status,
        data: result.ok ? result.data : undefined,
        seqRef: monsterMarkerSeqRef,
        deletedRef: monsterMarkerDeletedRef,
        onRemove: () => setState((current) => ({
          ...current,
          monsterMarkers: current.monsterMarkers.filter((row) => row.id !== event.markerId),
        })),
        onUpsert: (marker) => setState((current) => {
          if (current.map && marker.mapId !== current.map.id) return current;
          return {
            ...current,
            monsterMarkers: [...current.monsterMarkers.filter((row) => row.id !== marker.id), marker],
          };
        }),
      });
    }
  }

  return {
    state,
    error,
    setError,
    applyEvent,
    onResync,
    reload,
    selectMap,
    loadPin,
    createMap,
    deleteMap,
    replaceImage,
    setMapVisibility,
    createPin,
    patchPin,
    removePin,
    dropPin,
    placeCharacter,
    dropMarker,
    removeMarker,
    placeMonsterMarker,
    copyMonsterMarker,
    dropMonsterMarker,
    removeMonsterMarker,
    patchMonsterMarker,
  };
}
