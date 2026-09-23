import type { ReactNode } from "react";
import { parseChatMarkdown, type MdNode } from "@/lib/chat/markdown";

function renderNodes(nodes: MdNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}${index}`;
    if (node.type === "text") return node.value;
    if (node.type === "bold") return <strong key={key}>{renderNodes(node.children, `${key}.`)}</strong>;
    return <em key={key}>{renderNodes(node.children, `${key}.`)}</em>;
  });
}

/** Chat body as React text, strong and em. No raw HTML. */
export function ChatMarkdown({ text }: { text: string }) {
  return <>{renderNodes(parseChatMarkdown(text), "m")}</>;
}
