/** Channel expand/collapse per device and world (Plan 007 C9, Nachtrag 2026-09-23).
 * Stored as a cookie so the server can render the saved state; see `src/lib/chat/expanded-state.ts`.
 */

import { EXPANDED_COOKIE, expandedCookiePath, serializeExpanded } from "@/lib/chat/expanded-state";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function writeExpanded(worldId: string, map: Record<string, boolean>): void {
  try {
    document.cookie =
      `${EXPANDED_COOKIE}=${serializeExpanded(map)}; Path=${expandedCookiePath(worldId)}; ` +
      `Max-Age=${ONE_YEAR}; SameSite=Lax`;
  } catch {
    /* cookies disabled */
  }
}
