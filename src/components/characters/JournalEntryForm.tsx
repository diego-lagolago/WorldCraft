"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import type { JournalVisibility } from "@/lib/authz/types";
import { apiRequest } from "@/lib/client/api";
import { JOURNAL_TITLE_MAX } from "@/lib/characters/sheet";
import { plainTextOf, type RichDoc } from "@/lib/editor/rich-text";

export function JournalEntryForm(props: { worldId: string; characterId: string; canCreateArticle: boolean }) {
  const { worldId, characterId, canCreateArticle } = props;
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState<RichDoc | null>(null);
  const [empty, setEmpty] = useState(true);
  const [visibility, setVisibility] = useState<JournalVisibility>("private");
  const [editorKey, setEditorKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await apiRequest(`/api/worlds/${worldId}/characters/${characterId}/journal`, "POST", {
      title,
      body,
      visibility,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTitle("");
    setBody(null);
    setEmpty(true);
    setVisibility("private");
    setEditorKey((key) => key + 1);
    router.refresh();
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <h2 style={{ margin: 0 }}>Neuer Eintrag</h2>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Titel (optional)"
        aria-label="Titel"
        maxLength={JOURNAL_TITLE_MAX}
      />
      <RichTextEditor
        key={editorKey}
        initialContent={null}
        onChange={({ doc }) => {
          setBody(doc);
          setEmpty(!plainTextOf(doc).trim());
        }}
        mentions={{ worldId, canCreateArticle }}
        placeholder="Was ist passiert?"
        ariaLabel="Inhalt des Eintrags"
      />
      <div className="chips" role="radiogroup" aria-label="Sichtbarkeit">
        <button
          type="button"
          role="radio"
          aria-checked={visibility === "private"}
          className={visibility === "private" ? "chip on" : "chip"}
          onClick={() => setVisibility("private")}
        >
          🔒 privat
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={visibility === "shared_with_gm"}
          className={visibility === "shared_with_gm" ? "chip on" : "chip"}
          onClick={() => setVisibility("shared_with_gm")}
        >
          👁 mit Spielleitung teilen
        </button>
      </div>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn primary" disabled={pending || empty}>
        Speichern
      </button>
    </form>
  );
}
