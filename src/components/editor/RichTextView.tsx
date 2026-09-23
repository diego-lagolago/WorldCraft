import Link from "next/link";
import type { ReactNode } from "react";
import type { ResolvedMention } from "@/lib/domain/mention-resolve";
import { normalizeLinkHref } from "@/lib/editor/links";
import { isMentionableKind, mentionKey } from "@/lib/editor/mentions";
import type { RichDoc, RichMark, RichNode } from "@/lib/editor/rich-text";
import "./editor.css";

type Props = {
  doc: RichDoc | null;
  mentions?: Record<string, ResolvedMention>;
  empty?: ReactNode;
};

/** Stored, sanitized TipTap JSON as React elements; unknown nodes are skipped. */
export function RichTextView({ doc, mentions = {}, empty = null }: Props) {
  const hasText = doc?.content.some((node) => node.content?.length || node.type === "horizontalRule");
  if (!doc || !hasText) return <>{empty}</>;
  return <div className="rich-text">{renderNodes(doc.content, mentions)}</div>;
}

function renderNodes(nodes: RichNode[] | undefined, mentions: Record<string, ResolvedMention>): ReactNode[] {
  return (nodes ?? []).map((node, index) => renderNode(node, index, mentions));
}

function renderNode(node: RichNode, key: number, mentions: Record<string, ResolvedMention>): ReactNode {
  const children = () => renderNodes(node.content, mentions);
  switch (node.type) {
    case "paragraph":
      return <p key={key}>{children()}</p>;
    case "heading":
      return Number(node.attrs?.level) >= 3 ? <h3 key={key}>{children()}</h3> : <h2 key={key}>{children()}</h2>;
    case "blockquote":
      return <blockquote key={key}>{children()}</blockquote>;
    case "bulletList":
      return <ul key={key}>{children()}</ul>;
    case "orderedList": {
      const start = Number(node.attrs?.start);
      return (
        <ol key={key} start={Number.isInteger(start) && start > 1 ? start : undefined}>
          {children()}
        </ol>
      );
    }
    case "listItem":
      return <li key={key}>{children()}</li>;
    case "horizontalRule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    case "text":
      return <span key={key}>{applyMarks(node.text ?? "", node.marks)}</span>;
    case "mention":
      return renderMention(node, key, mentions);
    default:
      return null;
  }
}

function renderMention(node: RichNode, key: number, mentions: Record<string, ResolvedMention>): ReactNode {
  const label = String(node.attrs?.label ?? "?");
  const kind = node.attrs?.kind;
  const id = node.attrs?.id;
  if (!isMentionableKind(kind) || typeof id !== "string") return <span key={key}>{label}</span>;
  const resolved = mentions[mentionKey({ kind, id })];
  if (!resolved || resolved.state === "plain") return <span key={key}>{label}</span>;
  return (
    <Link
      key={key}
      href={resolved.href}
      className={resolved.state === "stub" ? "mention mention-stub" : "mention"}
      data-kind={kind}
    >
      {resolved.title}
    </Link>
  );
}

function applyMarks(text: string, marks: RichMark[] | undefined): ReactNode {
  let out: ReactNode = text;
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case "bold":
        out = <strong>{out}</strong>;
        break;
      case "italic":
        out = <em>{out}</em>;
        break;
      case "underline":
        out = <u>{out}</u>;
        break;
      case "strike":
        out = <s>{out}</s>;
        break;
      case "link": {
        const href = normalizeLinkHref(mark.attrs?.href);
        if (href) {
          out = (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {out}
            </a>
          );
        }
        break;
      }
    }
  }
  return out;
}
