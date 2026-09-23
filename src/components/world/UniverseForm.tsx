"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { worldPath } from "@/components/shell/nav";
import type { VisibilityStatus } from "@/lib/authz/types";
import { apiRequest } from "@/lib/client/api";
import type { MentionState } from "@/lib/editor/mentions";
import type { RichDoc } from "@/lib/editor/rich-text";

type Props = {
  worldId: string;
  universe?: { id: string; name: string; visibility: VisibilityStatus; description: RichDoc | null };
  mentionStates?: Record<string, MentionState>;
};

export function UniverseForm({ worldId, universe, mentionStates }: Props) {
  const router = useRouter();
  const [name, setName] = useState(universe?.name ?? "");
  const [published, setPublished] = useState(universe?.visibility === "published");
  const [description, setDescription] = useState<RichDoc | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/worlds/${worldId}/universes`;
  const detailPath = (id: string) => worldPath(worldId, `/universes/${id}`);

  async function run<T>(request: Promise<{ ok: true; data: T } | { ok: false; error: string }>) {
    setError(null);
    setPending(true);
    const result = await request;
    setPending(false);
    if (!result.ok) setError(result.error);
    return result;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const body = {
      name,
      visibility: published ? "published" : "gm_only",
      ...(description ? { description } : {}),
    };
    if (universe) {
      const saved = await run(apiRequest(`${base}/${universe.id}`, "PATCH", body));
      if (saved.ok) {
        router.push(detailPath(universe.id));
        router.refresh();
      }
    } else {
      const created = await run(apiRequest<{ id: string }>(base, "POST", body));
      if (created.ok) {
        router.push(detailPath(created.data.id));
        router.refresh();
      }
    }
  }

  async function onMove(move: "up" | "down") {
    if (!universe) return;
    const moved = await run(apiRequest(`${base}/${universe.id}`, "PATCH", { move }));
    if (moved.ok) router.refresh();
  }

  async function onDelete() {
    if (!universe) return;
    const confirmed = window.confirm(
      `Universum „${universe.name}“ mit seinen Karten, Pins und Markern löschen? Das lässt sich nicht rückgängig machen.`,
    );
    if (!confirmed) return;
    const deleted = await run(apiRequest(`${base}/${universe.id}`, "DELETE"));
    if (deleted.ok) {
      router.push(worldPath(worldId));
      router.refresh();
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Link className="back" href={universe ? detailPath(universe.id) : worldPath(worldId)}>
        ‹ Abbrechen
      </Link>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Name des Universums"
        aria-label="Name des Universums"
        maxLength={120}
        required
        style={{ fontSize: 20, fontWeight: 700 }}
      />
      <div className="toggle card" style={{ padding: "8px 12px" }}>
        <span>
          Veröffentlicht
          <br />
          <span className="small muted">aus = nur Spielleitung</span>
        </span>
        <button
          type="button"
          className="sw"
          role="switch"
          aria-checked={published}
          aria-label="Veröffentlicht"
          onClick={() => setPublished((value) => !value)}
        />
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="field-label">Beschreibung</span>
        <RichTextEditor
          initialContent={universe?.description ?? null}
          onChange={({ doc }) => setDescription(doc)}
          mentions={{ worldId, canCreateArticle: true, states: mentionStates }}
          ariaLabel="Beschreibung des Universums"
        />
      </div>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn primary" disabled={pending || !name.trim()}>
        {universe ? "Speichern" : "Universum anlegen"}
      </button>
      {universe ? (
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Reihenfolge</h2>
          <div className="row">
            <button type="button" className="btn grow" disabled={pending} onClick={() => onMove("up")}>
              ↑ Nach oben
            </button>
            <button type="button" className="btn grow" disabled={pending} onClick={() => onMove("down")}>
              ↓ Nach unten
            </button>
          </div>
          <button type="button" className="btn danger" disabled={pending} onClick={onDelete}>
            Universum löschen
          </button>
          <p className="small muted">Das letzte Universum einer Welt lässt sich nicht löschen.</p>
        </div>
      ) : null}
    </form>
  );
}
