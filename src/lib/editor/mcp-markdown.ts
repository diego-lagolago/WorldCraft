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
  let paragraph: { text: string; hardBreak: boolean }[] = [];
  let list: { ordered: boolean; items: RichNode[] } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.map((line, index) => `${line.text}${index === paragraph.length - 1 ? "" : line.hardBreak ? "  \n" : " "}`).join("");
    blocks.push({ type: "paragraph", content: inline(text, mentions, options.mentions) });
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
    const hardBreak = /(?: {2}|\\)$/.test(rawLine);
    const line = rawLine.trimEnd();
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { flushParagraph(); flushList(); blocks.push({ type: "horizontalRule" }); continue; }
    if (heading) { flushParagraph(); flushList(); blocks.push({ type: "heading", attrs: { level: Math.min(3, Math.max(2, heading[1].length)) }, content: inline(heading[2], mentions, options.mentions) }); continue; }
    if (quote) { flushParagraph(); flushList(); blocks.push({ type: "blockquote", content: [{ type: "paragraph", content: inline(quote[1], mentions, options.mentions) }] }); continue; }
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) { flushList(); list = { ordered: isOrdered, items: [] }; }
      list.items.push({ type: "listItem", content: [{ type: "paragraph", content: inline((bullet ?? ordered)![1], mentions, options.mentions) }] });
      continue;
    }
    flushList();
    paragraph.push({ text: hardBreak ? line.replace(/(?: {2}|\\)$/, "") : line, hardBreak });
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
  return parseMarked(line, []);
}

function parseMarked(line: string, inheritedMarks: RichMark[]): RichNode[] {
  const nodes: RichNode[] = [];
  let cursor = 0;
  while (cursor < line.length) {
    const match = nextMark(line, cursor);
    if (!match) {
      nodes.push({ type: "text", text: line.slice(cursor), marks: inheritedMarks });
      break;
    }
    if (match.index > cursor) nodes.push({ type: "text", text: line.slice(cursor, match.index), marks: inheritedMarks });
    nodes.push(...parseMarked(match.content, [...inheritedMarks, match.mark]));
    cursor = match.end;
  }
  return nodes;
}

function nextMark(value: string, start: number): { index: number; end: number; content: string; mark: RichMark } | null {
  const link = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const underline = /<u>([^<]+)<\/u>/g;
  const delimiter = /(\*\*\*|___|\*\*|__|~~|\*|_)([^\n]+?)\1/g;
  const candidates: { index: number; end: number; content: string; mark: RichMark }[] = [];
  for (const [regex, mapper] of [
    [link, (match: RegExpExecArray): { content: string; mark: RichMark } => ({ content: match[1], mark: { type: "link", attrs: { href: match[2] } } })],
    [underline, (match: RegExpExecArray): { content: string; mark: RichMark } => ({ content: match[1], mark: { type: "underline" } })],
    [delimiter, (match: RegExpExecArray): { content: string; mark: RichMark } | null => {
      const token = match[1];
      const before = match.index > 0 ? value[match.index - 1] : "";
      const after = value[match.index + match[0].length] ?? "";
      if ((token.includes("_") || token === "*") && /[\p{L}\p{N}]/u.test(before + after)) return null;
      if (token === "***" || token === "___") return { content: match[2], mark: { type: "bold" } };
      return { content: match[2], mark: token === "**" || token === "__" ? { type: "bold" } : token === "~~" ? { type: "strike" } : { type: "italic" } };
    }],
  ] as const) {
    regex.lastIndex = start;
    const match = regex.exec(value);
    if (!match) continue;
    const mapped = mapper(match);
    if (mapped) candidates.push({ index: match.index, end: match.index + match[0].length, ...mapped });
  }
  if (!candidates.length) return null;
  candidates.sort((left, right) => left.index - right.index || right.end - left.end);
  return candidates[0];
}
