"use client";

import { useState } from "react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { RichTextView } from "@/components/editor/RichTextView";
import { Sheet } from "@/components/map/MapSheets";
import { apiRequest } from "@/lib/client/api";
import type { MentionState } from "@/lib/editor/mentions";
import { asRichDoc, emptyDoc, type RichDoc } from "@/lib/editor/rich-text";
import {
  interpretNoteReload,
  interpretNoteSave,
  noteSaveDisabled,
  prepareNoteView,
  type QuestNoteView,
} from "./quest-note-state";

function hasNoteContent(bodyJson: unknown): boolean {
  const doc = asRichDoc(bodyJson);
  if (!doc) return false;
  return doc.content.some((node) => Boolean(node.content?.length) || node.type === "horizontalRule");
}

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function QuestNotesSheet({
  worldId,
  questId,
  canCreateArticle,
  mentionStates,
  initialNote,
}: {
  worldId: string;
  questId: string;
  canCreateArticle: boolean;
  mentionStates: Record<string, MentionState>;
  initialNote: QuestNoteView;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(() => prepareNoteView(initialNote));
  const [draft, setDraft] = useState<RichDoc | null>(null);
  const [editing, setEditing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  const base = `/api/worlds/${worldId}/quests/${questId}/notes`;
  const fabHas = hasNoteContent(note.bodyJson);

  function openSheet() {
    setError(null);
    setConflict(false);
    setDraft(null);
    setEditing(!hasNoteContent(note.bodyJson));
    setEditorKey((value) => value + 1);
    setOpen(true);
  }

  function closeSheet() {
    if (pending) return;
    setOpen(false);
    setConflict(false);
    setError(null);
    setDraft(null);
    setEditing(false);
  }

  async function onSave() {
    setPending(true);
    setError(null);
    const bodyJson = draft ?? asRichDoc(note.bodyJson) ?? emptyDoc();
    const result = await apiRequest<{ note: QuestNoteView }>(base, "PUT", {
      bodyJson,
      version: note.version,
    });
    setPending(false);
    const outcome = interpretNoteSave(result);
    if (outcome.action === "success") {
      setNote(outcome.note);
      setDraft(null);
      setConflict(false);
      setEditing(false);
      return;
    }
    if (outcome.action === "conflict") {
      setConflict(true);
      return;
    }
    setError(outcome.error);
  }

  async function onReload() {
    setPending(true);
    setError(null);
    const result = await apiRequest<{ note: QuestNoteView }>(base, "GET");
    setPending(false);
    const outcome = interpretNoteReload(result);
    if (outcome.action === "error") {
      setError(outcome.error);
      return;
    }
    setNote(outcome.note);
    setDraft(null);
    setConflict(false);
    setEditorKey((value) => value + 1);
  }

  const metaParts = [
    note.version > 0 ? `v${note.version}` : null,
    note.updatedByName,
    note.updatedAt ? formatUpdatedAt(note.updatedAt) : null,
  ].filter(Boolean);

  return (
    <>
      <button
        type="button"
        className={`note-fab${fabHas ? " has" : ""}`}
        title="Notizblock"
        aria-label="Notizblock öffnen"
        onClick={openSheet}
      >
        📝
      </button>

      {open ? (
        <Sheet title="Notizblock" onClose={closeSheet}>
          <p className="small muted" style={{ margin: "6px 0 12px" }}>
            Gemeinsam für alle, die die Quest sehen. Erwähnungen erzeugen keine Relationen.
            {metaParts.length > 0 ? ` · ${metaParts.join(" · ")}` : " · noch leer"}
          </p>

          {conflict ? (
            <div className="note-conflict" style={{ marginBottom: 12 }}>
              Die Notiz wurde inzwischen geändert.{" "}
              <button type="button" className="btn sm" disabled={pending} onClick={() => void onReload()}>
                Neu laden
              </button>
              <div className="small muted" style={{ marginTop: 6 }}>
                Speichern ist gesperrt. Kopiere deinen Text, bevor du neu lädst — „Neu laden“ ersetzt
                deinen Entwurf mit dem Stand vom Server.
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}

          {editing ? (
            <>
              <RichTextEditor
                key={editorKey}
                initialContent={asRichDoc(note.bodyJson)}
                onChange={({ doc }) => setDraft(doc)}
                mentions={{ worldId, canCreateArticle, states: mentionStates }}
                ariaLabel="Quest-Notizblock"
              />
              <p className="small muted" style={{ margin: "8px 0" }}>
                Tippe <b>@</b> für Erwähnungen.
              </p>
              <div className="row wrap" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn primary grow"
                  disabled={noteSaveDisabled(pending, conflict)}
                  onClick={() => void onSave()}
                >
                  Speichern
                </button>
                <button
                  type="button"
                  className="btn sm"
                  disabled={pending}
                  onClick={() => {
                    setDraft(null);
                    setEditing(false);
                    setConflict(false);
                    setError(null);
                  }}
                >
                  Abbrechen
                </button>
              </div>
            </>
          ) : (
            <>
              <RichTextView
                doc={asRichDoc(note.bodyJson)}
                mentions={note.mentions}
                empty={<p className="muted">Noch keine Notiz.</p>}
              />
              <div className="row wrap" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn primary grow"
                  onClick={() => {
                    setDraft(null);
                    setEditorKey((value) => value + 1);
                    setEditing(true);
                  }}
                >
                  Bearbeiten
                </button>
                <button type="button" className="btn sm" onClick={closeSheet}>
                  Schließen
                </button>
              </div>
            </>
          )}
        </Sheet>
      ) : null}
    </>
  );
}
