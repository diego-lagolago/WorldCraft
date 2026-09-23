/** Channel expand/collapse state as a cookie value (Plan 007 C9, Nachtrag 2026-09-23).
 * Read on the server so the channel list renders in its saved state (no flicker),
 * written by the client. Format: `<channelId>.<1|0>` joined by `~` (cookie-safe characters only).
 */

export const EXPANDED_COOKIE = "chat-expanded";

/** Stays below the 4 KB cookie limit including name and attributes (~90 channels per world). */
export const EXPANDED_COOKIE_MAX = 3500;

const ENTRY = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([01])$/i;

export function parseExpanded(raw: string | undefined | null): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!raw) return out;
  for (const part of raw.split("~")) {
    const match = ENTRY.exec(part);
    if (match) out[match[1]!.toLowerCase()] = match[2] === "1";
  }
  return out;
}

/** Oldest entries are dropped first when the value would exceed the cookie limit. */
export function serializeExpanded(map: Record<string, boolean>): string {
  const parts = Object.entries(map)
    .filter(([id]) => ENTRY.test(`${id}.1`))
    .map(([id, open]) => `${id.toLowerCase()}.${open ? "1" : "0"}`);
  let value = parts.join("~");
  while (value.length > EXPANDED_COOKIE_MAX && parts.length > 0) {
    parts.shift();
    value = parts.join("~");
  }
  return value;
}

/** Cookie is scoped to the world's chat page, so it is sent only there. */
export function expandedCookiePath(worldId: string): string {
  return `/w/${worldId}/chat`;
}
