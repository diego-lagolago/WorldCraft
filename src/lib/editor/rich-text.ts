/**
 * TipTap JSON on the server side (ADR-004, APP-PLAIN, APP-WORLD-NO-MENTIONS).
 * The client editor is never trusted: every save runs through `sanitizeRichDoc`,
 * which keeps only the allowed nodes and marks, derives the plain text and
 * returns the mention list for APP-REL-RECALC.
 */

import { normalizeLinkHref } from "./links";
import { isMentionableKind, mentionKey, type MentionRef } from "./mentions";

export type RichMark = { type: string; attrs?: Record<string, unknown> };
export type RichNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  text?: string;
  marks?: RichMark[];
};
export type RichDoc = { type: "doc"; content: RichNode[] };

export const RICH_DOC_MAX_JSON_CHARS = 400_000;
export const MENTION_LABEL_MAX = 200;
const MAX_DEPTH = 24;

const BLOCK_CONTAINERS = new Set(["blockquote", "bulletList", "orderedList", "listItem"]);
const TEXT_BLOCKS = new Set(["paragraph", "heading"]);
const ALLOWED_MARKS = new Set(["bold", "italic", "underline", "strike", "link"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SanitizedRichText = {
  doc: RichDoc;
  plain: string;
  mentions: MentionRef[];
};

export type SanitizeResult =
  | { ok: true; value: SanitizedRichText }
  | { ok: false; error: string };

export function emptyDoc(): RichDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function sanitizeRichDoc(
  input: unknown,
  options: { mentions: boolean },
): SanitizeResult {
  if (!isRecord(input) || input.type !== "doc") {
    return { ok: false, error: "Der Text hat kein gültiges Format." };
  }
  let size: number;
  try {
    size = JSON.stringify(input).length;
  } catch {
    return { ok: false, error: "Der Text hat kein gültiges Format." };
  }
  if (size > RICH_DOC_MAX_JSON_CHARS) {
    return { ok: false, error: "Der Text ist zu lang." };
  }

  const state: WalkState = { mentionsAllowed: options.mentions, mentionFound: false };
  const content = sanitizeBlocks(input.content, state, 0);
  if (!options.mentions && state.mentionFound) {
    return { ok: false, error: "Dieser Text darf keine Erwähnungen enthalten." };
  }
  const doc: RichDoc = {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
  return {
    ok: true,
    value: { doc, plain: plainTextOf(doc), mentions: extractMentions(doc) },
  };
}

type WalkState = { mentionsAllowed: boolean; mentionFound: boolean };

function sanitizeBlocks(raw: unknown, state: WalkState, depth: number): RichNode[] {
  if (!Array.isArray(raw) || depth > MAX_DEPTH) return [];
  const out: RichNode[] = [];
  for (const node of raw) {
    const clean = sanitizeBlock(node, state, depth + 1);
    if (clean) out.push(clean);
  }
  return out;
}

function sanitizeBlock(raw: unknown, state: WalkState, depth: number): RichNode | null {
  if (!isRecord(raw) || typeof raw.type !== "string") return null;
  switch (raw.type) {
    case "paragraph": {
      const content = sanitizeInline(raw.content, state);
      return content.length ? { type: "paragraph", content } : { type: "paragraph" };
    }
    case "heading": {
      const level = headingLevel(isRecord(raw.attrs) ? raw.attrs.level : undefined);
      const content = sanitizeInline(raw.content, state);
      return content.length
        ? { type: "heading", attrs: { level }, content }
        : { type: "heading", attrs: { level } };
    }
    case "horizontalRule":
      return { type: "horizontalRule" };
    case "blockquote":
    case "bulletList":
    case "orderedList":
    case "listItem": {
      const content = sanitizeBlocks(raw.content, state, depth);
      const children =
        raw.type === "bulletList" || raw.type === "orderedList"
          ? content.filter((child) => child.type === "listItem")
          : content.filter((child) => child.type !== "listItem");
      if (children.length === 0) {
        if (raw.type === "listItem" || raw.type === "blockquote") {
          return { type: raw.type, content: [{ type: "paragraph" }] };
        }
        return null;
      }
      const node: RichNode = { type: raw.type, content: children };
      if (raw.type === "orderedList" && isRecord(raw.attrs)) {
        const start = Number(raw.attrs.start);
        if (Number.isInteger(start) && start > 1 && start < 100_000) node.attrs = { start };
      }
      return node;
    }
    default:
      return null;
  }
}

function headingLevel(value: unknown): 2 | 3 {
  return Number(value) >= 3 ? 3 : 2;
}

function sanitizeInline(raw: unknown, state: WalkState): RichNode[] {
  if (!Array.isArray(raw)) return [];
  const out: RichNode[] = [];
  for (const node of raw) {
    if (!isRecord(node) || typeof node.type !== "string") continue;
    if (node.type === "text") {
      if (typeof node.text !== "string" || node.text.length === 0) continue;
      const marks = sanitizeMarks(node.marks);
      out.push(marks.length ? { type: "text", text: node.text, marks } : { type: "text", text: node.text });
    } else if (node.type === "hardBreak") {
      out.push({ type: "hardBreak" });
    } else if (node.type === "mention") {
      state.mentionFound = true;
      if (!state.mentionsAllowed) continue;
      const mention = sanitizeMention(node.attrs);
      if (mention) out.push(mention);
    }
  }
  return out;
}

function sanitizeMention(attrs: unknown): RichNode | null {
  if (!isRecord(attrs)) return null;
  const id = typeof attrs.id === "string" ? attrs.id : "";
  if (!UUID.test(id) || !isMentionableKind(attrs.kind)) return null;
  const label =
    typeof attrs.label === "string" && attrs.label.trim()
      ? attrs.label.trim().slice(0, MENTION_LABEL_MAX)
      : "?";
  return {
    type: "mention",
    attrs: { id: id.toLowerCase(), kind: attrs.kind, label, mentionSuggestionChar: "@" },
  };
}

function sanitizeMarks(raw: unknown): RichMark[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: RichMark[] = [];
  for (const mark of raw) {
    if (!isRecord(mark) || typeof mark.type !== "string") continue;
    if (!ALLOWED_MARKS.has(mark.type) || seen.has(mark.type)) continue;
    if (mark.type === "link") {
      const href = normalizeLinkHref(isRecord(mark.attrs) ? mark.attrs.href : undefined);
      if (!href) continue;
      out.push({ type: "link", attrs: { href } });
    } else {
      out.push({ type: mark.type });
    }
    seen.add(mark.type);
  }
  return out;
}

/** Plain text for search (APP-PLAIN). Mentions contribute their label, no `@`. */
export function plainTextOf(doc: RichDoc): string {
  const blocks: string[] = [];
  collectPlain(doc.content, blocks);
  return blocks
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectPlain(nodes: RichNode[] | undefined, blocks: string[]) {
  for (const node of nodes ?? []) {
    if (TEXT_BLOCKS.has(node.type)) {
      blocks.push(inlineText(node.content));
    } else if (BLOCK_CONTAINERS.has(node.type)) {
      collectPlain(node.content, blocks);
    }
  }
}

function inlineText(nodes: RichNode[] | undefined): string {
  let text = "";
  for (const node of nodes ?? []) {
    if (node.type === "text") text += node.text ?? "";
    else if (node.type === "hardBreak") text += "\n";
    else if (node.type === "mention") text += String(node.attrs?.label ?? "");
  }
  return text;
}

/** All mentions (kind + id) in document order, each once. */
export function extractMentions(doc: unknown): MentionRef[] {
  const out: MentionRef[] = [];
  const seen = new Set<string>();
  walkMentions(doc, out, seen, 0);
  return out;
}

function walkMentions(node: unknown, out: MentionRef[], seen: Set<string>, depth: number) {
  if (!isRecord(node) || depth > MAX_DEPTH + 2) return;
  if (node.type === "mention" && isRecord(node.attrs)) {
    const { id, kind } = node.attrs;
    if (typeof id === "string" && UUID.test(id) && isMentionableKind(kind)) {
      const ref: MentionRef = { kind, id: id.toLowerCase() };
      const key = mentionKey(ref);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(ref);
      }
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) walkMentions(child, out, seen, depth + 1);
  }
}

/** Reads a stored JSON column back as a document; anything else becomes empty. */
export function asRichDoc(value: unknown): RichDoc | null {
  if (!isRecord(value) || value.type !== "doc" || !Array.isArray(value.content)) return null;
  return value as RichDoc;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
