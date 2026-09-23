"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client/api-fetch";
import { withEditedMessage, withMessage, withThread } from "@/lib/chat/stream-state";
import type { RollPayload, RollResult } from "@/lib/chat/dice-draft";
import type { ChatMessageDto, ChatState, ChatThreadDto } from "@/lib/chat/types";
import type { WorldRealtimeEvent } from "@/lib/realtime/events";

type PostResponse =
  | { message: ChatMessageDto }
  | { posted: true; message: ChatMessageDto }
  | { posted: false; dice: { text: string; sum: number } };

export function useChatStream(worldId: string, initial: ChatState) {
  const [state, setState] = useState<ChatState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const stateRef = useRef(state);
  const postToChatSeqRef = useRef(0);
  const postToChatPendingRef = useRef(Promise.resolve());
  const dicePostToChatRef = useRef(initial.dicePostToChat);
  useEffect(() => {
    stateRef.current = state;
    if (state) dicePostToChatRef.current = state.dicePostToChat;
  }, [state]);

  const reload = useCallback(async () => {
    const current = stateRef.current;
    const params = new URLSearchParams();
    if (current.channel) params.set("channelId", current.channel.id);
    if (current.thread) params.set("threadId", current.thread.id);
    const query = params.toString();
    setLoading(true);
    const res = await apiFetch<ChatState>(`/api/worlds/${worldId}/chat${query ? `?${query}` : ""}`);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setState(res.data);
  }, [worldId]);

  const applyEvent = useCallback((event: WorldRealtimeEvent) => {
    if (event.type === "chat.channels") {
      void reload();
      return;
    }
    setState((prev) => {
      if (!prev) return prev;
      if (event.type === "chat.message") return withMessage(prev, event.message);
      if (event.type === "chat.message.edited") return withEditedMessage(prev, event.message);
      if (event.type === "chat.thread") return withThread(prev, event.thread);
      if (event.type === "chat.message.deleted") {
        return { ...prev, messages: prev.messages.filter((row) => row.id !== event.messageId) };
      }
      return prev;
    });
  }, [reload]);

  async function failAndReload(message: string) {
    setError(message);
    await reload();
  }

  async function sendText(body: string): Promise<boolean> {
    if (!state?.channel) return false;
    setNotice(null);
    const res = await apiFetch<PostResponse>(`/api/worlds/${worldId}/chat`, {
      method: "POST",
      body: JSON.stringify({
        body,
        channelId: state.channel.id,
        threadId: state.thread?.id ?? null,
      }),
    });
    if (!res.ok) {
      await failAndReload(res.error);
      return false;
    }
    setError(null);
    if ("posted" in res.data && res.data.posted === false) {
      setNotice(res.data.dice.text);
      return true;
    }
    const message = res.data.message;
    setState((prev) => (prev ? withMessage(prev, message) : prev));
    return true;
  }

  async function roll(input: RollPayload): Promise<RollResult> {
    if (!state?.channel) {
      return { ok: false, error: "Kein Kanal geladen." };
    }
    // Server reads dicePostToChat from DB — wait for any in-flight setting PATCH.
    await postToChatPendingRef.current;
    const body: Record<string, unknown> = {
      kind: "roll",
      terms: input.terms,
      channelId: state.channel.id,
      threadId: state.thread?.id ?? null,
    };
    if (input.modifier !== 0) body.modifier = input.modifier;
    const res = await apiFetch<PostResponse>(`/api/worlds/${worldId}/chat`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Sheet shows the error; reload only when channel/thread/rights may have changed.
      // status 0 = network (no HTTP); 400 = validation — neither reloads.
      if (res.status >= 401) {
        await reload();
      }
      return { ok: false, error: res.error };
    }
    setError(null);
    if ("posted" in res.data && res.data.posted === false) {
      return { ok: true, posted: false, text: res.data.dice.text, sum: res.data.dice.sum };
    }
    if ("message" in res.data) {
      const message = res.data.message;
      setState((prev) => (prev ? withMessage(prev, message) : prev));
    }
    return { ok: true, posted: true };
  }

  async function setPostToChat(
    next: boolean,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const previous = dicePostToChatRef.current;
    const seq = ++postToChatSeqRef.current;
    dicePostToChatRef.current = next;
    setState((prev) => (prev ? { ...prev, dicePostToChat: next } : prev));

    const task = (async (): Promise<{ ok: true } | { ok: false; error: string }> => {
      const res = await apiFetch<{ dicePostToChat: boolean }>(
        `/api/worlds/${worldId}/chat/settings`,
        {
          method: "PATCH",
          body: JSON.stringify({ dicePostToChat: next }),
        },
      );
      if (!res.ok) {
        if (seq === postToChatSeqRef.current) {
          dicePostToChatRef.current = previous;
          setState((prev) => (prev ? { ...prev, dicePostToChat: previous } : prev));
        }
        return { ok: false, error: res.error };
      }
      // Keep the optimistic value; do not overwrite from the response.
      return { ok: true };
    })();

    postToChatPendingRef.current = Promise.all([
      postToChatPendingRef.current,
      task.then(
        () => undefined,
        () => undefined,
      ),
    ]).then(() => undefined);

    return task;
  }

  async function deleteMessage(messageId: string): Promise<void> {
    const res = await apiFetch<{ messageId: string }>(
      `/api/worlds/${worldId}/chat/messages/${messageId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      await failAndReload(res.error);
      return;
    }
    setState((prev) =>
      prev ? { ...prev, messages: prev.messages.filter((row) => row.id !== messageId) } : prev,
    );
  }

  async function editMessage(messageId: string, body: string): Promise<boolean> {
    const res = await apiFetch<{ message: ChatMessageDto }>(
      `/api/worlds/${worldId}/chat/messages/${messageId}`,
      { method: "PATCH", body: JSON.stringify({ body }) },
    );
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError(null);
    setState((prev) => (prev ? withEditedMessage(prev, res.data.message) : prev));
    return true;
  }

  async function createChannel(name: string): Promise<boolean> {
    const res = await apiFetch(`/api/worlds/${worldId}/chat/channels`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError(null);
    await reload();
    return true;
  }

  async function renameChannel(channelIdToRename: string, name: string): Promise<boolean> {
    const res = await apiFetch(`/api/worlds/${worldId}/chat/channels/${channelIdToRename}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "rename", name }),
    });
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError(null);
    await reload();
    return true;
  }

  async function renameThread(threadId: string, title: string): Promise<boolean> {
    const res = await apiFetch<{ thread: ChatThreadDto }>(
      `/api/worlds/${worldId}/chat/threads/${threadId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ title }),
      },
    );
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError(null);
    setState((prev) => (prev ? withThread(prev, res.data.thread) : prev));
    return true;
  }

  async function archiveChannel(channelIdToArchive: string): Promise<boolean> {
    const res = await apiFetch(`/api/worlds/${worldId}/chat/channels/${channelIdToArchive}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "archive" }),
    });
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError(null);
    await reload();
    return true;
  }

  async function restoreChannel(channelIdToRestore: string): Promise<boolean> {
    const res = await apiFetch(`/api/worlds/${worldId}/chat/channels/${channelIdToRestore}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "restore" }),
    });
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError(null);
    await reload();
    return true;
  }

  async function moveChannel(channelToMove: string, direction: -1 | 1): Promise<void> {
    if (!state) return;
    const ids = state.channels.map((channel) => channel.id);
    const index = ids.indexOf(channelToMove);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) return;
    const swapped = [...ids];
    const current = swapped[index];
    const target = swapped[next];
    if (!current || !target) return;
    swapped[index] = target;
    swapped[next] = current;
    const res = await apiFetch(`/api/worlds/${worldId}/chat/channels`, {
      method: "PUT",
      body: JSON.stringify({ channelIds: swapped }),
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    await reload();
  }

  async function startThread(title: string): Promise<string | null> {
    if (!state?.channel || state.thread) return null;
    const res = await apiFetch<{ thread: { id: string }; message: ChatMessageDto }>(
      `/api/worlds/${worldId}/chat/threads`,
      {
        method: "POST",
        body: JSON.stringify({ channelId: state.channel.id, title }),
      },
    );
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    setError(null);
    await reload();
    return res.data.thread.id;
  }

  async function loadOlder(): Promise<void> {
    if (!state?.channel || !state.hasMore || state.messages.length === 0) return;
    const first = state.messages[0];
    if (!first) return;
    const params = new URLSearchParams({
      channelId: state.channel.id,
      before: first.id,
    });
    if (state.thread) params.set("threadId", state.thread.id);
    const res = await apiFetch<{ messages: ChatMessageDto[]; hasMore: boolean }>(
      `/api/worlds/${worldId}/chat?${params}`,
    );
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setState((prev) => {
      if (!prev) return prev;
      const seen = new Set(prev.messages.map((row) => row.id));
      const older = res.data.messages.filter((row) => !seen.has(row.id));
      return { ...prev, messages: [...older, ...prev.messages], hasMore: res.data.hasMore };
    });
  }

  return {
    state,
    error,
    notice,
    loading,
    reload,
    applyEvent,
    sendText,
    roll,
    setPostToChat,
    deleteMessage,
    editMessage,
    createChannel,
    renameChannel,
    renameThread,
    archiveChannel,
    restoreChannel,
    moveChannel,
    startThread,
    loadOlder,
    clearNotice: () => setNotice(null),
  };
}
