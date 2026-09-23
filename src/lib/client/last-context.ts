/** Last world and universe per device (Plan 003 Informationsarchitektur: localStorage is enough). */

const LAST_WORLD_KEY = "worldcraft:last-world";
const LAST_UNIVERSE_PREFIX = "worldcraft:last-universe:";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readLastWorld(): string | null {
  return storage()?.getItem(LAST_WORLD_KEY) ?? null;
}

export function rememberWorld(worldId: string): void {
  storage()?.setItem(LAST_WORLD_KEY, worldId);
}

export function forgetWorld(worldId: string): void {
  const store = storage();
  if (!store) return;
  if (store.getItem(LAST_WORLD_KEY) === worldId) store.removeItem(LAST_WORLD_KEY);
  store.removeItem(LAST_UNIVERSE_PREFIX + worldId);
}

export function readLastUniverse(worldId: string): string | null {
  return storage()?.getItem(LAST_UNIVERSE_PREFIX + worldId) ?? null;
}

export function rememberUniverse(worldId: string, universeId: string): void {
  storage()?.setItem(LAST_UNIVERSE_PREFIX + worldId, universeId);
}

/** Stored world if still valid, otherwise null (→ onboarding). */
export function pickLastWorld(stored: string | null, validWorldIds: readonly string[]): string | null {
  return stored && validWorldIds.includes(stored) ? stored : null;
}

/** Stored universe if still visible, otherwise the first visible one. */
export function pickUniverse(stored: string | null, visibleUniverseIds: readonly string[]): string | null {
  if (stored && visibleUniverseIds.includes(stored)) return stored;
  return visibleUniverseIds[0] ?? null;
}
