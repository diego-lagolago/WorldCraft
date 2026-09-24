"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  MAP_FILTER_CATS,
  toggleMapFilterHidden,
  type MapFilterCategory,
} from "@/lib/map/map-filter";

const STORAGE_PREFIX = "worldcraft.mapFilter.";
const listeners = new Map<string, Set<() => void>>();

function storageKey(worldId: string): string {
  return `${STORAGE_PREFIX}${worldId}`;
}

function loadHidden(worldId: string): MapFilterCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(worldId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set(MAP_FILTER_CATS.map((row) => row.key));
    return parsed.filter(
      (row): row is MapFilterCategory =>
        typeof row === "string" && allowed.has(row as MapFilterCategory),
    );
  } catch {
    return [];
  }
}

function saveHidden(worldId: string, hidden: readonly MapFilterCategory[]) {
  try {
    localStorage.setItem(storageKey(worldId), JSON.stringify(hidden));
  } catch {
    /* private window / quota — session-only */
  }
  for (const listener of listeners.get(worldId) ?? []) listener();
}

function subscribe(worldId: string, onStoreChange: () => void) {
  let set = listeners.get(worldId);
  if (!set) {
    set = new Set();
    listeners.set(worldId, set);
  }
  set.add(onStoreChange);
  return () => {
    set!.delete(onStoreChange);
  };
}

export function useMapFilter(worldId: string) {
  const hidden = useSyncExternalStore(
    (onStoreChange) => subscribe(worldId, onStoreChange),
    () => loadHidden(worldId),
    () => [] as MapFilterCategory[],
  );

  const toggle = useCallback(
    (category: MapFilterCategory) => {
      saveHidden(worldId, toggleMapFilterHidden(loadHidden(worldId), category));
    },
    [worldId],
  );

  const clear = useCallback(() => {
    saveHidden(worldId, []);
  }, [worldId]);

  return {
    hidden,
    hasOff: hidden.length > 0,
    cats: MAP_FILTER_CATS,
    toggle,
    clear,
  };
}
