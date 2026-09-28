import { sanitizeRichDoc, type RichDoc, type RichMark, type RichNode } from "./rich-text";

export type McpMarkdownMention = {
  key: string;
  title: string;
  target?: { kind: "article" | "quest" | "character" | "universe" | "monster"; id: string };
};

export type ParsedMcpMarkdown = { doc: RichDoc; mentions: McpMarkdownMention[] };
export type ResolvedMcpMarkdownMention = McpMarkdownMention & {
  kind: "article" | "quest" | "character" | "universe" | "monster";
  id: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MENTION_TARGET = /^(artikel|article|quest|charakter|character|universum|universe|monster):([0-9a-f-]{36})$/i;
const KIND: Record<string, ResolvedMcpMarkdownMention["kind"]> = {
  artikel: "article", article: "article", quest: "quest", charakter: "character", character: "character",
  universum: "universe", universe: "universe", monster: "monster",
};

/**
 * Small, intentionally conservative Markdown reader for MCP writes. Unsupported
 * constructs disappear instead of becoming active HTML or unsupported TipTap nodes.
 */
export function mcpMarkdownToTiptap(markdown: string, options: { mentions: boolean }): ParsedMcpMarkdown {
  const mentions: McpMarkdownMention[] = [];
  const blocks: RichNode[] = [];
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let inCodeFence = false;
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: RichNode[] } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", content: inline(paragraph.join("\n"), mentions, options.mentions) });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({ type: list.ordered ? "orderedList" : "bulletList", content: list.items });
    list = null;
  };

  for (const rawLine of lines) {
    if (/^\s*```/.test(rawLine)) { inCodeFence = !inCodeFence; continue; }
    if (inCodeFence || /^\s*!\[[^\]]*\]\([^)]*\)\s*$/.test(rawLine) || /^\s*\|.*\|\s*$/.test(rawLine)) continue;
    const line = rawLine.trimEnd();
    const heading = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { flushParagraph(); flushList(); blocks.push({ type: "horizontalRule" }); continue; }
    if (heading) { flushParagraph(); flushList(); blocks.push({ type: "heading", attrs: { level: heading[1].length }, content: inline(heading[2], mentions, options.mentions) }); continue; }
    if (quote) { flushParagraph(); flushList(); blocks.push({ type: "blockquote", content: [{ type: "paragraph", content: inline(quote[1], mentions, options.mentions) }] }); continue; }
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) { flushList(); list = { ordered: isOrdered, items: [] }; }
      list.items.push({ type: "listItem", content: [{ type: "paragraph", content: inline((bullet ?? ordered)![1], mentions, options.mentions) }] });
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph(); flushList();
  return { doc: { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] }, mentions };
}

/** Replaces parser-only mention placeholders and applies the normal server sanitizer. */
export function resolveMcpMarkdown(parsed: ParsedMcpMarkdown, resolved: readonly ResolvedMcpMarkdownMention[], options: { mentions: boolean }): RichDoc {
  const byKey = new Map(resolved.map((mention) => [mention.key, mention]));
  const replace = (node: RichNode): RichNode | null => {
    if (node.type === "mcpMention") {
      const key = typeof node.attrs?.key === "string" ? node.attrs.key : "";
      const mention = byKey.get(key);
      return mention ? { type: "mention", attrs: { kind: mention.kind, id: mention.id, label: mention.title, mentionSuggestionChar: "@" } } : null;
    }
    const content = node.content?.map(replace).filter((child): child is RichNode => child !== null);
    return content ? { ...node, content } : node;
  };
  const result = sanitizeRichDoc({ type: "doc", content: parsed.doc.content.map(replace).filter((node): node is RichNode => node !== null) }, options);
  if (!result.ok) throw new Error(result.error);
  return result.value.doc;
}

function inline(value: string, mentions: McpMarkdownMention[], mentionsAllowed: boolean): RichNode[] {
  const out: RichNode[] = [];
  const parts = value.split(/(@\[[^\]]+\](?:\([^)]*\))?)/g);
  for (const part of parts) {
    const match = /^@\[([^\]]+)\](?:\(([^)]*)\))?$/.exec(part);
    if (!match) { out.push(...markedText(part)); continue; }
    if (!mentionsAllowed) throw new Error("Dieser Text darf keine Erwähnungen enthalten.");
    const title = match[1].trim();
    const target = match[2] ? MENTION_TARGET.exec(match[2].trim()) : null;
    if (match[2] && (!target || !UUID.test(target[2]))) throw new Error("Die Erwähnung hat kein gültiges Ziel.");
    const key = `m${mentions.length}`;
    mentions.push({ key, title, target: target ? { kind: KIND[target[1].toLowerCase()], id: target[2].toLowerCase() } : undefined });
    out.push({ type: "mcpMention", attrs: { key } });
  }
  return out;
}

function markedText(value: string): RichNode[] {
  if (!value) return [];
  const hardBreak = value.split("  \n");
  return hardBreak.flatMap((line, index) => {
    const nodes = markedLine(line);
    if (index < hardBreak.length - 1) nodes.push({ type: "hardBreak" });
    return nodes;
  });
}

function markedLine(line: string): RichNode[] {
  const nodes: RichNode[] = [];
  const token = /(\*\*|__|~~|\*|_)([^\n]+?)\1|<u>([^<]+)<\/u>|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let cursor = 0;
  for (let match; (match = token.exec(line));) {
    if (match.index > cursor) nodes.push({ type: "text", text: line.slice(cursor, match.index) });
    if (match[1]) {
      const mark = matchingMark(match[1], match[1]);
      nodes.push({ type: "text", text: match[2], marks: mark ? [mark] : [] });
    } else if (match[3] !== undefined) {
      nodes.push({ type: "text", text: match[3], marks: [{ type: "underline" }] });
    } else {
      nodes.push({ type: "text", text: match[4], marks: [{ type: "link", attrs: { href: match[5] } }] });
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) nodes.push({ type: "text", text: line.slice(cursor) });
  return nodes;
}

function matchingMark(open: string, close: string): RichMark | null {
  if (open !== close && !(open === "__" && close === "__")) return null;
  if (open === "**" || open === "__") return { type: "bold" };
  if (open === "~~") return { type: "strike" };
  if (open === "*" || open === "_") return { type: "italic" };
  return null;
}
