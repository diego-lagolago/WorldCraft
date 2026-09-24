import type { ContentKind } from "@/lib/authz/types";
import { contentKindLabel } from "@/lib/i18n";
import { templateOf } from "@/lib/templates/registry";

/** Pins are never mentionable (datenmodell R-2.1-2). Monster stubs are not creatable via `@`. */
export const MENTIONABLE_KINDS = [
  "article",
  "quest",
  "character",
  "universe",
  "monster",
] as const satisfies readonly ContentKind[];
export type MentionableKind = (typeof MENTIONABLE_KINDS)[number];

export const MENTION_RESULT_LIMIT = 10;
export const MENTION_QUERY_MAX = 200;
export const STUB_TITLE_MIN = 2;

export type MentionRef = { kind: MentionableKind; id: string };

export type MentionHit = {
  kind: MentionableKind;
  id: string;
  title: string;
  /** Only articles: template key, e.g. `place`. */
  templateType?: string;
};

/** Display state of a mention for the reader (APP-MENTION-RENDER, erwaehnungen.md). */
export type MentionState = "linked" | "stub";

export function isMentionableKind(value: unknown): value is MentionableKind {
  return typeof value === "string" && (MENTIONABLE_KINDS as readonly string[]).includes(value);
}

export function mentionKey(ref: MentionRef): string {
  return `${ref.kind}:${ref.id}`;
}

/** Fachmodell 2.4: category, for articles plus template, e.g. „Artikel · Ort“. */
export function mentionCategoryLabel(hit: Pick<MentionHit, "kind" | "templateType">): string {
  if (hit.kind === "article" && hit.templateType) {
    const template = templateOf(hit.templateType);
    if (template.type !== "none") return `${contentKindLabel("article")} · ${template.label}`;
  }
  return contentKindLabel(hit.kind);
}

function startsAWord(title: string, query: string): boolean {
  return title
    .toLowerCase()
    .split(/\s+/)
    .some((word) => word.startsWith(query));
}

/**
 * Fachmodell 2.4: partial word, case-insensitive, at most 10. Word-start hits
 * come before hits inside a word, then alphabetical.
 */
export function rankMentionHits(hits: readonly MentionHit[], rawQuery: string): MentionHit[] {
  const query = rawQuery.trim().toLowerCase();
  const pool = query
    ? hits.filter((hit) => hit.title.toLowerCase().includes(query))
    : [...hits];
  pool.sort((a, b) => {
    if (query) {
      const aStart = startsAWord(a.title, query);
      const bStart = startsAWord(b.title, query);
      if (aStart !== bStart) return aStart ? -1 : 1;
    }
    return a.title.localeCompare(b.title, "de");
  });
  return pool.slice(0, MENTION_RESULT_LIMIT);
}

/** Escapes `%`, `_` and `\` so a user query is literal inside ILIKE. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
