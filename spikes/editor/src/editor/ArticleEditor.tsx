import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { useEffect } from 'react';
import { createExtensions } from './extensions';
import { clipboardContainsOnlyImage, sanitizePastedHtml } from './sanitize-paste';
import { Toolbar } from './Toolbar';

type Props = {
  mentions: boolean;
  content: unknown | null;
  onEditorReady?: (editor: Editor) => void;
};

export function ArticleEditor({ mentions, content, onEditorReady }: Props) {
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: createExtensions({
        mentions,
        placeholder: mentions
          ? 'Text schreiben. @ öffnet Erwähnungen…'
          : 'Weltbeschreibung — @ ist nur ein Zeichen.',
      }),
      content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
      editorProps: {
        attributes: {
          class: 'ProseMirror editor-surface',
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
          if (files && Array.from(files).some((f) => f.type.startsWith('image/'))) {
            event.preventDefault();
            return true;
          }
          return false;
        },
      },
    },
    [mentions],
  );

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  if (!editor) return <p>Editor wird geladen…</p>;

  return (
    <div className="editor-shell">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
