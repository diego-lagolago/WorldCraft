import { Fragment, type ReactNode } from "react";
import { parseChatMarkdown, type MdNode } from "@/lib/chat/markdown";

/** Preserve newlines that HTML would otherwise collapse in text nodes. */
function renderTextWithBreaks(value: string, keyPrefix: string): ReactNode {
  const parts = value.split("\n");
  if (parts.length === 1) return value;
  return parts.map((part, index) => (
    <Fragment key={`${keyPrefix}${index}`}>
      {index > 0 ? <br /> : null}
      {part}
    </Fragment>
  ));
}

function renderNodes(nodes: MdNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}${index}`;
    if (node.type === "text") return <Fragment key={key}>{renderTextWithBreaks(node.value, `${key}.`)}</Fragment>;
    if (node.type === "bold") return <strong key={key}>{renderNodes(node.children, `${key}.`)}</strong>;
    return <em key={key}>{renderNodes(node.children, `${key}.`)}</em>;
  });
}

/** Chat body as React text, strong and em. No raw HTML. */
export function ChatMarkdown({ text }: { text: string }) {
  return <>{renderNodes(parseChatMarkdown(text), "m")}</>;
}
