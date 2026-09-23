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
import {
  QUEST_STATUSES,
  QUEST_STATUS_LABEL,
  type QuestParticipant,
  type QuestStatus,
} from "@/lib/quests/status";

type CharacterOption = { id: string; name: string };

type Quest = {
  id: string;
  title: string;
  status: QuestStatus;
  visibility: VisibilityStatus;
  description: RichDoc | null;
  participants: QuestParticipant[];
};

export function QuestForm({
  worldId,
  quest,
  characters,
  mentionStates,
}: {
  worldId: string;
  quest?: Quest;
  characters: CharacterOption[];
  mentionStates?: Record<string, MentionState>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(quest?.title ?? "");
  const [status, setStatus] = useState<QuestStatus>(quest?.status ?? "open");
  const [published, setPublished] = useState(quest?.visibility === "published");
  const [participantIds, setParticipantIds] = useState<string[]>(
    () => quest?.participants.map((entry) => entry.characterId).filter((id): id is string => Boolean(id)) ?? [],
  );
  const [description, setDescription] = useState<RichDoc | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/worlds/${worldId}/quests`;
  const viewPath = (id: string) => worldPath(worldId, `/quests/${id}`);

  async function run<T>(request: Promise<{ ok: true; data: T } | { ok: false; error: string }>) {
    setError(null);
    setPending(true);
    const result = await request;
    setPending(false);
    if (!result.ok) setError(result.error);
    return result;
  }

  function toggleParticipant(id: string) {
    setParticipantIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      title,
      status,
      visibility: published ? "published" : "gm_only",
      participantIds,
      ...(description ? { description } : {}),
    };
    if (quest) {
      const saved = await run(apiRequest(`${base}/${quest.id}`, "PATCH", payload));
      if (saved.ok) {
        router.push(viewPath(quest.id));
        router.refresh();
      }
    } else {
      const created = await run(apiRequest<{ quest: { id: string } }>(base, "POST", payload));
      if (created.ok) {
        router.push(viewPath(created.data.quest.id));
        router.refresh();
      }
    }
  }

  async function onDelete() {
    if (!quest) return;
    const confirmed = window.confirm(`Quest „${quest.title}“ löschen? Relationen darauf entfallen.`);
    if (!confirmed) return;
    const deleted = await run(apiRequest(`${base}/${quest.id}`, "DELETE"));
    if (deleted.ok) {
      router.push(worldPath(worldId));
      router.refresh();
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Link className="back" href={quest ? viewPath(quest.id) : worldPath(worldId)}>
        ‹ Abbrechen
      </Link>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Titel"
        aria-label="Titel"
        maxLength={200}
        required
        style={{ fontSize: 20, fontWeight: 700 }}
      />
      <div className="grid2">
        <label className="stack" style={{ gap: 6 }}>
          <span className="field-label">Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as QuestStatus)}>
            {QUEST_STATUSES.map((value) => (
              <option key={value} value={value}>
                {QUEST_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
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
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Beteiligte</h2>
        {characters.length === 0 ? (
          <p className="muted">Noch keine mitgebrachten Charaktere in dieser Welt.</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {characters.map((character) => {
              const checked = participantIds.includes(character.id);
              return (
                <label key={character.id} className="row" style={{ gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleParticipant(character.id)}
                  />
                  <span>{character.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className="field-label">Beschreibung</span>
        <RichTextEditor
          initialContent={quest?.description ?? null}
          onChange={({ doc }) => setDescription(doc)}
          mentions={{ worldId, canCreateArticle: true, states: mentionStates }}
          ariaLabel="Beschreibung der Quest"
        />
        <p className="small muted">Tippe @ für Erwähnungen. Bilder und Tabellen werden beim Einfügen verworfen.</p>
      </div>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <div className="row">
        <button type="submit" className="btn primary grow" disabled={pending || !title.trim()}>
          Speichern
        </button>
        {quest ? (
          <button type="button" className="btn danger" disabled={pending} onClick={onDelete}>
            Löschen
          </button>
        ) : null}
      </div>
    </form>
  );
}
