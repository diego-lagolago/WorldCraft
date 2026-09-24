"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { RichTextView } from "@/components/editor/RichTextView";
import { Sheet } from "@/components/map/MapSheets";
import { QuestStatusSelect } from "@/components/quests/QuestStatusSelect";
import { VisibilityBadge } from "@/components/world/display";
import { ContentVisibilitySelect } from "@/components/world/VisibilitySelect";
import type { ContentVisibility } from "@/lib/authz/types";
import { CHAPTER_TITLE_MAX, QUEST_STATUS_LABEL, type QuestStatus } from "@/lib/quests/status";
import { apiRequest } from "@/lib/client/api";
import type { ResolvedMention } from "@/lib/domain/mention-resolve";
import type { MentionState } from "@/lib/editor/mentions";
import { asRichDoc, emptyDoc, type RichDoc } from "@/lib/editor/rich-text";

export type QuestChapterView = {
  id: string;
  title: string;
  bodyJson: unknown;
  status: QuestStatus;
  visibility: ContentVisibility;
  ownerId: string;
};

type SheetMode =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; chapter: QuestChapterView }
  | { kind: "delete"; chapter: QuestChapterView };

export function QuestChapters({
  worldId,
  questId,
  chapters,
  actorId,
  staff,
  mentions,
  mentionStates,
}: {
  worldId: string;
  questId: string;
  chapters: QuestChapterView[];
  actorId: string;
  staff: boolean;
  mentions: Record<string, ResolvedMention>;
  mentionStates: Record<string, MentionState>;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetMode>({ kind: "none" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/worlds/${worldId}/quests/${questId}/chapters`;

  async function run<T>(request: Promise<{ ok: true; data: T } | { ok: false; error: string }>) {
    setError(null);
    setPending(true);
    const result = await request;
    setPending(false);
    if (!result.ok) setError(result.error);
    return result;
  }

  async function refresh() {
    router.refresh();
  }

  async function onStatusChange(chapter: QuestChapterView, status: QuestStatus) {
    if (status === chapter.status) return;
    const saved = await run(
      apiRequest(`${base}/${chapter.id}`, "PATCH", { status }),
    );
    if (saved.ok) await refresh();
  }

  async function onMove(chapterId: string, direction: -1 | 1) {
    const index = chapters.findIndex((entry) => entry.id === chapterId);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= chapters.length) return;
    const next = chapters.map((entry) => entry.id);
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    const saved = await run(apiRequest(`${base}/order`, "PUT", { chapterIds: next }));
    if (saved.ok) await refresh();
  }

  async function onDeleteConfirm(chapter: QuestChapterView) {
    const deleted = await run(apiRequest(`${base}/${chapter.id}`, "DELETE"));
    if (deleted.ok) {
      setSheet({ kind: "none" });
      await refresh();
    }
  }

  return (
    <div className="card stack chapters-block">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Kapitel</h2>
        {staff ? (
          <button type="button" className="btn sm" onClick={() => setSheet({ kind: "create" })}>
            + Kapitel
          </button>
        ) : null}
      </div>
      <p className="small muted">
        Nummerierung zählt nur sichtbare Kapitel. Die Spielleitung schaltet jedes Kapitel einzeln frei.
      </p>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      {chapters.length === 0 ? (
        <div className="empty">
          {staff ? "Noch keine Kapitel. Lege das erste an." : "Noch keine freigegebenen Kapitel."}
        </div>
      ) : (
        chapters.map((chapter, index) => (
          <div key={chapter.id} className="chapter">
            <div className="ch-h">
              <span className="ch-num">{index + 1}.</span>
              <b className="grow">{chapter.title}</b>
              <VisibilityBadge visibility={chapter.visibility} />
              {staff ? (
                <div className="ch-actions">
                  <QuestStatusSelect
                    value={chapter.status}
                    onChange={(status) => void onStatusChange(chapter, status)}
                    ariaLabel={`Status von ${chapter.title}`}
                    disabled={pending}
                  />
                  <button
                    type="button"
                    className="btn sm"
                    title="Nach oben"
                    aria-label="Nach oben"
                    disabled={pending || index === 0}
                    onClick={() => void onMove(chapter.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    title="Nach unten"
                    aria-label="Nach unten"
                    disabled={pending || index === chapters.length - 1}
                    onClick={() => void onMove(chapter.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    disabled={pending}
                    onClick={() => setSheet({ kind: "edit", chapter })}
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    className="btn sm danger"
                    disabled={pending}
                    onClick={() => setSheet({ kind: "delete", chapter })}
                  >
                    Löschen
                  </button>
                </div>
              ) : (
                <span className={`badge st-${chapter.status}`}>{QUEST_STATUS_LABEL[chapter.status]}</span>
              )}
            </div>
            <RichTextView
              doc={asRichDoc(chapter.bodyJson)}
              mentions={mentions}
              empty={<p className="muted">Kein Text.</p>}
            />
          </div>
        ))
      )}

      {sheet.kind === "create" || sheet.kind === "edit" ? (
        <ChapterEditSheet
          mode={sheet.kind}
          chapter={sheet.kind === "edit" ? sheet.chapter : null}
          worldId={worldId}
          actorId={actorId}
          mentionStates={mentionStates}
          pending={pending}
          error={error}
          onClose={() => {
            setError(null);
            setSheet({ kind: "none" });
          }}
          onSave={async (payload) => {
            if (sheet.kind === "create") {
              const created = await run(
                apiRequest<{ chapter: QuestChapterView }>(base, "POST", payload),
              );
              if (created.ok) {
                setSheet({ kind: "none" });
                await refresh();
              }
              return;
            }
            const saved = await run(
              apiRequest(`${base}/${sheet.chapter.id}`, "PATCH", payload),
            );
            if (saved.ok) {
              setSheet({ kind: "none" });
              await refresh();
            }
          }}
        />
      ) : null}

      {sheet.kind === "delete" ? (
        <Sheet title="Kapitel löschen?" onClose={() => setSheet({ kind: "none" })}>
          <p className="muted" style={{ margin: "10px 0" }}>
            „{sheet.chapter.title}“ wird endgültig entfernt. Relationen der Quest werden neu berechnet.
          </p>
          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}
          <div className="row" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn grow"
              disabled={pending}
              onClick={() => setSheet({ kind: "none" })}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="btn danger grow"
              disabled={pending}
              onClick={() => void onDeleteConfirm(sheet.chapter)}
            >
              Löschen
            </button>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function ChapterEditSheet({
  mode,
  chapter,
  worldId,
  actorId,
  mentionStates,
  pending,
  error,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  chapter: QuestChapterView | null;
  worldId: string;
  actorId: string;
  mentionStates: Record<string, MentionState>;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    body: RichDoc;
    visibility: ContentVisibility;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(chapter?.title ?? "");
  const [visibility, setVisibility] = useState<ContentVisibility>(
    chapter?.visibility ?? "owner_only",
  );
  const [body, setBody] = useState<RichDoc | null>(null);
  const allowOwner = !chapter || chapter.ownerId === actorId;

  return (
    <Sheet title={mode === "create" ? "Kapitel anlegen" : "Kapitel bearbeiten"} onClose={onClose}>
      <div className="stack" style={{ marginTop: 12 }}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Titel"
          aria-label="Kapiteltitel"
          maxLength={CHAPTER_TITLE_MAX}
          required
        />
        <RichTextEditor
          key={chapter?.id ?? "new"}
          initialContent={chapter ? asRichDoc(chapter.bodyJson) : null}
          onChange={({ doc }) => setBody(doc)}
          mentions={{ worldId, canCreateArticle: true, states: mentionStates }}
          ariaLabel="Kapiteltext"
        />
        <p className="small muted">Tippe @ für Erwähnungen.</p>
        <ContentVisibilitySelect
          value={visibility}
          onChange={setVisibility}
          allowOwner={allowOwner}
          id="chapter-visibility"
        />
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="btn primary"
          disabled={pending || !title.trim()}
          onClick={() =>
            void onSave({
              title: title.trim(),
              body: body ?? (chapter ? asRichDoc(chapter.bodyJson) ?? emptyDoc() : emptyDoc()),
              visibility,
            })
          }
        >
          Speichern
        </button>
      </div>
    </Sheet>
  );
}
