/** Channel expand/collapse per device (Plan 007 C9).
 * No size cap: a few bytes per channel, intentional (Plan-Review 2026-09-23, CR-016).
 */

const EXPANDED_KEY = "worldcraft:chat-expanded";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readExpanded(): Record<string, boolean> {
  try {
    const raw = storage()?.getItem(EXPANDED_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeExpanded(map: Record<string, boolean>): void {
  try {
    storage()?.setItem(EXPANDED_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}
