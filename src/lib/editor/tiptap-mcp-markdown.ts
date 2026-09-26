type Mark = { type?: unknown; attrs?: unknown };
type Node = { type?: unknown; text?: unknown; attrs?: unknown; marks?: unknown; content?: unknown };

function nodes(value: unknown): Node[] {
  return Array.isArray(value) ? value.filter((node): node is Node => Boolean(node) && typeof node === "object") : [];
}

function textWithMarks(text: string, marks: Mark[]): string {
  let value = text.replace(/([\\`*_{}\[\]()#+.!|-])/g, "\\$1");
  for (const mark of marks) {
    if (mark.type === "bold") value = `**${value}**`;
    else if (mark.type === "italic") value = `*${value}*`;
    else if (mark.type === "strike") value = `~~${value}~~`;
    else if (mark.type === "code") value = `\`${value.replace(/`/g, "\\`")}\``;
    else if (mark.type === "link" && mark.attrs && typeof mark.attrs === "object") {
      const href = (mark.attrs as { href?: unknown }).href;
      if (typeof href === "string" && /^https?:\/\//i.test(href)) value = `[${value}](${href})`;
    }
  }
  return value;
}

function inline(content: unknown): string {
  return nodes(content)
    .map((node) => {
      if (node.type === "text" && typeof node.text === "string") {
        return textWithMarks(node.text, nodes(node.marks) as Mark[]);
      }
      if (node.type === "hardBreak") return "  \n";
      if (node.type === "mention" && node.attrs && typeof node.attrs === "object") {
        const attrs = node.attrs as { id?: unknown; kind?: unknown; label?: unknown };
        if (typeof attrs.id === "string" && typeof attrs.kind === "string" && typeof attrs.label === "string") {
          const kind = attrs.kind === "article" ? "artikel" : attrs.kind === "universe" ? "universum" : attrs.kind;
          return `@[${attrs.label}](${kind}:${attrs.id})`;
        }
        return typeof attrs.label === "string" ? `@${attrs.label}` : "";
      }
      return inline(node.content);
    })
    .join("");
}

function block(node: Node, depth = 0): string {
  const content = nodes(node.content);
  switch (node.type) {
    case "paragraph":
      return inline(content);
    case "heading": {
      const level = node.attrs && typeof node.attrs === "object" && typeof (node.attrs as { level?: unknown }).level === "number"
        ? Math.min(6, Math.max(1, (node.attrs as { level: number }).level))
        : 2;
      return `${"#".repeat(level)} ${inline(content)}`;
    }
    case "blockquote":
      return content.map((child) => `> ${block(child, depth)}`).join("\n");
    case "bulletList":
      return content.map((child) => block(child, depth)).join("\n");
    case "orderedList":
      return content.map((child, index) => block(child, depth).replace(/^[-*] /, `${index + 1}. `)).join("\n");
    case "listItem": {
      const body = content.map((child) => block(child, depth + 1)).filter(Boolean).join("\n");
      return `${"  ".repeat(depth)}- ${body}`;
    }
    case "codeBlock":
      return `\`\`\`\n${inline(content)}\n\`\`\``;
    case "horizontalRule":
      return "---";
    case "text":
    case "mention":
    case "hardBreak":
      return inline([node]);
    default:
      return content.map((child) => block(child, depth)).filter(Boolean).join("\n");
  }
}

/** Server-side, DOM-free export for MCP. Unknown nodes degrade to safe text. */
export function tiptapJsonToMcpMarkdown(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const root = value as Node;
  const rendered = nodes(root.content).map((node) => block(node)).filter(Boolean).join("\n\n");
  return rendered.replace(/\n{3,}/g, "\n\n").trim();
}
