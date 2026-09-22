/** Minimal chat markdown: only `**bold**` and `*italic*`. No HTML. */

export type MdNode =
  | { type: "text"; value: string }
  | { type: "bold"; children: MdNode[] }
  | { type: "italic"; children: MdNode[] };

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

/** Parse plain text with a tiny markdown subset. Unmatched `*` / `**` stay as text. */
export function parseChatMarkdown(source: string): MdNode[] {
  const nodes: MdNode[] = [];
  let i = 0;

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nodesToHtml(nodes: MdNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return escapeHtml(node.value).replace(/\n/g, "<br>");
      if (node.type === "bold") return `<strong>${nodesToHtml(node.children)}</strong>`;
      return `<em>${nodesToHtml(node.children)}</em>`;
    })
    .join("");
}

/** Safe HTML for the composer (escaped text + strong/em only). */
export function markdownToEditorHtml(source: string): string {
  if (!source) return "";
  return nodesToHtml(parseChatMarkdown(source));
}
