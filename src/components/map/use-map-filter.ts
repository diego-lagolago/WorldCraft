"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  MAP_FILTER_CATS,
  toggleMapFilterHidden,
  type MapFilterCategory,
} from "@/lib/map/map-filter";

const STORAGE_PREFIX = "worldcraft.mapFilter.";
const listeners = new Map<string, Set<() => void>>();
const NONE: MapFilterCategory[] = [];
const hiddenCache = new Map<string, { raw: string | null; value: MapFilterCategory[] }>();

function storageKey(worldId: string): string {
  return `${STORAGE_PREFIX}${worldId}`;
}

export function getMapFilterSnapshot(worldId: string): MapFilterCategory[] {
  if (typeof window === "undefined") return NONE;

  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(worldId));
  } catch {
    return hiddenCache.get(worldId)?.value ?? NONE;
  }

  const cached = hiddenCache.get(worldId);
  if (cached?.raw === raw) return cached.value;

  let value = NONE;
  try {
    if (!raw) {
      hiddenCache.set(worldId, { raw, value });
      return value;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      hiddenCache.set(worldId, { raw, value });
      return value;
    }
    const allowed = new Set(MAP_FILTER_CATS.map((row) => row.key));
    const parsedValue = parsed.filter(
      (row): row is MapFilterCategory =>
        typeof row === "string" && allowed.has(row as MapFilterCategory),
    );
    value = parsedValue.length > 0 ? parsedValue : NONE;
  } catch {
    value = NONE;
  }
  hiddenCache.set(worldId, { raw, value });
  return value;
}

function saveHidden(worldId: string, hidden: readonly MapFilterCategory[]) {
  const value = hidden.length > 0 ? [...hidden] : NONE;
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(storageKey(worldId), raw);
  } catch {
    /* private window / quota — session-only */
  }
  hiddenCache.set(worldId, { raw, value });
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
    () => getMapFilterSnapshot(worldId),
    () => NONE,
  );

  const toggle = useCallback(
    (category: MapFilterCategory) => {
      saveHidden(worldId, toggleMapFilterHidden(getMapFilterSnapshot(worldId), category));
    },
    [worldId],
  );

  const clear = useCallback(() => {
    saveHidden(worldId, []);
  }, [worldId]);

  const hideAll = useCallback(() => {
    saveHidden(worldId, MAP_FILTER_CATS.map((category) => category.key));
  }, [worldId]);

  return {
    hidden,
    hasOff: hidden.length > 0,
    cats: MAP_FILTER_CATS,
    toggle,
    clear,
    hideAll,
  };
}
