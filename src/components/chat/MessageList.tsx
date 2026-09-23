"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { formatDiceRoll } from "@/lib/chat/dice-format";
import { MESSAGE_MAX, type ChatMessageDto, type ChatThreadDto } from "@/lib/chat/types";
import { ChatMarkdown } from "./ChatMarkdown";

function DiceBubble({
  expression,
  terms,
  sum,
}: {
  expression: string;
  terms: NonNullable<ChatMessageDto["dice"]>["terms"];
  sum: number;
}) {
  const line = formatDiceRoll(expression, terms);
  const eq = line.lastIndexOf(" = ");
  const head = eq >= 0 ? line.slice(0, eq) : line;
  return (
    <div className="dice">
      🎲 {head} = <b>{sum}</b>
    </div>
  );
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
}

function editedTitle(iso: string): string {
  return new Date(iso).toLocaleString("de-AT");
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) return <img className="av" src={image} alt="" />;
  return <span className="av">{name.slice(0, 1).toUpperCase()}</span>;
}

export function messageCopyText(message: ChatMessageDto, threads: ChatThreadDto[]): string {
  if (message.opensThreadId) {
    return threads.find((row) => row.id === message.opensThreadId)?.title ?? "";
  }
  if (message.dice) {
    return formatDiceRoll(message.dice.expression, message.dice.terms);
  }
  return message.body ?? "";
}

export function messagePreviewText(message: ChatMessageDto, threads: ChatThreadDto[]): string {
  if (message.opensThreadId) {
    const title = threads.find((row) => row.id === message.opensThreadId)?.title;
    return title ? `🧵 ${title}` : "";
  }
  if (message.dice) {
    return formatDiceRoll(message.dice.expression, message.dice.terms);
  }
  return message.body ?? "";
}

export function truncatePreview(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

type Props = {
  messages: ChatMessageDto[];
  threads: ChatThreadDto[];
  actorId: string;
  staff: boolean;
  hasMore: boolean;
  onEdit: (messageId: string, body: string) => Promise<boolean>;
  onDelete: (messageId: string, event: MouseEvent) => void;
  onToast: (message: string) => void;
  onOpenThread: (threadId: string) => void;
  onOlder: () => void;
};

export function MessageList({
  messages,
  threads,
  actorId,
  staff,
  hasMore,
  onEdit,
  onDelete,
  onToast,
  onOpenThread,
  onOlder,
}: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const count = messages.length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  useEffect(() => {
    function onDocClick(event: Event) {
      if (!window.matchMedia("(hover: none)").matches) return;
      if (editingId) return;
      const target = event.target as Element | null;
      if (!target) return;
      if (
        target.closest(".msg-act") ||
        target.closest(".msg-edit") ||
        target.closest(".thread-card") ||
        target.closest("a")
      ) {
        return;
      }
      const msgEl = target.closest(".msg");
      if (msgEl && listRef.current?.contains(msgEl)) {
        const id = msgEl.getAttribute("data-id");
        setSelectedId((prev) => (prev === id ? null : id));
        return;
      }
      setSelectedId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [editingId]);

  async function saveEdit(messageId: string) {
    const text = draft.trim();
    if (!text) {
      onToast("Zum Entfernen löschen");
      return;
    }
    setSaving(true);
    const ok = await onEdit(messageId, text.slice(0, MESSAGE_MAX));
    setSaving(false);
    if (ok) setEditingId(null);
  }

  function startEdit(message: ChatMessageDto) {
    setEditingId(message.id);
    setDraft(message.body ?? "");
    setSelectedId(null);
  }

  async function copyMessage(message: ChatMessageDto) {
    try {
      await navigator.clipboard.writeText(messageCopyText(message, threads));
      onToast("Kopiert");
    } catch {
      onToast("Kopieren nicht möglich");
    }
  }

  function onEditKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, messageId: string) {
    if (event.key === "Escape") {
      event.preventDefault();
      setEditingId(null);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void saveEdit(messageId);
    }
  }

  return (
    <div className="msgs" ref={listRef}>
      {hasMore ? (
        <button type="button" className="btn sm older" onClick={onOlder}>
          Ältere Nachrichten
        </button>
      ) : null}
      {messages.length === 0 ? <p className="empty">Noch keine Nachrichten.</p> : null}
      {messages.map((message) => {
        const mine = message.authorId === actorId;
        const isOpener = Boolean(message.opensThreadId);
        const canEdit = mine && !message.dice && !isOpener && message.body != null;
        const canDelete =
          !isOpener && (message.authorId === actorId || staff) && (!message.dice || staff);
        const thread = message.opensThreadId
          ? threads.find((row) => row.id === message.opensThreadId)
          : undefined;
        const editing = editingId === message.id;
        const selected = selectedId === message.id;
        const classes = ["msg", mine ? "mine" : "", selected ? "selected" : ""].filter(Boolean).join(" ");

        return (
          <div key={message.id} className={classes} data-id={message.id} tabIndex={0}>
            <Avatar name={message.authorName} image={message.authorImage} />
            <div className="body">
              <div className="who">
                {message.authorName}
                <span className="when">
                  {timeLabel(message.sentAt)}
                  {message.editedAt ? (
                    <span className="edited" title={editedTitle(message.editedAt)}>
                      (bearbeitet)
                    </span>
                  ) : null}
                </span>
              </div>
              {editing ? (
                <div className="msg-edit stack">
                  <textarea
                    className="in msg-edit-in"
                    rows={3}
                    value={draft}
                    maxLength={MESSAGE_MAX}
                    aria-label="Nachricht bearbeiten"
                    autoFocus
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => onEditKeyDown(event, message.id)}
                  />
                  <div className="row">
                    <button
                      type="button"
                      className="btn sm primary"
                      disabled={saving}
                      onClick={() => void saveEdit(message.id)}
                    >
                      Speichern
                    </button>
                    <button type="button" className="btn sm" disabled={saving} onClick={() => setEditingId(null)}>
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {message.dice ? (
                    <DiceBubble
                      expression={message.dice.expression}
                      terms={message.dice.terms}
                      sum={message.dice.sum}
                    />
                  ) : !isOpener && message.body != null ? (
                    <div className="txt">
                      <ChatMarkdown text={message.body} />
                    </div>
                  ) : null}
                  {thread ? (
                    <button type="button" className="thread-card" onClick={() => onOpenThread(thread.id)}>
                      🧵 <b>{thread.title}</b>
                      <span className="muted">· {thread.replyCount} Antworten ›</span>
                    </button>
                  ) : null}
                </>
              )}
            </div>
            {!editing ? (
              <div className="msg-actions">
                {canEdit ? (
                  <button
                    type="button"
                    className="msg-act"
                    aria-label="Bearbeiten"
                    onClick={() => startEdit(message)}
                  >
                    ✏️
                  </button>
                ) : null}
                <button
                  type="button"
                  className="msg-act"
                  aria-label="Kopieren"
                  onClick={() => void copyMessage(message)}
                >
                  📋
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    className="msg-act"
                    aria-label="Löschen"
                    onClick={(event) => onDelete(message.id, event)}
                  >
                    🗑
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
