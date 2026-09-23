import type { ContentKind } from "@/lib/authz/types";

export const SEARCH_QUERY_MIN = 2;
export const SEARCH_QUERY_MAX = 200;
export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 50;
export const SEARCH_SNIPPET_MAX = 300;

export const SEARCH_KINDS = ["article", "quest", "character", "pin", "universe"] as const satisfies readonly ContentKind[];
export type SearchKind = (typeof SEARCH_KINDS)[number];

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  href: string;
  templateType?: string;
  kindLabel: string;
  snippet: string;
};

/** Clamp MCP/App `limit`: default 20, hard cap 50. Invalid → default. */
export function clampSearchLimit(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return SEARCH_DEFAULT_LIMIT;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1) return SEARCH_DEFAULT_LIMIT;
  return Math.min(Math.floor(n), SEARCH_MAX_LIMIT);
}

export function isSearchKind(value: unknown): value is SearchKind {
  return typeof value === "string" && (SEARCH_KINDS as readonly string[]).includes(value);
}

/** APP-SEARCH-SNIPPET: excerpt around the first case-insensitive hit, max 300 chars. */
export function searchSnippet(plain: string | null | undefined, query: string): string {
  const text = (plain ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  const q = query.trim().toLowerCase();
  const i = q ? lower.indexOf(q) : -1;
  if (i < 0) {
    return text.length <= SEARCH_SNIPPET_MAX ? text : `${text.slice(0, SEARCH_SNIPPET_MAX - 1)}…`;
  }
  const start = Math.max(0, i - 40);
  const end = Math.min(text.length, i + q.length + 120);
  let snip = text.slice(start, end);
  if (start > 0) snip = `…${snip}`;
  if (end < text.length) snip = `${snip}…`;
  return snip.length <= SEARCH_SNIPPET_MAX ? snip : `${snip.slice(0, SEARCH_SNIPPET_MAX - 1)}…`;
}
