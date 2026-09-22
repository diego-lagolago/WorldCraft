/** Spike T-010 — In-Process-SSE-Bus (ein Next-Prozess, lokal ausreichend). */

import type { SpikeChatRealtimeEvent } from "./types";

type Listener = (event: SpikeChatRealtimeEvent) => void;

const globalForBus = globalThis as typeof globalThis & {
  __spikeChatListeners?: Set<Listener>;
};

function listeners(): Set<Listener> {
  if (!globalForBus.__spikeChatListeners) {
    globalForBus.__spikeChatListeners = new Set();
  }
  return globalForBus.__spikeChatListeners;
}

export function publishChatEvent(event: SpikeChatRealtimeEvent): void {
  for (const listener of listeners()) {
    listener(event);
  }
}

export function subscribeChatEvents(listener: Listener): () => void {
  listeners().add(listener);
  return () => {
    listeners().delete(listener);
  };
}
