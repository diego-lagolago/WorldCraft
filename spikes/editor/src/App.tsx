import type { Editor } from '@tiptap/react';
import { useCallback, useRef, useState } from 'react';
import { ArticleEditor } from './editor/ArticleEditor';
import { extractMentions } from './editor/extract-mentions';
import { sanitizePastedHtml } from './editor/sanitize-paste';
import { ART_LABEL } from './editor/types';

const PASTE_SAMPLE = `<p>Vor dem Bild </p><img src="https://example.com/x.png" alt="x"><table><tr><td>Zelltext</td></tr></table><p> und danach.</p>`;

export default function App() {
  const [mentions, setMentions] = useState(true);
  const [savedJson, setSavedJson] = useState<unknown | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [loadContent, setLoadContent] = useState<unknown | null>(null);
  const [mentionsOut, setMentionsOut] = useState<string>('');
  const [plain, setPlain] = useState('');
  const editorRef = useRef<Editor | null>(null);

  const onReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const save = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const json = editor.getJSON();
    setSavedJson(json);
    setPlain(editor.getText());
    const refs = extractMentions(json);
    setMentionsOut(
      refs.length === 0
        ? '(keine Erwähnungen)'
        : refs.map((r) => `${ART_LABEL[r.art]} · ${r.id}`).join('\n'),
    );
  };

  const reload = () => {
    if (!savedJson) return;
    setLoadContent(savedJson);
    setLoadKey((k) => k + 1);
  };

  const simulatePaste = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const cleaned = sanitizePastedHtml(PASTE_SAMPLE);
    editor.chain().focus().insertContent(cleaned).run();
  };

  return (
    <main className="page">
      <h1>WorldCraft Editor-Spike</h1>
      <p className="lead">
        Genau die erlaubten Formatierungen. <code>@schleim</code> findet „Gottschleim“ (Artikel · Ort)
        und „Töte den Gottschleim“ (Quest). Bild und Tabelle aus der Zwischenablage werden verworfen.
      </p>

      <label className="mode">
        <input
          type="checkbox"
          checked={mentions}
          onChange={(e) => {
            setMentions(e.target.checked);
            setLoadContent(null);
            setLoadKey((k) => k + 1);
          }}
        />
        Erwähnungen aktiv (aus für Weltbeschreibung)
      </label>

      <ArticleEditor
        key={`${mentions}-${loadKey}`}
        mentions={mentions}
        content={loadContent}
        onEditorReady={onReady}
      />

      <div className="actions">
        <button type="button" onClick={save}>
          Speichern
        </button>
        <button type="button" onClick={reload} disabled={!savedJson}>
          JSON neu laden
        </button>
        <button type="button" onClick={simulatePaste}>
          Einfügen simulieren (Bild + Tabelle)
        </button>
      </div>

      <section>
        <h2>Klartext (Suche)</h2>
        <pre>{plain || '—'}</pre>
      </section>
      <section>
        <h2>Erwähnte Inhaltsverweise</h2>
        <pre>{mentionsOut || '—'}</pre>
      </section>
      <section>
        <h2>Gespeichertes JSON</h2>
        <pre>{savedJson ? JSON.stringify(savedJson, null, 2) : '—'}</pre>
      </section>
    </main>
  );
}
