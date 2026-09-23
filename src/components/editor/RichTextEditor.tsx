"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  mentionKey,
  type MentionHit,
  type MentionRef,
  type MentionState,
  type MentionableKind,
} from "@/lib/editor/mentions";
import { emptyDoc, extractMentions, type RichDoc } from "@/lib/editor/rich-text";
import { clipboardContainsOnlyImage, sanitizePastedHtml } from "@/lib/editor/sanitize-paste";
import { createEditorExtensions } from "./extensions";
import { createMentionSuggestion } from "./mention-suggestion";
import { createArticleStub, searchMentions } from "./mention-api";
import { Toolbar } from "./Toolbar";
import "./editor.css";

export type RichTextChange = { doc: RichDoc; mentions: MentionRef[] };

export type MentionConfig = {
  worldId: string;
  /** Only the Spielleitung may create articles; players never see „Neuen Artikel anlegen“. */
  canCreateArticle: boolean;
  /** `kind:id` → state of already known mentions (stubs are red). */
  states?: Record<string, MentionState>;
};

type Props = {
  initialContent: RichDoc | null;
  onChange: (change: RichTextChange) => void;
  /** Omit for the world description: `@` is then a plain character. */
  mentions?: MentionConfig;
  placeholder?: string;
  ariaLabel?: string;
};

export function RichTextEditor({ initialContent, onChange, mentions, placeholder, ariaLabel }: Props) {
  const [error, setError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  const [stateStore] = useState(
    () => new Map<string, MentionState>(Object.entries(mentions?.states ?? {})),
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    for (const [key, state] of Object.entries(mentions?.states ?? {})) stateStore.set(key, state);
  }, [mentions?.states, stateStore]);

  const worldId = mentions?.worldId ?? null;
  const canCreate = mentions?.canCreateArticle ?? false;

  const extensions = useMemo(() => {
    const mentionConfig = worldId
      ? {
          resolveState: (kind: string, id: string) =>
            stateStore.get(mentionKey({ kind: kind as MentionableKind, id })) ?? "linked",
          suggestion: createMentionSuggestion({
            search: (query) => searchMentions(worldId, query),
            createStub: canCreate
              ? async (title: string): Promise<MentionHit> => {
                  const hit = await createArticleStub(worldId, title);
                  stateStore.set(mentionKey(hit), "stub");
                  return hit;
                }
              : null,
            onError: setError,
          }),
        }
      : null;
    return createEditorExtensions({
      placeholder:
        placeholder ?? (worldId ? "Text schreiben. @ öffnet Erwähnungen …" : "Text schreiben …"),
      mentions: mentionConfig,
    });
  }, [worldId, canCreate, placeholder, stateStore]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: initialContent ?? emptyDoc(),
      editorProps: {
        attributes: {
          class: "rich-text editor-surface",
          "aria-label": ariaLabel ?? "Text",
          "aria-multiline": "true",
          role: "textbox",
        },
        transformPastedHTML: (html) => sanitizePastedHtml(html),
        handlePaste(_view, event) {
          if (clipboardContainsOnlyImage(event.clipboardData)) {
            event.preventDefault();
            return true;
          }
          return false;
        },
        handleDrop(_view, event) {
          const files = event.dataTransfer?.files;
          if (files && Array.from(files).some((file) => file.type.startsWith("image/"))) {
            event.preventDefault();
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor: ed }) => {
        setError(null);
        const doc = ed.getJSON() as RichDoc;
        onChangeRef.current({ doc, mentions: extractMentions(doc) });
      },
    },
    [extensions],
  );

  if (!editor) return <div className="editor-shell is-loading">Editor wird geladen …</div>;

  return (
    <div className="editor-shell">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      {error ? (
        <p className="editor-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
