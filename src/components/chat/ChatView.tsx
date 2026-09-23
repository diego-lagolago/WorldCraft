"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { messagePreviewText, truncatePreview } from "@/lib/chat/message-text";
import type { ChatState } from "@/lib/chat/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { confirmMode } from "@/components/ui/confirm-dialog";
import { ChannelList } from "./ChannelList";
import {
  ChannelSheet,
  NewChannelSheet,
  RenameThreadSheet,
  ThreadSheet,
} from "./ChatSheets";
import { ComposerBar } from "./ComposerBar";
import { DiceSheet } from "./DiceSheet";
import { MessageList } from "./MessageList";
import { Toast } from "./Toast";
import { useChatRealtime } from "./use-chat-realtime";
import { useChatStream } from "./use-chat-stream";

export function ChatView({
  worldId,
  initial,
  initialExpanded,
  focusStream,
}: {
  worldId: string;
  initial: ChatState;
  initialExpanded: Record<string, boolean>;
  focusStream: boolean;
}) {
  const router = useRouter();
  const [diceOpen, setDiceOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [renameThreadId, setRenameThreadId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const stream = useChatStream(worldId, initial);
  useChatRealtime(worldId, stream.applyEvent, () => {
    void stream.reload();
  });

  useEffect(() => {
    const shell = document.querySelector(".shell");
    if (!shell) return;
    const cover = focusStream && window.matchMedia("(max-width: 767px)").matches;
    shell.classList.toggle("chat-composer-open", cover);
    return () => shell.classList.remove("chat-composer-open");
  }, [focusStream]);

  function openChannel(nextChannel: string, nextThread?: string) {
    const query = new URLSearchParams({ channel: nextChannel });
    if (nextThread) query.set("thread", nextThread);
    router.push(`/w/${worldId}/chat?${query}`);
  }

  function handleDelete(messageId: string, event: MouseEvent) {
    if (confirmMode(event) === "immediate") {
      void stream.deleteMessage(messageId);
      return;
    }
    setPendingDeleteId(messageId);
  }

  const state = stream.state;
  const managed = state?.channels.find((channel) => channel.id === manageId) ?? null;
  const managedIndex = managed ? state!.channels.findIndex((channel) => channel.id === managed.id) : -1;
  const renameThread = state?.threads.find((thread) => thread.id === renameThreadId) ?? null;
  const pendingDelete = state?.messages.find((message) => message.id === pendingDeleteId) ?? null;
  const toastMessage = toast ?? stream.notice;
  const heading = state?.thread
    ? `🧵 ${state.thread.title}`
    : state?.channel
      ? `# ${state.channel.name}`
      : "Chat";

  return (
    <div className={focusStream ? "chat open" : "chat"}>
      <ChannelList
        worldId={worldId}
        initialExpanded={initialExpanded}
        channels={state?.channels ?? []}
        threads={state?.threads ?? []}
        archived={state?.archivedChannels ?? []}
        currentChannelId={state?.channel?.id ?? null}
        currentThreadId={state?.thread?.id ?? null}
        actorId={state?.actorId ?? ""}
        staff={state?.staff ?? false}
        onOpenChannel={(id) => openChannel(id)}
        onOpenThread={(channel, thread) => openChannel(channel, thread)}
        onManage={setManageId}
        onManageThread={setRenameThreadId}
        onCreate={() => setNewChannelOpen(true)}
        onRestore={(id) => void stream.restoreChannel(id)}
      />
      <section className="stream" aria-label={heading}>
          <div className="stream-h">
            <button
              type="button"
              className="btn icon sm stream-back"
              aria-label="Zurück"
              onClick={() => {
                if (state?.thread && state.channel) openChannel(state.channel.id);
                else router.push(`/w/${worldId}/chat`);
              }}
            >
              ‹
            </button>
            <div className="grow">
              <b>{heading}</b>
              {state?.thread && state.channel ? <div className="kind">in #{state.channel.name}</div> : null}
            </div>
          </div>
          {stream.error ? <p className="chat-error">{stream.error}</p> : null}
          {stream.loading && !state ? <p className="empty">Chat wird geladen …</p> : null}
          {state?.channel ? (
            <>
              <MessageList
                messages={state.messages}
                threads={state.threads}
                actorId={state.actorId}
                staff={state.staff}
                hasMore={state.hasMore}
                onEdit={stream.editMessage}
                onDelete={handleDelete}
                onToast={setToast}
                onOpenThread={(id) => openChannel(state.channel!.id, id)}
                onOlder={() => void stream.loadOlder()}
              />
              <ComposerBar
                disabled={false}
                inThread={Boolean(state.thread)}
                placeholder={state.thread ? `Nachricht an 🧵 ${state.thread.title}` : `Nachricht an ${heading}`}
                onSend={stream.sendText}
                onStartThread={() => setThreadOpen(true)}
                onOpenDice={() => setDiceOpen(true)}
              />
            </>
          ) : state && !stream.loading ? (
            <p className="empty">
              {state.staff
                ? "Noch kein aktiver Kanal. Lege einen an oder stelle einen archivierten wieder her."
                : "Noch kein aktiver Kanal. Die Spielleitung kann einen anlegen."}
            </p>
          ) : null}
      </section>
      {toastMessage ? (
        <Toast
          message={toastMessage}
          onDone={() => {
            if (toast) setToast(null);
            else stream.clearNotice();
          }}
        />
      ) : null}
      {pendingDelete && state ? (
        <ConfirmDialog
          title="Nachricht löschen?"
          preview={truncatePreview(messagePreviewText(pendingDelete, state.threads))}
          confirmLabel="Löschen"
          hint="Tipp: Mit gedrückter Umschalttaste ohne Nachfrage löschen."
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => {
            const id = pendingDelete.id;
            setPendingDeleteId(null);
            void stream.deleteMessage(id);
          }}
        />
      ) : null}
      {diceOpen && state ? (
        <DiceSheet
          postToChat={state.dicePostToChat}
          onPostToChat={(next) => void stream.setPostToChat(next)}
          onRoll={(input) => stream.roll(input)}
          onClose={() => setDiceOpen(false)}
        />
      ) : null}
      {threadOpen ? (
        <ThreadSheet
          onClose={() => setThreadOpen(false)}
          onSubmit={(title) => {
            void stream.startThread(title).then((id) => {
              setThreadOpen(false);
              if (id && state?.channel) openChannel(state.channel.id, id);
            });
          }}
        />
      ) : null}
      {newChannelOpen ? (
        <NewChannelSheet
          onClose={() => setNewChannelOpen(false)}
          onSubmit={(name) => {
            void stream.createChannel(name).then((ok) => {
              if (ok) setNewChannelOpen(false);
            });
          }}
        />
      ) : null}
      {renameThread ? (
        <RenameThreadSheet
          title={renameThread.title}
          onClose={() => setRenameThreadId(null)}
          onSubmit={(title) => {
            void stream.renameThread(renameThread.id, title).then((ok) => {
              if (ok) setRenameThreadId(null);
            });
          }}
        />
      ) : null}
      {managed && state ? (
        <ChannelSheet
          name={managed.name}
          canArchive={state.channels.length > 1}
          canMoveUp={managedIndex > 0}
          canMoveDown={managedIndex >= 0 && managedIndex < state.channels.length - 1}
          onClose={() => setManageId(null)}
          onRename={(name) => {
            void stream.renameChannel(managed.id, name).then((ok) => {
              if (ok) setManageId(null);
            });
          }}
          onArchive={() => {
            void stream.archiveChannel(managed.id).then((ok) => {
              if (!ok) return;
              setManageId(null);
              if (state.channel?.id === managed.id) router.push(`/w/${worldId}/chat`);
            });
          }}
          onMove={(direction) => {
            void stream.moveChannel(managed.id, direction);
            setManageId(null);
          }}
        />
      ) : null}
    </div>
  );
}
