/** Pure decision helpers for map pin/marker refetch (Plan 004 CR-003, CR-006, CR-017). */

export type RefetchOutcome<T> =
  | { action: "ignore" }
  | { action: "skip_fetch" }
  | { action: "remove" }
  | { action: "upsert"; data: T }
  | { action: "keep_and_reload" }
  | { action: "keep_and_wait_resync" };

export function nextRefetchSeq(current: number): number {
  return current + 1;
}

export function shouldApplyRefetch(seq: number, latest: number): boolean {
  return seq === latest;
}

/** Interprets HTTP status from a refetch response (ok uses status 200). */
export function interpretRefetchResult(
  status: number,
): "remove" | "keep_and_reload" | "keep_and_wait_resync" | "ok" {
  if (status >= 200 && status < 300) return "ok";
  if (status === 404) return "remove";
  if (status === 0) return "keep_and_wait_resync";
  return "keep_and_reload";
}

/** Skip a refetch when no map is open or the event targets another map. */
export function isEventForCurrentMap(eventMapId: string, openMapId: string | undefined): boolean {
  if (!openMapId) return false;
  return eventMapId === openMapId;
}

export function rememberDeleted(deleted: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(deleted);
  next.add(id);
  return next;
}

/** A fresh upsert signal means the entity is visible again — allow refetch to apply. */
export function forgetDeleted(deleted: ReadonlySet<string>, id: string): Set<string> {
  if (!deleted.has(id)) return new Set(deleted);
  const next = new Set(deleted);
  next.delete(id);
  return next;
}

export function isDeleted(deleted: ReadonlySet<string>, id: string): boolean {
  return deleted.has(id);
}

export function clearDeletedOnSync(): Set<string> {
  return new Set();
}

/** Debounce: only the first error in a burst should trigger reload. */
export function shouldScheduleReload(pendingReload: boolean): boolean {
  return !pendingReload;
}

export function resolveRefetchResponse<T>(input: {
  seq: number;
  latestSeq: number;
  status: number;
  data: T | undefined;
  deleted: ReadonlySet<string>;
  id: string;
}): RefetchOutcome<T> {
  if (!shouldApplyRefetch(input.seq, input.latestSeq)) {
    return { action: "ignore" };
  }
  const kind = interpretRefetchResult(input.status);
  if (kind === "remove") return { action: "remove" };
  if (kind === "keep_and_reload") return { action: "keep_and_reload" };
  if (kind === "keep_and_wait_resync") return { action: "keep_and_wait_resync" };
  if (isDeleted(input.deleted, input.id)) return { action: "ignore" };
  if (input.data === undefined) return { action: "keep_and_reload" };
  return { action: "upsert", data: input.data };
}
