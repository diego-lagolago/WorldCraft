"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { worldPath } from "@/components/shell/nav";
import { apiRequest, uploadImage } from "@/lib/client/api";
import type { RichDoc } from "@/lib/editor/rich-text";
import { IMAGE_ACCEPT } from "./image-accept";

export function CreateWorldForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState<RichDoc | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const created = await apiRequest<{ id: string }>("/api/worlds", "POST", {
      name,
      description: description ?? undefined,
    });
    if (!created.ok) {
      setError(created.error);
      setPending(false);
      return;
    }
    if (image) {
      const uploaded = await uploadImage({ file: image, kind: "world_title", worldId: created.data.id });
      if (!uploaded.ok) {
        setCreatedId(created.data.id);
        setError(`Die Welt ist angelegt, das Titelbild nicht: ${uploaded.error}`);
        setPending(false);
        return;
      }
    }
    router.push(worldPath(created.data.id));
  }

  if (createdId) {
    return (
      <div className="card stack">
        <p className="error-text" role="alert">
          {error}
        </p>
        <button type="button" className="btn primary" onClick={() => router.push(worldPath(createdId))}>
          Weiter zur Welt
        </button>
      </div>
    );
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <h2>Neue Welt anlegen</h2>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Name der Welt"
        aria-label="Name der Welt"
        maxLength={120}
        required
      />
      <div className="stack" style={{ gap: 6 }}>
        <span className="field-label">Beschreibung (optional, ohne Erwähnungen)</span>
        <RichTextEditor
          initialContent={null}
          onChange={({ doc }) => setDescription(doc)}
          ariaLabel="Beschreibung der Welt"
          placeholder="Worum geht es in dieser Welt?"
        />
      </div>
      <label className="stack small muted" style={{ gap: 6 }}>
        Titelbild (optional, JPG, PNG oder WebP, max. 10 MB)
        <input type="file" accept={IMAGE_ACCEPT} onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
      </label>
      <p className="small muted">
        Du wirst Game Master. Das „Hauptuniversum“ und der Chat-Kanal „Allgemein“ werden automatisch angelegt.
      </p>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn primary" disabled={pending || !name.trim()}>
        {pending ? "Wird angelegt …" : "Welt anlegen"}
      </button>
    </form>
  );
}
