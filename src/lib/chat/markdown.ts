/** Minimal chat markdown: only `**bold**` and `*italic*`. No HTML. */

import { escapeHtml } from "@/lib/html";

export type MdNode =
  | { type: "text"; value: string }
  | { type: "bold"; children: MdNode[]; incomplete?: boolean }
  | { type: "italic"; children: MdNode[]; incomplete?: boolean };

type ParseOptions = {
  /** Unclosed `*` / `**` style through EOF (Discord-style live preview). */
  live?: boolean;
};

function findItalicClose(source: string, from: number): number {
  let i = from;
  while (i < source.length) {
    if (source.startsWith("**", i)) {
      const boldClose = source.indexOf("**", i + 2);
      if (boldClose === -1) {
        i += 1;
        continue;
      }
      i = boldClose + 2;
      continue;
    }
    if (source[i] === "*") return i;
    i += 1;
  }
  return -1;
}

/** Parse plain text with a tiny markdown subset. Unmatched `*` / `**` stay as text (unless `live`). */
export function parseChatMarkdown(source: string, options: ParseOptions = {}): MdNode[] {
  const nodes: MdNode[] = [];
  let i = 0;
  const live = options.live === true;

  while (i < source.length) {
    // Common order: ***bold+italic*** before **bold** before *italic*.
    if (source.startsWith("***", i)) {
      const close = source.indexOf("***", i + 3);
      if (close !== -1) {
        nodes.push({
          type: "bold",
          children: [{ type: "italic", children: parseChatMarkdown(source.slice(i + 3, close)) }],
        });
        i = close + 3;
        continue;
      }
    }

    if (source.startsWith("**", i)) {
      const close = source.indexOf("**", i + 2);
      if (close !== -1) {
        nodes.push({ type: "bold", children: parseChatMarkdown(source.slice(i + 2, close)) });
        i = close + 2;
        continue;
      }
      if (live) {
        nodes.push({
          type: "bold",
          incomplete: true,
          children: parseChatMarkdown(source.slice(i + 2), { live: true }),
        });
        break;
      }
      nodes.push({ type: "text", value: "*" });
      i += 1;
      continue;
    }

    if (source[i] === "*") {
      const close = findItalicClose(source, i + 1);
      if (close !== -1) {
        nodes.push({ type: "italic", children: parseChatMarkdown(source.slice(i + 1, close)) });
        i = close + 1;
        continue;
      }
      if (live) {
        nodes.push({
          type: "italic",
          incomplete: true,
          children: parseChatMarkdown(source.slice(i + 1), { live: true }),
        });
        break;
      }
      nodes.push({ type: "text", value: "*" });
      i += 1;
      continue;
    }

    const next = source.indexOf("*", i);
    const end = next === -1 ? source.length : next;
    nodes.push({ type: "text", value: source.slice(i, end) });
    i = end;
  }

  return nodes;
}

/** Flatten nodes to a string for tests / plain fallback (markers removed for matched spans). */
export function mdNodesToPlain(nodes: MdNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.value;
      return mdNodesToPlain(node.children);
    })
    .join("");
}

function syntaxSpan(marker: string): string {
  return `<span class="md-syntax">${escapeHtml(marker)}</span>`;
}

function nodesToHtml(nodes: MdNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return escapeHtml(node.value).replace(/\n/g, "<br>");
      if (node.type === "bold") {
        const inner = nodesToHtml(node.children);
        if (node.incomplete) return `${syntaxSpan("**")}<strong>${inner}</strong>`;
        return `${syntaxSpan("**")}<strong>${inner}</strong>${syntaxSpan("**")}`;
      }
      const inner = nodesToHtml(node.children);
      if (node.incomplete) return `${syntaxSpan("*")}<em>${inner}</em>`;
      return `${syntaxSpan("*")}<em>${inner}</em>${syntaxSpan("*")}`;
    })
    .join("");
}

/**
 * Discord-style composer HTML: markers stay visible (dimmed), only the span
 * between matching open/close is bold/italic. Serialize via plain text walk.
 */
export function markdownToEditorHtml(source: string): string {
  if (!source) return "";
  return nodesToHtml(parseChatMarkdown(source, { live: true }));
}
