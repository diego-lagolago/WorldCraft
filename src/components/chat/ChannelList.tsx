"use client";

import { useState, type ReactNode } from "react";
import type { ChatChannelDto, ChatThreadDto } from "@/lib/chat/types";
import { readExpanded, writeExpanded } from "@/lib/client/chat-expanded";

type Props = {
  channels: ChatChannelDto[];
  threads: ChatThreadDto[];
  archived: ChatChannelDto[];
  currentChannelId: string | null;
  currentThreadId: string | null;
  actorId: string;
  staff: boolean;
  onOpenChannel: (channelId: string) => void;
  onOpenThread: (channelId: string, threadId: string) => void;
  onManage: (channelId: string) => void;
  onManageThread: (threadId: string) => void;
  onCreate: () => void;
  onRestore: (channelId: string) => void;
};

export function ChannelList({
  channels,
  threads,
  archived,
  currentChannelId,
  currentThreadId,
  actorId,
  staff,
  onOpenChannel,
  onOpenThread,
  onManage,
  onManageThread,
  onCreate,
  onRestore,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => readExpanded());
  const threadChannelId = threads.find((row) => row.id === currentThreadId)?.channelId ?? null;

  function toggleExpanded(channelId: string, currentlyOpen: boolean) {
    setExpanded((prev) => {
      const next = { ...prev, [channelId]: !currentlyOpen };
      writeExpanded(next);
      return next;
    });
  }

  return (
    <div className="chan-list">
      <div className="row chan-head">
        <b>Kanäle</b>
        {staff ? (
          <button type="button" className="btn sm" onClick={onCreate}>
            + Kanal
          </button>
        ) : null}
      </div>
      {channels.map((channel) => {
        const channelThreads = threads.filter((thread) => thread.channelId === channel.id);
        const open = expanded[channel.id] ?? channel.id === threadChannelId;
        const active = channel.id === currentChannelId && !currentThreadId;
        return (
          <div key={channel.id}>
            <div className={active ? "chan on" : "chan"}>
              {channelThreads.length > 0 ? (
                <button
                  type="button"
                  className={open ? "chev open" : "chev"}
                  aria-expanded={open}
                  aria-label={open ? "Threads zuklappen" : "Threads aufklappen"}
                  onClick={() => toggleExpanded(channel.id, open)}
                >
                  ▶
                </button>
              ) : (
                <span className="chev-sp" />
              )}
              <button type="button" className="chan-name" onClick={() => onOpenChannel(channel.id)}>
                <span className="hash">#</span>
                {channel.name}
                {channelThreads.length > 0 && !open ? <span className="badge">{channelThreads.length}</span> : null}
              </button>
              {staff ? (
                <button
                  type="button"
                  className="more"
                  aria-label="Kanal verwalten"
                  onClick={() => onManage(channel.id)}
                >
                  ⋯
                </button>
              ) : null}
            </div>
            {open
              ? channelThreads.map((thread) => {
                  const canManageThread = thread.createdBy === actorId || staff;
                  return (
                    <div key={thread.id} className={thread.id === currentThreadId ? "thr on" : "thr"}>
                      <button
                        type="button"
                        className="thr-name"
                        onClick={() => onOpenThread(channel.id, thread.id)}
                      >
                        🧵 {thread.title}
                      </button>
                      {canManageThread ? (
                        <button
                          type="button"
                          className="more"
                          aria-label="Thread verwalten"
                          onClick={() => onManageThread(thread.id)}
                        >
                          ⋯
                        </button>
                      ) : null}
                    </div>
                  );
                })
              : null}
          </div>
        );
      })}
      {staff ? (
        <details className="archive">
          <summary>Archivierte Kanäle ({archived.length})</summary>
          {archived.map((channel) => (
            <div key={channel.id} className="row archive-row">
              <span className="muted"># {channel.name}</span>
              <button type="button" className="btn sm" onClick={() => onRestore(channel.id)}>
                Wiederherstellen
              </button>
            </div>
          ))}
        </details>
      ) : null}
    </div>
  );
}

export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="sheet-bg" role="presentation" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grab" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
