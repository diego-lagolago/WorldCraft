"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { ImageUploadField } from "@/components/files/ImageUploadField";
import { worldPath } from "@/components/shell/nav";
import { apiRequest } from "@/lib/client/api";
import { finishCreateWithImage } from "@/lib/client/finish-create-with-image";
import type { RichDoc } from "@/lib/editor/rich-text";

export function CreateWorldForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState<RichDoc | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const uploaded = await finishCreateWithImage({
        file: image,
        kind: "world_title",
        worldId: created.data.id,
        targetId: created.data.id,
        onFailureHref: `${worldPath(created.data.id, "/menu")}?imageError=1`,
        navigate: router.push,
      });
      if (!uploaded) {
        router.refresh();
        return;
      }
    }
    router.push(worldPath(created.data.id));
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
      <div className="stack small muted" style={{ gap: 6 }}>
        <span>Titelbild (optional, JPG, PNG oder WebP, max. 10 MB)</span>
        <ImageUploadField mode="pending" onFileChange={setImage} onRemove={image ? () => setImage(null) : undefined} />
      </div>
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
