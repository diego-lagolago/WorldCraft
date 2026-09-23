"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { apiRequest, uploadImage } from "@/lib/client/api";
import { forgetWorld } from "@/lib/client/last-context";
import type { RichDoc } from "@/lib/editor/rich-text";
import { IMAGE_ACCEPT } from "./image-accept";

type Props = {
  world: { id: string; name: string; description: RichDoc | null; titleImageId: string | null };
};

/** Game master only (Entscheidung Projektinhaber 2026-09-23). */
export function WorldSettingsCard({ world }: Props) {
  const router = useRouter();
  const [name, setName] = useState(world.name);
  const [description, setDescription] = useState<RichDoc | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");

  function begin() {
    setError(null);
    setMessage(null);
    setPending(true);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    begin();
    const saved = await apiRequest(`/api/worlds/${world.id}`, "PATCH", {
      name,
      ...(description ? { description } : {}),
    });
    setPending(false);
    if (!saved.ok) return setError(saved.error);
    setMessage("Gespeichert.");
    router.refresh();
  }

  async function onImage(file: File | undefined) {
    if (!file) return;
    begin();
    const uploaded = await uploadImage({ file, kind: "world_title", worldId: world.id });
    setPending(false);
    if (!uploaded.ok) return setError(uploaded.error);
    setMessage("Titelbild gespeichert.");
    router.refresh();
  }

  async function onRemoveImage() {
    begin();
    const removed = await apiRequest(`/api/worlds/${world.id}`, "PATCH", { removeTitleImage: true });
    setPending(false);
    if (!removed.ok) return setError(removed.error);
    setMessage("Titelbild entfernt.");
    router.refresh();
  }

  async function onDelete() {
    begin();
    const deleted = await apiRequest(`/api/worlds/${world.id}`, "DELETE");
    if (!deleted.ok) {
      setPending(false);
      return setError(deleted.error);
    }
    forgetWorld(world.id);
    router.replace("/?new=1");
    router.refresh();
  }

  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Welt-Einstellungen</h2>
      <form className="stack" onSubmit={onSave}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Name der Welt"
          maxLength={120}
          required
        />
        <RichTextEditor
          initialContent={world.description}
          onChange={({ doc }) => setDescription(doc)}
          ariaLabel="Beschreibung der Welt"
        />
        <p className="small muted">Weltbeschreibung ohne @-Erwähnungen.</p>
        <button type="submit" className="btn" disabled={pending || !name.trim()}>
          Speichern
        </button>
      </form>

      <div className="row wrap">
        <label className="btn sm">
          {world.titleImageId ? "Titelbild ersetzen" : "Titelbild wählen"}
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            hidden
            disabled={pending}
            onChange={(event) => onImage(event.target.files?.[0])}
          />
        </label>
        {world.titleImageId ? (
          <button type="button" className="btn sm" disabled={pending} onClick={onRemoveImage}>
            Titelbild entfernen
          </button>
        ) : null}
      </div>

      {message ? <p className="small muted">{message}</p> : null}
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      <details className="stack">
        <summary className="btn danger">Welt löschen</summary>
        <div className="stack" style={{ marginTop: 10 }}>
          <p className="small">
            Löscht die Welt mit allen Universen, Karten, Artikeln, Quests, Chats und Tagebüchern. Charaktere bleiben
            bei ihren Besitzern. Zur Bestätigung den Namen der Welt eingeben:
          </p>
          <input
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            aria-label="Name der Welt zur Bestätigung"
            placeholder={world.name}
          />
          <button
            type="button"
            className="btn danger"
            disabled={pending || confirmName.trim() !== world.name}
            onClick={onDelete}
          >
            Endgültig löschen
          </button>
        </div>
      </details>
    </div>
  );
}
