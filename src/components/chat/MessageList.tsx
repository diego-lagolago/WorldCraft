"use client";

import { useEffect, useRef } from "react";
import { formatDiceRoll } from "@/lib/chat/dice-format";
import type { ChatMessageDto, ChatThreadDto } from "@/lib/chat/types";
import { ChatMarkdown } from "./ChatMarkdown";

type Props = {
  messages: ChatMessageDto[];
  threads: ChatThreadDto[];
  actorId: string;
  staff: boolean;
  hasMore: boolean;
  onDelete: (messageId: string) => void;
  onOpenThread: (threadId: string) => void;
  onOlder: () => void;
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) return <img className="av" src={image} alt="" />;
  return <span className="av">{name.slice(0, 1).toUpperCase()}</span>;
}

export function MessageList({
  messages,
  threads,
  actorId,
  staff,
  hasMore,
  onDelete,
  onOpenThread,
  onOlder,
}: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const count = messages.length;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  return (
    <div className="msgs">
      {hasMore ? (
        <button type="button" className="btn sm older" onClick={onOlder}>
          Ältere Nachrichten
        </button>
      ) : null}
      {messages.length === 0 ? <p className="empty">Noch keine Nachrichten.</p> : null}
      {messages.map((message) => {
        const canDelete =
          !message.dice && !message.opensThreadId && (message.authorId === actorId || staff);
        const thread = message.opensThreadId
          ? threads.find((row) => row.id === message.opensThreadId)
          : undefined;
        return (
          <div key={message.id} className="msg">
            <Avatar name={message.authorName} image={message.authorImage} />
            <div className="body">
              <div className="who">
                {message.authorName}
                <span className="when">{timeLabel(message.sentAt)}</span>
              </div>
              {message.dice ? (
                <div className="dice">🎲 {formatDiceRoll(message.dice.expression, message.dice.terms)}</div>
              ) : (
                <div className="txt">
                  <ChatMarkdown text={message.body} />
                </div>
              )}
              {thread ? (
                <button type="button" className="thread-card" onClick={() => onOpenThread(thread.id)}>
                  🧵 <b>{thread.title}</b>
                  <span className="muted">· {thread.replyCount} Antworten ›</span>
                </button>
              ) : null}
            </div>
            {canDelete ? (
              <button type="button" className="del" aria-label="Löschen" onClick={() => onDelete(message.id)}>
                🗑
              </button>
            ) : null}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
